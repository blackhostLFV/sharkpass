import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/store.mjs';
import {Mailer} from '../src/mail.mjs';
const env={MAIL_PROVIDER:'smtp',SMTP_HOST:'smtp.example.invalid',SMTP_PORT:'465',SMTP_USER:'sender@example.invalid',SMTP_PASSWORD:'synthetic',MAIL_FROM:'sender@example.invalid'};
test('free orders queue one receipt to the buyer, preserve idempotency, isolate delivery and throttle resends',async()=>{
 const s=new Store();try{
  const buyer=s.register({email:'buyer@example.invalid',password:'synthetic-password-123'}),other=s.register({email:'other@example.invalid',password:'synthetic-password-123'});
  const org=s.createOrganization(buyer,{name:'DEMO'}),event=s.createEvent(buyer,{organizationId:org.id,title:'DEMO receipt',description:'Synthetic fixture',venue:'Test venue',startsAt:'2031-11-18T18:00:00-05:00',isDemo:true});
  const type=s.addType(buyer,event.id,{name:'General',priceCop:0,capacity:4});s.setEventState(buyer,event.id,'published');
  const key=randomUUID(),input={eventId:event.id,typeId:type.id,quantity:2,email:'purchase@example.invalid'};
  const order=s.order(buyer,input,key);assert.equal(s.order(buyer,input,key).id,order.id);assert.equal(s.all('SELECT * FROM mail_outbox').length,1);
  let sent=0;const mailer=new Mailer(s,{env,publicUrl:'https://example.invalid',createTransport:()=>({sendMail:async m=>{sent++;assert.deepEqual(m.to,['purchase@example.invalid']);assert.match(m.html,/DEMO receipt/);return {accepted:m.to,rejected:[],messageId:m.messageId};}})});
  assert.equal(mailer.delivery(buyer,order.id).state,'queued');
  assert.throws(()=>mailer.delivery(other,order.id),e=>e.status===404);
  assert.throws(()=>mailer.retry(other,order.id),e=>e.status===404);
  assert.throws(()=>mailer.delivery(null,order.id),e=>e.status===401);
  await mailer.flush();await mailer.flush();assert.equal(sent,1);assert.equal(mailer.delivery(buyer,order.id).state,'sent');
  assert.throws(()=>mailer.retry(buyer,order.id),e=>e.status===429);
  s.run("UPDATE mail_outbox SET state='attention',sent_at=NULL");mailer.retry(buyer,order.id);await mailer.flush();assert.equal(sent,2);
  const copies=[];const copyMailer=new Mailer(s,{env,publicUrl:'https://example.invalid',createTransport:()=>({sendMail:async m=>{copies.push(m);return {accepted:m.to,rejected:[],messageId:m.messageId};}})});
  await assert.rejects(copyMailer.copy(other,order.id,{email:'friend@example.invalid'}),e=>e.status===404);
  await assert.rejects(copyMailer.copy(buyer,order.id,{email:'invalid'}),e=>e.status===400);
  await copyMailer.copy(buyer,order.id,{email:'friend@example.invalid'});
  assert.equal(copies.length,1);assert.deepEqual(copies[0].to,['friend@example.invalid']);
  assert.match(copies[0].html,new RegExp(order.id));
  assert.equal(copyMailer.delivery(buyer,order.id).email,'purchase@example.invalid');
  await assert.rejects(copyMailer.copy(buyer,order.id,{email:'friend@example.invalid'}),e=>e.status===429);
 }finally{s.close();}
});
