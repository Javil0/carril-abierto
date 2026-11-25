import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAMODARAN } from '../public/damodaran.mjs';
import { historicalInputs, defaultAssumptions, computeWacc, valuation, sensitivity, runDcf, releverBeta, companyProfile, industryRow } from '../public/dcf.mjs';
import { defaultGroup } from '../public/peers.mjs';
import { parseEcb } from '../lib/market.mjs';
const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,a+' ≠ '+b);

// Caso calculado a mano: 2 años, sin convención de mitad de año, WACC 10 %, g∞ 2 %.
// Año 1: ingresos 1.100; NOPAT 220 × 0,75 = 165; + 55 − 66 − 11 = FCFF 143; VP 130.
// Año 2: ingresos 1.210; NOPAT 181,5; + 60,5 − 72,6 − 12,1 = FCFF 157,3; VP 130.
// VT = 157,3 × 1,02 / 0,08 = 2.005,575; VP 1.657,5. EV = 1.917,5. Patrimonio = 1.917,5 − (300 − 100) − 17,5 = 1.700; 17 por acción.
const base={revenue:1000,debt:300,cash:100,minorities:17.5,shares:100};
const a={years:2,growth:.10,margin:.20,tax:.25,daPct:.05,capexPct:.06,nwcPct:.01,tvMethod:'gordon',terminalGrowth:.02,midYear:false};
test('DCF calculado a mano: FCFF, valor terminal, EV, patrimonio y valor por acción',()=>{
 const r=valuation(base,a,.10);assert.deepEqual(r.errors,[]);
 close(r.rows[0].fcff,143);close(r.rows[1].fcff,157.3);close(r.rows[0].pv,130);close(r.rows[1].pv,130);
 close(r.tv,2005.575);close(r.pvTv,1657.5);close(r.ev,1917.5);close(r.equity,1700);close(r.perShare,17);
 close(r.tvShare,1657.5/1917.5);
});
test('Convención de mitad de año: los flujos se descuentan medio año antes y el valor terminal al final del año n',()=>{
 const r=valuation(base,{...a,midYear:true},.10);close(r.rows[0].factor,Math.pow(1.1,-.5));close(r.rows[1].factor,Math.pow(1.1,-1.5));close(r.pvTv,1657.5);
});
test('Gordon y múltiplo de salida son coherentes entre sí',()=>{
 const g=valuation(base,a,.10),m=valuation(base,{...a,tvMethod:'multiple',exitMultiple:g.impliedMultiple},.10);
 close(m.tv,g.tv,1e-6);close(m.impliedGrowth,.02,1e-9);close(m.ev,g.ev,1e-6);
});
test('WACC por CAPM con beta reapalancada (Hamada) y prima de riesgo país',()=>{
 // βL = 0,8 × (1 + 0,75 × 0,25) = 0,95; Ke = 4 % + 0,95 × (5 % + 1 %) = 9,7 %; Kd neto = 5 % × 0,8 = 4 %; pesos 80/20 → 8,56 %.
 const w=computeWacc({waccMode:'capm',betaU:.8,de:.25,relevTax:.25,rf:.04,erp:.05,crp:.01,kd:.05,tax:.20});
 close(w.betaL,.95);close(w.ke,.097);close(w.kdAfter,.04);close(w.wE,.8);close(w.wacc,.0856);
 const over=computeWacc({waccMode:'capm',betaU:.8,de:.25,relevTax:.25,betaOverride:1.2,rf:.04,erp:.05,crp:0,kd:.05,tax:.2});close(over.betaL,1.2);
 assert.equal(computeWacc({waccMode:'direct',waccDirect:.09}).wacc,.09);
});
test('Sin coste de la deuda o sin tipo libre de riesgo el WACC queda pendiente, nunca se inventa',()=>{
 const w=computeWacc({waccMode:'capm',betaU:1,de:.1,relevTax:.25,rf:null,erp:.05,crp:0,kd:null,tax:.2});
 assert.equal(w.wacc,null);assert.ok(w.missing.includes('tipo libre de riesgo'));assert.ok(w.missing.includes('coste de la deuda'));
 // Sin deuda, el coste de la deuda no hace falta.
 close(computeWacc({waccMode:'capm',betaU:1,de:0,relevTax:.25,rf:.04,erp:.05,crp:0,kd:null,tax:.2}).wacc,.09);
});
test('Reapalancar la beta desapalancada de Damodaran con su D/E y su tipo marginal devuelve su beta apalancada',()=>{
 let n=0;
 for(const reg of Object.values(DAMODARAN.regions))for(const[name,r]of Object.entries(reg.industries)){close(releverBeta(r[4],r[2],reg.marginalTax),r[1],2e-3);n++;}
 assert.ok(n>=280,'Se comprueban '+n+' industrias');
 assert.equal(DAMODARAN.updated,'2026-01-05');
});
test('Bloqueos: g ≥ WACC, banca y moneda de cotización distinta',()=>{
 const r=valuation(base,{...a,terminalGrowth:.10},.10);assert.ok(r.errors.some(e=>/menor que el WACC/.test(e)));
 const hist={base,currency:'USD'},asm={...a,waccMode:'direct',waccDirect:.10};
 const bank=runDcf({hist,profile:companyProfile('SAN.MC'),assumptions:asm,currency:'EUR'});assert.equal(bank.blocks.length,1);assert.equal(bank.ev,undefined);
 const fx=runDcf({hist,profile:{industry:'Semiconductor'},assumptions:asm,market:{price:10,priceCurrency:'USD'},currency:'TWD'});
 assert.equal(fx.upside,null);assert.ok(fx.warnings.some(w=>/no se compara con la cotización/.test(w)));
 const ok=runDcf({hist,profile:{industry:'Semiconductor'},assumptions:asm,market:{price:20,priceCurrency:'USD'},currency:'USD'});close(ok.upside,17/20-1);
});
test('La tabla de sensibilidad tiene en el centro el caso base',()=>{
 const s=sensitivity(base,a,.10);close(s.cells[2][2],17);assert.equal(s.cells.length,5);assert.ok(s.cells[0][2]>s.cells[4][2],'Más WACC, menos valor');assert.ok(s.cells[2][4]>s.cells[2][0],'Más g, más valor');
});
test('Perfil de Damodaran: industria, país y región; respaldo por grupo si Damodaran no clasifica la empresa',()=>{
 assert.deepEqual(companyProfile('ITX.MC'),{industry:'Retail (Special Lines)',country:'Spain',region:'europe',source:'damodaran'});
 assert.equal(companyProfile('MCD').industry,'Restaurant/Dining');
 const vw=companyProfile('VOW3.DE',defaultGroup('VOW3.DE'));assert.equal(vw.source,'group');assert.equal(vw.industry,'Auto & Truck');assert.equal(vw.region,'europe');
 assert.equal(companyProfile('ZZZZ').industry,null);
 close(industryRow('us','Restaurant/Dining').betaU,DAMODARAN.regions.us.industries['Restaurant/Dining'][4]);
});
const fx=JSON.parse(readFileSync(new URL('./fixtures/yahoo_mcd_dcf.json',import.meta.url)));
const periods=Object.keys(fx).filter(k=>k!=='_fuente').sort().reverse().map(date=>({date,currency:'USD',values:fx[date]}));
test('McDonald\'s (datos reales): supuestos históricos con su fórmula',()=>{
 const h=historicalInputs(periods,'2025-12-31'),v=fx['2025-12-31'];
 close(h.tax.value,(2334+2121+2053)/(10897+10345+10522));
 close(h.growth.value,Math.pow(26885/23182,1/3)-1);
 close(h.kd.value,1582/((54814+51948)/2));
 close(h.capexPct.value,(3365/26885+2775/25920+2357/25495)/3);
 close(h.nwcPct.value,(-106/26885+438/25920+108/25495)/3);
 assert.equal(h.base.minorities,0); // Patrimonio total −1.791 M frente a −1.790 M de accionistas: minoritarios negativos, no se restan.assert.equal(h.base.shares,v.shares);
 // Con patrimonio contable negativo, la D/E se calcula a valor de mercado y sigue siendo interpretable.
 const asm=defaultAssumptions(h,companyProfile('MCD'),{price:280,priceCurrency:'USD',rf:.045});
 close(asm.de,54814e6/(280*v.shares),1e-12);assert.equal(asm.equityValueSource,'price');
 const r=runDcf({hist:h,profile:companyProfile('MCD'),assumptions:asm,market:{price:280,priceCurrency:'USD'},currency:'USD'});
 assert.deepEqual(r.errors,[]);assert.ok(r.wacc.wacc>.05&&r.wacc.wacc<.12);assert.ok(r.perShare>0);
});
test('Curva del BCE: toma la observación más reciente',()=>{
 const json={dataSets:[{series:{'0:0:0':{observations:{'0':[3.36],'1':[3.32],'2':[3.31]}}}}],structure:{dimensions:{observation:[{values:[{id:'2026-11-20'},{id:'2026-11-23'},{id:'2026-11-24'}]}]}}};
 assert.deepEqual(parseEcb(json),{date:'2026-11-24',rate:.0331});assert.equal(parseEcb({}),null);
});
