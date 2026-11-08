import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFinancials } from '../lib/financials.mjs';
import { extractSecPeriods, compareWithSec, fillFromSec, pickFact } from '../public/verify.mjs';
import { getSecFacts } from '../lib/sec.mjs';
import { buildComparison, pickPeriod, quantile, position, defaultPeers } from '../public/peers.mjs';
import { getPeerComparison } from '../lib/peers.mjs';

const read=f=>JSON.parse(readFileSync(new URL('./fixtures/'+f,import.meta.url)));
const sec=read('sec_mcd_googl.json'),yahoo=read('yahoo_mcd_googl.json'),peersFx=read('yahoo_peers_millones.json');
const series=(code,raw,date,currency='USD')=>({meta:{type:['annual'+code]},['annual'+code]:[{asOfDate:date,periodType:'12M',currencyCode:currency,reportedValue:{raw}}]});
const payload=(data,scale=1,currency='USD')=>({timeseries:{result:Object.entries(data).filter(([d])=>/^\d{4}/.test(d)).flatMap(([d,v])=>Object.entries(v).map(([c,raw])=>series(c,raw*scale,d,currency)))}});
const report=t=>parseFinancials(payload(yahoo[t]),t);

test('SEC: elige el 10-K anual más reciente y descarta trimestres',()=>{
 const g=sec.GOOGL.facts['us-gaap'];
 assert.equal(pickFact(g.Assets.units.USD,'2024-12-31','instant').val,450256e6); // reexpresión posterior gana a la original
 assert.equal(pickFact(g.Revenues.units.USD,'2025-12-31','duration').val,402836e6); // no el Q4
 assert.equal(pickFact(g.Assets.units.USD,'2025-12-24','instant').val,595281e6); // tolerancia de fechas (7 días)
 assert.equal(pickFact(g.Assets.units.USD,'2025-11-30','instant'),null);
});
test('SEC MCD: coincide salvo redondeos, deriva el pasivo y enlaza el 10-K',()=>{
 const p=report('MCD').periods[0],s=extractSecPeriods(sec.MCD,[p.date]).periods[p.date];
 assert.equal(s.liabilities.value,61306e6);assert.ok(s.liabilities.derived);
 assert.match(s.assets.url,/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/63908\/000006390826000035\//);
 const c=compareWithSec(p,s),row=k=>c.rows.find(r=>r.key===k);
 for(const k of ['assets','currentAssets','currentLiabilities','liabilities','revenue','netIncome','interest','ocf','capex','cash','inventory'])assert.equal(row(k).status,'match',k);
 assert.equal(row('stockholdersEquity').status,'match'); // −1.790 frente a −1.791: 0,06 %
 assert.equal(row('ebit').status,'definition');assert.equal(c.summary.differs,0);
});
test('SEC GOOGL: el EBIT de Yahoo no es el resultado operativo del 10-K',()=>{
 const p=report('GOOGL').periods[0],c=compareWithSec(p,extractSecPeriods(sec.GOOGL,[p.date]).periods[p.date]);
 const ebit=c.rows.find(r=>r.key==='ebit');assert.equal(ebit.status,'definition');assert.ok(ebit.diff>0.2); // 159.562 frente a 129.039
 assert.equal(c.rows.find(r=>r.key==='interest').status,'match'); // InterestExpenseNonoperating
 assert.equal(c.rows.find(r=>r.key==='inventory').status,'both_missing');
});
test('SEC: detecta una discrepancia y rellena huecos sin pisar cifras',()=>{
 const p=structuredClone(report('MCD').periods[0]);p.values.revenue*=1.03;p.values.interest=null;
 const s=extractSecPeriods(sec.MCD,[p.date]).periods[p.date],c=compareWithSec(p,s);
 assert.equal(c.rows.find(r=>r.key==='revenue').status,'differs');assert.equal(c.rows.find(r=>r.key==='interest').status,'yahoo_missing');
 const filled=fillFromSec(p,s);assert.deepEqual(filled,['interest']);assert.equal(p.values.interest,1582e6);
 assert.equal(p.raw.find(r=>r.key==='interest').status,'sec');assert.ok(p.values.revenue>26885e6); // no sustituye cifras existentes
});
test('SEC: rechaza emisores no estadounidenses y consulta con User-Agent',async()=>{
 await assert.rejects(getSecFacts('SAN.MC',['2025-12-31']),e=>e.status===422);
 const seen=[];const fetcher=async(url,opt)=>{seen.push(opt.headers['User-Agent']);return new Response(JSON.stringify(url.includes('company_tickers')?sec.tickers:sec.MCD));};
 const r=await getSecFacts('MCD',['2025-12-31'],{fetcher});assert.equal(r.periods['2025-12-31'].revenue.value,26885e6);assert.ok(seen.every(ua=>/CarrilAbierto/.test(ua)));
});
test('Sector: mediana y cuartiles con valores pendientes excluidos',()=>{
 assert.equal(quantile([1,2,3,4],.5),2.5);assert.equal(quantile([1,2,3,4,5],.25),2);
 const s=buildComparison([{ticker:'A',date:'x',ratios:[{id:'r',value:1}]},{ticker:'B',date:'x',ratios:[{id:'r',value:3}]},{ticker:'C',date:'x',ratios:[{id:'r',value:null,reason:'Patrimonio negativo'}]},{ticker:'D',date:'x',ratios:[{id:'r',value:2}]}]).r;
 assert.equal(s.n,3);assert.equal(s.median,2);assert.equal(position(5,s),'above');assert.equal(position(2,s),'inside');
 const few=buildComparison([{ticker:'A',date:'x',ratios:[{id:'r',value:1}]},{ticker:'B',date:'x',ratios:[{id:'r',value:null}]}]).r;assert.equal(few.median,null);
 assert.equal(pickPeriod([{date:'2025-06-30'},{date:'2026-06-30'}],'2025-12-31').date,'2026-06-30');assert.equal(pickPeriod([{date:'2023-01-31'}],'2025-12-31'),null);
 assert.equal(defaultPeers('MCD').name,'Restauración');assert.ok(!defaultPeers('MCD').peers.includes('MCD'));assert.equal(defaultPeers('ZZZZ'),null);
});
const fakeFin=async t=>{const d=peersFx[t];if(!d)throw new Error('Sin datos');return parseFinancials(payload(d,1e6,d.c),t);};
test('Sector real MCD: comparables con patrimonio negativo no entran en la mediana del ROE',async()=>{
 const r=await getPeerComparison('MCD','2025-12-31',null,{getFin:fakeFin});
 assert.equal(r.group.name,'Restauración');assert.equal(r.peers.length,6);
 assert.equal(r.peers.find(p=>p.ticker==='DRI').date,'2026-05-31');assert.equal(r.peers.find(p=>p.ticker==='SBUX').date,'2025-09-30');
 const roe=r.stats.roe;assert.deepEqual(roe.values.filter(v=>v.value!==null).map(v=>v.ticker).sort(),['CMG','DRI','QSR']); // SBUX, YUM y DPZ excluidos
 assert.equal(roe.n,3);assert.ok(r.stats.fcfYield.n===6);
});
test('Sector GOOGL y grupo personalizado con ticker sin datos',async()=>{
 const r=await getPeerComparison('GOOGL','2025-12-31',null,{getFin:fakeFin});assert.equal(r.group.name,'Tecnología y plataformas');assert.ok(r.stats.opMargin.median>0.2*100);
 const c=await getPeerComparison('GOOGL','2025-12-31','meta, msft XXXX googl',{getFin:fakeFin});
 assert.deepEqual(c.peers.map(p=>p.ticker),['META','MSFT']);assert.equal(c.excluded[0].ticker,'XXXX');assert.equal(c.stats.roe.median,null); // solo 2 comparables
 const none=await getPeerComparison('ZZZZ','2025-12-31',null,{getFin:fakeFin});assert.equal(none.group,null);
});
test('Sector real Inditex: grupo de moda con ejercicios y monedas distintos',async()=>{
 const fx=read('yahoo_itx_moda_millones.json');const fin=async t=>{const d=fx[t];if(!d)throw new Error('Sin datos');return parseFinancials(payload(d,1e6,d.c),t);};
 const itx=await fin('ITX.MC');assert.equal(itx.periods[0].currency,'EUR');assert.ok(itx.periods[0].ratios.every(r=>r.id==='coverage'||r.value!==null||/Falta/.test(r.reason))); 
 const r=await getPeerComparison('ITX.MC','2026-01-31',null,{getFin:fin});
 assert.equal(r.group.name,'Moda y distribución textil');assert.equal(r.peers.length,6);assert.equal(r.peers.find(p=>p.ticker==='HM-B.ST').currency,'SEK');
 assert.ok(r.stats.roe.n>=5&&r.stats.roe.median>0);
});
