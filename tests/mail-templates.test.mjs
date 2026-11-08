import test from 'node:test';
import assert from 'node:assert/strict';
import {accountEmail,receiptEmail} from '../src/mail-templates.mjs';
const base={publicUrl:'https://example.invalid',support:'support@example.invalid'};
test('account templates preserve one-use flows, plain text and safe links',()=>{
 for(const purpose of ['verify','reset']){
  const m=accountEmail({...base,purpose,token:'synthetic&token'});
  assert.match(m.html,/<html lang="es">/);assert.match(m.html,/15 minutos/);assert.match(m.text,/15 minutos/);
  assert.ok(m.html.includes(`?${purpose}=${encodeURIComponent('synthetic&token')}`));
  assert.match(m.html,/width="100%"/);assert.doesNotMatch(m.html,/<script|<form|<iframe|@import/);
 }
 assert.throws(()=>accountEmail({...base,purpose:'unsupported',token:'test'}));
});
test('receipts escape personalized text, label Sandbox, and expose no QR access secret',()=>{
 const order={title:'<img src=x onerror=alert(1)>',venue:'Sala <DEMOSTRACIÓN>',quantity:2,amount_cents:10000000,order_id:'synthetic-order',environment:'test',token:'never-send-qr-secret'};
 const m=receiptEmail({...base,order});
 assert.match(m.subject,/\[PRUEBA\]/);assert.match(m.html,/Sin cobro real ni validez comercial/);assert.match(m.html,/&lt;img/);
 assert.doesNotMatch(m.html,/<img src=x|never-send-qr-secret|sharkpass:v1:/);
 assert.match(m.text,/100\.000/);assert.match(m.html,/\?order=synthetic-order/);assert.match(m.html,/no reemplazan el QR/);
 const real=receiptEmail({...base,order:{...order,environment:'prod'}});assert.doesNotMatch(real.subject,/PRUEBA/);assert.doesNotMatch(real.html,/PRUEBA SANDBOX/);
});

test('receipt dates use Bogota at midnight and keep location/type safe in both formats',()=>{
 const order={title:'DEMO',venue:'Sala & Jardín',type_name:'Preferencial <DEMO>',quantity:1,amount_cents:0,order_id:'synthetic',environment:'prod'};
 const before=receiptEmail({...base,order:{...order,starts_at:'2031-11-19T04:59:59Z'}}),after=receiptEmail({...base,order:{...order,starts_at:'2031-11-19T05:00:00Z'}});
 assert.match(before.text,/18 de noviembre de 2031/);assert.match(after.text,/19 de noviembre de 2031/);
 assert.match(after.html,/Preferencial &lt;DEMO&gt;/);assert.match(after.html,/Sala &amp; Jardín/);assert.match(after.text,/Total:.*0/);
 assert.doesNotMatch(after.html,/TOTAL PAGADO/);
});
