import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkill} from '../src/handler.js';
import {buildAlexaApp} from '../src/app.js';
import {fixture, token, family, alice, outsider} from '../../backend/test/fixtures.js';

const skillId = 'amzn1.ask.skill.11111111-1111-4111-8111-111111111111';
const config = {skillId, familyId: family, apiBaseUrl: 'http://api:3000'};
function envelope({accessToken = 'test-token', name = 'du lait', id = 'request-1', type = 'IntentRequest', intent = 'AjouterCourse'} = {}) {
  return {version:'1.0', context:{System:{application:{applicationId:skillId}, user:{userId:'test-user', accessToken}}},
    session:{new:true, sessionId:'test-session', application:{applicationId:skillId}, user:{userId:'test-user'}},
    request:{type, requestId:id, timestamp:new Date().toISOString(), locale:'fr-FR',
      intent:{name:intent, confirmationStatus:'NONE', slots:{article:{name:'article',value:name}}}}};
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
  const skill=createSkill({...config,fetchImpl:async()=>Response.json({success:true,data:{count:1,items:[{id:'saved',name}]}})});
  const output=speech(await skill.invoke(envelope({name})));
  assert.ok(output.includes('&lt;audio'));assert.ok(!output.includes('<audio'));
  const noWrite=createSkill({...config,fetchImpl:async()=>{throw Error('must not write');}});
  assert.match(speech(await noWrite.invoke(envelope({type:'LaunchRequest'}))),/Bienvenue/);
  assert.equal((await noWrite.invoke(envelope({intent:'AMAZON.StopIntent'}))).response.shouldEndSession,true);
  assert.match(speech(await noWrite.invoke(envelope({intent:'AjouterEvenement'}))),/après le raccordement/);
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
