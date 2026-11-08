import { getFinancials, validateTicker, FinancialsError } from './financials.mjs';
import { defaultPeers, pickPeriod, buildComparison, MAX_PEERS } from '../public/peers.mjs';
// Descarga los comparables (con la misma caché y las mismas fórmulas que la empresa) de tres en tres para no saturar a Yahoo.
export async function getPeerComparison(input,date,list,{fetcher=fetch,now=new Date(),getFin=getFinancials}={}){
 const ticker=validateTicker(input);if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new FinancialsError('Falta el ejercicio de referencia.',400);
 const preset=defaultPeers(ticker);let tickers,group;
 if(list&&String(list).trim()){tickers=[...new Set(String(list).split(/[\s,;]+/).filter(Boolean).map(validateTicker))].filter(t=>t!==ticker).slice(0,MAX_PEERS);group={group:'custom',name:'Grupo personalizado',warning:null};}
 else if(preset){tickers=preset.peers;group=preset;}
 else return {ticker,date,group:null,peers:[],excluded:[],stats:{},message:'No hay un grupo de comparables predefinido para '+ticker+'. Escribe tus propios comparables.'};
 if(!tickers.length)throw new FinancialsError('Indica al menos un comparable distinto de la empresa.',400);
 const peers=[],excluded=[];
 for(let i=0;i<tickers.length;i+=3){
  const batch=await Promise.all(tickers.slice(i,i+3).map(async t=>{try{return {t,data:await getFin(t,{fetcher,now})};}catch(e){return {t,error:e.message||'Error de descarga.'};}}));
  for(const b of batch){
   if(b.error){excluded.push({ticker:b.t,reason:b.error});continue;}
   const p=pickPeriod(b.data.periods,date);
   if(!p){excluded.push({ticker:b.t,reason:'Sin ejercicio a menos de 200 días de '+date+'.'});continue;}
   peers.push({ticker:b.t,date:p.date,currency:p.currency,ratios:p.ratios.map(r=>({id:r.id,value:r.value,reason:r.reason}))});
  }
 }
 return {ticker,date,group:{id:group.group,name:group.name,warning:group.warning},peers:peers.map(({ticker,date,currency})=>({ticker,date,currency})),excluded,stats:buildComparison(peers)};
}
