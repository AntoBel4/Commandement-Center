import {mkdir, writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function alexaClient(redirectUris, secret) {
  if (!Array.isArray(redirectUris) || redirectUris.length !== 3 || new Set(redirectUris).size !== 3) throw Error('Three exact Amazon redirect URLs required');
  const hosts = new Set(['layla.amazon.com','pitangui.amazon.com','alexa.amazon.co.jp']);
  let vendor;
  for (const value of redirectUris) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hosts.delete(url.hostname) || url.port || url.username || url.password ||
        url.search || url.hash || !/^\/api\/skill\/link\/[A-Z0-9]+$/.test(url.pathname)) throw Error('Unexpected Amazon redirect URL');
    const id = url.pathname.split('/').at(-1);
    if (vendor && vendor !== id) throw Error('Redirect URLs must belong to the same vendor');
    vendor = id;
  }
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) throw Error('Random client secret required');
  return {clientId:'commandement-alexa',name:'Courses Maison - Alexa',enabled:true,protocol:'openid-connect',
    publicClient:false,clientAuthenticatorType:'client-secret',secret,standardFlowEnabled:true,
    directAccessGrantsEnabled:false,serviceAccountsEnabled:false,implicitFlowEnabled:false,
    fullScopeAllowed:false,redirectUris,webOrigins:[],defaultClientScopes:['basic'],optionalClientScopes:['offline_access'],
    attributes:{'pkce.code.challenge.method':'S256','access.token.lifespan':'300'},
    protocolMappers:[{name:'family-api-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',
      consentRequired:false,config:{'included.custom.audience':'commandement-api','id.token.claim':'false','access.token.claim':'true'}}]};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = resolve('.private/nexus');
  const client = alexaClient(process.env.ALEXA_REDIRECT_URIS?.split(','),randomBytes(32).toString('hex'));
  await mkdir(directory,{recursive:true,mode:0o700});
  await writeFile(resolve(directory,'alexa-client.json'),JSON.stringify(client,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Private Alexa client prepared; secret not printed. No existing client overwritten.');
}
