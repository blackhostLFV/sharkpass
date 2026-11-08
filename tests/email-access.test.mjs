import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {Accounts} from '../src/accounts.mjs';
const password='synthetic-password-123';
test('email registration normalizes access, rejects duplicates and wrong passwords without granting roles',()=>{
 const s=new Store();try{
  const user=s.register({email:' Buyer@Example.invalid ',password});
  assert.equal(s.session(s.login({email:'BUYER@example.invalid',password}).token).id,user.id);
  assert.equal(s.isPlatformAdmin(user),false);
  assert.throws(()=>s.register({email:'buyer@example.invalid',password}),e=>e.status===409);
  for(const email of ['no-email','x@x','x@y.invalid\nBcc: other@example.invalid'])assert.throws(()=>s.register({email,password}),e=>e.status===400);
  assert.throws(()=>s.login({email:'buyer@example.invalid',password:'wrong-password'}),e=>e.status===401);
  assert.throws(()=>s.login({email:'other@example.invalid',password}),e=>e.status===401);
 }finally{s.close();}
});
test('verified legacy accounts retain their ID and roles when enabling email login; reserved emails cannot be claimed',async()=>{
 const s=new Store();let token;const accounts=new Accounts(s,{configured:true,accountMessage:async(_e,_p,t)=>{token=t;}});
 try{
  const legacy=s.register({username:'legacy-owner',password});s.initializePlatformAdmin(legacy.id);
  const other=s.register({email:'reserved@example.invalid',password});
  await accounts.request(legacy,{email:'reserved@example.invalid'},'verify');
  assert.throws(()=>accounts.complete({token},'verify'),e=>e.status===409);
  assert.equal(s.session(s.login({email:'reserved@example.invalid',password}).token).id,other.id);
  await accounts.request(legacy,{email:'owner@example.invalid'},'verify');accounts.complete({token},'verify');
  const logged=s.login({email:'owner@example.invalid',password}).user;
  assert.equal(logged.id,legacy.id);assert.equal(s.isPlatformAdmin(logged),true);
  assert.throws(()=>s.register({email:'owner@example.invalid',password}),e=>e.status===409);
  await accounts.request(legacy,{email:'new-owner@example.invalid'},'verify');accounts.complete({token},'verify');
  assert.throws(()=>s.login({email:'owner@example.invalid',password}),e=>e.status===401);
  assert.equal(s.login({email:'new-owner@example.invalid',password}).user.id,legacy.id);
 }finally{s.close();}
});

test('upgrading a populated database preserves verified email login and existing receipt state',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const {mkdtempSync,readFileSync,readdirSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHash}=await import('node:crypto');
 const dir=mkdtempSync(join(tmpdir(),'sharkpass-migration-')),path=join(dir,'test.sqlite');
 let db=new DatabaseSync(path),store;
 try{
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL)");
  for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')&&n<'202611070001').sort()){
   const sql=readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');db.exec(sql);
   db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(name,createHash('sha256').update(sql).digest('hex'));
  }
  db.exec(`INSERT INTO users VALUES('owner','legacy','unused-hash','2030-01-01');
   INSERT INTO account_emails VALUES('owner','verified@example.invalid',1);
   INSERT INTO organizations VALUES('org','DEMO','owner');
   INSERT INTO events VALUES('event','org','DEMO','Synthetic','Test venue','2031-11-18','published',1);
   INSERT INTO ticket_types VALUES('type','event','General',5000,10);
   INSERT INTO orders VALUES('order','owner','event','type',1,'confirmed',5000,'key','hash','2030-01-01');
   INSERT INTO payment_attempts VALUES('payment','owner','event','type',1,500000,'purchase@example.invalid','confirmed','test','provider','order','key','hash',1,2,1);
   INSERT INTO mail_outbox(id,payment_id,state,next_at,attempts,provider_id,sent_at) VALUES('receipt','payment','sent',0,1,'message',1);`);
  db.close();db=null;store=new Store(path);
  assert.equal(store.get('SELECT user_id FROM login_emails WHERE email=?','verified@example.invalid').user_id,'owner');
  assert.equal(store.get('SELECT state,provider_id FROM mail_outbox').state,'sent');
  assert.equal(store.get('SELECT state,provider_id FROM mail_outbox').provider_id,'message');
  assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]);
 }finally{db?.close();store?.close();rmSync(dir,{recursive:true,force:true});}
});
