import {AppError} from './store.mjs';
const fail=(status,message)=>{throw new AppError(status,message);};
const uuid=/^[a-f0-9-]{36}$/i;
export function normalizeSeatIds(input){
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length<1||input.length>6||input.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(input).size!==input.length)fail(400,'Selecciona entre 1 y 6 sillas diferentes.');
 return [...input].sort();
}
export function publicSeatMap(store,eventId,time=Date.now()){
 return store.all(`SELECT s.id,s.type_id AS typeId,s.row_label AS row,s.seat_number AS number,CASE WHEN b.seat_id IS NOT NULL THEN 'unavailable' WHEN a.ticket_id IS NOT NULL THEN 'sold' WHEN a.payment_id IS NOT NULL AND a.expires_at>? AND p.state='pending' THEN 'reserved' ELSE 'available' END AS status FROM event_seats s JOIN ticket_types t ON t.id=s.type_id LEFT JOIN ticket_type_visibility v ON v.type_id=t.id LEFT JOIN seat_blocks b ON b.seat_id=s.id LEFT JOIN seat_allocations a ON a.seat_id=s.id LEFT JOIN payment_attempts p ON p.id=a.payment_id WHERE s.event_id=? AND COALESCE(v.visibility,'public')='public' ORDER BY s.row_label,s.seat_number`,time,eventId);
}
export function selectedSeats(store,eventId,typeId,quantity,input,time=Date.now()){
 const ids=normalizeSeatIds(input),type=store.get("SELECT t.id FROM ticket_types t LEFT JOIN ticket_type_visibility v ON v.type_id=t.id WHERE t.id=? AND t.event_id=? AND COALESCE(v.visibility,'public')='public'",typeId,eventId);
 if(!type)fail(400,'Localidad no disponible para compra.');
 const count=store.get('SELECT COUNT(*) n FROM event_seats WHERE type_id=?',typeId).n;
 if(!count){if(ids.length)fail(400,'Esta localidad no tiene sillas numeradas.');return [];}
 if(ids.length!==quantity)fail(400,'Elige una silla por cada entrada.');
 // Called only inside the checkout/order transaction, before checking availability.
 store.run("DELETE FROM seat_allocations WHERE ticket_id IS NULL AND (expires_at<=? OR payment_id IN (SELECT id FROM payment_attempts WHERE state!='pending'))",time);
 const seats=ids.map(id=>store.get('SELECT id,type_id,row_label,seat_number FROM event_seats WHERE id=? AND event_id=?',id,eventId));
 if(seats.some(seat=>!seat||seat.type_id!==typeId))fail(400,'Las sillas deben pertenecer a la localidad seleccionada.');
 for(const seat of seats)if(store.get('SELECT seat_id FROM seat_blocks WHERE seat_id=?',seat.id)||store.get('SELECT seat_id FROM seat_allocations WHERE seat_id=?',seat.id))fail(409,'Una de las sillas ya está reservada o vendida. Elige otra.');
 return seats.sort((a,b)=>a.row_label.localeCompare(b.row_label)||a.seat_number-b.seat_number);
}
export function holdSeats(store,seats,paymentId,expiresAt){for(const seat of seats)store.run('INSERT INTO seat_allocations(seat_id,payment_id,expires_at) VALUES(?,?,?)',seat.id,paymentId,expiresAt);}
export function paymentSeats(store,paymentId){return store.all('SELECT s.id,s.row_label AS row,s.seat_number AS number,s.type_id AS typeId FROM seat_allocations a JOIN event_seats s ON s.id=a.seat_id WHERE a.payment_id=? ORDER BY s.row_label,s.seat_number',paymentId);}
export function heldSeatsMatch(store,row,time){
 const count=store.get('SELECT COUNT(*) n FROM event_seats WHERE type_id=?',row.type_id).n;if(!count)return true;
 return store.get('SELECT COUNT(*) n FROM seat_allocations WHERE payment_id=? AND ticket_id IS NULL AND expires_at>?',row.id,time).n===row.quantity;
}
export function assignSeat(store,seat,ticketId,paymentId=null){
 if(paymentId){const result=store.run('UPDATE seat_allocations SET ticket_id=?,expires_at=NULL WHERE seat_id=? AND payment_id=? AND ticket_id IS NULL',ticketId,seat.id,paymentId);if(result.changes!==1)fail(409,'No se pudo confirmar la silla reservada.');}
 else store.run('INSERT INTO seat_allocations(seat_id,ticket_id) VALUES(?,?)',seat.id,ticketId);
 store.run('INSERT INTO ticket_seats VALUES(?,?)',ticketId,seat.id);
}
export function seatLabel(store,ticketId){const seat=store.get('SELECT s.row_label,s.seat_number FROM ticket_seats t JOIN event_seats s ON s.id=t.seat_id WHERE t.ticket_id=?',ticketId);return seat?`${seat.row_label}${seat.seat_number}`:null;}
