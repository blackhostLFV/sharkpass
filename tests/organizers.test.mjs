import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateGrossRevenue} from '../public/organizers.js';

test('organizer illustration estimates gross sales in whole pesos, including zero and the supported boundary',()=>{
  assert.equal(estimateGrossRevenue(50000,60),3000000);
  assert.equal(estimateGrossRevenue(0,60),0);
  assert.equal(estimateGrossRevenue(50000,0),0);
  assert.equal(estimateGrossRevenue(500000,500),250000000);
});

test('organizer estimate rejects invalid amounts instead of displaying misleading totals',()=>{
  for(const [price,quantity] of [[-1,10],[500001,10],[50000,-1],[50000,501],[50000,1.5],[1.5,10],[NaN,10],[Infinity,10],['50000',10]]) {
    assert.throws(()=>estimateGrossRevenue(price,quantity),RangeError);
  }
});
