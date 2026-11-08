import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { Store } from '../src/store.mjs';
import { createApp } from '../src/server.mjs';
test('www redirects to configured origin; untrusted origins cannot authenticate', async () => {
  const store = new Store(':memory:');
  const {server} = createApp({store,publicUrl:'https://sharkpass.co',paymentConfig:null,mailConfig:{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const canonical=await new Promise((resolve,reject)=>{
      http.get(base+'/?demo=1',{headers:{Host:'www.sharkpass.co'}},res=>{res.resume();resolve({status:res.statusCode,location:res.headers.location});}).on('error',reject);
    });
    assert.equal(canonical.status,308);
    assert.equal(canonical.location,'https://sharkpass.co/?demo=1');
    const regular=await fetch(base+'/api/health',{headers:{host:'sharkpass.co'}});
    assert.equal(regular.status,200);
    const denied=await fetch(base+'/api/login',{method:'POST',headers:{host:'sharkpass.co',origin:'https://untrusted.invalid','content-type':'application/json'},body:'{}'});
    assert.equal(denied.status,403);
  } finally {await new Promise(resolve=>server.close(resolve));store.close();}
});
