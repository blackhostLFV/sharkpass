// COP integers, VAT rounded per ticket. Totals always use the frozen quote when present.
export function ticketPricing(baseCop,vatRate=0){
 if(!Number.isSafeInteger(baseCop)||baseCop<0||!Number.isInteger(vatRate)||vatRate<0||vatRate>100)throw new Error("Precio inválido.");
 const vatCop=Math.round(baseCop*vatRate/100);
 return {baseCop,vatRate,vatCop,totalCop:baseCop+vatCop};
}
export function summarizePricing(pricing,quantity,totalCop){
 if(!pricing||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const {baseCop,vatRate,vatCop}=pricing,expected=ticketPricing(baseCop,vatRate);
 if(expected.vatCop!==vatCop||expected.totalCop!==pricing.totalCop||pricing.totalCop*quantity!==totalCop)return null;
 return {baseCop:baseCop*quantity,vatRate,vatCop:vatCop*quantity,totalCop};
}
