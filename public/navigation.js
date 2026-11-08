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
