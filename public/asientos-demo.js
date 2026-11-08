// Standalone design demonstration: no API requests, inventory or persistence.
const selected=new Map(),seats=new Map();
const money=value=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
const occupied=new Set(['A3','A4','B7','B8','C1','D10','E6','F4','F5','G11','H2']);
const feedback=document.querySelector('#feedback');
function render(){
 const list=document.querySelector('#chosen');list.replaceChildren();
 for(const [id,seat] of selected){const li=document.createElement('li'),text=document.createElement('span'),remove=document.createElement('button');text.textContent=`Fila ${seat.row} · Puesto ${seat.number} · ${money(seat.price)}`;remove.textContent='×';remove.setAttribute('aria-label',`Quitar puesto ${id}`);remove.onclick=()=>toggle(id);li.append(text,remove);list.append(li);}
 for(const [id,seat] of seats)seat.button.setAttribute('aria-pressed',String(selected.has(id)));
 document.querySelector('#total').textContent=money([...selected.values()].reduce((sum,seat)=>sum+seat.price,0));
 document.querySelector('#empty').hidden=selected.size>0;document.querySelector('#review').disabled=selected.size===0;document.querySelector('#review-panel').hidden=true;
}
function toggle(id){const seat=seats.get(id);if(!seat||occupied.has(id))return;if(selected.has(id))selected.delete(id);else{if(selected.size===6){feedback.textContent='Puedes elegir hasta 6 puestos. Quita uno para cambiarlo.';return;}selected.set(id,seat);}feedback.textContent=`${selected.size} ${selected.size===1?'puesto seleccionado':'puestos seleccionados'}.`;render();}
for(const [index,row] of [...'ABCDEFGH'].entries()){
 const line=document.createElement('div');line.className='row';line.setAttribute('role','group');line.setAttribute('aria-label',`Fila ${row}`);
 const label=()=>{const span=document.createElement('span');span.className='row-label';span.textContent=row;span.setAttribute('aria-hidden','true');return span;};line.append(label());
 for(let number=1;number<=12;number++){if(number===7)line.append(document.createElement('span'));const id=row+number,button=document.createElement('button'),price=index<4?80000:50000;button.className='seat';button.type='button';button.textContent=number;button.disabled=occupied.has(id);button.setAttribute('aria-label',`Fila ${row}, puesto ${number}, ${index<4?'Preferencial':'General'}, ${money(price)}${button.disabled?', ocupado':''}`);button.setAttribute('aria-pressed','false');button.onclick=()=>toggle(id);seats.set(id,{row,number,price,button});line.append(button);}
 line.append(label());document.querySelector(index<4?'#front':'#back').append(line);
}
document.querySelector('#clear').onclick=()=>{selected.clear();render();feedback.textContent='Selección vacía.';};
document.querySelector('#review').onclick=()=>{const panel=document.querySelector('#review-panel');document.querySelector('#review-copy').textContent=`Puestos ${[...selected.keys()].join(', ')}. Total ilustrativo: ${document.querySelector('#total').textContent}. No se ha reservado ningún puesto.`;panel.hidden=false;panel.focus();};render();
