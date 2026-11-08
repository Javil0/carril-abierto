import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as financials } from '../api/financials.js';
import { GET as sec } from '../api/sec.js';
import { GET as peers } from '../api/peers.js';
// Las funciones de Vercel responden con JSON y el código de error adecuado sin llegar a la red.
test('Las funciones de /api validan la entrada y devuelven errores claros',async()=>{
 let r=await financials(new Request('https://x/api/financials?ticker=../x'));assert.equal(r.status,400);assert.match((await r.json()).error,/ticker válido/);
 r=await sec(new Request('https://x/api/sec?ticker=ITX.MC&dates=2026-01-31'));assert.equal(r.status,422);assert.match((await r.json()).error,/CNMV/);
 r=await peers(new Request('https://x/api/peers?ticker=ITX.MC'));assert.equal(r.status,400);
});
