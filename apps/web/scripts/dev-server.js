import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const api = new URL(process.env.PORTAL_API_URL || 'http://127.0.0.1:3100');
if (!['localhost','127.0.0.1','[::1]'].includes(api.hostname) || api.protocol !== 'http:') throw Error('Development API must be local HTTP');
const config = JSON.parse(await readFile(new URL('../config.json',import.meta.url),'utf8'));
config.familyId = process.env.PORTAL_FAMILY_ID || config.familyId;
config.auth.url = process.env.PORTAL_AUTH_URL || config.auth.url;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server = http.createServer(async(req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const proxy = http.request(new URL(req.url,api),{method:req.method,headers:{...req.headers,host:api.host}},upstream => {
        res.writeHead(upstream.statusCode,upstream.headers); upstream.pipe(res);
      });
      proxy.on('error',()=>{if(!res.headersSent) res.writeHead(502,{'content-type':'application/json'}); res.end(JSON.stringify({success:false}));});
      req.pipe(proxy); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405);res.end();return;}
    if (url.pathname === '/config.json') {res.setHeader('content-type','application/json');res.end(JSON.stringify(config));return;}
    const path = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path === '/vendor/keycloak.js' ? fileURLToPath(new URL('../../../node_modules/keycloak-js/lib/keycloak.js',import.meta.url)) : resolve(root,'.'+path);
    if (path !== '/vendor/keycloak.js' && (!file.startsWith(root) || !(/^\/(src\/[^/]+\.(js|css)|index\.html|icon\.svg|manifest\.webmanifest)$/.test(path)))) {res.writeHead(404);res.end();return;}
    const content = await readFile(file);
    res.setHeader('content-type',types[extname(file)] || 'application/octet-stream');res.end(req.method === 'HEAD' ? undefined : content);
  } catch {res.writeHead(404);res.end();}
});
server.listen(Number(process.env.PORTAL_PORT || 4173),'127.0.0.1',()=>console.log('Maison preview: http://localhost:' + server.address().port));
