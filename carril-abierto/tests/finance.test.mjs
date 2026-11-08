import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ratioAnalysis, dupontAnalysis, altmanAnalysis, previousIsComparable, contextNotes, freeCashFlow, netDebt } from '../public/finance.mjs';
import { parseFinancials, getFinancials, validateTicker } from '../lib/financials.mjs';

const period={date:'2025-12-31',currency:'USD',values:{currentAssets:420,currentLiabilities:210,cashShortTotal:160,receivables:100,debt:360,equity:600,assets:1200,cost:1080,inventory:120,revenue:1800,ebit:270,interest:30,netIncome:180,commonIncome:180,retained:250,liabilities:600,marketEquity:1500,ebitda:330,ocf:300,capex:-100,fcfReported:200}};
const previous={date:'2024-12-31',currency:'USD',values:{assets:1000,equity:500,inventory:100}};
test('Los trece ratios usan sus numeradores, denominadores y promedios',()=>{
 const expected=[2,260/210,.6,30,9,200/330,1080/110,1800/1100,15,180/1100*100,180/550*100,300/360,200/1500*100];
 assert.equal(ratioAnalysis(period,previous).length,expected.length);
 ratioAnalysis(period,previous).forEach((r,i)=>assert.ok(Math.abs(r.value-expected[i])<1e-10,r.name));
});
test('DuPont reconcilia con ROE y conserva una pérdida real',()=>{
 const roe=ratioAnalysis(period,previous).find(r=>r.id==='roe');assert.ok(Math.abs(dupontAnalysis(period,previous).value-roe.value)<1e-10);
 const loss=structuredClone(period);loss.values.commonIncome=-180;loss.values.netIncome=-180;
 assert.ok(dupontAnalysis(loss,previous).value<0);assert.ok(ratioAnalysis(loss,previous).find(r=>r.id==='roa').value<0);
});
test('Altman se calcula automáticamente y conserva todos los términos',()=>{
 assert.ok(Number.isFinite(altmanAnalysis(period).value));assert.equal(altmanAnalysis(period).terms.length,5);
 assert.ok(Math.abs(altmanAnalysis(period).value-4.244166666666667)<1e-10);
 const missing=structuredClone(period);missing.values.marketEquity=null;assert.equal(altmanAnalysis(missing).value,null);
});
test('No convierte cifras ausentes en cero, ni divide entre cero',()=>{
 const missing=structuredClone(period);missing.values.cashShortTotal=null;missing.values.interest=0;
 const rows=ratioAnalysis(missing,previous);assert.equal(rows.find(r=>r.id==='quick').value,null);assert.equal(rows.find(r=>r.id==='coverage').value,null);
 missing.values.debt=0;assert.equal(ratioAnalysis(missing,previous).find(r=>r.id==='debtAssets').value,0);
});
test('Los promedios exigen un cierre cercano y en la misma moneda',()=>{
 assert.equal(previousIsComparable(period,{...previous,currency:'EUR'}),false);
 assert.equal(previousIsComparable(period,{...previous,date:'2020-12-31'}),false);
 assert.equal(ratioAnalysis(period,{...previous,currency:'EUR'}).find(r=>r.id==='roa').value,null);
 const p=structuredClone(previous);p.values.equity=-1800;assert.equal(ratioAnalysis(period,p).find(r=>r.id==='roe').value,null);
});
const series=(code,raw,currency='USD',date='2025-12-31')=>({meta:{type:['annual'+code]},['annual'+code]:[{asOfDate:date,periodType:'12M',currencyCode:currency,reportedValue:{raw}}]});
test('El parser empareja fechas, mantiene procedencia y excluye divisas diferentes',()=>{
 const p=parseFinancials({timeseries:{result:[series('TotalAssets',1200),series('TotalRevenue',999,'USD','2024-12-31'),series('MarketCap',1500,'EUR'),series('CashAndCashEquivalents',140),series('OtherShortTermInvestments',20)]}},'TEST').periods[0];
 assert.equal(p.values.revenue,null);assert.equal(p.values.marketEquity,null);assert.equal(p.values.cashShortTotal,160);assert.equal(p.raw.find(r=>r.key==='cashShortTotal').status,'derived');assert.ok(p.warnings.length);
});
test('Un ticker inexistente o sin balance no genera datos de ejemplo',()=>{
 assert.throws(()=>parseFinancials({timeseries:{result:[]}},'BAD'),e=>e.status===404);
 assert.equal(validateTicker(' msft '),'MSFT');assert.throws(()=>validateTicker('../x'));
});
test('Propaga el límite del proveedor sin reintentos ni datos inventados',async()=>{
 await assert.rejects(getFinancials('LIMITTEST',{fetcher:async()=>new Response('',{status:429})}),e=>e.status===429);
});

