import test from 'node:test';
import assert from 'node:assert/strict';
import { Mailer } from '../src/mail.mjs';
const env = { MAIL_PROVIDER:'smtp', SMTP_HOST:'smtp.example.invalid', SMTP_PORT:'465', SMTP_USER:'sender@example.invalid', SMTP_PASSWORD:'synthetic-only', MAIL_FROM:'SharkPass <sender@example.invalid>' };
const publicUrl='https://example.invalid';
function queuedStore(state='queued') {
 const row={id:'receipt-test',payment_id:'payment-test',state,next_at:0,attempts:0,first_attempt_at:null};
 return {row,all:()=>[],transaction:fn=>fn(),get(sql){if(sql.includes('mail_outbox'))return ['queued','sending'].includes(row.state)&&row.next_at<=1000?{...row}:null;return {state:'confirmed',email:'buyer@example.invalid',order_id:'order-test',environment:'test',title:'DEMO <event>',quantity:1};},run(sql,...args){if(sql.includes("state='sending'")){row.state='sending';row.next_at=args[0];}else if(sql.includes("state='sent'"))row.state='sent';else if(sql.includes("state='attention'"))row.state='attention';else {row.state='queued';row.next_at=args[0];}}};
}
test('SMTP requires complete private config, HTTPS and TLS ports; no fallback',async()=>{
 for(const partial of [{SMTP_PASSWORD:''},{SMTP_USER:''},{SMTP_HOST:''},{SMTP_PORT:'25'},{MAIL_FROM:''},{MAIL_PROVIDER:'unknown'}]){
  const mailer=new Mailer(null,{env:{...env,...partial},publicUrl,createTransport:()=>assert.fail('must stay disabled')});
  assert.equal(mailer.configured,false);
  await assert.rejects(mailer.accountMessage('test@example.invalid','verify','token','id'),/mail_not_configured/);
 }
 assert.equal(new Mailer(null,{env,publicUrl:'http://localhost'}).configured,false);
});
test('SMTP account messages use encrypted transport and escaped one-use links',async()=>{
 let options;const messages=[];
 const mailer=new Mailer(null,{env,publicUrl,createTransport:o=>{options=o;return {sendMail:async m=>{messages.push(m);return {accepted:m.to,rejected:[],messageId:m.messageId};}};}});
 await mailer.accountMessage('buyer@example.invalid','verify','synthetic-token','verify-id');
 await mailer.accountMessage('buyer@example.invalid','reset','synthetic-token','reset-id');
 assert.equal(options.secure,true);assert.equal(options.requireTLS,true);assert.equal(options.tls.rejectUnauthorized,true);
 assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);
 assert.match(messages[0].html,/https:\/\/example.invalid\/\?verify=synthetic-token/);
 assert.match(messages[1].html,/\?reset=synthetic-token/);
 assert.doesNotMatch(JSON.stringify(messages),/synthetic-only/);
 let starttls;new Mailer(null,{env:{...env,SMTP_PORT:'587'},publicUrl,createTransport:o=>{starttls=o;return {};}});
 assert.equal(starttls.secure,false);assert.equal(starttls.requireTLS,true);
});
test('SMTP receipts send once after acceptance, escape content and retain test label',async()=>{
 const store=queuedStore();let count=0;
 const mailer=new Mailer(store,{env,publicUrl,clock:()=>1000,createTransport:()=>({sendMail:async m=>{
  count++;assert.match(m.subject,/\[PRUEBA\]/);assert.match(m.html,/DEMO &lt;event&gt;/);assert.match(m.html,/\?order=order-test/);assert.doesNotMatch(m.html,/sharkpass:v1:/);
  return {accepted:m.to,rejected:[],messageId:m.messageId};
 }})});
 await mailer.flush();await mailer.flush();assert.equal(store.row.state,'sent');assert.equal(count,1);
});
test('SMTP retries explicit temporary rejection but quarantines uncertain or permanent failures',async()=>{
 for(const [error,state] of [[{responseCode:451},'queued'],[{code:'EDNS'},'queued'],[{code:'ETIMEDOUT',command:'CONN'},'queued'],[{code:'ETIMEDOUT',command:'DATA'},'attention'],[{responseCode:550},'attention']]){
  const store=queuedStore();const mailer=new Mailer(store,{env,publicUrl,clock:()=>1000,createTransport:()=>({sendMail:async()=>{throw Object.assign(new Error('synthetic'),error);}})});
  await mailer.flush();assert.equal(store.row.state,state,JSON.stringify(error));
 }
 const store=queuedStore('sending');const mailer=new Mailer(store,{env,publicUrl,clock:()=>1000,createTransport:()=>({sendMail:()=>assert.fail('ambiguous interrupted delivery must not resend')})});
 await mailer.flush();assert.equal(store.row.state,'attention');
});
test('SMTP rejection never marks a receipt sent',async()=>{
 const store=queuedStore();const mailer=new Mailer(store,{env,publicUrl,clock:()=>1000,createTransport:()=>({sendMail:async()=>({accepted:[],rejected:['buyer@example.invalid']})})});
 await mailer.flush();assert.equal(store.row.state,'attention');
});

test('replies go to the configured support address and SMTP errors expose codes only',async()=>{
 const lines=[];const original=console.warn;console.warn=v=>lines.push(v);
 const diagnosticEnv={...env,MAIL_REPLY_TO:'support@example.invalid'};
 try {
  const mailer=new Mailer(null,{env:diagnosticEnv,publicUrl,createTransport:()=>({sendMail:async message=>{
   assert.equal(message.replyTo,'support@example.invalid');
   throw Object.assign(new Error('private credential and address'),{code:'EAUTH',responseCode:535,response:'private SMTP response'});
  }})});
  await assert.rejects(mailer.accountMessage('buyer@example.invalid','verify','synthetic-token','test'),/private credential/);
  assert.deepEqual(JSON.parse(lines[0]),{operation:'smtp_send_failed',code:'EAUTH',responseCode:535});
  assert.doesNotMatch(lines.join(''),/credential|address|synthetic|example|private/);
 }finally{console.warn=original;}
});
