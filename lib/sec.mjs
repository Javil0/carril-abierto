import { extractSecPeriods } from '../public/verify.mjs';
import { FinancialsError, validateTicker } from './financials.mjs';
// La SEC exige identificarse en el User-Agent con un contacto: se configura con la variable de entorno SEC_USER_AGENT
// (p. ej. «CarrilAbierto equipo@ejemplo.com») en Vercel → Settings → Environment Variables.
export const SEC_USER_AGENT=(typeof process!=='undefined'&&process.env?.SEC_USER_AGENT)||'CarrilAbierto/1.0 (proyecto academico ICADE)';
const cache=new Map(),TTL=15*60*1000,TICKERS_TTL=24*60*60*1000;let tickerMap=null;
async function getJson(url,fetcher){
 let r;try{r=await fetcher(url,{headers:{'User-Agent':SEC_USER_AGENT,Accept:'application/json'},signal:AbortSignal.timeout(20000)});}catch{throw new FinancialsError('No se pudo conectar con la SEC. Inténtalo más tarde.',503);}
 if(r.status===429)throw new FinancialsError('La SEC ha limitado temporalmente las consultas. Espera unos minutos.',429);
 if(r.status===403)throw new FinancialsError('La SEC ha rechazado la consulta (revisa el User-Agent de contacto).',502);
 if(r.status===404)return null;
 if(!r.ok)throw new FinancialsError('La SEC no está disponible en este momento.',502);
 try{return await r.json();}catch{throw new FinancialsError('La respuesta de la SEC no se pudo interpretar.',502);}
}
export async function cikFor(ticker,{fetcher=fetch,now=Date.now()}={}){
 if(!tickerMap||now-tickerMap.time>TICKERS_TTL){const j=await getJson('https://www.sec.gov/files/company_tickers.json',fetcher);const map=new Map();for(const e of Object.values(j||{}))map.set(String(e.ticker).toUpperCase(),e.cik_str);tickerMap={time:now,map};}
 return tickerMap.map.get(ticker)??null;
}
export async function getSecFacts(input,dates,{fetcher=fetch,now=Date.now()}={}){
 const ticker=validateTicker(input);
 if(ticker.includes('.'))throw new FinancialsError('La SEC solo cubre emisores que presentan informes en EE. UU. Para '+ticker+' la fuente primaria serían las cuentas depositadas en la CNMV o en el regulador de su país.',422);
 const valid=[...new Set(dates)].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,8);if(!valid.length)throw new FinancialsError('Faltan los ejercicios que se quieren contrastar.',400);
 const cik=await cikFor(ticker,{fetcher,now});if(!cik)throw new FinancialsError(ticker+' no figura en el registro de emisores de la SEC.',404);
 const key=String(cik);let facts=cache.get(key);
 if(!facts||now-facts.time>TTL){const j=await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10,'0')}.json`,fetcher);if(!j)throw new FinancialsError('La SEC no tiene datos XBRL para '+ticker+'.',404);facts={time:now,data:j};if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,facts);}
 if(!facts.data.facts?.['us-gaap'])throw new FinancialsError(ticker+' presenta sus cuentas con taxonomía IFRS (formulario 20-F); este contraste solo admite us-gaap.',422);
 return {ticker,source:'SEC EDGAR · companyfacts',retrievedAt:new Date(now).toISOString(),...extractSecPeriods(facts.data,valid)};
}
