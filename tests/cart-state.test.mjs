import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseCart,sameSelection,remainingReservationMs,formatReservation} from '../public/cart-state.js';
test('cart persists only a bounded selection and a stable idempotency key',()=>{
 const cart={version:1,eventId:randomUUID(),typeId:randomUUID(),quantity:6,key:randomUUID()};
 assert.deepEqual(parseCart(JSON.stringify({...cart,email:'never-store@example.invalid',price:1,token:'private'})),cart);
 assert.deepEqual(parseCart(JSON.stringify(parseCart(cart))),cart);
 for(const quantity of [0,-1,7,1.5,'2',null])assert.equal(parseCart({...cart,quantity}),null);
 for(const raw of ['{bad',null,{}, {...cart,eventId:'no'}, {...cart,key:'no'}])assert.equal(parseCart(raw),null);
 assert.equal(sameSelection(cart,{event:{id:cart.eventId},type:{id:cart.typeId},quantity:6}),true);
 assert.equal(sameSelection(cart,{event:{id:cart.eventId},type:{id:randomUUID()},quantity:6}),false);
});
test('reservation countdown uses server time, does not restart on reload, and never goes negative',()=>{
 const p={state:'pending',serverNow:'2031-11-25T23:00:00Z',expiresAt:'2031-11-25T23:15:00Z'};
 assert.equal(remainingReservationMs(p),900000);
 assert.equal(formatReservation(remainingReservationMs(p,61000)),'13:59');
 assert.equal(remainingReservationMs({...p,serverNow:'2031-11-25T23:10:00Z'}),300000);
 assert.equal(remainingReservationMs(p,1000000),0);
 assert.equal(remainingReservationMs({...p,state:'confirmed'}),0);
 assert.equal(remainingReservationMs({...p,serverNow:'bad'}),0);
});
