// Comparación con el sector: grupos de comparables y estadística descriptiva por ratio.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const MIN_PEERS=3;            // Con menos de 3 valores no se publica mediana.
export const PERIOD_WINDOW_DAYS=200; // Ejercicio del comparable más cercano al de la empresa, como mucho a ~6 meses.
export const MAX_PEERS=8;
// Grupos definidos a mano (decisión del equipo): el usuario puede sustituirlos por su propia lista.
export const peerGroups=[
 {id:'tech',name:'Tecnología y plataformas',tickers:['AAPL','MSFT','GOOGL','META','AMZN','NVDA','ORCL','ADBE','CRM']},
 {id:'semis',name:'Semiconductores',tickers:['AMD','INTC','AVGO','QCOM','TXN','MU','NVDA']},
 {id:'restaurants',name:'Restauración',tickers:['MCD','SBUX','YUM','CMG','DRI','DPZ','QSR','WEN']},
 {id:'retail',name:'Distribución minorista',tickers:['WMT','COST','TGT','HD','LOW','KR','DG']},
 {id:'staples',name:'Consumo básico',tickers:['KO','PEP','PG','CL','KMB','MDLZ','PM']},
 {id:'pharma',name:'Farmacéuticas',tickers:['JNJ','PFE','MRK','ABBV','LLY','BMY','AMGN']},
 {id:'oil',name:'Petróleo y gas',tickers:['XOM','CVX','COP','OXY','EOG','SLB']},
 {id:'industrials',name:'Industria',tickers:['CAT','DE','HON','GE','MMM','UNP','BA','LMT']},
 {id:'telecom',name:'Telecomunicaciones y medios',tickers:['VZ','T','TMUS','CMCSA','DIS','NFLX']},
 {id:'autos',name:'Automoción',tickers:['TSLA','F','GM','STLA','TM']},
 {id:'usbanks',name:'Banca EE. UU.',tickers:['JPM','BAC','C','WFC','GS','MS'],warning:'En banca los ratios de empresa industrial (liquidez corriente, rotaciones, deuda/EBITDA) tienen poco significado.'},
 {id:'esbanks',name:'Banca España',tickers:['SAN.MC','BBVA.MC','CABK.MC','SAB.MC','BKT.MC','UNI.MC'],warning:'En banca los ratios de empresa industrial (liquidez corriente, rotaciones, deuda/EBITDA) tienen poco significado.'},
 {id:'esutilities',name:'Eléctricas y energía España',tickers:['IBE.MC','ELE.MC','NTGY.MC','RED.MC','ENG.MC','SLR.MC']},
 {id:'fashion',name:'Moda y distribución textil',tickers:['ITX.MC','HM-B.ST','TJX','ROST','GAP','LULU','NKE']},
 {id:'esibex',name:'Ibex: industria y consumo',tickers:['TEF.MC','REP.MC','AENA.MC','FER.MC','ACS.MC','IAG.MC']},
];
export function defaultPeers(ticker){
 const t=String(ticker||'').toUpperCase(),g=peerGroups.find(g=>g.tickers.includes(t));
 return g?{group:g.id,name:g.name,warning:g.warning||null,peers:g.tickers.filter(x=>x!==t).slice(0,6)}:null;
}
export function pickPeriod(periods,date){
 let best=null,gap=Infinity;
 for(const p of periods||[]){const d=Math.abs(Date.parse(p.date)-Date.parse(date))/864e5;if(d<gap){gap=d;best=p;}}
 return best&&gap<=PERIOD_WINDOW_DAYS?best:null;
}
export function quantile(sorted,q){if(!sorted.length)return null;const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);}
// peers: [{ticker, date, ratios:[{id,value,reason}]}]. Los ratios pendientes de un comparable (p. ej. ROE con patrimonio negativo) no entran en la estadística.
export function buildComparison(peers){
 const ids=[...new Set(peers.flatMap(p=>p.ratios.map(r=>r.id)))];const stats={};
 for(const id of ids){
  const values=peers.map(p=>{const r=p.ratios.find(r=>r.id===id);return {ticker:p.ticker,date:p.date,value:finite(r?.value)?r.value:null,reason:r?.value===null?r?.reason||null:null};});
  const nums=values.map(v=>v.value).filter(finite).sort((a,b)=>a-b);
  stats[id]=nums.length>=MIN_PEERS?{n:nums.length,median:quantile(nums,.5),p25:quantile(nums,.25),p75:quantile(nums,.75),values}:{n:nums.length,median:null,p25:null,p75:null,values,reason:'Menos de '+MIN_PEERS+' comparables con dato.'};
 }
 return stats;
}
export function position(value,stat){
 if(!finite(value)||!stat||stat.median===null)return null;
 if(value>stat.p75)return 'above';if(value<stat.p25)return 'below';return 'inside';
}
