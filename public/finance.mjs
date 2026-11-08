export const fields = [
  ['currentAssets','Activo corriente','CurrentAssets','Balance'],['cash','Efectivo y equivalentes','CashAndCashEquivalents','Balance'],['shortInvestments','Inversiones corrientes','OtherShortTermInvestments','Balance'],['cashShortTotal','Efectivo e inversiones corrientes','CashCashEquivalentsAndShortTermInvestments','Balance'],['receivables','Cuentas por cobrar','AccountsReceivable','Balance'],['inventory','Inventarios','Inventory','Balance'],['otherCurrent','Otros activos corrientes','OtherCurrentAssets','Balance'],['nonCurrentAssets','Activo no corriente','TotalNonCurrentAssets','Balance'],['ppe','Inmovilizado material neto','NetPPE','Balance'],['intangibles','Fondo de comercio e intangibles','GoodwillAndOtherIntangibleAssets','Balance'],['longInvestments','Inversiones y anticipos','InvestmentsAndAdvances','Balance'],['otherNonCurrent','Otros activos no corrientes','OtherNonCurrentAssets','Balance'],['assets','Activo total','TotalAssets','Balance'],['currentLiabilities','Pasivo corriente','CurrentLiabilities','Balance'],['payables','Cuentas por pagar','AccountsPayable','Balance'],['shortDebt','Deuda corriente','CurrentDebt','Balance'],['otherCurrentLiabilities','Otros pasivos corrientes','OtherCurrentLiabilities','Balance'],['nonCurrentLiabilities','Pasivo no corriente','TotalNonCurrentLiabilitiesNetMinorityInterest','Balance'],['longDebt','Deuda no corriente','LongTermDebt','Balance'],['otherLongLiabilities','Otros pasivos no corrientes','OtherNonCurrentLiabilities','Balance'],['liabilities','Pasivo total','TotalLiabilitiesNetMinorityInterest','Balance'],['debt','Deuda financiera total','TotalDebt','Balance'],['equity','Patrimonio ordinario','CommonStockEquity','Balance'],['stockholdersEquity','Patrimonio de accionistas','StockholdersEquity','Balance'],['totalEquity','Patrimonio total, incluidos minoritarios','TotalEquityGrossMinorityInterest','Balance'],['capital','Capital social','CapitalStock','Balance'],['retained','Beneficios retenidos','RetainedEarnings','Balance'],['otherEquity','Otras partidas del patrimonio','OtherEquityAdjustments','Balance'],['revenue','Ingresos','TotalRevenue','Resultados'],['cost','Coste de ventas','CostOfRevenue','Resultados'],['ebit','EBIT','EBIT','Resultados'],['interest','Gasto por intereses','InterestExpense','Resultados'],['netIncome','Beneficio neto','NetIncome','Resultados'],['commonIncome','Beneficio atribuible ordinario','NetIncomeCommonStockholders','Resultados'],['marketEquity','Capitalización al cierre del periodo','MarketCap','Mercado'],['ebitda','EBITDA','EBITDA','Resultados'],['ocf','Flujo de caja operativo','OperatingCashFlow','Flujos de caja'],['capex','Inversión en inmovilizado (capex)','CapitalExpenditure','Flujos de caja'],['fcfReported','Flujo de caja libre publicado por Yahoo','FreeCashFlow','Flujos de caja']
];
export const fieldLabels=Object.fromEntries(fields.map(([key,label])=>[key,label]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const n=(v,k)=>finite(v?.[k])?v[k]:null;
export const mean=(a,b)=>finite(a)&&finite(b)?(a+b)/2:null;
export const sum=(...v)=>v.every(finite)?v.reduce((a,b)=>a+b,0):null;
// Derivados explícitos. Yahoo publica el capex en negativo (salida de caja); se usa su valor absoluto para que el signo de origen no cambie el resultado.
export const freeCashFlow=c=>finite(c?.ocf)&&finite(c?.capex)?c.ocf-Math.abs(c.capex):null;
// Deuda neta = deuda financiera - (efectivo + inversiones corrientes). Negativa = caja neta.
export const netDebt=c=>finite(c?.debt)&&finite(c?.cashShortTotal)?c.debt-c.cashShortTotal:null;
const EQUITY_NEGATIVE='Patrimonio ordinario negativo o nulo: el ratio no tiene lectura económica (un ROE o un apalancamiento con signo invertido engañan). Usa deuda/activos, deuda neta/EBITDA y cobertura por flujo operativo.';
export function previousIsComparable(current,previous){
  if(!previous||current.currency!==previous.currency)return false;
  const days=(Date.parse(current.date)-Date.parse(previous.date))/86400000;
  return days>=300&&days<=430;
}
export const definitions=[
 {id:'current',name:'Ratio corriente',category:'Liquidez',unit:'×',formula:'Activo corriente / Pasivo corriente',reading:'Recursos corrientes por unidad de obligaciones a corto plazo.',inputs:['currentAssets','currentLiabilities'],run:(c)=>[c.currentAssets,c.currentLiabilities]},
 {id:'quick',name:'Ratio rápido',category:'Liquidez',unit:'×',formula:'(Efectivo e inversiones corrientes + cuentas por cobrar) / Pasivo corriente',reading:'Liquidez excluyendo inventarios y otros activos menos líquidos.',inputs:['cashShortTotal','receivables','currentLiabilities'],run:c=>[sum(c.cashShortTotal,c.receivables),c.currentLiabilities]},
 {id:'debtEquity',name:'Deuda / patrimonio',category:'Deuda',unit:'×',formula:'Deuda financiera / Patrimonio ordinario al cierre',reading:'Apalancamiento respecto al capital ordinario contable.',inputs:['debt','equity'],run:c=>[c.debt,c.equity],positiveDenominator:true,negativeReason:EQUITY_NEGATIVE},
 {id:'debtAssets',name:'Deuda / activos',category:'Deuda',unit:'%',formula:'Deuda financiera / Activo al cierre × 100',reading:'Peso de la deuda financiera sobre el activo.',inputs:['debt','assets'],run:c=>[c.debt,c.assets],positiveDenominator:true},
 {id:'coverage',name:'Cobertura de intereses',category:'Deuda',unit:'×',formula:'EBIT / Gasto por intereses',reading:'Cuántas veces el EBIT cubre el gasto por intereses.',inputs:['ebit','interest'],run:c=>[c.ebit,c.interest],positiveDenominator:true},
 {id:'netDebtEbitda',name:'Deuda neta / EBITDA',category:'Deuda',unit:'×',formula:'(Deuda financiera − efectivo e inversiones corrientes) / EBITDA',reading:'Años de EBITDA necesarios para devolver la deuda neta.',inputs:['debt','cashShortTotal','ebitda'],run:c=>[netDebt(c),c.ebitda],positiveDenominator:true,negativeReason:'EBITDA negativo: la empresa no genera resultado operativo para atender la deuda; el ratio no se interpreta.',note:(c,v)=>v<0?'Caja neta: la liquidez supera a la deuda financiera (deuda neta negativa). Un valor negativo indica holgura, no riesgo; no se ordena como un apalancamiento bajo.':null},
 {id:'inventory',name:'Rotación de inventarios',category:'Actividad',unit:'×',formula:'Coste de ventas / Inventario medio',reading:'Rotaciones del inventario durante el ejercicio.',inputs:['cost','inventory'],priorInputs:['inventory'],run:(c,p)=>[c.cost,mean(c.inventory,p?.inventory)],positiveDenominator:true},
 {id:'turnover',name:'Rotación de activos',category:'Actividad',unit:'×',formula:'Ingresos / Activo medio',reading:'Ingresos generados por unidad de activo medio.',inputs:['revenue','assets'],priorInputs:['assets'],run:(c,p)=>[c.revenue,mean(c.assets,p?.assets)],positiveDenominator:true},
 {id:'opMargin',name:'Margen operativo',category:'Rentabilidad',unit:'%',formula:'EBIT / Ingresos × 100',reading:'Resultado antes de intereses e impuestos respecto a ventas.',inputs:['ebit','revenue'],run:c=>[c.ebit,c.revenue],positiveDenominator:true},
 {id:'roa',name:'ROA',category:'Rentabilidad',unit:'%',formula:'Beneficio neto / Activo medio × 100',reading:'Rentabilidad generada sobre el activo medio.',inputs:['netIncome','assets'],priorInputs:['assets'],run:(c,p)=>[c.netIncome,mean(c.assets,p?.assets)],positiveDenominator:true},
 {id:'roe',name:'ROE',category:'Rentabilidad',unit:'%',formula:'Beneficio atribuible ordinario / Patrimonio ordinario medio × 100',reading:'Rentabilidad sobre el patrimonio ordinario medio.',inputs:['commonIncome','equity'],priorInputs:['equity'],run:(c,p)=>[c.commonIncome,mean(c.equity,p?.equity)],positiveDenominator:true,negativeReason:EQUITY_NEGATIVE,guard:(c,p)=>c.equity<=0||p?.equity<=0?EQUITY_NEGATIVE+' (Al menos uno de los cierres usados en el promedio es negativo; la media podría salir positiva y ocultarlo.)':null},
 {id:'cfoDebt',name:'Cobertura de deuda por flujo operativo',category:'Flujo de caja',unit:'×',formula:'Flujo de caja operativo / Deuda financiera total',reading:'Parte de la deuda que se podría devolver con un año de caja operativa.',inputs:['ocf','debt'],run:c=>[c.ocf,c.debt],positiveDenominator:true,zeroReason:'Sin deuda financiera: no hay deuda que cubrir.',note:(c,v)=>v<0?'Flujo operativo negativo: el negocio consumió caja antes de invertir.':null},
 {id:'fcfYield',name:'Free cash flow yield',category:'Flujo de caja',unit:'%',formula:'(Flujo de caja operativo − capex) / Capitalización al cierre × 100',reading:'Caja libre generada por cada 100 de valor bursátil del mismo cierre.',inputs:['ocf','capex','marketEquity'],run:c=>[freeCashFlow(c),c.marketEquity],positiveDenominator:true,note:(c,v)=>v<0?'FCF negativo: tras invertir en inmovilizado, el negocio consumió caja.':null},
];
export function ratioAnalysis(current,previous){
 const c=current.values,p=previousIsComparable(current,previous)?previous.values:null;
 return definitions.map(def=>{
  const missing=def.inputs.filter(k=>!finite(n(c,k))).map(k=>fieldLabels[k]);
  if(def.priorInputs){if(!p)missing.push('Ejercicio anterior comparable para el promedio');else for(const key of def.priorInputs)if(!finite(n(p,key)))missing.push(fieldLabels[key]+' del cierre anterior');}
  let value=null,reason=null;const [numerator,denominator]=def.run(c,p);
  if(missing.length)reason='Falta: '+missing.join(', ')+'.';
  else if(!finite(numerator)||!finite(denominator))reason='Faltan cifras para completar la fórmula.';
  else if(def.guard&&def.guard(c,p))reason=def.guard(c,p);
  else if(denominator===0)reason=def.zeroReason||'El denominador es cero.';
  else if(def.positiveDenominator&&denominator<0)reason=def.negativeReason||'El denominador es negativo; este ratio no se interpreta de forma estándar.';
  else{value=numerator/denominator*(def.unit==='%'?100:1);if(!finite(value)){value=null;reason='El cálculo no produce un valor finito.';}}
  const reading=(value!==null&&def.note?.(c,value))||def.reading;
  const parts=def.inputs.map(k=>({label:fieldLabels[k],value:n(c,k),date:current.date}));
  if(def.priorInputs)for(const k of def.priorInputs)parts.push({label:fieldLabels[k]+' inicial',value:n(p,k),date:p?previous.date:null});
  return {id:def.id,name:def.name,category:def.category,unit:def.unit,formula:def.formula,reading,value,reason,numerator:finite(numerator)?numerator:null,denominator:finite(denominator)?denominator:null,parts};
 });
}
export function dupontAnalysis(current,previous){
 const ratios=ratioAnalysis(current,previous),roe=ratios.find(r=>r.id==='roe');
 const c=current.values,p=previousIsComparable(current,previous)?previous.values:null;
 const a=mean(c.assets,p?.assets),e=mean(c.equity,p?.equity);
 const missing=['commonIncome','revenue','assets','equity'].filter(k=>!finite(c[k]));
 if(finite(c.equity)&&(c.equity<=0||(finite(p?.equity)&&p.equity<=0)))return {value:null,reason:'Patrimonio ordinario negativo: DuPont no se descompone porque el multiplicador de patrimonio cambia de signo y el ROE resultante no tiene lectura económica.',factors:null};
 if(!p||missing.length||!finite(a)||!finite(e)||a<=0||e<=0||!finite(c.revenue)||c.revenue<=0||roe.value===null)return {value:null,reason:roe.reason||'Faltan ingresos o activos comparables y positivos para DuPont.',factors:null};
 const factors={margin:c.commonIncome/c.revenue,turnover:c.revenue/a,multiplier:a/e};
 return {value:factors.margin*factors.turnover*factors.multiplier*100,factors,reason:null};
}
export function altmanAnalysis(current){
 const c=current.values;
 const terms=[{label:'Capital circulante / activo',weight:1.2,num:sum(c.currentAssets,finite(c.currentLiabilities)?-c.currentLiabilities:null),den:c.assets},{label:'Beneficios retenidos / activo',weight:1.4,num:c.retained,den:c.assets},{label:'EBIT / activo',weight:3.3,num:c.ebit,den:c.assets},{label:'Capitalización histórica / pasivo total',weight:.6,num:c.marketEquity,den:c.liabilities},{label:'Ingresos / activo',weight:1,num:c.revenue,den:c.assets}].map(t=>({...t,value:finite(t.num)&&finite(t.den)&&t.den>0?t.num/t.den:null}));
 const incomplete=terms.filter(t=>t.value===null).map(t=>t.label);
 if(incomplete.length)return {value:null,zone:null,terms,reason:'Faltan datos del mismo periodo: '+incomplete.join(', ')+'.'};
 const value=terms.reduce((s,t)=>s+t.weight*t.value,0);
 return {value,zone:value>2.99?'Zona segura (modelo)':value>=1.81?'Zona gris':'Mayor riesgo (modelo)',terms,reason:null};
}

// Avisos de contexto que cambian la lectura de varios ratios a la vez.
export function contextNotes(period){
 const c=period.values,notes=[];
 if(finite(c.equity)&&c.equity<=0)notes.push('Patrimonio ordinario negativo ('+(c.equity/1e6).toLocaleString('es-ES',{maximumFractionDigits:0})+' M '+period.currency+'): suele deberse a recompras de acciones o dividendos por encima del beneficio acumulado, o a pérdidas acumuladas. D/E, ROE y DuPont quedan sin interpretar.');
 const nd=netDebt(c);if(finite(nd)&&nd<0)notes.push('Caja neta: el efectivo y las inversiones corrientes superan a la deuda financiera en '+(-nd/1e6).toLocaleString('es-ES',{maximumFractionDigits:0})+' M '+period.currency+'.');
 const own=freeCashFlow(c);if(finite(own)&&finite(c.fcfReported)&&Math.abs(own-c.fcfReported)>Math.max(1,Math.abs(c.fcfReported)*0.01))notes.push('El FCF calculado (flujo operativo − capex) difiere más de un 1 % del FCF publicado por Yahoo; se usa el calculado. Revisa el estado de flujos de efectivo.');
 return notes;
}
