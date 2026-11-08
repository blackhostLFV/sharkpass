import {summarizePricing} from "/pricing.js?v=20261108-iva19";
export function mountSeatPicker(container,event,{el,button,money,onChoose}){
 const format=(type,q=1)=>{const p=summarizePricing(type.pricing,q,type.price_cop*q);return p?`Base ${money(p.baseCop)} + IVA (${p.vatRate}%) ${money(p.vatCop)} = Total ${money(p.totalCop)}`:money(type.price_cop*q);};
 const selected=new Set(),types=new Map(event.types.map(type=>[type.id,type]));let typeId=null;
 const section=el('section',null,{class:'seat-picker','aria-labelledby':'seat-picker-title'});section.append(el('h2','Elige tu silla',{id:'seat-picker-title'}),el('p','El escenario está al frente. Preferencial en dorado y General en azul. Hasta 6 sillas de una localidad por compra.',{class:'seat-picker-intro'}));
 const legend=el('div',null,{class:'seat-legend'});for(const type of event.types.filter(type=>event.seats.some(seat=>seat.typeId===type.id))){const gold=/preferencial/i.test(type.name);legend.append(el('span',`${type.name} · ${format(type)}`,{class:gold?'seat-legend-gold':'seat-legend-blue'}));}legend.append(el('span','No disponible',{class:'seat-legend-busy'}));section.append(legend);
 const scroll=el('div',null,{class:'seat-map-scroll',tabindex:'0',role:'region','aria-label':'Mapa de sillas. Desliza horizontalmente si lo necesitas.'}),map=el('div',null,{class:'numbered-seat-map'});map.append(el('div','ESCENARIO',{class:'seat-stage'}));
 const buttons=new Map();
 const status=el('p','Selecciona tus sillas.',{class:'seat-selection-status',role:'status','aria-live':'polite'}),summary=el('strong','',{class:'seat-selection-total'}),choose=button('Añadir sillas al carrito',async()=>{if(!selected.size)return;await onChoose(types.get(typeId),[...selected].sort());},'checkout-primary');choose.disabled=true;
 const update=()=>{for(const [id,b] of buttons){b.setAttribute('aria-pressed',String(selected.has(id)));}const type=types.get(typeId);status.textContent=selected.size?`${type.name} · Sillas ${event.seats.filter(seat=>selected.has(seat.id)).map(seat=>seat.row+seat.number).join(', ')}`:'Selecciona tus sillas.';summary.textContent=selected.size?format(type,selected.size):'';choose.disabled=!selected.size;};
 for(const row of [...new Set(event.seats.map(seat=>seat.row))]){
  const line=el('div',null,{class:'seat-row'});line.append(el('span',row,{class:'seat-row-label','aria-hidden':'true'}));
  for(const seat of event.seats.filter(seat=>seat.row===row)){
   const type=types.get(seat.typeId),gold=/preferencial/i.test(type.name),busy=seat.status!=='available';
   const b=button(String(seat.number),()=>{if(typeId!==seat.typeId){selected.clear();typeId=seat.typeId;}if(selected.has(seat.id))selected.delete(seat.id);else{if(selected.size===6){status.textContent='Puedes elegir hasta 6 sillas por compra.';return;}selected.add(seat.id);}update();},`numbered-seat ${gold?'seat-preferential':'seat-general'}`);
   const stateLabel={unavailable:'Vendida',sold:'Vendida',reserved:'Reservada'}[seat.status]??'No disponible';
   b.replaceChildren(el('span',String(seat.number),{class:'seat-number','aria-hidden':'true'}));
   if(busy)b.append(el('span',stateLabel,{class:'seat-state-ribbon','aria-hidden':'true'}));
   b.disabled=busy;b.dataset.seatStatus=seat.status;b.setAttribute('aria-label',`Silla ${seat.row}${seat.number}, ${type.name}, ${format(type)}, ${busy?stateLabel.toLowerCase():'disponible'}`);b.setAttribute('aria-pressed','false');buttons.set(seat.id,b);line.append(b);
  }map.append(line);
 }scroll.append(map);section.append(scroll,el('p','En móvil puedes deslizar el mapa. Elegir una silla todavía no la reserva; la reserva se confirma al preparar el pago.',{class:'seat-map-help'}));
 const selection=el('div',null,{class:'seat-selection'});selection.append(status,summary,choose);section.append(selection);container.append(section);
}
