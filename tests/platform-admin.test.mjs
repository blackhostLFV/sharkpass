import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/store.mjs';
import {createApp} from '../src/server.mjs';
const password='test-private-password-2026!';
const reason='Revisión operativa autorizada del evento.';
import { reportPlatformAdminCandidate } from '../src/platform-admin-lookup.mjs';
const deny=(fn,status)=>assert.throws(fn,e=>e.status===status);
function fixture(){
 const s=new Store();
 const admin=s.register({username:'platform-owner',password});
 const owner=s.register({username:'event-owner',password});
 const buyer=s.register({username:'buyer',password});
 const scanner=s.register({username:'scanner',password});
 const org=s.createOrganization(owner,{name:'Organizador de prueba'});
 s.addScanner(owner,org.id,{username:'scanner'});
 const event=s.createEvent(owner,{organizationId:org.id,title:'Evento privado de ensayo',description:'Datos sintéticos para probar permisos de administración.',venue:'Lugar de prueba',startsAt:'2031-01-02T15:00:00-05:00',isDemo:true});
 return {s,admin,owner,buyer,scanner,org,event};
}
test('private account lookup resolves an existing UUID without granting access or exposing credentials',()=>{
 const {s,admin}=fixture();
 try{
  const session=s.login({username:admin.username,password});
  const lines=[];
  reportPlatformAdminCandidate(s,admin.username,line=>lines.push(line));
  assert.deepEqual(JSON.parse(JSON.parse(lines[0]).message),{operation:'platform_admin_lookup',userId:admin.id});
  assert.equal(s.isPlatformAdmin(admin),false);
  assert.equal(s.session(session.token).id,admin.id);
  assert.equal(s.get('SELECT COUNT(*) n FROM platform_admin_setup').n,0);
  assert.equal(lines[0].includes(password),false);
  assert.equal(lines[0].includes(admin.username),false);
 }finally{s.close();}
});
test('private lookup never provisions missing accounts or accepts invalid account selectors',()=>{
 const {s}=fixture();
 try{
  const before=s.get('SELECT COUNT(*) n FROM users').n; const lines=[];
  reportPlatformAdminCandidate(s,'missing-user',line=>lines.push(line));
  assert.equal(JSON.parse(JSON.parse(lines[0]).message).userId,null);
  assert.throws(()=>reportPlatformAdminCandidate(s,"x' OR 1=1",()=>{}));
  reportPlatformAdminCandidate(s,undefined,()=>assert.fail('No diagnostic expected'));
  assert.equal(s.get('SELECT COUNT(*) n FROM users').n,before);
  assert.equal(s.get('SELECT COUNT(*) n FROM platform_admins').n,0);
 }finally{s.close();}
});
test('registration never grants platform role, including forged role fields',()=>{
 const {s,admin,owner,buyer,scanner}=fixture();
 try{
  const fake=s.register({username:'forged-admin',password,role:'superadmin',platformAdmin:true});
  for(const u of [admin,owner,buyer,scanner,fake]){assert.equal(s.isPlatformAdmin(u),false);deny(()=>s.platformOverview(u),403);}
  deny(()=>s.platformOverview(null),401);
 }finally{s.close();}
});
test('initial grant binds an existing UUID, clears sessions and consumes setup once',()=>{
 const {s,admin,buyer}=fixture();
 try{
  deny(()=>s.initializePlatformAdmin(randomUUID()),404);
  const session=s.login({username:admin.username,password});
  assert.equal(s.initializePlatformAdmin(admin.id).changed,true);
  assert.equal(s.session(session.token),null);
  assert.equal(s.isPlatformAdmin(admin),true);
  assert.equal(s.initializePlatformAdmin(buyer.id).changed,false);
  assert.equal(s.isPlatformAdmin(buyer),false);
  s.provisionPlatformAdmin(buyer.id,'ops-test',reason);
  s.revokePlatformAdmin(admin.id,'ops-test',reason);
  s.initializePlatformAdmin(admin.id);
  assert.equal(s.isPlatformAdmin(admin),false);
 }finally{s.close();}
});
test('global readers return useful data without passwords, email, phone, QR or sessions',()=>{
 const {s,admin,owner,buyer,scanner,org,event}=fixture();
 try{
  s.initializePlatformAdmin(admin.id);
  assert.equal(s.platformOverview(admin).users,4);
  assert.equal(s.platformOrganizations(admin)[0].owner,owner.username);
  assert.equal(s.platformEvents(admin)[0].id,event.id);
  const data=JSON.stringify([s.platformUsers(admin),s.platformOrganizations(admin),s.platformEvents(admin),s.platformOrders(admin),s.platformAuditLog(admin)]);
  for(const field of ['password_hash','token_hash','"password"','"phone"','"email"','"token"'])assert.equal(data.includes(field),false);
  for(const u of [owner,buyer,scanner]){
   for(const read of ['platformUsers','platformOrganizations','platformEvents','platformOrders','platformAuditLog'])deny(()=>s[read](u),403);
  }
  deny(()=>s.org(admin,org.id,true),403);
  deny(()=>s.addType(admin,event.id,{name:'General',priceCop:0,capacity:2}),403);
 }finally{s.close();}
});
test('moderation requires current password and a reason, preserves publication constraints',()=>{
 const {s,admin,owner,buyer,event}=fixture();
 try{
  s.initializePlatformAdmin(admin.id);
  const before=s.platformAuditLog(admin).length;
  deny(()=>s.platformSetEventState(admin,event.id,{state:'published',password:'wrong',reason}),401);
  deny(()=>s.platformSetEventState(admin,event.id,{state:'published',password,reason:'short'}),400);
  deny(()=>s.platformSetEventState(buyer,event.id,{state:'published',password,reason}),403);
  deny(()=>s.platformSetEventState(admin,event.id,{state:'published',password,reason}),400);
  assert.equal(s.platformAuditLog(admin).length,before);
  const type=s.addType(owner,event.id,{name:'General',priceCop:0,capacity:2});
  s.platformSetEventState(admin,event.id,{state:'published',password,reason});
  const order=s.order(buyer,{eventId:event.id,typeId:type.id,quantity:1},randomUUID());
  deny(()=>s.platformSetEventState(admin,event.id,{state:'draft',password,reason}),409);
  s.platformSetEventState(admin,event.id,{state:'cancelled',password,reason});
  assert.equal(s.get('SELECT status FROM tickets WHERE id=?',order.tickets[0].id).status,'void');
  deny(()=>s.platformSetEventState(admin,event.id,{state:'published',password,reason}),409);
  const audit=s.platformAuditLog(admin).find(a=>a.action==='event_cancelled');
  assert.equal(audit.actor,admin.username);assert.equal(audit.reason,reason);
  assert.equal(JSON.stringify(audit).includes(password),false);
 }finally{s.close();}
});
test('support can revoke sessions with reauthentication and without changing passwords',()=>{
 const {s,admin,buyer,owner}=fixture();
 try{
  s.initializePlatformAdmin(admin.id);
  const login=s.login({username:buyer.username,password});
  const stored=s.get('SELECT password_hash FROM users WHERE id=?',buyer.id).password_hash;
  deny(()=>s.platformRevokeSessions(owner,buyer.id,{password,reason}),403);
  deny(()=>s.platformRevokeSessions(admin,buyer.id,{password:'wrong',reason}),401);
  assert.ok(s.session(login.token));
  s.platformRevokeSessions(admin,buyer.id,{password,reason});
  assert.equal(s.session(login.token),null);
  assert.equal(s.get('SELECT password_hash FROM users WHERE id=?',buyer.id).password_hash,stored);
  deny(()=>s.platformRevokeSessions(admin,admin.id,{password,reason}),400);
  assert.equal(s.platformAuditLog(admin)[0].action,'sessions_revoked');
 }finally{s.close();}
});
test('private grants are audited, idempotent; last admin cannot be revoked',()=>{
 const {s,admin,buyer}=fixture();
 try{
  s.provisionPlatformAdmin(admin.id,'ops-test',reason);
  assert.equal(s.provisionPlatformAdmin(admin.id,'ops-test',reason).changed,false);
  deny(()=>s.revokePlatformAdmin(admin.id,'ops-test',reason),409);
  s.provisionPlatformAdmin(buyer.id,'ops-test',reason);
  s.revokePlatformAdmin(admin.id,'ops-test',reason);
  deny(()=>s.platformOverview(admin),403);
  assert.equal(s.platformAuditLog(buyer)[0].action,'admin_revoked');
 }finally{s.close();}
});
test('HTTP enforces role on every admin route; no public privilege or payment override',async()=>{
 const {s,admin,owner,buyer,scanner}=fixture();
 const {server}=createApp({store:s,publicUrl:'http://localhost',paymentConfig:null,mailConfig:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const u of [null,owner,buyer,scanner]){
   const token=u?s.login({username:u.username,password}).token:null;
   for(const path of ['overview','users','organizations','events','orders','audit']){
    const r=await fetch(base+'/api/admin/'+path,{headers:token?{cookie:`sharkpass_session=${token}`}:{}});
    assert.equal(r.status,u?403:401);
   }
  }
  s.initializePlatformAdmin(admin.id);
  const token=s.login({username:admin.username,password}).token;
  const headers={cookie:`sharkpass_session=${token}`,'content-type':'application/json'};
  const r=await fetch(base+'/api/admin/overview',{headers});assert.equal(r.status,200);
  const me=await fetch(base+'/api/me',{headers});assert.equal((await me.json()).platformAdmin,true);
  for(const path of ['grant','roles','payments/approve','__proto__','constructor']){
   const r=await fetch(base+'/api/admin/'+path,{method:'POST',headers,body:'{}'});assert.equal(r.status,404);
  }
  const denied=await fetch(base+'/api/admin/users/none/revoke-sessions',{method:'POST',headers:{...headers,origin:'https://untrusted.invalid'},body:JSON.stringify({password,reason})});assert.equal(denied.status,403);
  s.provisionPlatformAdmin(buyer.id,'ops-test',reason);s.revokePlatformAdmin(admin.id,'ops-test',reason);
  const revoked=await fetch(base+'/api/admin/overview',{headers});assert.equal(revoked.status,401);
 }finally{await new Promise(resolve=>server.close(resolve));s.close();}
});

