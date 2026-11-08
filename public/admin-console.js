export async function mountAdminConsole(content,{request,el,button,field,form,fmtDate,money,me}){
 const sections={overview:'Resumen',events:'Eventos',organizations:'Organizadores',users:'Usuarios',orders:'Pedidos',payments:'Pagos',tickets:'Entradas e ingresos',mail:'Correos',audit:'Auditoría'};
 const columns={
  events:[['title','Evento'],['organizer','Organizador'],['state','Estado'],['is_demo','Ambiente'],['starts_at','Fecha'],['capacity','Cupo'],['issued','Emitidas'],['used','Ingresos']],
  organizations:[['name','Organizador'],['owner','Propietario'],['events','Eventos'],['scanners','Operadores']],
  users:[['username','Usuario'],['email','Correo de acceso'],['verified','Verificado'],['platformAdmin','Administrador'],['ownerRoles','Organizador'],['scannerRoles','Operador'],['activeSessions','Sesiones']],
  orders:[['id','Referencia'],['event','Evento'],['buyer','Comprador'],['quantity','Entradas'],['total_cop','Importe COP'],['state','Estado'],['is_demo','Ambiente'],['created_at','Creado']],
  payments:[['id','Referencia'],['event','Evento'],['buyer','Comprador'],['total_cop','Importe COP'],['environment','Ambiente'],['state','Estado'],['created_at','Creado']],
  tickets:[['id','Entrada'],['event','Evento'],['locality','Localidad'],['status','Estado'],['is_demo','Ambiente'],['used_at','Ingreso'],['operator','Operador']],
  mail:[['event','Evento'],['email','Destinatario'],['state','Estado'],['attempts','Intentos'],['is_demo','Ambiente'],['sent_at','Enviado']],
  audit:[['created_at','Fecha'],['actor','Usuario'],['operator','Origen'],['action','Acción'],['target_id','Referencia'],['reason','Motivo']]
 };
 const labels={draft:'Borrador',published:'Publicado',cancelled:'Cancelado',confirmed:'Confirmado',pending:'Pendiente',failed:'Fallido',expired:'Vencido',review:'En revisión',voided:'Anulado',valid:'Válida',used:'Utilizada',void:'Anulada',queued:'En cola',sending:'Enviando',sent:'Enviado',attention:'Requiere atención',test:'DEMO / Sandbox',prod:'Comercial'};
 let section='overview',filters={q:'',state:'',environment:'all',page:1},serial=0,summary;
 const layout=el('div',null,{class:'admin-console-layout'}),aside=el('aside',null,{class:'admin-console-sidebar'}),nav=el('nav',null,{'aria-label':'Administración de la plataforma'}),workspace=el('section',null,{class:'admin-console-main'});
 aside.append(el('p','SHARKPASS ADMIN',{class:'admin-console-brand'}),el('p','Gestión de la plataforma',{class:'admin-console-caption'}));
 for(const [key,label] of Object.entries(sections)){const b=button(label,()=>open(key),'admin-console-nav');b.dataset.section=key;nav.append(b);}aside.append(nav,el('a','← Volver al sitio',{href:'/',class:'admin-console-site'}));layout.append(aside,workspace);content.append(layout);
 const refresh=button('Actualizar datos',async()=>{await loadSummary();await render();},'admin-console-refresh');
 async function loadSummary(){summary=await request('admin/dashboard');}
 function format(key,value){if(value===null||value===undefined||value==='')return '—';if(['verified','platformAdmin'].includes(key))return value?'Sí':'No';if(key==='is_demo')return value?'DEMO':'Comercial';if(key==='total_cop')return money(value);if(['created_at','starts_at','used_at','sent_at','next_at','expires_at','updated_at'].includes(key))return fmtDate(value);return labels[value]??String(value);}
 function shell(title,description){workspace.replaceChildren();const header=el('div',null,{class:'admin-console-heading'}),copy=el('div');copy.append(el('h2',title),el('p',description));header.append(copy,refresh);workspace.append(header);}
 async function open(key,preset={}){section=key;filters={q:'',state:'',environment:'all',page:1,...preset};for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.section===key?'page':'false');await render();}
 function overview(){
  shell('Resumen general',`Consultado: ${fmtDate(summary.asOf)} · Los importes confirmados no son liquidaciones bancarias.`);
  const environment=el('div',null,{class:'admin-service-strip'});environment.append(el('span',`Wompi: ${summary.paymentEnvironment?labels[summary.paymentEnvironment]:'Sin configurar'}`),el('span',`Correo: ${summary.emailConfigured?'Configurado':'Pendiente'}`),el('span',`${summary.activeSessions} sesiones activas`));workspace.append(environment);
  const grid=el('div',null,{class:'admin-stat-grid'});
  for(const [label,value,hint] of [['Ventas comerciales confirmadas',money(summary.financial.commercialCop),'Pedidos comerciales vigentes'],['Importes DEMO',money(summary.financial.demoCop),'Ensayos · Sin dinero real'],['Pedidos confirmados',summary.confirmedOrders,'Comerciales y DEMO'],['Entradas sin utilizar',summary.admissions.valid,`${summary.admissions.used} utilizadas · ${summary.admissions.voided} anuladas`],['Ingresos hoy',summary.todayUsed,'Día de Colombia · America/Bogota'],['Usuarios',summary.users,'Cuentas registradas'],['Organizadores',summary.organizers,'Organizaciones en la plataforma'],['Eventos publicados',summary.published,`${summary.events} eventos en total`]]){const card=el('article',null,{class:'admin-stat'});card.append(el('p',label),el('strong',String(value)),el('small',hint));grid.append(card);}workspace.append(grid);
  const alerts=el('section',null,{class:'admin-operation-alerts','aria-label':'Revisión operativa'});for(const [count,text,key,preset] of [[summary.pending.review,'pagos requieren revisión','payments',{state:'review'}],[summary.mail.attention,'correos requieren atención','mail',{state:'attention'}],[summary.commercialDrafts,'borradores comerciales','events',{state:'draft',environment:'prod'}]])alerts.append(button(`${count} ${text} →`,()=>open(key,preset),'admin-operation-alert'));workspace.append(alerts);
  const activity=el('section',null,{class:'admin-activity'});activity.append(el('h3','Pedidos confirmados · últimos 7 días'),el('p','Compara actividad diaria. Los importes DEMO se muestran separados de los comerciales.'));const list=el('ol'),peak=Math.max(1,...summary.series.map(day=>day.orders));for(const day of summary.series){const row=el('li'),meter=el('meter',null,{min:'0',max:String(peak),value:String(day.orders),'aria-label':`${day.day}: ${day.orders} pedidos`});row.append(el('span',day.day),meter,el('strong',`${day.orders} pedidos`),el('small',`${money(day.commercialCop)} comercial · ${money(day.demoCop)} DEMO`));list.append(row);}activity.append(list);workspace.append(activity);
 }
 async function render(){
  const ticket=++serial;
  if(section==='overview'){overview();return;}
  const key=section;shell(sections[key],'Cargando registros…');
  const params=new URLSearchParams({section:key,...filters});
  let data;try{data=await request(`admin/console?${params}`);}catch(error){if(ticket!==serial)return;workspace.append(el('p',error.message,{class:'notice',role:'alert'}));return;}
  if(ticket!==serial)return;
  shell(sections[key],`${data.total} registros coinciden · Página ${data.page} de ${data.pages}`);
  const filter=el('form',null,{class:'admin-filter-form'}),query=el('label','Buscar'),input=el('input',null,{type:'search',name:'q',maxlength:'100',placeholder:'Nombre, correo o referencia'});input.value=filters.q;query.append(input);filter.append(query);
  const stateLabel=el('label','Estado'),state=el('select',null,{name:'state'});state.append(el('option','Todos',{value:''}));for(const value of data.states)state.append(el('option',labels[value]??value,{value}));state.value=filters.state;stateLabel.append(state);if(data.states.length)filter.append(stateLabel);
  const envLabel=el('label','Ambiente'),env=el('select',null,{name:'environment'});for(const [value,label] of [['all','Todos'],['prod','Comercial'],['test','DEMO / Sandbox']])env.append(el('option',label,{value}));env.value=filters.environment;envLabel.append(env);if(data.environmentFilter)filter.append(envLabel);
  filter.append(el('button','Aplicar filtros',{type:'submit',class:'admin-filter-submit'}),button('Limpiar',()=>open(key),'admin-filter-clear'));
  filter.addEventListener('submit',event=>{event.preventDefault();filters={q:input.value.trim(),state:data.states.length?state.value:'',environment:data.environmentFilter?env.value:'all',page:1};void render();});workspace.append(filter);
  const wrap=el('div',null,{class:'admin-table-scroll',tabindex:'0','aria-label':`Tabla de ${sections[key]}`}),table=el('table',null,{class:'admin-data-table'}),head=el('thead'),tr=el('tr');
  for(const [,label] of columns[key])tr.append(el('th',label,{scope:'col'}));tr.append(el('th','Registro',{scope:'col'}));head.append(tr);table.append(head);const body=el('tbody');
  for(const row of data.rows){const tr=el('tr');for(const [field] of columns[key]){const td=el('td',format(field,row[field]));if(['state','status','environment','is_demo'].includes(field))td.className='admin-status-cell';if(['id','target_id'].includes(field)){td.className='admin-reference-cell';td.title=String(row[field]??'');}tr.append(td);}const actions=el('td');actions.append(button('Ver registro',()=>details(row,key),'admin-record-open'));tr.append(actions);body.append(tr);}table.append(body);wrap.append(table);workspace.append(wrap);
  if(!data.rows.length)workspace.append(el('p','No hay registros con estos filtros.',{class:'admin-empty'}));
  const pagination=el('div',null,{class:'admin-pagination'}),previous=button('Anterior',async()=>{filters.page--;await render();},'secondary'),next=button('Siguiente',async()=>{filters.page++;await render();},'secondary');previous.disabled=data.page<=1;next.disabled=data.page>=data.pages;pagination.append(previous,el('span',`${data.total} registros · ${data.pageSize} por página`),next);workspace.append(pagination);
 }
 function details(row,key){
  serial++;shell(`Registro · ${sections[key]}`,'Información de la plataforma. Las acciones disponibles se verifican también en el servidor.');workspace.append(button('← Volver al listado',render,'admin-record-back'));
  const dl=el('dl',null,{class:'admin-record-details'});for(const [field,value] of Object.entries(row)){const label=columns[key].find(item=>item[0]===field)?.[1]??({venue:'Lugar',quantity:'Cantidad',buyer:'Comprador',locality:'Localidad',status:'Estado',used_at:'Ingreso',operator:'Operador',id:'Identificador',order_id:'Pedido',payment_id:'Pago',provider_id:'Referencia del proveedor',updated_at:'Actualizado',expires_at:'Vencimiento',next_at:'Próximo intento',created_at:'Creado',is_demo:'Ambiente'}[field]??field);dl.append(el('dt',label),el('dd',format(field,value)));}workspace.append(dl);
  if(key==='events')workspace.append(el('a','Vista previa del evento',{href:`/?previewEvent=${row.id}`,class:'admin-record-back'}));
  if(key==='events')workspace.append(button('Revisar estado del evento',()=>review(row,'event'),'admin-filter-submit'));
  if(key==='users'&&row.id!==me.id)workspace.append(button('Cerrar sesiones de esta cuenta',()=>review(row,'user'),'secondary'));
  if(key==='payments')workspace.append(el('p','El estado del pago procede de Wompi. Este panel no fuerza aprobaciones ni ejecuta reembolsos.',{class:'admin-record-note'}));
  if(key==='tickets')workspace.append(el('p','El QR es privado del comprador. Aquí se consulta su estado; no se descarga ni se reactiva una entrada utilizada.',{class:'admin-record-note'}));
 }
 function review(row,type){
  const event=type==='event';shell(event?'Revisar estado del evento':'Cerrar sesiones de usuario','La acción requiere tu contraseña actual y un motivo. Se registra en auditoría.');workspace.append(el('p',event?`${row.title}. Cancelar invalida las entradas; no ejecuta reembolsos. Un evento con entradas emitidas no se puede ocultar.`:'Se cerrarán las sesiones vigentes. La contraseña y los pedidos de esa persona se conservan.',{class:'notice'}));
  const feedback=el('p','',{role:'alert',class:'admin-action-feedback',tabindex:'-1'});feedback.hidden=true;
  const f=form(async data=>{try{await request(event?`admin/events/${row.id}/state`:`admin/users/${row.id}/revoke-sessions`,'POST',data);f.reset();await loadSummary();await render();}catch(error){feedback.hidden=false;feedback.textContent=error.message;feedback.focus();throw error;}},'Confirmar acción');f.className='admin-action-form';
  if(event){const label=el('label','Nuevo estado'),select=el('select',null,{name:'state',required:''});for(const [value,text] of [['','Selecciona'],['published','Publicar'],['draft','Volver a borrador'],['cancelled','Cancelar evento y entradas']])select.append(el('option',text,{value}));label.append(select);f.append(label);}
  const reason=field(f,'Motivo (mínimo 12 caracteres)','reason','textarea');reason.minLength=12;reason.maxLength=500;const password=field(f,'Tu contraseña actual','password','password');password.autocomplete='current-password';f.append(feedback);f.appendSubmit();workspace.append(f,button('Volver sin cambios',render,'secondary'));
 }
 await loadSummary();await open('overview');
}
