// Comparación con el sector: grupos de comparables y estadística descriptiva por ratio.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const MIN_PEERS=3;            // Con menos de 3 valores no se publica mediana.
export const PERIOD_WINDOW_DAYS=366; // Último ejercicio de cada comparable a menos de 12 meses del de la empresa (los cierres fiscales difieren).
export const MAX_PEERS=8;            // Comparables descargados por consulta (los primeros del grupo, sin contar la empresa).
const BANK_WARNING='En banca y seguros los ratios de empresa industrial (liquidez corriente, rotaciones, deuda/EBITDA) tienen poco significado.';
const REIT_WARNING='En inmobiliarias patrimonialistas la deuda y la rotación de activos se leen de forma distinta: el activo son inmuebles a valor contable.';
// Grupos definidos por el equipo (Ibex 35, Euro Stoxx 50 y grandes cotizadas de EE. UU.). Tickers comprobados en Yahoo el 8/11/2026.
// El usuario elige el grupo en un desplegable; por defecto se propone el primero que contiene la empresa.
export const peerGroups=[
 {id:'tech',area:'Tecnología',name:'Tecnología y plataformas',tickers:['AAPL','MSFT','GOOGL','META','AMZN','IBM','CSCO','PRX.AS']},
 {id:'software',area:'Tecnología',name:'Software y servicios tecnológicos',tickers:['ORCL','SAP.DE','CRM','ADBE','NOW','INTU','WDAY','AMS.MC']},
 {id:'semis',area:'Tecnología',name:'Semiconductores',tickers:['NVDA','AMD','INTC','AVGO','QCOM','TXN','MU','ASML.AS','IFX.DE','TSM']},
 {id:'media',area:'Tecnología',name:'Medios y entretenimiento',tickers:['DIS','NFLX','CMCSA','WBD','SPOT']},
 {id:'telecom',area:'Tecnología',name:'Telecomunicaciones',tickers:['TEF.MC','VZ','T','TMUS','DTE.DE','ORA.PA','VOD.L','CLNX.MC']},
 {id:'fashion',area:'Consumo',name:'Moda y distribución textil',tickers:['ITX.MC','HM-B.ST','TJX','ROST','GAP','LULU','NKE','ADS.DE']},
 {id:'luxury',area:'Consumo',name:'Lujo',tickers:['MC.PA','RMS.PA','KER.PA','CFR.SW','MONC.MI','BRBY.L','TPR','RACE.MI']},
 {id:'retail',area:'Consumo',name:'Distribución minorista',tickers:['WMT','COST','TGT','HD','LOW','KR','DG','DLTR']},
 {id:'restaurants',area:'Consumo',name:'Restauración',tickers:['MCD','SBUX','YUM','CMG','DRI','DPZ','QSR','WEN']},
 {id:'foodbev',area:'Consumo',name:'Alimentación y bebidas',tickers:['KO','PEP','MDLZ','KHC','GIS','NESN.SW','BN.PA','ABI.BR','EBRO.MC','VIS.MC']},
 {id:'personal',area:'Consumo',name:'Higiene, cosmética y hogar',tickers:['PG','CL','KMB','CHD','ULVR.L','OR.PA','EL','PUIG.MC']},
 {id:'travel',area:'Consumo',name:'Viajes y hoteles',tickers:['BKNG','EXPE','ABNB','MAR','HLT','MEL.MC']},
 {id:'autos',area:'Consumo',name:'Automoción',tickers:['TSLA','F','GM','STLAM.MI','TM','VOW3.DE','BMW.DE','MBG.DE','CIE.MC']},
 {id:'pharma',area:'Salud',name:'Farmacéuticas',tickers:['LLY','JNJ','MRK','ABBV','PFE','BMY','AMGN','NOVN.SW','RO.SW','SAN.PA','AZN','NOVO-B.CO','BAYN.DE','GRF.MC','ROVI.MC','ALM.MC']},
 {id:'health',area:'Salud',name:'Equipos y servicios sanitarios',tickers:['UNH','CVS','ABT','TMO','MDT','ISRG','DHR','EL.PA']},
 {id:'oil',area:'Energía',name:'Petróleo y gas',tickers:['REP.MC','XOM','CVX','COP','OXY','EOG','SHEL','BP','TTE.PA','ENI.MI','EQNR']},
 {id:'euutil',area:'Energía',name:'Eléctricas y renovables (Europa)',tickers:['IBE.MC','ELE.MC','NTGY.MC','RED.MC','ENG.MC','SLR.MC','ANE.MC','ENEL.MI','EDP.LS']},
 {id:'usutil',area:'Energía',name:'Eléctricas (EE. UU.)',tickers:['NEE','DUK','SO','D','AEP','EXC']},
 {id:'industrials',area:'Industria',name:'Industria y bienes de equipo',tickers:['CAT','DE','HON','GE','MMM','ETN','EMR','SIE.DE','SU.PA','FDR.MC']},
 {id:'aero',area:'Industria',name:'Aeroespacial y defensa',tickers:['AIR.PA','SAF.PA','IDR.MC','BA','LMT','RTX','NOC','GD']},
 {id:'airlines',area:'Industria',name:'Aerolíneas',tickers:['IAG.MC','DAL','UAL','AAL','LHA.DE','AF.PA','RYAAY']},
 {id:'infra',area:'Industria',name:'Construcción e infraestructuras',tickers:['FER.MC','ACS.MC','SCYR.MC','ANA.MC','DG.PA','AENA.MC','ADP.PA','HOT.DE']},
 {id:'steel',area:'Materiales',name:'Acero y metales',tickers:['MTS.MC','ACX.MC','NUE','STLD','CLF','TKA.DE']},
 {id:'chemicals',area:'Materiales',name:'Química',tickers:['LIN','DOW','DD','BAS.DE','AI.PA','SHW','APD']},
 {id:'realestate',area:'Materiales',name:'Inmobiliario',tickers:['MRL.MC','COL.MC','PLD','O','SPG','AMT','VNA.DE'],warning:REIT_WARNING},
 {id:'esbanks',area:'Finanzas',name:'Banca España',tickers:['SAN.MC','BBVA.MC','CABK.MC','SAB.MC','BKT.MC','UNI.MC'],warning:BANK_WARNING},
 {id:'eubanks',area:'Finanzas',name:'Banca europea',tickers:['BNP.PA','GLE.PA','DBK.DE','ISP.MI','UCG.MI','INGA.AS','HSBA.L','NDA-FI.HE'],warning:BANK_WARNING},
 {id:'usbanks',area:'Finanzas',name:'Banca EE. UU.',tickers:['JPM','BAC','C','WFC','GS','MS','USB','PNC'],warning:BANK_WARNING},
 {id:'insurance',area:'Finanzas',name:'Seguros',tickers:['MAP.MC','LDA.MC','ALV.DE','CS.PA','ZURN.SW','G.MI','MUV2.DE','AIG','MET','PRU'],warning:BANK_WARNING},
 {id:'payments',area:'Finanzas',name:'Pagos y servicios financieros',tickers:['V','MA','AXP','PYPL','FISV','ADYEN.AS','DB1.DE','SPGI']},
];
const ALIASES={GOOG:'GOOGL','BRK-A':'BRK-B'};
const canon=t=>{const u=String(t||'').toUpperCase();return ALIASES[u]||u;};
export const groupById=id=>peerGroups.find(g=>g.id===id)||null;
// Grupo recomendado: el primero que contiene la empresa (o null si no está en ninguno).
export function defaultGroup(ticker){const t=canon(ticker);return peerGroups.find(g=>g.tickers.includes(t))||null;}
// Comparables de un grupo para una empresa: sin la propia empresa y como mucho MAX_PEERS.
export function peersFor(group,ticker){const t=canon(ticker);return group.tickers.filter(x=>x!==t).slice(0,MAX_PEERS);}
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
