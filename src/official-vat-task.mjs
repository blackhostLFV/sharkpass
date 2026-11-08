import {readFileSync,renameSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {AppError} from './store.mjs';
import {ticketPricing} from '../public/pricing.js';
export const VAT_BATCH='sharkcaribe-iva19-20261108';
const EVENT_ID='f73a9bc4-337b-4d83-a067-6d8722c1a8c6';
export function applyOfficialVat(store,eventId=EVENT_ID){
 return store.transaction(()=>{
  const event=store.get('SELECT e.*,o.name AS organizer FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=?',eventId);
  if(!event||event.is_demo||event.organizer!=='Shark Caribe'||!['draft','published'].includes(event.state))throw new AppError(409,'Evento oficial no disponible para actualizar precios.');
  const done=store.get("SELECT id FROM platform_admin_audit WHERE action='official_vat_applied' AND target_id=? AND reason=?",eventId,VAT_BATCH);
  const types=store.eventTypes(eventId);
  if(types.length!==2)throw new AppError(409,'Inventario oficial inesperado.');
  for(const [name,base] of [['General',50000],['Preferencial',79900]]){
   const type=types.find(t=>t.name===name),p=ticketPricing(base,19);
   if(!type||type.capacity!==50||type.price_cop!==(done?p.totalCop:base))throw new AppError(409,'El precio cambió; revisión requerida.');
   if(done){if(JSON.stringify(type.pricing)!==JSON.stringify(p))throw new AppError(409,'El desglose no coincide.');continue;}
   store.run('INSERT INTO ticket_type_pricing VALUES(?,?,?,?,?)',type.id,p.baseCop,p.vatRate,p.vatCop,p.totalCop);
   store.run('UPDATE ticket_types SET price_cop=? WHERE id=?',p.totalCop,type.id);
  }
  if(!done){
   store.run("UPDATE events SET description=REPLACE(description,'Todos los cargos incluidos.','Valores base más IVA del 19%. General: $50.000 + $9.500 IVA = $59.500. Preferencial: $79.900 + $15.181 IVA = $95.081. Sin cargos de servicio adicionales.') WHERE id=?",eventId);
   store.platformAudit(null,'private-vat-update','official_vat_applied',eventId,VAT_BATCH);
  }
  return {changed:!done,vatRate:19,prices:store.eventTypes(eventId).map(t=>({name:t.name,...t.pricing})),preservedPaymentAttempts:store.get('SELECT COUNT(*) n FROM payment_attempts WHERE event_id=?',eventId).n,preservedOrders:store.get('SELECT COUNT(*) n FROM orders WHERE event_id=?',eventId).n};
 });
}
export function runOfficialVatTask(store,path=fileURLToPath(new URL('../ops/official-vat.json',import.meta.url))){
 const claimed=`${path}.${process.pid}.running`;try{renameSync(path,claimed);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 let result;try{const task=JSON.parse(readFileSync(claimed,'utf8'));if(Object.keys(task).join(',')!=='batch'||task.batch!==VAT_BATCH)throw new Error('Invalid VAT task');result=applyOfficialVat(store);}catch{result={status:'failed'};}
 unlinkSync(claimed);console.log(JSON.stringify({timestamp:new Date().toISOString(),level:result.status==='failed'?'ERROR':'INFO',message:JSON.stringify({operation:'official_vat_update',...result})}));return result;
}