const ROE_PENDING=/Patrimonio ordinario negativo/;
test('FCF usa el capex en valor absoluto, sea cual sea el signo publicado',()=>{
 assert.equal(freeCashFlow({ocf:300,capex:-100}),200);assert.equal(freeCashFlow({ocf:300,capex:100}),200);assert.equal(freeCashFlow({ocf:300,capex:null}),null);
 const burn=structuredClone(period);burn.values.ocf=50;burn.values.capex=-200;const y=ratioAnalysis(burn,previous).find(r=>r.id==='fcfYield');
 assert.ok(y.value<0);assert.match(y.reading,/FCF negativo/);
});
test('Patrimonio negativo: D/E, ROE y DuPont quedan pendientes con su motivo y se avisa',()=>{
 const neg=structuredClone(period);neg.values.equity=-200;const rows=ratioAnalysis(neg,previous);
 for(const id of ['debtEquity','roe']){const r=rows.find(r=>r.id===id);assert.equal(r.value,null);assert.match(r.reason,ROE_PENDING);}
 assert.equal(dupontAnalysis(neg,previous).value,null);assert.match(dupontAnalysis(neg,previous).reason,ROE_PENDING);
 assert.ok(contextNotes(neg).some(n=>ROE_PENDING.test(n)));
 // Cierre anterior negativo y actual positivo: la media podría salir positiva, pero no se interpreta.
 const p=structuredClone(previous);p.values.equity=-100;const roe=ratioAnalysis(period,p).find(r=>r.id==='roe');assert.equal(roe.value,null);
 // Los ratios que no dependen del patrimonio siguen disponibles.
 assert.ok(rows.find(r=>r.id==='debtAssets').value>0);assert.ok(rows.find(r=>r.id==='cfoDebt').value>0);
});
test('Deuda neta negativa se muestra como caja neta, no como apalancamiento bajo',()=>{
 const cashRich=structuredClone(period);cashRich.values.cashShortTotal=500;const r=ratioAnalysis(cashRich,previous).find(r=>r.id==='netDebtEbitda');
 assert.ok(Math.abs(r.value-(-140/330))<1e-10);assert.match(r.reading,/Caja neta/);assert.equal(netDebt(cashRich.values),-140);
 assert.ok(contextNotes(cashRich).some(n=>/Caja neta/.test(n)));
 const noDebt=structuredClone(period);noDebt.values.debt=0;const c=ratioAnalysis(noDebt,previous).find(r=>r.id==='cfoDebt');assert.equal(c.value,null);assert.match(c.reason,/Sin deuda financiera/);
 const badEbitda=structuredClone(period);badEbitda.values.ebitda=-10;assert.match(ratioAnalysis(badEbitda,previous).find(r=>r.id==='netDebtEbitda').reason,/EBITDA negativo/);
});
test('Avisa si el FCF calculado no cuadra con el publicado',()=>{
 const off=structuredClone(period);off.values.fcfReported=150;assert.ok(contextNotes(off).some(n=>/difiere/.test(n)));
 assert.ok(!contextNotes(period).some(n=>/difiere/.test(n)));
});
// Casos reales: McDonald's (patrimonio negativo) y Alphabet (caja neta), ejercicio 2025.
const fx=JSON.parse(readFileSync(new URL('./fixtures/yahoo_mcd_googl.json',import.meta.url)));
const payloadFrom=data=>({timeseries:{result:Object.entries(data).flatMap(([date,vals])=>Object.entries(vals).map(([code,raw])=>series(code,raw,'USD',date)))}});
test('MCD real: patrimonio negativo, ratios de caja disponibles y FCF cuadra con Yahoo',()=>{
 const [p25]=parseFinancials(payloadFrom(fx.MCD),'MCD').periods;const r=Object.fromEntries(p25.ratios.map(x=>[x.id,x]));
 assert.equal(r.roe.value,null);assert.equal(r.debtEquity.value,null);assert.equal(p25.dupont.value,null);
 assert.ok(Math.abs(r.fcfYield.value-7186/217180.678*100)<1e-9);          // 3,31 %
 assert.ok(Math.abs(r.cfoDebt.value-10551/54814)<1e-12);                   // 0,19 ×
 assert.ok(Math.abs(r.netDebtEbitda.value-(54814-774)/14678)<1e-12);      // 3,68 ×
 assert.equal(freeCashFlow(p25.values),p25.values.fcfReported);
});
test('GOOGL real: deuda neta negativa etiquetada como caja neta',()=>{
 const [p25]=parseFinancials(payloadFrom(fx.GOOGL),'GOOGL').periods;const nd=p25.ratios.find(x=>x.id==='netDebtEbitda');
 assert.ok(Math.abs(nd.value-(59291-126843)/180698)<1e-12);assert.match(nd.reading,/Caja neta/);
 assert.ok(contextNotes(p25).some(n=>/Caja neta/.test(n)));assert.ok(p25.ratios.find(x=>x.id==='roe').value>0);
});
