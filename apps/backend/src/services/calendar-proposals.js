import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CalendarError, googleEvent } from './google-calendar.js';

const day = z.string().date().refine(v => v >= '2000-01-01' && v <= '2099-12-31');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const proposalSchema = z.object({
  title: z.string().trim().min(1).max(255),
  location: z.string().trim().max(255).default(''),
  description: z.string().trim().max(5000).default(''),
  slots: z.array(z.object({date:day, time, endDate:day, endTime:time}).strict()).min(1).max(5)
}).strict();
export const actionSchema = z.object({
  version:z.number().int().positive(), action:z.enum(['approve','decline','revise','withdraw','cancel','retry']),
  slot:z.number().int().min(0).max(4).optional(),
  body:proposalSchema.optional(), revisionKey:z.string().uuid().optional()
}).strict().refine(v => (v.action === 'approve' ? v.slot !== undefined : v.slot === undefined)
  && (v.action === 'revise' ? v.body !== undefined && v.revisionKey !== undefined : v.body === undefined && v.revisionKey === undefined));
const fail = (code, status=409) => { throw new CalendarError(status,code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function slotEvent(proposal, index) {
  const { title, location, description } = proposal.body;
  return { title, location, description, ...proposal.body.slots[index], allDay:false };
}
function validateSlots(proposal) {
  const instants=proposal.body.slots.map((_,i)=>googleEvent(slotEvent(proposal,i)));
  if(instants.some(e=>Date.parse(e.start.dateTime)<=Date.now())) fail('PROPOSAL_PAST',400);
  if(new Set(instants.map(e=>e.start.dateTime+'/'+e.end.dateTime)).size!==instants.length) fail('PROPOSAL_DUPLICATE',400);
}

// A single store operation serializes all mutations for this proposal. The publishing
// state is committed BEFORE the Google call: a crash can only retry the frozen choice.
export class CalendarProposals {
  constructor(store, calendar) { this.store=store; this.calendar=calendar; }
  async list(familyId) { return {proposals:await this.store.listCalendarProposals(familyId)}; }
  async create(body, familyId, actor, id) {
    const fingerprint=hash({body,actor});
    return this.store.calendarProposalTransaction(familyId,id,async(current,members)=>{
      if(current) {
        if(current.fingerprint!==fingerprint) fail('PROPOSAL_KEY_REUSED');
        return current;
      }
      if(members.length!==2 || !members.includes(actor)) fail('PROPOSAL_MEMBERS');
      const proposal={id,body,fingerprint,members:[...members].sort(),creator:actor,
        status:'pending',version:1,votes:{},selected:null,eventId:null,createdAt:new Date().toISOString()};
      validateSlots(proposal);
      return proposal;
    });
  }
  verifyMembers(p,members,actor) {
    if(!p.members.includes(actor) || JSON.stringify([...members].sort())!==JSON.stringify(p.members)) fail('PROPOSAL_MEMBERS');
  }
  async act(familyId,id,actor,action) {
    const saved=await this.store.calendarProposalTransaction(familyId,id,async(p,members)=>{
      if(!p) fail('PROPOSAL_NOT_FOUND',404);
      this.verifyMembers(p,members,actor);
      // A lost revision response must not clear votes cast since that revision.
      if(action.action==='revise' && p.revisionKey===action.revisionKey) {
        if(p.revisionFingerprint!==hash({body:action.body,actor})) fail('PROPOSAL_KEY_REUSED');
        return p;
      }
      if(action.action==='retry') {
        if(!['publishing','confirmed'].includes(p.status)) fail('PROPOSAL_STATE');
        return p;
      }
      // Retrying the same approval after a lost response is safe, even if publication started.
      if(action.action==='approve' && p.votes[actor]===action.slot && ['pending','publishing','confirmed'].includes(p.status)) return p;
      if(p.status!=='pending') fail('PROPOSAL_STATE');
      if(p.version!==action.version) fail('PROPOSAL_VERSION');
      if(action.action==='decline') {
        if(actor===p.creator) fail('PROPOSAL_STATE');
        p.votes[actor]='none';
      }
      if(action.action==='revise') {
        const votes=p.members.map(member=>p.votes[member]);
        if(!votes.includes('none') && !(votes.every(Number.isInteger) && votes[0]!==votes[1])) fail('PROPOSAL_STATE');
        p.body=action.body; validateSlots(p);
        p.creator=actor; p.votes={}; p.selected=null;
        p.revisionKey=action.revisionKey; p.revisionFingerprint=hash({body:action.body,actor});
        p.revisedAt=new Date().toISOString();
      }
      if(action.action==='cancel') p.status='cancelled';
      if(action.action==='withdraw') delete p.votes[actor];
      if(action.action==='approve') {
        if(!p.body.slots[action.slot]) fail('VALIDATION_ERROR',400);
        if(Date.parse(googleEvent(slotEvent(p,action.slot)).start.dateTime)<=Date.now()) fail('PROPOSAL_PAST',400);
        p.votes[actor]=action.slot;
        if(p.members.every(member=>p.votes[member]===action.slot)) {
          p.status='publishing'; p.selected=action.slot;
        }
      }
      p.version++; return p;
    });
    if(saved.status!=='publishing') return saved;
    return this.store.calendarProposalTransaction(familyId,id,async(p,members)=>{
      this.verifyMembers(p,members,actor);
      if(p.status!=='publishing') return p;
      // A stable actor + UUID is used for all retries, including from the other member.
      // Do not reset this state on a timeout: Google may already have saved the event.
      const result=await this.calendar.create(slotEvent(p,p.selected),'proposal:'+p.creator,p.id);
      p.status='confirmed'; p.eventId=result.event.id; p.version++;
      p.confirmedAt=new Date().toISOString(); return p;
    });
  }
}
