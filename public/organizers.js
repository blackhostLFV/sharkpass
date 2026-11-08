export function estimateGrossRevenue(priceCop, quantity) {
  if (!Number.isInteger(priceCop) || priceCop < 0 || priceCop > 500000 ||
      !Number.isInteger(quantity) || quantity < 0 || quantity > 500) {
    throw new RangeError('Usa un precio entero de 0 a 500.000 y de 0 a 500 entradas.');
  }
  return priceCop * quantity;
}

export function mountOrganizerLanding(container, {el, button, money, icon, onStart, onLogin}) {
  const hero=el('section',null,{class:'org-hero','aria-labelledby':'org-title'});
  const copy=el('div',null,{class:'org-hero-copy'});
  const title=el('h1',null,{id:'org-title'});
  title.append('Tu evento.',el('br'),el('span','Todo más simple.'));
  copy.append(el('p','SHARKPASS PARA ORGANIZADORES',{class:'org-kicker'}),title,
    el('p','Para quienes crean experiencias en el Caribe. Prepara tu evento, vende por internet y recibe a tu público con todo en orden.',{class:'org-lead'}));
  const actions=el('div',null,{class:'org-actions'});
  actions.append(button('Empezar con mi evento',onStart,'org-primary'),button('Ya tengo cuenta',onLogin,'org-text-link'));
  copy.append(actions,el('p','Crea tu cuenta, configura tu organizador y prepara un borrador antes de publicar.',{class:'org-micro'}));

  const visual=el('div',null,{class:'org-visual','aria-label':'Ilustración de una operación de entradas. Datos de ejemplo.'});
  visual.append(el('span','EJEMPLO ILUSTRATIVO',{class:'org-example-label'}));
  const board=el('div',null,{class:'org-illustration-board'}),boardHead=el('div',null,{class:'org-board-head'});
  boardHead.append(el('img',null,{src:'/brand/sharkpass-logo.svg',alt:'SharkPass',width:'72',height:'61'}),el('span','Tu espacio de organización'));
  board.append(boardHead,el('h2','Una operación conectada.'));
  const stages=el('div',null,{class:'org-stage-pills','aria-hidden':'true'});
  for(const [index,label] of ['Evento','Entradas','Ingreso'].entries())stages.append(el('span',`${index+1}. ${label}`,{class:`org-stage-${index+1}`}));
  board.append(stages,el('p','Ejemplo de entradas vendidas',{class:'org-chart-label'}));
  const chart=el('div',null,{class:'org-illustration-chart','aria-hidden':'true'});
  for(let index=1;index<=6;index++)chart.append(el('span',null,{class:`org-bar org-bar-${index}`}));
  board.append(chart,el('p','Organiza · Vende · Recibe',{class:'org-board-caption'}));
  const ticket=el('div',null,{class:'org-floating-ticket','aria-hidden':'true'});
  ticket.append(icon('ticket'),el('span','TU PRÓXIMO EVENTO'),el('strong','Entrada digital'),el('small','Un pase por persona'));
  const access=el('div',null,{class:'org-access-chip','aria-hidden':'true'});
  access.append(icon('shield'),el('div'));access.lastChild.append(el('strong','Un solo ingreso'),el('small','Validación con conexión'));
  const pause=button('Pausar animación',()=>{const paused=visual.classList.toggle('is-paused');pause.textContent=paused?'Reanudar animación':'Pausar animación';pause.setAttribute('aria-pressed',String(paused));},'org-animation-toggle');
  pause.setAttribute('aria-pressed','false');visual.append(board,ticket,access,pause);hero.append(copy,visual);container.append(hero);

  const benefits=el('section',null,{class:'org-benefits','aria-labelledby':'org-benefits-title'});
  benefits.append(el('p','POR QUÉ ORGANIZAR CON SHARKPASS',{class:'org-kicker'}),el('h2','Más claridad para ti. Mejor experiencia para tu público.',{id:'org-benefits-title'}));
  const grid=el('div',null,{class:'org-benefit-grid'});
  for(const [symbol,label,description] of [
    ['ticket','Tu venta, en un solo lugar','Publica la información, define localidades y precios y ofrece una compra desde el móvil.'],
    ['compass','Cupos bajo control','Gestiona la disponibilidad y las reservas temporales mientras tus compradores preparan el pago.'],
    ['shield','Un ingreso organizado','Autoriza a tu equipo y valida cada entrada con la PWA de acceso conectada al servidor.'],
    ['user','Resultados a la vista','Consulta pedidos, ventas y asistencia de tus eventos sin mezclar la información de otros organizadores.'],
  ]){const card=el('article');card.append(icon(symbol),el('h3',label),el('p',description));grid.append(card);}
  benefits.append(grid);container.append(benefits);

  const flow=el('section',null,{class:'org-flow','aria-labelledby':'org-flow-title'});
  flow.append(el('div',null,{class:'org-section-heading'}));flow.firstChild.append(el('p','ASÍ LO HACES',{class:'org-kicker'}),el('h2','Del plan a la puerta, paso a paso.',{id:'org-flow-title'}));
  const steps=el('ol');
  for(const [index,[label,description]] of [
    ['Prepara','Crea tu organizador y el borrador con fecha, lugar y descripción.'],
    ['Define','Añade localidades, precios y cupos; revisa la información antes de publicar.'],
    ['Vende','Comparte el evento. Las entradas se emiten cuando la compra se confirma.'],
    ['Recibe','Da acceso a tu equipo y valida las entradas el día del evento.'],
  ].entries()){const step=el('li');step.append(el('span',String(index+1).padStart(2,'0'),{class:'org-step-number'}),el('h3',label),el('p',description));steps.append(step);}
  flow.append(steps);container.append(flow);

  const simulator=el('section',null,{class:'org-simulator','aria-labelledby':'org-simulator-title'}),explanation=el('div',null,{class:'org-simulator-copy'});
  explanation.append(el('p','EXPLORA TU IDEA',{class:'org-kicker'}),el('h2','Ponle números a tu próximo evento.',{id:'org-simulator-title'}),el('p','Mueve las entradas y cambia el precio para explorar un posible ingreso por ventas. Es un ejemplo; no modifica ningún evento.'),el('p','La utilidad depende de tus costos y de las condiciones comerciales. El valor de las entradas vendidas es solo el punto de partida.',{class:'org-simulator-note'}));
  const calculator=el('div',null,{class:'org-calculator'}),priceLabel=el('label','Precio por entrada · COP',{for:'org-price'}),price=el('input',null,{id:'org-price',type:'number',min:'0',max:'500000',step:'1',value:'50000',inputmode:'numeric'});
  priceLabel.append(price);
  const quantityLabel=el('label',null,{for:'org-quantity',class:'org-quantity-label'}),quantityValue=el('output','60',{for:'org-quantity'});
  quantityLabel.append(el('span','Entradas que podrías vender'),quantityValue);
  const quantity=el('input',null,{id:'org-quantity','aria-label':'Entradas que podrías vender',type:'range',min:'0',max:'500',step:'1',value:'60'}),range=el('div',null,{class:'org-range-limits','aria-hidden':'true'});range.append(el('span','0 entradas'),el('span','500 entradas'));
  const result=el('div',null,{class:'org-estimate',role:'status','aria-live':'polite'}),amount=el('strong'),detail=el('p');
  result.append(el('span','Ingreso bruto estimado'),amount,detail);
  const update=()=>{const count=Number(quantity.value);quantityValue.value=String(count);quantityValue.textContent=String(count);try{const unit=Number(price.value);if(price.value==='')throw new RangeError();amount.textContent=money(estimateGrossRevenue(unit,count));detail.textContent=`${count} ${count===1?"entrada":"entradas"} × ${money(unit)}`;}catch{amount.textContent='—';detail.textContent='Usa un precio entero entre $0 y $500.000.';}};
  price.addEventListener('input',update);quantity.addEventListener('input',update);update();
  calculator.append(el('p','SIMULACIÓN',{class:'org-simulation-tag'}),priceLabel,quantityLabel,quantity,range,result,el('p','Ingresos brutos, antes de costos, impuestos y tarifas aplicables. No representa utilidad ni garantiza ventas.',{class:'org-calculator-disclaimer'}));
  simulator.append(explanation,calculator);container.append(simulator);
  const ending=el('section',null,{class:'org-ending'}),endingCopy=el('div');endingCopy.append(el('h2','Tu próximo evento empieza con una idea.'),el('p','Dale un espacio para crecer. Organízalo con SharkPass.'));ending.append(endingCopy,button('Empezar con mi evento',onStart,'org-primary'));container.append(ending);
}
