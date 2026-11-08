// Contraste de las cifras de Yahoo con el 10-K presentado en la SEC (EDGAR, taxonomía us-gaap).
// Compartido entre servidor (extracción) y navegador (comparación).
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const MATCH_TOLERANCE=0.005; // 0,5 %: por debajo, la diferencia se atribuye a redondeos.
export const DATE_TOLERANCE_DAYS=10; // Yahoo normaliza al fin de mes (Apple: 26/09 → 30/09).

// kind: 'instant' = saldo de balance; 'duration' = flujo anual (resultados, flujos de caja).
export const secConcepts=[
 {key:'assets',label:'Activo total',tags:['Assets'],kind:'instant'},
 {key:'currentAssets',label:'Activo corriente',tags:['AssetsCurrent'],kind:'instant'},
 {key:'currentLiabilities',label:'Pasivo corriente',tags:['LiabilitiesCurrent'],kind:'instant'},
 {key:'liabilities',label:'Pasivo total',tags:['Liabilities'],kind:'instant',derive:'liabilities'},
 {key:'stockholdersEquity',label:'Patrimonio de accionistas',tags:['StockholdersEquity'],kind:'instant'},
 {key:'cash',label:'Efectivo y equivalentes',tags:['CashAndCashEquivalentsAtCarryingValue'],kind:'instant'},
 {key:'inventory',label:'Inventarios',tags:['InventoryNet'],kind:'instant'},
 {key:'revenue',label:'Ingresos',tags:['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet'],kind:'duration'},
 {key:'netIncome',label:'Beneficio neto',tags:['NetIncomeLoss'],kind:'duration'},
 {key:'interest',label:'Gasto por intereses',tags:['InterestExpense','InterestExpenseNonoperating','InterestExpenseDebt'],kind:'duration'},
 {key:'ocf',label:'Flujo de caja operativo',tags:['NetCashProvidedByUsedInOperatingActivities'],kind:'duration'},
 {key:'capex',label:'Capex (inversión en inmovilizado)',tags:['PaymentsToAcquirePropertyPlantAndEquipment'],kind:'duration',absolute:true},
 {key:'ebit',label:'EBIT de Yahoo frente a resultado operativo del 10-K',tags:['OperatingIncomeLoss'],kind:'duration',definitional:true,
  note:'No es la misma magnitud: Yahoo calcula el EBIT desde el resultado antes de impuestos (incluye ingresos financieros y otros resultados); el 10-K publica el resultado operativo. La diferencia no cuenta como error, pero afecta al margen operativo y a Altman.'},
];
const days=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/864e5;
export const filingUrl=(cik,accn)=>`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(accn).replace(/-/g,'')}/${accn}-index.htm`;
// Elige el hecho anual de un 10-K cuyo cierre coincide con la fecha de Yahoo. Si hay varios (reexpresiones), usa el presentado más tarde.
export function pickFact(facts,date,kind){
 const list=(facts||[]).filter(f=>/^10-K/.test(f.form||'')&&finite(f.val)&&f.end&&days(f.end,date)<=DATE_TOLERANCE_DAYS&&(kind==='instant'?!f.start:f.start&&days(f.end,f.start)>=330&&days(f.end,f.start)<=400));
 return list.sort((a,b)=>(a.filed<b.filed?1:a.filed>b.filed?-1:0))[0]||null;
}
export function extractSecPeriods(companyFacts,dates){
 const gaap=companyFacts?.facts?.['us-gaap'];const cik=companyFacts?.cik;
 const periods={};
 for(const date of dates){
  const row={};
  const find=(tag,kind)=>{const f=pickFact(gaap?.[tag]?.units?.USD,date,kind);return f?{value:f.val,tag,end:f.end,start:f.start||null,accn:f.accn,filed:f.filed,form:f.form,url:filingUrl(cik,f.accn)}:null;};
  for(const c of secConcepts){
   let hit=null;for(const tag of c.tags){hit=find(tag,c.kind);if(hit)break;}
   if(!hit&&c.derive==='liabilities'){ // Algunas empresas (p. ej. MCD) no etiquetan el pasivo total: pasivo = pasivo y patrimonio − patrimonio total.
    const tot=find('LiabilitiesAndStockholdersEquity','instant'),eq=find('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest','instant')||find('StockholdersEquity','instant');
    if(tot&&eq)hit={...tot,value:tot.value-eq.value,tag:'LiabilitiesAndStockholdersEquity − '+eq.tag,derived:true};
   }
   row[c.key]=hit;
  }
  periods[date]=row;
 }
 return {cik,entity:companyFacts?.entityName||null,periods};
}
export function compareWithSec(period,secPeriod){
 const v=period.values;
 const rows=secConcepts.map(c=>{
  const sec=secPeriod?.[c.key]||null,yahoo=finite(v[c.key])?v[c.key]:null;
  const y=yahoo!==null&&c.absolute?Math.abs(yahoo):yahoo,s=sec&&c.absolute?Math.abs(sec.value):sec?.value??null;
  let status,diff=null;
  if(y!==null&&s!==null){diff=s===0?(y===0?0:null):(y-s)/Math.abs(s);status=c.definitional?'definition':diff!==null&&Math.abs(diff)<=MATCH_TOLERANCE?'match':'differs';}
  else if(y===null&&s!==null)status='yahoo_missing';
  else if(y!==null&&s===null)status='sec_missing';
  else status='both_missing';
  return {key:c.key,label:c.label,yahoo:y,sec:s,diff,status,definitional:!!c.definitional,note:c.note||null,source:sec};
 });
 const count=k=>rows.filter(r=>r.status===k).length;
 return {rows,summary:{match:count('match'),differs:count('differs'),yahooMissing:count('yahoo_missing'),secMissing:count('sec_missing'),definition:count('definition'),bothMissing:count('both_missing')}};
}
// Rellena huecos de Yahoo con el 10-K. Nunca sustituye una cifra existente ni usa conceptos de definición distinta.
export function fillFromSec(period,secPeriod){
 const filled=[];
 for(const c of secConcepts){
  if(c.definitional)continue;const sec=secPeriod?.[c.key];
  if(!sec||finite(period.values[c.key]))continue;
  period.values[c.key]=c.absolute?-Math.abs(sec.value):sec.value; // Yahoo publica el capex en negativo.
  const raw=period.raw?.find(r=>r.key===c.key);if(raw){raw.value=period.values[c.key];raw.status='sec';raw.derivation='Tomado del 10-K ('+sec.tag+', presentado el '+sec.filed+').';}
  filled.push(c.key);
 }
 return filled;
}
