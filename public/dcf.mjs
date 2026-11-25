// Valoración por descuento de flujos de caja libres para la empresa (FCFF). Funciones puras: sin red ni DOM.
// FCFF = EBIT × (1 − t) + amortizaciones − capex − Δ capital circulante. Descuento al WACC; valor terminal por Gordon o por múltiplo.
import { DAMODARAN } from './damodaran.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const avg=a=>{const v=a.filter(finite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;};
export const HISTORY_YEARS=3;           // Ejercicios usados para las medias históricas.
export const TV_WARNING_SHARE=0.75;     // Aviso si el valor terminal pesa más del 75 % del valor de empresa.
export const DEFAULT_TERMINAL_GROWTH=0.02;
// En banca y seguros la deuda es materia prima del negocio y el FCFF no tiene sentido: no se calcula.
export const FINANCIAL_INDUSTRIES=['Bank (Money Center)','Banks (Regional)','Insurance (General)','Insurance (Life)','Insurance (Prop/Cas.)','Reinsurance','Brokerage & Investment Banking','Investments & Asset Management'];
const REIT_INDUSTRIES=['R.E.I.T.','Retail (REITs)','Real Estate (Operations & Services)','Real Estate (General/Diversified)','Real Estate (Development)'];
// País por sufijo de Yahoo, solo si la empresa no está en la clasificación de Damodaran.
const SUFFIX_COUNTRY={MC:'Spain',DE:'Germany',PA:'France',AS:'Netherlands',L:'United Kingdom',SW:'Switzerland',MI:'Italy',ST:'Sweden',CO:'Denmark',BR:'Belgium',LS:'Portugal',HE:'Finland',IR:'Ireland',OL:'Norway',VI:'Austria'};
export const industryNames=region=>Object.keys(DAMODARAN.regions[region]?.industries||{}).filter(n=>!/^(Total Market|Grand Total)/.test(n));
export const industryRow=(region,name)=>{const r=DAMODARAN.regions[region]?.industries?.[name];return r?{name,region,firms:r[0],beta:r[1],de:r[2],effectiveTax:r[3],betaU:r[4],cashFirm:r[5],betaUCash:r[6],evEbitda:r[7]}:null;};
// Industria más frecuente de un grupo de comparables según Damodaran (para empresas que él no clasifica).
export function groupIndustry(group){
 const count=new Map();for(const t of group?.tickers||[]){const c=DAMODARAN.companies[t];if(c)count.set(c[0],(count.get(c[0])||0)+1);}
 return [...count.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
}
// Perfil de la empresa: industria, país y región de la tabla. Prioridad: clasificación de Damodaran > grupo de comparables > sufijo del ticker.
export function companyProfile(ticker,group=null){
 const t=String(ticker||'').toUpperCase(),c=DAMODARAN.companies[t];
 if(c)return {industry:c[0],country:c[1],region:c[2],source:'damodaran'};
 const suffix=t.includes('.')?t.split('.').pop():null,country=suffix?SUFFIX_COUNTRY[suffix]||null:'United States';
 const region=country==='United States'?'us':country?'europe':'global';
 const industry=groupIndustry(group);
 return {industry,country,region,source:industry?'group':null};
}
export const countryRisk=country=>finite(DAMODARAN.crp[country])?DAMODARAN.crp[country]:null;
// Hamada: βL = βU × [1 + (1 − t) × D/E].
export const releverBeta=(betaU,de,tax)=>[betaU,de,tax].every(finite)?betaU*(1+(1-tax)*de):null;

// Supuestos de partida a partir del histórico. Cada uno lleva su fórmula, los ejercicios usados y, si falta, el motivo.
export function historicalInputs(periods,date){
 const i=(periods||[]).findIndex(p=>p.date===date);if(i<0)return null;
 const p0=periods[i],chain=[p0];
 for(let k=i+1;k<periods.length&&chain.length<=HISTORY_YEARS;k++){const p=periods[k],prev=chain[chain.length-1];if(p.currency!==p0.currency)break;const gap=(Date.parse(prev.date)-Date.parse(p.date))/864e5;if(gap<300||gap>430)break;chain.push(p);}
 const win=chain.slice(0,HISTORY_YEARS),v=p=>p.values,dates=win.map(p=>p.date);
 const ratioAvg=(fn,formula)=>{const vals=win.map(p=>fn(v(p))).filter(finite);return vals.length?{value:avg(vals),years:dates.slice(0,vals.length),n:vals.length,formula}:{value:null,formula,reason:'Faltan datos en el histórico.'};};
 const out={date:p0.date,currency:p0.currency,years:dates};
 // Crecimiento: CAGR de ingresos entre el ejercicio más antiguo de la cadena y el actual.
 const first=chain[chain.length-1],n=chain.length-1;
 out.growth=n>=1&&finite(v(p0).revenue)&&finite(v(first).revenue)&&v(first).revenue>0&&v(p0).revenue>0?{value:Math.pow(v(p0).revenue/v(first).revenue,1/n)-1,years:[first.date,p0.date],n,formula:'CAGR de ingresos: (ingresos '+p0.date.slice(0,4)+' / ingresos '+first.date.slice(0,4)+')^(1/'+n+') − 1'}:{value:null,formula:'CAGR de ingresos',reason:'Hace falta al menos un ejercicio anterior comparable con ingresos positivos.'};
 out.margin=ratioAvg(x=>finite(x.ebit)&&x.revenue>0?x.ebit/x.revenue:null,'Media de EBIT / ingresos');
 const taxYears=win.filter(p=>finite(v(p).taxProvision)&&finite(v(p).pretaxIncome)&&v(p).pretaxIncome>0);
 const tax=taxYears.length?taxYears.reduce((s,p)=>s+v(p).taxProvision,0)/taxYears.reduce((s,p)=>s+v(p).pretaxIncome,0):null;
 out.tax=finite(tax)&&tax>=0&&tax<0.6?{value:tax,years:taxYears.map(p=>p.date),n:taxYears.length,formula:'Σ gasto por impuestos / Σ resultado antes de impuestos'}:{value:null,formula:'Tipo efectivo',reason:'Sin resultado antes de impuestos positivo o con un tipo efectivo fuera de rango (0–60 %).'};
 out.daPct=ratioAvg(x=>x.revenue>0?(finite(x.depreciation)?Math.abs(x.depreciation):finite(x.ebitda)&&finite(x.ebit)?x.ebitda-x.ebit:null)/x.revenue:null,'Media de amortizaciones / ingresos');
 out.capexPct=ratioAvg(x=>finite(x.capex)&&x.revenue>0?Math.abs(x.capex)/x.revenue:null,'Media de capex / ingresos');
 // En el estado de flujos, una variación negativa del circulante es caja consumida: la inversión en circulante es −ChangeInWorkingCapital.
 out.nwcPct=ratioAvg(x=>finite(x.changeWC)&&x.revenue>0?-x.changeWC/x.revenue:null,'Media de inversión en circulante (−variación en el estado de flujos) / ingresos');
 const p1=chain[1],debtAvg=p1&&finite(v(p0).debt)&&finite(v(p1).debt)?(v(p0).debt+v(p1).debt)/2:null;
 out.kd=finite(v(p0).interest)&&finite(debtAvg)&&debtAvg>0&&Math.abs(v(p0).interest)>0?{value:Math.abs(v(p0).interest)/debtAvg,years:[p1.date,p0.date],formula:'Gasto por intereses / deuda financiera media'}:{value:null,formula:'Gasto por intereses / deuda financiera media',reason:'Falta el gasto por intereses o la deuda media. Introduce el coste de la deuda (p. ej., rentabilidad de sus bonos).'};
 const minorities=finite(v(p0).totalEquity)&&finite(v(p0).stockholdersEquity)?Math.max(0,v(p0).totalEquity-v(p0).stockholdersEquity):0;
 out.base={revenue:v(p0).revenue,debt:v(p0).debt,cash:v(p0).cashShortTotal,minorities,shares:v(p0).shares,marketEquity:v(p0).marketEquity,ebit:v(p0).ebit};
 return out;
}

// Supuestos por defecto: históricos + Damodaran + mercado. market = {price, priceCurrency, rf}.
export function defaultAssumptions(hist,profile,market={}){
 const ind=profile?.industry?industryRow(profile.region,profile.industry):null,region=DAMODARAN.regions[profile?.region];
 const b=hist.base,sameCurrency=market.priceCurrency===hist.currency&&finite(market.price)&&finite(b.shares)&&b.shares>0;
 const equityValue=sameCurrency?market.price*b.shares:b.marketEquity;
 const de=finite(b.debt)&&finite(equityValue)&&equityValue>0?b.debt/equityValue:null;
 return {
  years:5,growth:hist.growth.value,margin:hist.margin.value,tax:hist.tax.value??region?.marginalTax??null,
  daPct:hist.daPct.value,capexPct:hist.capexPct.value,nwcPct:hist.nwcPct.value??0,
  tvMethod:'gordon',terminalGrowth:DEFAULT_TERMINAL_GROWTH,exitMultiple:finite(ind?.evEbitda)?ind.evEbitda:null,midYear:true,
  waccMode:'capm',waccDirect:null,rf:finite(market.rf)?market.rf:null,erp:DAMODARAN.erp.mature,crp:countryRisk(profile?.country)??0,
  betaU:ind?.betaU??null,relevTax:region?.marginalTax??null,de,betaOverride:null,kd:hist.kd.value,
  equityValueSource:sameCurrency?'price':'close',
 };
}

export function computeWacc(a){
 const missing=[];
 if(a.waccMode==='direct'){if(!finite(a.waccDirect))missing.push('WACC');return {wacc:finite(a.waccDirect)?a.waccDirect:null,missing,direct:true};}
 const betaL=finite(a.betaOverride)?a.betaOverride:releverBeta(a.betaU,a.de,a.relevTax);
 if(!finite(betaL))missing.push('beta');if(!finite(a.rf))missing.push('tipo libre de riesgo');if(!finite(a.erp))missing.push('prima de riesgo de mercado');
 const de=finite(a.de)?Math.max(0,a.de):null;if(de===null)missing.push('D/E');
 const wE=de===null?null:1/(1+de),wD=de===null?null:de/(1+de);
 if(wD>0&&!finite(a.kd))missing.push('coste de la deuda');if(!finite(a.tax))missing.push('tipo impositivo');
 const ke=finite(betaL)&&finite(a.rf)&&finite(a.erp)?a.rf+betaL*(a.erp+(finite(a.crp)?a.crp:0)):null;
 const kdAfter=wD===0?0:finite(a.kd)&&finite(a.tax)?a.kd*(1-a.tax):null;
 const wacc=missing.length?null:wE*ke+wD*kdAfter;
 return {betaL,ke,kdAfter,wE,wD,wacc,missing,direct:false};
}

const required=[['growth','crecimiento de ingresos'],['margin','margen EBIT'],['tax','tipo impositivo'],['daPct','amortizaciones / ingresos'],['capexPct','capex / ingresos'],['nwcPct','circulante / ingresos']];
// Proyección y valor. wacc explícito permite reutilizarla en la tabla de sensibilidad.
export function valuation(base,a,wacc){
 const errors=[],warnings=[];
 if(!finite(base?.revenue)||base.revenue<=0)errors.push('Faltan los ingresos del último ejercicio.');
 for(const[k,label]of required)if(!finite(a[k]))errors.push('Falta el supuesto de '+label+'.');
 const n=Math.round(a.years);if(!(n>=1&&n<=15))errors.push('El horizonte debe estar entre 1 y 15 años.');
 if(!finite(wacc))errors.push('Falta el WACC.');else if(wacc<=0)errors.push('El WACC debe ser positivo.');
 if(a.tvMethod==='gordon'){if(!finite(a.terminalGrowth))errors.push('Falta el crecimiento a perpetuidad.');else if(finite(wacc)&&a.terminalGrowth>=wacc)errors.push('El crecimiento a perpetuidad ('+(a.terminalGrowth*100).toFixed(2)+' %) debe ser menor que el WACC ('+(wacc*100).toFixed(2)+' %): con g ≥ WACC el modelo de Gordon no tiene solución finita.');}
 else if(!finite(a.exitMultiple)||a.exitMultiple<=0)errors.push('Falta un múltiplo EV/EBITDA de salida positivo.');
 if(errors.length)return {errors,warnings,rows:[]};
 const rows=[];let rev=base.revenue;
 for(let t=1;t<=n;t++){
  const prevRev=rev;rev=prevRev*(1+a.growth);
  const ebit=rev*a.margin,nopat=ebit*(1-a.tax),da=rev*a.daPct,capex=rev*a.capexPct,dNwc=rev*a.nwcPct,fcff=nopat+da-capex-dNwc;
  const factor=Math.pow(1+wacc,-(a.midYear?t-0.5:t));rows.push({t,revenue:rev,ebit,nopat,da,capex,dNwc,fcff,ebitda:ebit+da,factor,pv:fcff*factor});
 }
 const last=rows[n-1],tvFactor=Math.pow(1+wacc,-n);
 const gordonTv=a.terminalGrowth<wacc?last.fcff*(1+a.terminalGrowth)/(wacc-a.terminalGrowth):null;
 const multipleTv=finite(a.exitMultiple)?a.exitMultiple*last.ebitda:null;
 const tv=a.tvMethod==='gordon'?gordonTv:multipleTv;
 const pvExplicit=rows.reduce((s,r)=>s+r.pv,0),pvTv=tv*tvFactor,ev=pvExplicit+pvTv;
 const netDebt=finite(base.debt)&&finite(base.cash)?base.debt-base.cash:null;
 const equity=finite(netDebt)&&ev>0?ev-netDebt-(base.minorities||0):null;
 const perShare=finite(equity)&&finite(base.shares)&&base.shares>0?equity/base.shares:null;
 // Coherencia: múltiplo implícito en Gordon y crecimiento implícito en el múltiplo.
 const impliedMultiple=finite(gordonTv)&&last.ebitda>0?gordonTv/last.ebitda:null;
 const impliedGrowth=finite(multipleTv)&&multipleTv+last.fcff!==0?(multipleTv*wacc-last.fcff)/(multipleTv+last.fcff):null;
 const tvShare=ev>0?pvTv/ev:null;
 if(finite(tvShare)&&tvShare>TV_WARNING_SHARE)warnings.push('El valor terminal supone el '+(tvShare*100).toFixed(0)+' % del valor de empresa: el resultado depende sobre todo de los supuestos a perpetuidad.');
 if(rows[0].fcff<0)warnings.push('El FCFF del primer año proyectado es negativo: el valor descansa en flujos futuros más inciertos.');
 if(last.fcff<=0&&a.tvMethod==='gordon')warnings.push('El FCFF del último año es negativo o cero: el valor terminal por Gordon no es interpretable.');
 if(!finite(netDebt))warnings.push('Falta la deuda o el efectivo: no se puede pasar del valor de empresa al del patrimonio.');
 if(ev<=0)warnings.push('El valor de empresa sale negativo o cero: no se calcula el valor del patrimonio. Revisa los supuestos.');
 return {errors,warnings,rows,tv,pvTv,pvExplicit,ev,netDebt,minorities:base.minorities||0,equity,perShare,tvShare,impliedMultiple,impliedGrowth,gordonTv,multipleTv,wacc};
}

// Tabla de sensibilidad: WACC ± 1 p. p. frente a g∞ ± 1 p. p. (Gordon) o múltiplo ± 2× (salida).
export function sensitivity(base,a,wacc){
 if(!finite(wacc))return null;
 const ws=[-0.01,-0.005,0,0.005,0.01].map(d=>wacc+d);
 const gordon=a.tvMethod==='gordon',center=gordon?a.terminalGrowth:a.exitMultiple;if(!finite(center))return null;
 const xs=(gordon?[-0.01,-0.005,0,0.005,0.01]:[-2,-1,0,1,2]).map(d=>center+d);
 const metric=r=>finite(r.perShare)?r.perShare:finite(r.equity)?r.equity:r.ev;
 const cells=ws.map(w=>xs.map(x=>{const r=valuation(base,{...a,[gordon?'terminalGrowth':'exitMultiple']:x},w);return r.errors.length?null:metric(r);}));
 return {waccs:ws,xs,axis:gordon?'g':'multiple',cells,metric:finite(base.shares)&&base.shares>0?'perShare':'equity'};
}

// Punto de entrada: todo el cálculo, con bloqueos explícitos.
export function runDcf({hist,profile,assumptions,market={},currency}){
 const blocks=[];
 if(profile?.industry&&FINANCIAL_INDUSTRIES.includes(profile.industry))blocks.push('Banca, seguros y gestoras: la deuda y los depósitos son parte del negocio, así que el FCFF y el WACC no tienen sentido. Para estas empresas se usa un modelo de dividendos o de exceso de rentabilidad sobre el patrimonio.');
 const w=computeWacc(assumptions);
 const result=blocks.length?{errors:[],warnings:[],rows:[]}:valuation(hist.base,assumptions,w.wacc);
 if(!blocks.length&&w.missing.length)result.errors.unshift('Para calcular el WACC falta: '+w.missing.join(', ')+'.');
 const warnings=[...result.warnings];
 if(profile?.industry&&REIT_INDUSTRIES.includes(profile.industry))warnings.push('Inmobiliarias: el capex incluye compras de inmuebles y el FCFF varía mucho de un año a otro. Lee el resultado con cautela.');
 if(finite(assumptions.terminalGrowth)&&finite(assumptions.rf)&&assumptions.tvMethod==='gordon'&&assumptions.terminalGrowth>assumptions.rf)warnings.push('El crecimiento a perpetuidad supera al tipo libre de riesgo: a largo plazo, ninguna empresa puede crecer más que la economía.');
 const comparable=market.priceCurrency===currency&&finite(market.price);
 if(finite(market.price)&&!comparable)warnings.push('La acción cotiza en '+market.priceCurrency+' y las cuentas están en '+currency+': el valor por acción no se compara con la cotización (no se convierte la divisa).');
 const upside=comparable&&finite(result.perShare)&&market.price>0?result.perShare/market.price-1:null;
 return {...result,blocks,wacc:w,warnings,upside,sensitivity:blocks.length||result.errors?.length?null:sensitivity(hist.base,assumptions,w.wacc)};
}
