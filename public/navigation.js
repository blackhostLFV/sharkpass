// Non-modal disclosure: no focus trap; all destinations remain native navigation controls.
export function setupMobileNavigation(doc,win) {
  const toggle=doc.querySelector('#menu-toggle');
  const nav=doc.querySelector('#site-navigation');
  const header=doc.querySelector('.site-header');
  if(!toggle||!nav||!header)return;
  const mobile=win.matchMedia('(max-width: 780px)');
  const opened=()=>toggle.getAttribute('aria-expanded')==='true';
  function setOpen(value,restoreFocus=false){
    header.dataset.menuOpen=String(value);
    toggle.setAttribute('aria-expanded',String(value));
    toggle.setAttribute('aria-label',value?'Cerrar menú':'Abrir menú');
    if(restoreFocus)toggle.focus();
  }
  toggle.addEventListener('click',()=>setOpen(!opened()));
  nav.addEventListener('click',event=>{
    if(event.target.closest('button,a')&&!event.target.closest('button:disabled'))setOpen(false,mobile.matches);
  });
  doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&opened()){
      event.preventDefault();setOpen(false,true);
    }
  });
  doc.addEventListener('click',event=>{
    if(opened()&&(!header.contains(event.target)||event.target.closest('#cart-access')))setOpen(false);
  });
  mobile.addEventListener('change',()=>setOpen(false));
  setOpen(false);
}

// Internal navigation gets a real browser history entry. Back/forward only render.
export function createRouteHistory(win){
 let started=false,restoring=0;
 return {
  start(){started=true;},
  get restoring(){return restoring>0;},
  navigate(path,{replace=false}={}){
   if(restoring)return;
   const target=new URL(path,win.location.href),current=new URL(win.location.href);
   if(target.origin!==current.origin)throw new Error('La navegación debe permanecer en SharkPass.');
   const route=target.pathname+target.search+target.hash;
   if(route===current.pathname+current.search+current.hash)return;
   win.history[!started||replace?'replaceState':'pushState'](null,'',route);
  },
  async restore(render){restoring++;try{return await render();}finally{restoring--;}}
 };
}
