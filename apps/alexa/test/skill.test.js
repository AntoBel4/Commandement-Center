import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkill} from '../src/handler.js';
import {buildAlexaApp} from '../src/app.js';
import {fixture, token, family, alice, outsider} from '../../backend/test/fixtures.js';

const skillId = 'amzn1.ask.skill.11111111-1111-4111-8111-111111111111';
const config = {skillId, familyId: family, apiBaseUrl: 'http://api:3000'};
function envelope({accessToken = 'test-token', name = 'du lait', id = 'request-1', type = 'IntentRequest', intent = 'AjouterCourse', details = true, attributes = {}} = {}) {
  return {version:'1.0', context:{System:{application:{applicationId:skillId}, user:{userId:'test-user', accessToken}}},
    session:{new:false, sessionId:'test-session', attributes, application:{applicationId:skillId}, user:{userId:'test-user'}},
    request:{type, requestId:id, timestamp:new Date().toISOString(), locale:'fr-FR',
      intent:{name:intent, confirmationStatus:'NONE', slots:{article:{name:'article',value:name},
        ...(details ? {quantite:{name:'quantite',value:'2'},unite:{name:'unite',value:'paquets'},rayon:{name:'rayon',value:'Épicerie'}} : {})}}}};
}
const speech = r => r.response.outputSpeech?.ssml ?? '';
test('linked token adds through the real authenticated API; duplicate delivery remains one article', async t => {
  const api = await fixture(); t.after(()=>api.close());
  const fetchImpl = async (url, options) => {
    const r = await api.inject({method:options.method,url:new URL(url).pathname,headers:options.headers,payload:options.body});
    return new Response(r.body,{status:r.statusCode});
  };
  const skill = createSkill({...config,fetchImpl});
  const e = envelope({accessToken:await token(alice,{azp:'commandement-alexa'}),name:'sel et poivre'});
  assert.match(speech(await skill.invoke(e)),/J’ai ajouté sel et poivre/);
  assert.match(speech(await skill.invoke(e)),/J’ai ajouté/);
  const items = await api.store.listGroceries({familyId:family});
  assert.equal(items.length,1); assert.equal(items[0].source,'alexa'); assert.equal(items[0].name,'sel et poivre');
  assert.equal(items[0].quantity,2); assert.equal(items[0].unit,'paquet'); assert.equal(items[0].category,'Épicerie');
  const rejected = await skill.invoke(envelope({accessToken:await token(outsider,{azp:'commandement-alexa'}),id:'outsider'}));
  assert.match(speech(rejected),/n’est pas autorisé/);
  assert.equal((await api.store.listGroceries({familyId:family})).length,1);
});
test('absent token and incomplete article never write',async()=>{
  let calls=0; const skill=createSkill({...config,fetchImpl:async()=>{calls++; throw Error('not expected');}});
  assert.equal((await skill.invoke(envelope({accessToken:''}))).response.card.type,'LinkAccount');
  assert.match(speech(await skill.invoke(envelope({name:''}))),/pas identifié/);
  assert.match(speech(await skill.invoke(envelope({name:'x'.repeat(256)}))),/pas identifié/);
  assert.equal(calls,0);
});
test('lost acknowledgement, invalid body and backend errors never announce success',async()=>{
  for(const result of [new Response('{}',{status:201}),new Response('{}',{status:500}),null]) {
    const skill=createSkill({...config,fetchImpl:async()=>{if(!result)throw Error('timeout with token');return result;}});
    const output=speech(await skill.invoke(envelope()));
    assert.match(output,/Vérifiez la liste/);assert.doesNotMatch(output,/J’ai ajouté|test-token|timeout/);
  }
  const skill=createSkill({...config,fetchImpl:async()=>new Response('{}',{status:401})});
  assert.equal((await skill.invoke(envelope())).response.card.type,'LinkAccount');
});
test('speech escapes article markup; help/stop/calendar never call backend',async()=>{
  const name='<audio src="evil"/> & pain';
  const skill=createSkill({...config,fetchImpl:async(_url,options)=>Response.json({success:true,data:{count:1,items:[{id:'saved',...JSON.parse(options.body).items[0]}]}})});
  const output=speech(await skill.invoke(envelope({name})));
  assert.ok(output.includes('&lt;audio'));assert.ok(!output.includes('<audio'));
  const noWrite=createSkill({...config,fetchImpl:async()=>{throw Error('must not write');}});
  assert.match(speech(await noWrite.invoke(envelope({type:'LaunchRequest'}))),/Bienvenue/);
  assert.equal((await noWrite.invoke(envelope({intent:'AMAZON.StopIntent'}))).response.shouldEndSession,true);
  assert.match(speech(await noWrite.invoke(envelope({intent:'AjouterEvenement'}))),/après le raccordement/);
});

