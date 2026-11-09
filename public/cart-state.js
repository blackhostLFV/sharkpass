const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function parseCart(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || value.version !== 1 || !uuid.test(value.eventId) || !uuid.test(value.typeId) || !uuid.test(value.key) || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 6) return null;
    if(value.seatIds!==undefined&&(!Array.isArray(value.seatIds)||value.seatIds.length!==value.quantity||value.seatIds.some(id=>!uuid.test(id))||new Set(value.seatIds).size!==value.seatIds.length))return null;
    return {version:1,eventId:value.eventId,typeId:value.typeId,quantity:value.quantity,key:value.key,...(value.seatIds?{seatIds:[...value.seatIds].sort()}:{}),...(uuid.test(value.paymentId ?? "") ? {paymentId:value.paymentId} : {})};
  } catch { return null; }
}
export function sameSelection(cart, payment) {
  return Boolean(cart && payment && payment.event?.id === cart.eventId && payment.type?.id === cart.typeId && payment.quantity === cart.quantity && JSON.stringify([...(cart.seatIds??[])].sort())===JSON.stringify([...(payment.seatIds??[])].sort()));
}
export function remainingReservationMs(payment, elapsed = 0) {
  const remaining = Date.parse(payment.expiresAt) - Date.parse(payment.serverNow) - Math.max(0, elapsed);
  return payment.state === "pending" && Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
}
export function formatReservation(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}

// Restore only available chairs from this event and locality; never guess a substitute.
export function restoreSeatSelection(event,cart){
 if(!cart?.seatIds||cart.eventId!==event.id)return {seatIds:[],unavailable:[]};
 const seats=new Map(event.seats.map(seat=>[seat.id,seat]));
 const available=[],unavailable=[];
 for(const id of cart.seatIds){const seat=seats.get(id);if(seat?.typeId===cart.typeId&&seat.status==='available')available.push(id);else unavailable.push(id);}
 return {seatIds:available.slice(0,6),unavailable};
}
