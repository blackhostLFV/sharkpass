import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {createApp} from '../src/server.mjs';
import {adminConsole,adminDashboard,bogotaWindow} from '../src/admin-console.mjs';
import {grantVerifiedAdmin,runAdminGrantTask} from '../src/admin-grant-task.mjs';
const password='synthetic-admin-console-password';
const deny=(fn,status)=>assert.throws(fn,error=>error.status===status);
function fixture(){
 const s=new Store(),admin=s.register({email:'admin@example.invalid',password}),owner=s.register({email:'owner@example.invalid',password});s.initializePlatformAdmin(admin.id);
 const org=s.createOrganization(owner,{name:'Synthetic organizer'});
 const event=s.createEvent(owner,{organizationId:org.id,title:'Synthetic DEMO concert',description:'Synthetic event for private administration tests.',venue:'QA venue',startsAt:'2032-11-25T18:00:00-05:00',isDemo:true});const type=s.addType(owner,event.id,{name:'General',priceCop:0,capacity:100});s.setEventState(owner,event.id,'published');
 return {s,admin,owner,org,event,type};
}
test('admin console lists every section, paginates, binds search and excludes secret fields',()=>{
 const {s,admin,owner,event,type}=fixture();try{
 const order=s.order(owner,{eventId:event.id,typeId:type.id,quantity:2},randomUUID());
 for(let i=0;i<28;i++)s.run('INSERT INTO platform_admin_audit VALUES(?,?,?,?,?,?,?)',randomUUID(),admin.id,'synthetic','test',event.id,'Synthetic audit entry '+i,new Date().toISOString());
 for(const section of ['events','organizations','users','orders','payments','tickets','mail','audit']){
 const result=adminConsole(s,admin,{section});assert.ok(Array.isArray(result.rows));const json=JSON.stringify(result);for(const secret of ['password_hash','token_hash','"token"','request_hash',order.tickets[0].token])assert.equal(json.includes(secret),false);
 deny(()=>adminConsole(s,owner,{section}),403);
 }
 const first=adminConsole(s,admin,{section:'audit'}),second=adminConsole(s,admin,{section:'audit',page:2});assert.equal(first.rows.length,25);assert.equal(second.rows.length,4);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,29);
 assert.equal(adminConsole(s,admin,{section:'events',q:"' OR 1=1 --"}).total,0);
 assert.equal(adminConsole(s,admin,{section:'events',environment:'test',state:'published'}).total,1);
 assert.equal(adminConsole(s,admin,{section:'events',environment:'prod'}).total,0);
 assert.equal(adminConsole(s,admin,{section:'users',q:owner.email}).total,1);
 for(const query of [{section:'__proto__'},{section:'constructor'},{page:0},{page:1.5},{q:'a'.repeat(101)},{section:'users',environment:'test'},{state:'hacked'},{unknown:'x'}])deny(()=>adminConsole(s,admin,query),400);
 deny(()=>adminDashboard(s,null),401);
 }finally{s.close();}
});
test('dashboard separates DEMO money and counts admissions at Bogota midnight boundaries',()=>{
 const {s,admin,owner,event,type,org}=fixture();try{
 const order=s.order(owner,{eventId:event.id,typeId:type.id,quantity:3},randomUUID());s.run('UPDATE orders SET total_cop=12000,created_at=? WHERE id=?','2031-01-03T05:00:00.000Z',order.id);
 s.run("UPDATE tickets SET status='used',used_at=? WHERE id=?",'2031-01-03T04:59:59.999Z',order.tickets[0].id);s.run("UPDATE tickets SET status='used',used_at=? WHERE id=?",'2031-01-03T05:00:00.000Z',order.tickets[1].id);
 const commercial=s.createEvent(owner,{organizationId:org.id,title:'Commercial draft',description:'Synthetic commercial event data only.',venue:'QA venue',startsAt:'2032-11-25T18:00:00-05:00',isDemo:false});
 const dashboard=adminDashboard(s,admin,Date.parse('2031-01-03T05:00:00.000Z'));assert.equal(dashboard.financial.demoCop,12000);assert.equal(dashboard.financial.commercialCop,0);assert.equal(dashboard.todayUsed,1);assert.equal(dashboard.admissions.used,2);assert.equal(dashboard.admissions.valid,1);assert.equal(dashboard.series.at(-1).orders,1);assert.equal(dashboard.series.at(-2).orders,0);assert.equal(dashboard.commercialDrafts,1);
 assert.equal(bogotaWindow(Date.parse('2031-01-03T04:59:59.999Z')).day,'2031-01-02');assert.equal(bogotaWindow(Date.parse('2031-01-03T05:00:00.000Z')).day,'2031-01-03');
 s.run('UPDATE events SET is_demo=0 WHERE id=?',event.id);const real=adminDashboard(s,admin);assert.equal(real.financial.commercialCop,12000);assert.equal(real.financial.demoCop,0);assert.ok(commercial.id);
 }finally{s.close();}
});
test('new HTTP readers deny anonymous and non-admin, allow admin, and keep buyer QR private',async()=>{
 const {s,admin,owner,event,type}=fixture();const order=s.order(owner,{eventId:event.id,typeId:type.id,quantity:1},randomUUID());
 const {server}=createApp({store:s,publicUrl:'http://localhost',paymentConfig:null,mailConfig:{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const user of [null,owner,admin]){const headers=user?{cookie:`sharkpass_session=${s.login({email:user.email,password}).token}`}:{ };for(const endpoint of ['dashboard','console?section=tickets'])assert.equal((await fetch(base+'/api/admin/'+endpoint,{headers})).status,user===admin?200:user?403:401);if(user===admin){assert.equal((await fetch(base+`/api/tickets/${order.tickets[0].id}/qr`,{headers})).status,404);assert.equal((await fetch(base+'/api/admin/console?section=__proto__',{headers})).status,400);assert.equal((await fetch(base+'/admin-console.js')).status,200);}}
 }finally{await new Promise(resolve=>server.close(resolve));s.close();}
});
test('one-use private grant requires existing verified email, audits and revokes sessions without passwords',()=>{
 const {s,owner}=fixture(),task={id:randomUUID(),email:owner.email,reason:'Authorized synthetic administrator setup.'};const dir=mkdtempSync(join(tmpdir(),'sharkpass-grant-')),path=join(dir,'task.json');try{
 assert.equal(grantVerifiedAdmin(s,{...task,id:randomUUID(),email:'missing-admin@example.invalid'}).reason,'account_not_found');
 assert.deepEqual(grantVerifiedAdmin(s,task),{status:'awaiting_verified_account',changed:false,reason:'email_not_verified'});assert.equal(s.isPlatformAdmin(owner),false);
 writeFileSync(path,JSON.stringify({...task,id:randomUUID()}));const logs=[];runAdminGrantTask(s,path,line=>logs.push(line));assert.equal(existsSync(path),false);assert.equal(runAdminGrantTask(s,path),null);assert.equal(logs.join('').includes(owner.email),false);
 s.run('INSERT INTO account_emails VALUES(?,?,?)',owner.id,owner.email,Date.now());const login=s.login({email:owner.email,password});assert.equal(s.isPlatformAdmin(owner),false);
 task.id=randomUUID();
 const hash=s.get('SELECT password_hash FROM users WHERE id=?',owner.id).password_hash;
 assert.deepEqual(grantVerifiedAdmin(s,task),{status:'active',changed:true});assert.equal(s.session(login.token),null);assert.equal(s.get('SELECT password_hash FROM users WHERE id=?',owner.id).password_hash,hash);assert.equal(s.isPlatformAdmin(owner),true);assert.deepEqual(grantVerifiedAdmin(s,task),{status:'consumed',changed:false});
 const other=s.get('SELECT user_id FROM platform_admins WHERE user_id!=?',owner.id);s.revokePlatformAdmin(owner.id,'synthetic-ops','Synthetic permission removal test.');assert.deepEqual(grantVerifiedAdmin(s,task),{status:'consumed',changed:false});assert.equal(s.isPlatformAdmin(owner),false);assert.ok(other);
 assert.throws(()=>grantVerifiedAdmin(s,{...task,role:'admin'}));assert.throws(()=>grantVerifiedAdmin(s,{...task,reason:'short'}));
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
