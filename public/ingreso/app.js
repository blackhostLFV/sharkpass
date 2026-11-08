import {normalizeCode,scanDecision} from './state.js';
const $=selector=>document.querySelector(selector);
let user=null,events=[],selected=null,busy=false,mode='ready',admitted=0,stream=null,detector=null,frame=null,cameraGeneration=0,detecting=false,lastDetection=0,installPrompt=null,serverReachable=null;
const supportedCamera='BarcodeDetector' in window&&Boolean(navigator.mediaDevices?.getUserMedia);
function message(text=''){ $('#message').textContent=text;$('#message').hidden=!text; }
async function api(path,method='GET',data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});const body=await response.json();serverReachable=response.status<500;connectionLabel();if(!response.ok){const error=new Error(body.error||'No se pudo completar la operación.');error.status=response.status;throw error;}return body;}
 catch(error){if(!error.status){serverReachable=false;connectionLabel();}throw error;}finally{clearTimeout(timer);}
}
function result(decision){mode=decision.state;$('#result').dataset.state=mode;$('#result-symbol').textContent=decision.symbol;$('#result-kicker').textContent=decision.kicker;$('#result-title').textContent=decision.title;$('#result-description').textContent=decision.description;$('#next').hidden=['ready','busy'].includes(mode);$('#reconnect').hidden=mode!=='unknown';if(!['ready','busy'].includes(mode)&&matchMedia('(max-width:780px)').matches)$('#result').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});controls();}
function ready(){result({state:'ready',symbol:'—',kicker:'LISTO PARA VALIDAR',title:'Esperando una entrada',description:'Cada boleta se consulta en el servidor y permite un solo ingreso.'});$('#code').value='';if(!stream)$('#code').focus({preventScroll:true});}
function controls(){const disabled=busy||mode!=='ready'||!navigator.onLine||!selected;$('#validate').disabled=disabled;$('#code').disabled=disabled;$('#start-camera').disabled=disabled||Boolean(stream)||!supportedCamera;$('#next').disabled=busy||!navigator.onLine;$('#change-event').disabled=busy;$('#logout').disabled=busy;}
function connectionLabel(){const offline=!navigator.onLine;$('#connection').dataset.offline=String(offline||serverReachable===false);$('#connection').textContent=offline?'Sin conexión · No se pueden autorizar entradas':serverReachable===false?'Servidor sin respuesta · No autorizar ingresos':serverReachable?'Servidor disponible · Validación en línea':'Red disponible · Comprobando servidor';}
function connectivity(){const offline=!navigator.onLine;connectionLabel();controls();if(offline){stopCamera();if(selected&&!busy)result(scanDecision(0));}}
function stopCamera(){cameraGeneration++;if(frame)cancelAnimationFrame(frame);frame=null;stream?.getTracks().forEach(track=>track.stop());stream=null;$('#camera').srcObject=null;$('#camera-area').hidden=true;$('#camera-idle').hidden=false;$('#stop-camera').hidden=true;controls();}
async function startCamera(){
 if(!supportedCamera||busy||!selected||!navigator.onLine||mode!=='ready')return;
 stopCamera();const generation=cameraGeneration;
 $('#start-camera').disabled=true;message();
 try{
  if(BarcodeDetector.getSupportedFormats&&!(await BarcodeDetector.getSupportedFormats()).includes('qr_code'))throw new Error('QR no compatible');
  detector=new BarcodeDetector({formats:['qr_code']});const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(generation!==cameraGeneration||!selected){acquired.getTracks().forEach(track=>track.stop());return;}
  stream=acquired;$('#camera').srcObject=stream;$('#camera-area').hidden=false;$('#camera-idle').hidden=true;$('#stop-camera').hidden=false;await $('#camera').play();
  if(generation!==cameraGeneration)return;
  const tick=async time=>{
   if(generation!==cameraGeneration||!stream)return;
   if(!busy&&mode==='ready'&&!document.hidden&&!detecting&&time-lastDetection>150){detecting=true;lastDetection=time;try{const codes=await detector.detect($('#camera'));if(generation===cameraGeneration&&mode==='ready'&&codes.length)await validate(codes[0].rawValue);}catch{stopCamera();message('No pudimos leer la cámara. Usa un lector QR conectado o pega el código completo.');}finally{detecting=false;}}
   if(generation===cameraGeneration&&stream)frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);controls();
 }catch{stopCamera();message('No pudimos abrir la cámara. Revisa el permiso del navegador o utiliza un lector QR conectado.');}
}
async function validate(value){
 if(busy||!selected||mode!=='ready')return;
 const code=normalizeCode(value);if(!code){result({state:'denied',symbol:'×',kicker:'CÓDIGO INCOMPLETO',title:'QR no válido',description:'Lee el QR completo de la boleta; el número de referencia de la compra no sirve para validar el ingreso.'});return;}
 if(!navigator.onLine){result(scanDecision(0));return;}
 busy=true;result({state:'busy',symbol:'…',kicker:'CONSULTANDO EL SERVIDOR',title:'Validando entrada',description:'Espera la respuesta antes de autorizar el ingreso.'});
 try{const data=await api(`events/${encodeURIComponent(selected.id)}/scan`,'POST',{code});const decision=scanDecision(200,data);if(decision.state==='accepted'){decision.description=[data.attendeeName?`Asistente: ${data.attendeeName}.`:null,data.seatLabel?`Silla ${data.seatLabel}.`:null,decision.description].filter(Boolean).join(' ');admitted++;$('#session-count').textContent=`${admitted} ${admitted===1?'ingreso':'ingresos'} en esta apertura`;navigator.vibrate?.(80);}result(decision);}
 catch(error){result(scanDecision(error.status||0,{error:error.message}));if(error.status===401){stopCamera();selected=null;user=null;$('#reader').hidden=true;$('#login-panel').hidden=false;$('#logout').hidden=true;$('#operator').textContent='Acceso de operadores';message('Tu sesión venció. Inicia sesión nuevamente.');}}
 finally{busy=false;$('#code').value='';controls();}
}
async function boot(){
 message();stopCamera();$('#reader').hidden=true;$('#setup').hidden=true;$('#login-panel').hidden=true;selected=null;
 try{
  const session=await api('me');user=session.user;$('#logout').hidden=!user;$('#operator').textContent=user?(user.fullName||'Operador autorizado'):'Acceso de operadores';
  if(!user){$('#login-panel').hidden=false;return;}
  events=(await api('manage')).filter(event=>event.state==='published'&&['owner','scanner'].includes(event.role));
  $('#event').replaceChildren(new Option('Selecciona un evento',''));for(const event of events)$('#event').append(new Option(event.title,event.id));$('#setup').hidden=false;$('#open-reader').disabled=!events.length;$('#event').disabled=!events.length;$('#setup-help').textContent=events.length?'Confirma el evento antes de empezar a validar entradas.':'Tu cuenta no tiene eventos publicados para ingreso. El organizador debe autorizar tu correo en Personal de ingreso.';
 }catch{message('No pudimos comprobar tu acceso. Revisa la conexión y vuelve a cargar la app.');$('#login-panel').hidden=false;$('#operator').textContent='Acceso sin comprobar';}
 finally{connectivity();}
}
$('#login').addEventListener('submit',async event=>{event.preventDefault();const button=$('#login button');button.disabled=true;message();try{const data=new FormData(event.currentTarget);await api('login','POST',{email:String(data.get('email')).trim(),password:String(data.get('password'))});$('#login').reset();admitted=0;await boot();}catch(error){message(error.status?error.message:'No hay respuesta del servidor. Revisa tu conexión.');}finally{button.disabled=false;}});
$('#event-form').addEventListener('submit',event=>{event.preventDefault();selected=events.find(item=>item.id===$('#event').value);if(!selected)return;$('#setup').hidden=true;$('#reader').hidden=false;$('#event-title').textContent=selected.title;$('#event-date').textContent=new Intl.DateTimeFormat('es-CO',{dateStyle:'long',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(selected.starts_at));$('#demo-note').hidden=!selected.is_demo;$('#camera-help').textContent=supportedCamera?'Activa la cámara o usa un lector QR conectado que envíe con Enter. Tras cada resultado pulsa Siguiente entrada.':'Este navegador no ofrece lectura QR por cámara. Usa un lector QR conectado en modo teclado, o abre la app en un navegador compatible.';ready();connectivity();});
$('#change-event').addEventListener('click',()=>{if(busy)return;stopCamera();selected=null;void boot();});
$('#logout').addEventListener('click',async()=>{if(busy)return;busy=true;stopCamera();controls();try{await api('logout','POST',{});user=null;events=[];selected=null;admitted=0;$('#session-count').textContent='0 ingresos en esta apertura';busy=false;await boot();}catch{busy=false;controls();message('No pudimos cerrar la sesión en el servidor. Revisa la conexión e inténtalo de nuevo.');}});
$('#scan-form').addEventListener('submit',event=>{event.preventDefault();void validate($('#code').value);});
$('#next').addEventListener('click',()=>{if(!busy&&navigator.onLine){ready();$('#scanner-title')?.focus();}});
$('#start-camera').addEventListener('click',()=>void startCamera());$('#stop-camera').addEventListener('click',stopCamera);
$('#reconnect').addEventListener('click',async()=>{const button=$('#reconnect');button.disabled=true;try{await api('health');connectivity();message('El servidor responde. Vuelve a leer la misma entrada; ante una respuesta de utilizada tras un corte, consulta al coordinador.');}catch{message('El servidor todavía no responde. No autorices ingresos sin confirmar.');}finally{button.disabled=false;}});
window.addEventListener('offline',connectivity);window.addEventListener('online',connectivity);window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').hidden=false;});$('#install').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});window.addEventListener('appinstalled',()=>{$('#install').hidden=true;});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/ingreso/sw.js',{scope:'/ingreso/'}).then(registration=>{const update=()=>{$('#update-note').hidden=!registration.waiting||!navigator.serviceWorker.controller;};update();registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',update);});navigator.serviceWorker.ready.then(()=>{$('#install-status').textContent='App preparada para abrir en este dispositivo. La autorización de entradas siempre requiere conexión.';});}).catch(()=>{$('#install-status').textContent='Puedes usar el lector en el navegador. No se pudo preparar la apertura sin conexión.';});
void boot();
