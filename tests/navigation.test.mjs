import test from 'node:test';
import assert from 'node:assert/strict';
import {setupMobileNavigation} from '../public/navigation.js';
function fixture(){
 const node=()=>({attrs:{},dataset:{},events:{},focusCount:0,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focusCount++;}});
 const toggle=node(),nav=node(),header=node(),doc=node(),media=node();media.matches=true;
 const link={closest:s=>s==='button,a'?link:null},disabled={closest:s=>s==='button,a'||s==='button:disabled'?disabled:null},outside={closest:()=>null},cart={closest:s=>s==='#cart-access'?cart:null};
 header.contains=t=>[toggle,nav,link,disabled,cart].includes(t);
 doc.querySelector=s=>({'#menu-toggle':toggle,'#site-navigation':nav,'.site-header':header})[s];
 setupMobileNavigation(doc,{matchMedia:()=>media});
 return {toggle,nav,header,doc,media,link,disabled,outside,cart};
}
test('mobile menu exposes state and destinations, closes on Escape and restores trigger focus',()=>{
 const {toggle,header,doc}=fixture();
 assert.equal(toggle.attrs['aria-expanded'],'false');assert.equal(header.dataset.menuOpen,'false');
 toggle.events.click();assert.equal(toggle.attrs['aria-expanded'],'true');assert.equal(toggle.attrs['aria-label'],'Cerrar menú');
 let prevented=false;doc.events.keydown({key:'Escape',preventDefault(){prevented=true;}});
 assert.ok(prevented);assert.equal(toggle.attrs['aria-expanded'],'false');assert.equal(toggle.focusCount,1);
 doc.events.keydown({key:'Escape',preventDefault(){assert.fail('Closed menus must not intercept Escape');}});
});
test('menu closes for navigation, outside clicks, cart and breakpoint changes; disabled items do not navigate',()=>{
 const {toggle,nav,doc,media,link,disabled,outside,cart}=fixture();
 toggle.events.click();nav.events.click({target:disabled});assert.equal(toggle.attrs['aria-expanded'],'true');
 nav.events.click({target:link});assert.equal(toggle.attrs['aria-expanded'],'false');assert.equal(toggle.focusCount,1);
 toggle.events.click();doc.events.click({target:outside});assert.equal(toggle.attrs['aria-expanded'],'false');
 toggle.events.click();doc.events.click({target:cart});assert.equal(toggle.attrs['aria-expanded'],'false');
 toggle.events.click();media.matches=false;media.events.change();assert.equal(toggle.attrs['aria-expanded'],'false');
});
