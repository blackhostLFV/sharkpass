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


test('purchase navigation retains event, cart and map history; restoring Back does not create entries',async()=>{
 const {createRouteHistory}=await import('../public/navigation.js');
 const entries=['https://example.invalid/'],location={href:entries[0]};let index=0;
 const win={location,history:{pushState(_s,_t,path){entries.splice(index+1);entries.push(new URL(path,location.href).href);index++;location.href=entries[index];},replaceState(_s,_t,path){entries[index]=new URL(path,location.href).href;location.href=entries[index];}}};
 const nav=createRouteHistory(win);await nav.restore(async()=>nav.navigate('/'));nav.start();
 nav.navigate('/evento/event');nav.navigate('/?view=cart');nav.navigate('/?view=cart');
 assert.equal(entries.length,3);
 index--;location.href=entries[index];await nav.restore(async()=>{assert.equal(nav.restoring,true);nav.navigate('/?view=cart');});
 assert.equal(location.href,'https://example.invalid/evento/event');assert.equal(entries.length,3);
 nav.navigate('/evento/event#seat-picker-title');nav.navigate('/?view=cart');
 assert.equal(entries.length,4);assert.equal(entries[2],'https://example.invalid/evento/event#seat-picker-title');
 assert.throws(()=>nav.navigate('https://external.invalid/'),/SharkPass/);
 await assert.rejects(nav.restore(async()=>{throw new Error('Synthetic network failure');}));assert.equal(nav.restoring,false);
 nav.navigate('/?view=checkout');assert.equal(entries.length,5);
});
