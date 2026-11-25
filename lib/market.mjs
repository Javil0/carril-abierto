import { validateTicker, FinancialsError } from './financials.mjs';
// Datos de mercado para el DCF: cotización actual (Yahoo) y tipo libre de riesgo a 10 años en la moneda de los flujos.
// USD: rendimiento del Treasury a 10 años (índice ^TNX de Cboe, vía Yahoo). EUR: curva AAA de la zona euro del BCE (bono a 10 años).
// Otras monedas: no hay fuente automática; el tipo queda pendiente y lo introduce el usuario.
const cache=new Map(),TTL=15*60*1000;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
async function cached(key,now,run){const hit=cache.get(key);if(hit&&now.getTime()-hit.time<TTL)return hit.data;const data=await run();if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{time:now.getTime(),data});return data;}
async function yahooQuote(symbol,fetcher){
 let r;try{r=await fetcher(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json'},signal:AbortSignal.timeout(12000)});}catch{return null;}
 if(!r.ok)return null;let j;try{j=await r.json();}catch{return null;}
 const m=j?.chart?.result?.[0]?.meta;if(!m||!finite(m.regularMarketPrice))return null;
 return {price:m.regularMarketPrice,currency:/^[A-Z]{3}$/.test(m.currency||'')?m.currency:null,time:finite(m.regularMarketTime)?new Date(m.regularMarketTime*1000).toISOString():null,exchange:m.fullExchangeName||m.exchangeName||null};
}
export function parseEcb(json){
 const series=json?.dataSets?.[0]?.series;const key=series&&Object.keys(series)[0];const obs=key&&series[key].observations;const dates=json?.structure?.dimensions?.observation?.[0]?.values;
 if(!obs||!dates)return null;let best=null;
 for(const[i,v]of Object.entries(obs)){const date=dates[Number(i)]?.id;if(finite(v?.[0])&&date&&(!best||date>best.date))best={date,rate:v[0]/100};}
 return best;
}
const ECB_SERIES='YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y';
async function riskFree(currency,fetcher){
 if(currency==='USD'){
  const q=await yahooQuote('^TNX',fetcher);if(!q)return {currency,rate:null,reason:'No se pudo descargar el rendimiento del Treasury a 10 años. Introdúcelo a mano.'};
  return {currency,rate:q.price/100,date:q.time?.slice(0,10)||null,source:'Treasury de EE. UU. a 10 años (índice ^TNX de Cboe, vía Yahoo Finance)',url:'https://finance.yahoo.com/quote/%5ETNX/'};
 }
 if(currency==='EUR'){
  let r;try{r=await fetcher(`https://data-api.ecb.europa.eu/service/data/${ECB_SERIES}?lastNObservations=5&format=jsondata`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});}catch{r=null;}
  const p=r?.ok?parseEcb(await r.json().catch(()=>null)):null;
  if(!p)return {currency,rate:null,reason:'No se pudo descargar la curva del BCE. Introduce el tipo a 10 años a mano.'};
  return {currency,rate:p.rate,date:p.date,source:'BCE · curva de bonos soberanos AAA de la zona euro, 10 años',url:'https://data.ecb.europa.eu/data/datasets/YC/'+ECB_SERIES.slice(3)};
 }
 return {currency,rate:null,reason:'No hay una fuente automática del tipo libre de riesgo en '+currency+'. Introduce el rendimiento del bono soberano a 10 años en esa moneda.'};
}
export async function getMarket(input,currency,{fetcher=fetch,now=new Date()}={}){
 const ticker=validateTicker(input);const cur=String(currency||'').toUpperCase();if(!/^[A-Z]{3}$/.test(cur))throw new FinancialsError('Falta la moneda de los estados financieros.',400);
 return cached(ticker+'|'+cur,now,async()=>{
  const [quote,rf]=await Promise.all([yahooQuote(ticker,fetcher),riskFree(cur,fetcher)]);
  return {ticker,retrievedAt:now.toISOString(),quote,riskFree:rf};
 });
}