function turn(previous, values = {}, options = {}) {
  const e = envelope({details:false, id:options.id ?? 'follow-up', attributes:previous.sessionAttributes, ...options});
  e.request.intent = structuredClone(previous.response.directives?.find(d=>d.type==='Dialog.ElicitSlot')?.updatedIntent ?? e.request.intent);
  for (const [name,value] of Object.entries(values)) e.request.intent.slots[name] = {name,value};
  return e;
}
test('a complete phrase writes once through the API with every spoken detail and no elicitation', async t => {
  const api=await fixture();t.after(()=>api.close());
  const skill=createSkill({...config,fetchImpl:async(url,options)=>{
    const r=await api.inject({method:options.method,url:new URL(url).pathname,headers:options.headers,payload:options.body});
    return new Response(r.body,{status:r.statusCode});
  }});
  const request=envelope({accessToken:await token(alice,{azp:'commandement-alexa'}),
    name:'deux paquets de pâtes au rayon épicerie',details:false});
  for(let attempt=0;attempt<2;attempt++) {
    const result=await skill.invoke(request);
    assert.match(speech(result),/J’ai ajouté pâtes, quantité 2, unité paquet, rayon Épicerie/);
    assert.equal(result.response.directives,undefined);assert.deepEqual(result.sessionAttributes,{});
  }
  const items=await api.store.listGroceries({familyId:family});assert.equal(items.length,1);
  assert.deepEqual([items[0].name,items[0].quantity,items[0].unit,items[0].category],['pâtes',2,'paquet','Épicerie']);
});

