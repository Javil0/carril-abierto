import { fields, ratioAnalysis, dupontAnalysis } from '../public/finance.mjs';
const metrics=fields.map(([,,,doc],i)=>'annual'+fields[i][2]);
const cache=new Map(),TTL=15*60*1000;
export class FinancialsError extends Error{constructor(message,status=502){super(message);this.status=status;}}
export function validateTicker(input){const ticker=String(input||'').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(ticker))throw new FinancialsError('Introduce un ticker válido, como AAPL, MSFT o SAN.MC.',400);return ticker;}
export function parseFinancials(payload,ticker,now=new Date()){
 const items=payload?.timeseries?.result;if(!Array.isArray(items))throw new FinancialsError('Yahoo no ha devuelto estados financieros para este ticker.',404);
 const series=new Map();
 for(const item of items){const type=item?.meta?.type?.[0];if(!metrics.includes(type)||!Array.isArray(item[type]))continue;const map=series.get(type)||new Map();for(const p of item[type])if(p.periodType==='12M'&&/^\d{4}-\d{2}-\d{2}$/.test(p.asOfDate||'')&&Number.isFinite(p.reportedValue?.raw)&&/^[A-Z]{3}$/.test(p.currencyCode||''))map.set(p.asOfDate,p);series.set(type,map);}
 const assets=series.get('annualTotalAssets');if(!assets?.size)throw new FinancialsError('No hay un balance anual disponible. Comprueba que el ticker corresponde a una empresa cotizada.',404);
 const periods=[...assets.keys()].sort().reverse().map(date=>{
  const currency=assets.get(date).currencyCode,values={},raw=[],warnings=[];
  for(const[key,label,code,document]of fields){const p=series.get('annual'+code)?.get(date);const sameCurrency=p?.currencyCode===currency;values[key]=sameCurrency?p.reportedValue.raw:null;raw.push({key,label,code,document,value:values[key],date,currency: sameCurrency?currency:null,status:!p?'missing':sameCurrency?'available':'currency_mismatch'});if(p&&!sameCurrency)warnings.push('Se excluyó '+label+' por una moneda diferente.');}
  // La suma solo se usa si ambos componentes están presentes. Un campo ausente no equivale a cero.
  if(values.cashShortTotal===null&&Number.isFinite(values.cash)&&Number.isFinite(values.shortInvestments)){values.cashShortTotal=values.cash+values.shortInvestments;const r=raw.find(r=>r.key==='cashShortTotal');r.value=values.cashShortTotal;r.status='derived';r.currency=currency;r.derivation='Efectivo + inversiones corrientes del mismo periodo.';}
  const balanceCheck=Number.isFinite(values.liabilities)&&Number.isFinite(values.totalEquity)?values.assets-values.liabilities-values.totalEquity:null;
  if(balanceCheck!==null&&Math.abs(balanceCheck)>Math.max(1,Math.abs(values.assets)*1e-6))warnings.push('El activo no coincide con pasivo más patrimonio total en la fuente. Revisa las cuentas originales.');
  return {date,currency,values,raw,warnings,balanceCheck};
 });
 for(let i=0;i<periods.length;i++){periods[i].ratios=ratioAnalysis(periods[i],periods[i+1]);periods[i].dupont=dupontAnalysis(periods[i],periods[i+1]);}
 return {ticker,source:'Yahoo Finance',sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/balance-sheet/`,incomeSourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/financials/`,valuationSourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/key-statistics/`,retrievedAt:now.toISOString(),frequency:'annual',monetaryUnit:'whole_units',periods};
}
async function requestChunk(ticker,types,fetcher,now){
 const url=new URL(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}`);url.search=new URLSearchParams({symbol:ticker,type:types.join(','),period1:String(Math.floor(now.getTime()/1000)-7*366*86400),period2:String(Math.floor(now.getTime()/1000))});
 let r;try{r=await fetcher(url.toString(),{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json'},signal:AbortSignal.timeout(18000)});}catch{throw new FinancialsError('No se pudo conectar con Yahoo o la consulta agotó su tiempo. Inténtalo más tarde.',503);}
 if(r.status===429)throw new FinancialsError('Yahoo ha limitado temporalmente las consultas. Espera unos minutos antes de volver a intentarlo.',429);
 if(r.status===404)throw new FinancialsError('Yahoo no encuentra estados financieros para ese ticker.',404);
 if(!r.ok)throw new FinancialsError('Yahoo Finance no está disponible en este momento.',502);
 try{const j=await r.json();return j.timeseries?.result||[];}catch{throw new FinancialsError('La respuesta de Yahoo no se pudo interpretar.',502);}
}
export async function getFinancials(input,{fetcher=fetch,now=new Date()}={}){
 const ticker=validateTicker(input),existing=cache.get(ticker);if(existing&&now.getTime()-existing.time<TTL)return existing.data;
 const chunks=[];for(let i=0;i<metrics.length;i+=20)chunks.push(metrics.slice(i,i+20));
 const results=await Promise.all(chunks.map(c=>requestChunk(ticker,c,fetcher,now)));
 const data=parseFinancials({timeseries:{result:results.flat()}},ticker,now);
 if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(ticker,{time:now.getTime(),data});return data;
}
