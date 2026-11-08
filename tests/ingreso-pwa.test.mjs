import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/store.mjs';
import {createApp} from '../src/server.mjs';
import {scanDecision,normalizeCode} from '../public/ingreso/state.js';

test('door decisions authorize only an explicit server acceptance and treat lost results as unknown',()=>{
 assert.equal(scanDecision(200,{accepted:true,ticketId:randomUUID()}).state,'accepted');
 for(const [status,data] of [[200,{}],[200,{accepted:false}],[200,{accepted:true}],[0,{accepted:true,ticketId:'test'}],[500,{accepted:true,ticketId:'test'}],[503,{}]])assert.equal(scanDecision(status,data).state,'unknown');
 for(const status of [400,403,404,409,429])assert.equal(scanDecision(status,{error:'denied'}).state,'denied');
 assert.equal(scanDecision(401).state,'unknown');assert.equal(normalizeCode('  sharkpass:v1:synthetic-token  '),'sharkpass:v1:synthetic-token');assert.equal(normalizeCode(''),null);assert.equal(normalizeCode('x'.repeat(101)),null);
});

test('PWA cache handles only public assets, never API, auth, QR or mutations',async()=>{
 const handlers={},installed=[],deleted=[];let intercepted=0;
 const cache={addAll:async list=>installed.push(...list),put:async()=>{}};
 const context={URL,fetch:async()=>new Response('public asset'),caches:{open:async()=>cache,keys:async()=>['other-app-v1','sharkpass-ingreso-shell-v0'],delete:async key=>deleted.push(key),match:async()=>undefined},self:{location:{origin:'https://sharkpass.test'},addEventListener:(name,handler)=>{handlers[name]=handler;},clients:{claim:async()=>{}}}};
 vm.runInNewContext(readFileSync(new URL('../public/ingreso/sw.js',import.meta.url),'utf8'),context);
 await new Promise((resolve,reject)=>handlers.install({waitUntil:promise=>promise.then(resolve,reject)}));
 assert.ok(installed.includes('/ingreso/'));assert.ok(installed.every(path=>!path.startsWith('/api/')));
 for(const [method,path] of [['GET','/api/me'],['GET','/api/manage'],['POST','/api/login'],['POST','/api/events/test/scan'],['GET','/api/tickets/test/qr'],['GET','/ingreso/private.json'],['GET','/?view=account']])handlers.fetch({request:{method,url:`https://sharkpass.test${path}`},respondWith:()=>intercepted++});
 assert.equal(intercepted,0);
 let pending;handlers.fetch({request:{method:'GET',url:'https://sharkpass.test/ingreso/app.css'},waitUntil:()=>{},respondWith:promise=>{intercepted++;pending=promise;}});assert.equal(intercepted,1);await pending;
 await new Promise((resolve,reject)=>handlers.activate({waitUntil:promise=>promise.then(resolve,reject)}));assert.deepEqual(deleted,['sharkpass-ingreso-shell-v0']);
});

test('installable door app preserves scanner isolation and one admission across simultaneous requests',async()=>{
 const store=new Store(),password='synthetic-pwa-password-123';
 const owner=store.register({email:'owner-pwa@example.invalid',password}),scanner=store.register({email:'scanner-pwa@example.invalid',password}),outsider=store.register({email:'other-pwa@example.invalid',password});
 const org=store.createOrganization(owner,{name:'PWA synthetic organizer'});store.addScanner(owner,org.id,{email:scanner.email});
 const event=store.createEvent(owner,{organizationId:org.id,title:'PWA DEMO',description:'Synthetic local admission test only.',venue:'QA venue',startsAt:'2032-11-25T18:00:00-05:00',isDemo:true});const type=store.addType(owner,event.id,{name:'General',priceCop:0,capacity:6});store.setEventState(owner,event.id,'published');
 const foreignOrg=store.createOrganization(outsider,{name:'Foreign organizer'});const foreign=store.createEvent(outsider,{organizationId:foreignOrg.id,title:'Foreign DEMO',description:'Different organization test event.',venue:'Other QA venue',startsAt:'2032-11-26T18:00:00-05:00',isDemo:true});store.addType(outsider,foreign.id,{name:'General',priceCop:0,capacity:2});store.setEventState(outsider,foreign.id,'published');
 const order=store.order(owner,{eventId:event.id,typeId:type.id,quantity:2},randomUUID());
 const {server}=createApp({store,publicUrl:'http://localhost:3200',paymentConfig:null,mailConfig:{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const login=async email=>{const r=await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 try{
  for(const [path,mime] of [['/ingreso/','text/html'],['/ingreso/app.js','text/javascript'],['/ingreso/state.js','text/javascript'],['/ingreso/sw.js','text/javascript'],['/ingreso/app.css','text/css'],['/ingreso/manifest.webmanifest','application/manifest+json'],['/ingreso/icon-192.png','image/png'],['/ingreso/icon-512.png','image/png']]){const r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(mime));assert.equal(r.headers.get('cache-control'),'no-store');}
  const manifest=await (await fetch(base+'/ingreso/manifest.webmanifest')).json();assert.equal(manifest.scope,'/ingreso/');assert.equal(manifest.start_url,'/ingreso/');assert.equal(manifest.display,'standalone');
  const anonymous=await fetch(`${base}/api/manage`);assert.equal(anonymous.status,401);
  const cookie=await login(scanner.email);const managed=await (await fetch(base+'/api/manage',{headers:{Cookie:cookie}})).json();assert.equal(managed.length,1);assert.equal(managed[0].role,'scanner');
  const post=(path,code)=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({code})});
  const attempts=await Promise.all([post(`/api/events/${event.id}/scan`,order.tickets[0].token),post(`/api/events/${event.id}/scan`,order.tickets[0].token)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  assert.equal((await post(`/api/events/${foreign.id}/scan`,order.tickets[1].token)).status,403);
  assert.equal((await fetch(`${base}/api/events/${event.id}/sales`,{headers:{Cookie:cookie}})).status,403);
  assert.equal((await fetch(`${base}/api/tickets/${order.tickets[1].id}/qr`,{headers:{Cookie:cookie}})).status,404);
  const second=await post(`/api/events/${event.id}/scan`,order.tickets[1].token);assert.equal(second.status,200);
  await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal((await post(`/api/events/${event.id}/scan`,order.tickets[1].token)).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
