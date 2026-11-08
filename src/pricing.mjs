import {ticketPricing} from '../public/pricing.js';
export function typePricing(store,type){
 const row=store.get('SELECT * FROM ticket_type_pricing WHERE type_id=?',type.id);
 const pricing=row?{baseCop:row.base_cop,vatRate:row.vat_rate,vatCop:row.vat_cop,totalCop:row.total_cop}:ticketPricing(type.price_cop);
 if(pricing.totalCop!==type.price_cop)throw new Error('Ticket pricing configuration mismatch');
 return pricing;
}
export function paymentPricing(store,id){
 const row=store.get('SELECT * FROM payment_pricing WHERE payment_id=?',id);
 return row?{baseCop:row.base_cop,vatRate:row.vat_rate,vatCop:row.vat_cop,totalCop:row.total_cop}:null;
}
export function orderPricing(store,id){
 const payment=store.get('SELECT id FROM payment_attempts WHERE order_id=?',id);
 return payment?paymentPricing(store,payment.id):null;
}
