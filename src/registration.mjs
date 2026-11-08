import {AppError} from './store.mjs';
export function saleRules(store,eventId){const row=store.get('SELECT * FROM event_sale_rules WHERE event_id=?',eventId);return row?{requireAttendees:Boolean(row.require_attendees),version:row.terms_version,terms:JSON.parse(row.terms_json)}:null;}
export function checkoutRegistration(store,eventId,quantity,input){
 const rules=saleRules(store,eventId);if(!rules?.requireAttendees)return null;
 if(input.acceptTerms!==true||input.termsVersion!==rules.version)throw new AppError(400,'Lee y acepta las condiciones vigentes del evento.');
 if(!Array.isArray(input.attendees)||input.attendees.length!==quantity||input.attendees.some(name=>typeof name!=='string'||name.trim().length<2||name.trim().length>120))throw new AppError(400,'Registra el nombre completo de cada asistente.');
 return {attendees:input.attendees.map(name=>name.trim()),termsVersion:rules.version};
}
export function attendeeName(store,ticketId){return store.get('SELECT full_name FROM ticket_attendees WHERE ticket_id=?',ticketId)?.full_name??null;}