test('partial phrases elicit only missing details, preserve them across turns and allow cancellation',async()=>{
  const writes=[];const skill=createSkill({...config,fetchImpl:async(_u,o)=>{
    writes.push(JSON.parse(o.body).items[0]);return Response.json({success:true,data:{count:1,items:[{id:'saved',...writes.at(-1)}]}});
  }});
  const start=await skill.invoke(envelope({name:'deux bouteilles de lait',details:false}));
  assert.equal(start.response.directives[0].slotToElicit,'rayon');assert.equal(writes.length,0);
  const saved=await skill.invoke(turn(start,{rayon:'frais'}));
  assert.match(speech(saved),/J’ai ajouté lait/);
  assert.deepEqual(writes[0],{name:'lait',quantity:2,unit:'bouteille',category:'Frais',source:'alexa'});
  const other=await skill.invoke(envelope({name:'pain au rayon boulangerie',details:false,id:'next',attributes:saved.sessionAttributes}));
  assert.equal(other.response.directives[0].slotToElicit,'quantite');
  const skipped=await skill.invoke(envelope({intent:'PasserPrecision',details:false,attributes:other.sessionAttributes}));
  assert.equal(skipped.response.directives[0].slotToElicit,'unite');
  assert.equal(skipped.sessionAttributes.groceryDraft.rayon,'Boulangerie');
  const cancelled=await skill.invoke(envelope({intent:'AMAZON.CancelIntent',attributes:skipped.sessionAttributes}));
  assert.match(speech(cancelled),/Ajout annulé/);assert.equal(writes.length,1);
  const explicit=await skill.invoke(envelope({name:'trois kilos de pâtes au rayon frais'}));
  assert.match(speech(explicit),/quantité 2, unité paquet, rayon Épicerie/);
});
test('guided dialogue collects missing fields, accepts quantity plus unit together and writes only at the end',async()=>{
  const writes=[];const skill=createSkill({...config,fetchImpl:async(_u,o)=>{writes.push(o);return Response.json({success:true,data:{count:1,items:[{id:'saved',...JSON.parse(o.body).items[0]}]}});}});
  const start=await skill.invoke(envelope({name:'pommes',details:false}));
  assert.equal(start.response.directives[0].slotToElicit,'quantite');assert.equal(writes.length,0);
  assert.ok(!JSON.stringify(start.sessionAttributes).includes('test-token'));
  const qty=await skill.invoke(turn(start,{quantite:'1,5',unite:'kilos'}));
  assert.equal(qty.response.directives[0].slotToElicit,'rayon');assert.equal(writes.length,0);
  const finish=turn(qty,{rayon:'fruits et légumes'},{id:'finish'});
  const saved=await skill.invoke(finish);
  assert.match(speech(saved),/quantité 1,5.*unité kg.*Fruits &amp; légumes/);
  assert.deepEqual(JSON.parse(writes[0].body).items[0],{name:'pommes',quantity:1.5,unit:'kg',category:'Fruits & légumes',source:'alexa'});
  assert.deepEqual(saved.sessionAttributes,{});
  await skill.invoke(finish);
  assert.equal(writes[0].headers['idempotency-key'],writes[1].headers['idempotency-key']);
  const next=await skill.invoke(envelope({name:'pain',details:false,id:'new-item',attributes:saved.sessionAttributes}));
  assert.equal(next.response.directives[0].slotToElicit,'quantite');assert.equal(next.sessionAttributes.groceryDraft.name,'pain');
});
test('passer can skip every field without inventing values, and never writes early',async()=>{
  let calls=0,body;const skill=createSkill({...config,fetchImpl:async(_u,o)=>{calls++;body=JSON.parse(o.body);return Response.json({success:true,data:{count:1,items:[{id:'saved',...body.items[0]}]}});}});
  let result=await skill.invoke(envelope({details:false}));
  for(const field of ['unite','rayon']) {
    result=await skill.invoke(envelope({intent:'PasserPrecision',details:false,attributes:result.sessionAttributes}));
    assert.equal(result.response.directives[0].slotToElicit,field);assert.equal(calls,0);
  }
  result=await skill.invoke(envelope({intent:'PasserPrecision',details:false,attributes:result.sessionAttributes}));
  assert.equal(calls,1);assert.equal(body.items[0].quantity,null);assert.equal(body.items[0].unit,null);assert.equal(body.items[0].category,null);
  assert.match(speech(result),/J’ai ajouté/);
  await skill.invoke(envelope({intent:'PasserPrecision',details:false,attributes:result.sessionAttributes}));assert.equal(calls,1);
});
test('invalid quantities and categories reprompt; help preserves the pending item and cancellation never writes',async()=>{
  let calls=0;const skill=createSkill({...config,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
  const start=await skill.invoke(envelope({name:'sel et poivre',details:false}));
  for(const value of ['-1','0','100000000','1.001','NaN','1e2']) {
    const r=await skill.invoke(turn(start,{quantite:value}));assert.equal(r.response.directives[0].slotToElicit,'quantite');assert.match(speech(r),/pas compris/);
  }
  const qty=await skill.invoke(turn(start,{quantite:'2'}));assert.equal(qty.response.directives[0].slotToElicit,'unite');
  const unit=await skill.invoke(turn(qty,{unite:'paquets'}));assert.equal(unit.response.directives[0].slotToElicit,'rayon');
  const invalid=await skill.invoke(turn(unit,{rayon:'rayon inventé'}));assert.equal(invalid.response.directives[0].slotToElicit,'rayon');
  const help=await skill.invoke(envelope({intent:'AMAZON.HelpIntent',attributes:unit.sessionAttributes}));
  assert.equal(help.response.directives[0].slotToElicit,'rayon');assert.match(speech(help),/passer/);
  for(const intent of ['AMAZON.CancelIntent','AMAZON.StopIntent','AMAZON.NoIntent']) {
    const stopped=await skill.invoke(envelope({intent,attributes:unit.sessionAttributes}));
    assert.match(speech(stopped),/Ajout annulé/);assert.deepEqual(stopped.sessionAttributes,{});
  }
  await skill.invoke(envelope({type:'SessionEndedRequest',attributes:unit.sessionAttributes}));
  const relink=await skill.invoke({...turn(qty,{unite:'paquets'}),context:{System:{application:{applicationId:skillId},user:{accessToken:''}}}});
  assert.equal(relink.response.card.type,'LinkAccount');assert.deepEqual(relink.sessionAttributes,{});assert.equal(calls,0);
});
test('a mismatched acknowledgement never confirms supplied grocery details',async()=>{
  const skill=createSkill({...config,fetchImpl:async()=>Response.json({success:true,data:{count:1,items:[{id:'saved',name:'du lait',quantity:99,unit:'paquet',category:'Épicerie'}]}})});
  assert.match(speech(await skill.invoke(envelope())),/Vérifiez la liste/);
});
test('HTTP rejects unsigned requests, malicious certificate URLs, stale and future timestamps',async t=>{
  let writes=0;const app=buildAlexaApp({...config,fetchImpl:async()=>{writes++;throw Error('unexpected');}});t.after(()=>app.close());
  for(const timestamp of [new Date().toISOString(),'invalid',new Date(Date.now()-151000).toISOString(),new Date(Date.now()+151000).toISOString()]){
    const e=envelope();e.request.timestamp=timestamp;
    const r=await app.inject({method:'POST',url:'/integrations/alexa',payload:e,headers:{'signaturecertchainurl':'https://example.test/echo.api/test.pem','signature-256':'invalid'}});
    assert.equal(r.statusCode,400);assert.ok(!r.body.includes('test-token'));
  }
  assert.equal((await app.inject({method:'POST',url:'/integrations/alexa',payload:envelope()})).statusCode,400);
  assert.equal(writes,0);
});
test('HTTP validates raw body, skill IDs and locale before handler execution',async t=>{
  let checkedBody;let writes=0;
  const app=buildAlexaApp({...config,signatureVerifier:{verify:async body=>{checkedBody=body;}},
    fetchImpl:async()=>{writes++;return new Response('{}',{status:503});}});t.after(()=>app.close());
  const e=envelope();const raw=JSON.stringify(e,null,2);
  assert.equal((await app.inject({method:'POST',url:'/integrations/alexa',payload:raw,headers:{'content-type':'application/json'}})).statusCode,200);
  assert.equal(checkedBody,raw);assert.equal(writes,1);
  for(const change of [e=>e.context.System.application.applicationId='another-skill',e=>e.session.application.applicationId='another-skill',e=>e.request.locale='en-US']){
    const invalid=envelope();change(invalid);
    assert.equal((await app.inject({method:'POST',url:'/integrations/alexa',payload:invalid})).statusCode,400);
  }
  assert.equal(writes,1);
  for(const timestamp of ['invalid',new Date(Date.now()-151000).toISOString(),new Date(Date.now()+151000).toISOString()]) {
    const invalid=envelope();invalid.request.timestamp=timestamp;
    assert.equal((await app.inject({method:'POST',url:'/integrations/alexa',payload:invalid})).statusCode,400);
  }
  assert.equal(writes,1);
});