test('new permission migration has an integrity-checked snapshot and does not repeat it',async()=>{
 const {mkdtempSync,rmSync,readdirSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {DatabaseSync}=await import('node:sqlite');
 const {backupBeforeMigration}=await import('../src/migration-backup.mjs');
 const folder=mkdtempSync(join(tmpdir(),'sharkpass-admin-migration-')),path=join(folder,'db.sqlite');
 try{
  let s=new Store(path);const user=s.register({username:'existing-owner',password});
  s.db.exec('DROP TABLE platform_admin_audit;DROP TABLE platform_admin_setup;DROP TABLE platform_admins;');
  s.run('DELETE FROM schema_migrations WHERE name=?','202611060001_platform_admin.sql');s.close();
  const snapshot=backupBeforeMigration(path,'202611060001_platform_admin.sql');assert.ok(snapshot);
  const restored=new DatabaseSync(snapshot,{readOnly:true});
  assert.equal(restored.prepare('SELECT id FROM users WHERE id=?').get(user.id).id,user.id);
  assert.equal(restored.prepare("SELECT name FROM sqlite_master WHERE name='platform_admins'").get(),undefined);restored.close();
  s=new Store(path);assert.equal(s.isPlatformAdmin(user),false);s.close();
  assert.equal(backupBeforeMigration(path,'202611060001_platform_admin.sql'),null);
  assert.equal(readdirSync(join(folder,'backups')).length,1);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
