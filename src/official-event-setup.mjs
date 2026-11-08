import {ticketPricing} from "../public/pricing.js";
import {readFileSync,renameSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
const manifest=JSON.parse(readFileSync(new URL('../content/pitch-competition.json',import.meta.url),'utf8'));
const batch='official-sharkcaribe-20261107';
export function prepareOfficialEvent(store,input=manifest){
 return store.transaction(()=>{
  if(store.get("SELECT id FROM platform_admin_audit WHERE action='official_event_prepared' AND target_id=? AND reason=?",input.eventId,batch))return {changed:false,state:store.get('SELECT state FROM events WHERE id=?',input.eventId)?.state};
  const event=store.get('SELECT e.*,o.name AS organizer FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=?',input.eventId);
  if(!event||event.is_demo||event.state!=='draft'||event.organizer!=='Shark Caribe')throw new AppError(409,'El evento oficial debe existir como borrador de Shark Caribe.');
  if(store.get('SELECT COUNT(*) n FROM orders WHERE event_id=?',event.id).n||store.get('SELECT COUNT(*) n FROM payment_attempts WHERE event_id=?',event.id).n||store.get('SELECT COUNT(*) n FROM ticket_types WHERE event_id=?',event.id).n)throw new AppError(409,'El evento tiene inventario o compras; requiere revisión antes de configurar sillas.');
  store.run('UPDATE events SET starts_at=?,venue=?,description=? WHERE id=?',new Date(`${input.date}T${input.time}:00-05:00`).toISOString(),input.venue,`${input.description} Horario: 4:00 p. m. a 9:30 p. m. ${input.address}. Precios base más IVA del ${input.vatRate??0}%. Sin cargos de servicio adicionales. Las entradas incluyen únicamente el ingreso; no incluyen consumos ni beneficios adicionales. Sillas numeradas: A–E Preferencial y F–J General.`,event.id);
  store.run('UPDATE event_presentation SET image=?,category=? WHERE event_id=?',input.image,input.category,event.id);
  store.run('INSERT INTO event_sale_rules VALUES(?,?,?,?)',event.id,1,input.termsVersion,JSON.stringify(input.terms));
  const types=new Map();for(const type of input.ticketTypes){const id=randomUUID();store.run('INSERT INTO ticket_types VALUES(?,?,?,?,?)',id,event.id,type.name,ticketPricing(type.priceCop,input.vatRate??0).totalCop,type.capacity);const p=ticketPricing(type.priceCop,input.vatRate??0);store.run("INSERT INTO ticket_type_pricing VALUES(?,?,?,?,?)",id,p.baseCop,p.vatRate,p.vatCop,p.totalCop);types.set(type.name,id);}
  const courtesy=randomUUID();store.run('INSERT INTO ticket_types VALUES(?,?,?,?,?)',courtesy,event.id,'Cortesías internas',0,50);store.run("INSERT INTO ticket_type_visibility VALUES(?,'internal')",courtesy);
  for(const row of 'ABCDEFGHIJ'){const typeId=types.get(row<='E'?'Preferencial':'General');for(let number=1;number<=10;number++)store.run('INSERT INTO event_seats VALUES(?,?,?,?,?)',randomUUID(),event.id,typeId,row,number);}
  const blockedRows=input.seating?.occupiedPreferentialRows??[];
  if(blockedRows.some(row=>!['A','B','C','D','E'].includes(row))||new Set(blockedRows).size!==blockedRows.length)throw new AppError(400,'Filas ocupadas inválidas.');
  for(const seat of store.all('SELECT id,row_label FROM event_seats WHERE event_id=?',event.id))if(blockedRows.includes(seat.row_label))store.run('INSERT INTO seat_blocks VALUES(?,?,?)',seat.id,'Ocupada por asignación del organizador',new Date().toISOString());
  store.platformAudit(null,'private-event-setup','official_event_prepared',event.id,batch);
  return {changed:true,state:'draft',publicSeats:100,blockedSeats:blockedRows.length*10,availableSeats:100-blockedRows.length*10,internalCapacity:50};
 });
}
export function runOfficialEventTask(store,path=fileURLToPath(new URL('../ops/official-event-setup.json',import.meta.url))){
 const claimed=`${path}.${process.pid}.running`;try{renameSync(path,claimed);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 let result;try{const task=JSON.parse(readFileSync(claimed,'utf8'));if(Object.keys(task).join(',')!=='batch'||task.batch!==batch)throw new Error('Invalid official event task.');result=prepareOfficialEvent(store);}catch{result={status:'failed'};}
 unlinkSync(claimed);console.log(JSON.stringify({timestamp:new Date().toISOString(),level:result.status==='failed'?'ERROR':'INFO',message:JSON.stringify({operation:'official_event_setup',...result})}));return result;
}

export function publishOfficialEvent(store,{paymentMode,emailConfigured},input=manifest){
 return store.transaction(()=>{
  if(paymentMode!=='prod'||emailConfigured!==true)throw new AppError(409,'La venta oficial requiere pagos de producción y correo configurado.');
  if(store.get("SELECT id FROM platform_admin_audit WHERE action='official_event_published' AND target_id=? AND reason=?",input.eventId,batch))return {changed:false};
  const event=store.get('SELECT e.*,o.name AS organizer FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=?',input.eventId);
  const rules=store.get('SELECT * FROM event_sale_rules WHERE event_id=?',input.eventId),types=store.eventTypes(input.eventId);
  const blocked=store.all('SELECT s.row_label,s.seat_number FROM seat_blocks b JOIN event_seats s ON s.id=b.seat_id WHERE s.event_id=?',input.eventId);
  const expectedRows=input.seating?.occupiedPreferentialRows??[];
  if(!event||event.is_demo||event.state!=='draft'||event.organizer!=='Shark Caribe'||Date.parse(event.starts_at)<=Date.now()||!rules?.require_attendees||rules.terms_version!==input.termsVersion||types.length!==2||input.ticketTypes.some(expected=>!types.some(type=>type.name===expected.name&&type.capacity===expected.capacity&&type.price_cop===ticketPricing(expected.priceCop,input.vatRate??0).totalCop))||store.get('SELECT COUNT(*) n FROM event_seats WHERE event_id=?',input.eventId).n!==100||blocked.length!==expectedRows.length*10||blocked.some(seat=>!expectedRows.includes(seat.row_label)))throw new AppError(409,'Revisa el inventario y las condiciones antes de publicar el evento oficial.');
  store.run("UPDATE events SET state='published' WHERE id=?",input.eventId);
  store.platformAudit(null,'private-event-publish','official_event_published',input.eventId,batch);
  return {changed:true,state:'published',blockedSeats:blocked.length,availableSeats:types.reduce((sum,type)=>sum+type.available,0)};
 });
}
export function runOfficialPublishTask(store,services,path=fileURLToPath(new URL('../ops/official-event-publish.json',import.meta.url))){
 const claimed=`${path}.${process.pid}.running`;try{renameSync(path,claimed);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 let result;try{const task=JSON.parse(readFileSync(claimed,'utf8'));if(Object.keys(task).join(',')!=='batch'||task.batch!==batch)throw new Error('Invalid official publish task.');result=publishOfficialEvent(store,services);}catch{result={status:'failed'};}
 unlinkSync(claimed);console.log(JSON.stringify({timestamp:new Date().toISOString(),level:result.status==='failed'?'ERROR':'INFO',message:JSON.stringify({operation:'official_event_publish',...result})}));return result;
}
