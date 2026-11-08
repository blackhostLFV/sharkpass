import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {createApp} from '../src/server.mjs';

test('10 and 11 character passwords work; shorter creation/reset is rejected and old hashes remain valid',()=>{
 const s=new Store();
 try{
  assert.throws(()=>s.register({username:'short-password',password:'Abcdefghi'}),e=>e.status===400);
  for(const password of ['Abcdefghij','Abcdefghijk']){
   const user=s.register({username:`length-${password.length}`,password});
   assert.equal(s.session(s.login({username:user.username,password}).token).id,user.id);
   assert.throws(()=>s.login({username:user.username,password:password.slice(0,-1)+'X'}),e=>e.status===401);
  }
  const user=s.register({username:'existing-hash',password:'existing-long-password'});
  const stored=s.get('SELECT password_hash FROM users WHERE id=?',user.id).password_hash;
  const session=s.login({username:user.username,password:'existing-long-password'});
  assert.throws(()=>s.resetPassword(user.id,'Abcdefghi'),e=>e.status===400);
  assert.equal(s.get('SELECT password_hash FROM users WHERE id=?',user.id).password_hash,stored);
  assert.ok(s.session(session.token));
  s.resetPassword(user.id,'abcdefghij');
  assert.equal(s.session(session.token),null);
  assert.throws(()=>s.login({username:user.username,password:'existing-long-password'}),e=>e.status===401);
  assert.equal(s.session(s.login({username:user.username,password:'abcdefghij'}).token).id,user.id);
  s.initializePlatformAdmin(user.id);
  assert.equal(s.confirmPlatformAction(user,{password:'abcdefghij',reason:'Comprobación administrativa de prueba.'}),'Comprobación administrativa de prueba.');
  assert.throws(()=>s.confirmPlatformAction(user,{password:'wrongwrong',reason:'Comprobación administrativa de prueba.'}),e=>e.status===401);
  assert.throws(()=>s.confirmPlatformAction(user,{password:'abcdefghij',reason:'Corto'}),e=>e.status===400);
 }finally{s.close();}
});

test('HTTP registration and login accept a 10-character password without granting privileges',async()=>{
 const store=new Store(),{server}=createApp({store,publicUrl:'http://localhost:3201',paymentConfig:null,mailConfig:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 const post=(path,input)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const data={username:'ten-character-qa',password:'abcdefghij',fullName:'Usuario de prueba',phone:'3000000000'};
 try{
  assert.equal((await post('register',{...data,password:'abcdefghi'})).status,400);
  const registered=await post('register',data);assert.equal(registered.status,201);
  const login=await post('login',data);assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('login',{...data,password:'wrongwrong'})).status,401);
  assert.equal((await fetch(base+'account/profile')).status,401);
  assert.equal((await fetch(base+'account/profile',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(base+'admin/overview',{headers:{Cookie:cookie}})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
