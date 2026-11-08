import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {createApp} from '../src/server.mjs';
test('pending verification is private, never exposes a token, expires, and stays distinct from verified identity',async()=>{
 const store=new Store(),app=createApp({store,publicUrl:'http://localhost:3201',paymentConfig:null,mailConfig:{}});
 app.mailer.configured=true;app.mailer.accountMessage=async()=>{};
 const buyer=store.register({email:'buyer@example.invalid',password:'synthetic-password-123'}),other=store.register({email:'other@example.invalid',password:'synthetic-password-123'});
 await app.accounts.request(buyer,{email:'pending@example.invalid'},'verify');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${app.server.address().port}/api/me`;
 try{
  const get=async(user)=>{const token=user?store.login({email:user.email,password:'synthetic-password-123'}).token:null;return (await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{}})).json();};
  assert.equal((await get(null)).pendingEmail,null);assert.equal((await get(other)).pendingEmail,null);
  const result=await get(buyer);assert.equal(result.pendingEmail.email,'pending@example.invalid');assert.deepEqual(Object.keys(result.pendingEmail).sort(),['email','expires_at']);assert.equal(result.email,null);assert.equal(result.loginEmail,'buyer@example.invalid');
  assert.throws(()=>app.accounts.pending(null),e=>e.status===401);
  app.accounts.clock=()=>Date.now()+16*60*1000;assert.equal(app.accounts.pending(buyer),null);
 }finally{await new Promise(resolve=>app.server.close(resolve));store.close();}
});
