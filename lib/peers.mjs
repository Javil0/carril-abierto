import { getFinancials, validateTicker, FinancialsError } from './financials.mjs';
import { defaultGroup, groupById, peersFor, pickPeriod, buildComparison } from '../public/peers.mjs';
// Descarga los comparables del grupo elegido (o del recomendado) con la misma caché y las mismas fórmulas que la empresa, de tres en tres.
export async function getPeerComparison(input,date,groupId,{fetcher=fetch,now=new Date(),getFin=getFinancials}={}){
 const ticker=validateTicker(input);if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new FinancialsError('Falta el ejercicio de referencia.',400);
 const recommended=defaultGroup(ticker);
 let group=null;
 if(groupId&&String(groupId).trim()){group=groupById(String(groupId).trim());if(!group)throw new FinancialsError('Ese grupo de comparables no existe.',400);}
 else group=recommended;
 if(!group)return {ticker,date,group:null,recommended:null,peers:[],excluded:[],stats:{},message:ticker+' no está en ningún grupo predefinido. Elige en el desplegable el sector que consideres comparable.'};
 const tickers=peersFor(group,ticker),peers=[],excluded=[];
 for(let i=0;i<tickers.length;i+=3){
  const batch=await Promise.all(tickers.slice(i,i+3).map(async t=>{try{return {t,data:await getFin(t,{fetcher,now})};}catch(e){return {t,error:e.message||'Error de descarga.'};}}));
  for(const b of batch){
   if(b.error){excluded.push({ticker:b.t,reason:b.error});continue;}
   const p=pickPeriod(b.data.periods,date);
   if(!p){excluded.push({ticker:b.t,reason:'Sin ejercicio a menos de 12 meses de '+date+'.'});continue;}
   peers.push({ticker:b.t,date:p.date,currency:p.currency,ratios:p.ratios.map(r=>({id:r.id,value:r.value,reason:r.reason}))});
  }
 }
 return {ticker,date,group:{id:group.id,name:group.name,warning:group.warning||null},recommended:recommended?.id||null,peers:peers.map(({ticker,date,currency})=>({ticker,date,currency})),excluded,stats:buildComparison(peers)};
}
