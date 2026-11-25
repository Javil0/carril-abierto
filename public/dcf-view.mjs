// Pestaña «Valoración DCF»: supuestos editables, construcción de la beta, proyección y sensibilidad. El recálculo es local, sin llamadas al servidor.
import { DAMODARAN } from './damodaran.mjs';
import { historicalInputs, defaultAssumptions, runDcf, companyProfile, industryRow, industryNames, countryRisk, TV_WARNING_SHARE } from './dcf.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=2)=>finite(n)?new Intl.NumberFormat('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d,useGrouping:'always'}).format(n):'—';
const pct=(n,d=2)=>finite(n)?num(n*100,d)+' %':'—';
const mill=n=>finite(n)?num(n/1e6,0):'—';
const REGION_LABEL={us:'EE. UU.',europe:'Europa occidental',global:'Global'};
const COUNTRY_ES={'United States':'EE. UU.',Spain:'España',Germany:'Alemania',France:'Francia',Netherlands:'Países Bajos','United Kingdom':'Reino Unido',Switzerland:'Suiza',Italy:'Italia',Sweden:'Suecia',Denmark:'Dinamarca',Belgium:'Bélgica',Portugal:'Portugal',Finland:'Finlandia',Ireland:'Irlanda',Norway:'Noruega',Luxembourg:'Luxemburgo',Japan:'Japón',Taiwan:'Taiwán',Canada:'Canadá',Austria:'Austria'};
const countryEs=c=>COUNTRY_ES[c]||c||'—';
// Campos editables: clave, etiqueta, tipo ('pct' se edita en %, 'num' tal cual).
const OPERATING=[['growth','Crecimiento anual de ingresos','pct'],['margin','Margen EBIT','pct'],['tax','Tipo impositivo (NOPAT y escudo fiscal)','pct'],['daPct','Amortizaciones / ingresos','pct'],['capexPct','Capex / ingresos','pct'],['nwcPct','Inversión en circulante / ingresos','pct'],['years','Años de proyección explícita','num']];
const CAPITAL=[['rf','Tipo libre de riesgo','pct'],['erp','Prima de riesgo de mercado (ERP)','pct'],['crp','Prima de riesgo país','pct'],['betaU','Beta desapalancada del sector','num'],['de','Deuda / patrimonio (a mercado)','num'],['relevTax','Tipo para reapalancar','pct'],['betaOverride','Beta apalancada (sustituye a la calculada)','num'],['kd','Coste de la deuda antes de impuestos','pct']];

export function createDcfView(ctx){
 // ctx: {$, getReport, getPeriod, getGroup}
 const {$}=ctx;let state=freshState(),marketSeq=0;
 function freshState(){return {key:null,overrides:{},industry:null,region:null,market:null,marketError:null,marketLoading:false};}
 const report=()=>ctx.getReport(),period=()=>ctx.getPeriod();
 function profile(){
  const r=report(),p=companyProfile(r.ticker,ctx.getGroup());
  const region=state.region||p.region,industry=state.industry||p.industry;
  return {...p,region,industry,source:state.industry?'user':state.region&&state.region!==p.region?'user':p.source,baseRegion:p.region};
 }
 function model(){
  const r=report(),p=period();if(!r||!p)return null;
  const hist=historicalInputs(r.periods,p.date);if(!hist)return null;
  const prof=profile(),q=state.market?.quote;
  const market={price:q?.price,priceCurrency:q?.currency,rf:state.market?.riskFree?.rate};
  const defaults=defaultAssumptions(hist,prof,market);
  const assumptions={...defaults,...state.overrides};
  const result=runDcf({hist,profile:prof,assumptions,market,currency:p.currency});
  return {hist,prof,defaults,assumptions,result,market,currency:p.currency};
 }
 // Al cambiar de empresa o de ejercicio se vuelve a los supuestos de partida.
 function sync(){
  const r=report(),p=period();if(!r||!p)return false;const key=r.ticker+'|'+p.date;
  if(state.key!==key){const keepMarket=state.key&&state.key.split('|')[0]===r.ticker&&state.market?.currency===p.currency;const m=keepMarket?state.market:null;state=freshState();state.key=key;state.market=m;if(!m)loadMarket();}
  return true;
 }
 async function loadMarket(){
  const r=report(),p=period();if(!r||!p)return;const seq=++marketSeq;state.marketLoading=true;state.marketError=null;
  try{const res=await fetch('/api/market?ticker='+encodeURIComponent(r.ticker)+'&currency='+encodeURIComponent(p.currency),{signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudieron descargar los datos de mercado.');if(seq!==marketSeq)return;state.market={...data,currency:p.currency};}
  catch(e){if(seq!==marketSeq)return;state.marketError=e.name==='TimeoutError'?'Los datos de mercado han tardado demasiado.':e.message;}
  state.marketLoading=false;if(!$('panel-dcf').hidden)render();
 }
 function sourceNote(key,m){
  const h=m.hist,d=m.defaults,ind=m.prof.industry?industryRow(m.prof.region,m.prof.industry):null;
  const histNote=e=>e?.value===null||e?.value===undefined?'Pendiente: '+(e?.reason||'sin dato'):e.formula+' · '+(e.years||[]).map(y=>y.slice(0,4)).join(', ');
  switch(key){
   case 'growth':case 'margin':case 'daPct':case 'capexPct':return 'Histórico · '+histNote(h[key]);
   case 'nwcPct':return h.nwcPct.value===null?'Sin dato histórico: se parte de 0 %.':'Histórico · '+histNote(h.nwcPct);
   case 'tax':return h.tax.value===null?'Sin tipo efectivo histórico: se usa el marginal de la región en Damodaran ('+pct(DAMODARAN.regions[m.prof.region]?.marginalTax,2)+').':'Histórico · '+histNote(h.tax);
   case 'years':return 'Por defecto 5 años (de 1 a 15).';
   case 'rf':{const rf=state.market?.riskFree;if(state.marketLoading)return 'Descargando…';if(state.marketError)return 'Pendiente: '+state.marketError;return rf?.rate!=null?esc(rf.source)+' · '+rf.date+' · <a href="'+esc(rf.url)+'" target="_blank" rel="noopener noreferrer">fuente ↗</a>':'Pendiente: '+esc(rf?.reason||'sin dato');}
   case 'erp':return 'Damodaran · ERP implícita de un mercado maduro (país Aaa), '+DAMODARAN.updated+' · <a href="'+DAMODARAN.erp.source+'" target="_blank" rel="noopener noreferrer">fuente ↗</a>';
   case 'crp':return 'Damodaran · prima de '+esc(countryEs(m.prof.country))+' (país de la sede, no de las ventas)'+(countryRisk(m.prof.country)===null?' · sin dato: 0 %':'');
   case 'betaU':return ind?'Damodaran · '+esc(ind.name)+' ('+REGION_LABEL[ind.region]+', '+ind.firms+' empresas)':'Pendiente: elige una industria.';
   case 'de':return finite(d.de)?'Deuda financiera '+mill(h.base.debt)+' M / '+(d.equityValueSource==='price'?'cotización × acciones':'capitalización al cierre')+' '+mill(d.equityValueSource==='price'?state.market.quote.price*h.base.shares:h.base.marketEquity)+' M':'Pendiente: falta la deuda o la capitalización.';
   case 'relevTax':return 'Tipo marginal con el que Damodaran desapalancó la tabla '+REGION_LABEL[m.prof.region]+': así ida y vuelta son coherentes.';
   case 'betaOverride':return 'Vacío = se usa la beta reapalancada. Escribe una beta para sustituirla (p. ej., una regresión propia).';
   case 'kd':return 'Histórico · '+histNote(h.kd);
   case 'terminalGrowth':return 'Por defecto 2 %, cerca de la inflación a largo plazo. Tiene que ser menor que el WACC y no debería superar el tipo libre de riesgo.';
   case 'exitMultiple':return finite(ind?.evEbitda)?'Damodaran · EV/EBITDA medio de «'+esc(ind.name)+'» ('+REGION_LABEL[ind.region]+', empresas con EBITDA positivo)':'Pendiente: no hay múltiplo para esta industria. Introdúcelo.';
   case 'waccDirect':return 'Escribe el WACC que quieras usar. La beta y el CAPM dejan de intervenir.';
  }
  return '';
 }
 function field([key,label,type],m){
  const v=m.assumptions[key],edited=Object.prototype.hasOwnProperty.call(state.overrides,key);
  const shown=finite(v)?(type==='pct'?+(v*100).toFixed(2):key==='years'?v:+v.toFixed(key==='exitMultiple'?1:3)):'';
  return `<div class="dcf-field${edited?' edited':''}${!finite(v)&&key!=='betaOverride'?' missing':''}"><label for="dcf-${key}">${label}${type==='pct'?' <small>(%)</small>':''}</label><div class="dcf-input"><input id="dcf-${key}" data-key="${key}" data-type="${type}" type="number" step="${type==='pct'?'0.1':key==='years'?'1':'0.01'}" inputmode="decimal" value="${shown}" placeholder="${key==='betaOverride'?'—':'Pendiente'}">${edited?`<button type="button" class="dcf-reset" data-reset="${key}" title="Volver al valor de partida" aria-label="Volver al valor de partida de ${label}">↺</button>`:''}</div><small class="dcf-source">${edited?'<b>Supuesto del usuario.</b> ':''}${sourceNote(key,m)}</small></div>`;
 }
 function betaNotice(m){
  const a=m.assumptions,w=m.result.wacc,ind=m.prof.industry?industryRow(m.prof.region,m.prof.industry):null,t=report().ticker;
  const origin=m.prof.source==='damodaran'?'Damodaran clasifica a '+esc(t)+' en «'+esc(m.prof.industry)+'».':m.prof.source==='group'?'Damodaran no clasifica a '+esc(t)+': se usa la industria más frecuente de su grupo de comparables («'+esc(m.prof.industry)+'»).':m.prof.source==='user'?'Industria y tabla elegidas por el usuario.':'No hay industria asignada: elige una en el desplegable.';
  const formula=finite(a.betaOverride)?'Beta introducida por el usuario: <strong>'+num(a.betaOverride,3)+'</strong>. No se reapalanca.':finite(w.betaL)?`βL = βU × [1 + (1 − t) × D/E] = ${num(a.betaU,3)} × [1 + (1 − ${pct(a.relevTax,2)}) × ${num(a.de,3)}] = <strong>${num(w.betaL,3)}</strong>`:'Falta la beta desapalancada o la D/E.';
  return `<section class="dcf-beta"><div class="section-heading"><div><span class="eyebrow">CÓMO SE CONSTRUYE LA BETA</span><h2>Una beta estimada, no observada.</h2></div><span class="small-tag">Damodaran · ${DAMODARAN.updated}</span></div>
  <div class="dcf-pickers"><label class="peer-select"><span>Tabla de Damodaran</span><select id="dcfRegion">${Object.keys(DAMODARAN.regions).map(r=>`<option value="${r}"${r===m.prof.region?' selected':''}>${REGION_LABEL[r]}</option>`).join('')}</select></label><label class="peer-select"><span>Industria</span><select id="dcfIndustry"><option value="">Elige una industria…</option>${industryNames(m.prof.region).map(n=>`<option${n===m.prof.industry?' selected':''}>${esc(n)}</option>`).join('')}</select></label></div>
  <div class="formula-box">${formula}</div>
  <p class="detail-note">${origin} ${ind?`Se parte de su beta desapalancada media (${num(ind.betaU,3)}; ${ind.firms} empresas de la tabla ${REGION_LABEL[ind.region]}) y se reapalanca con la estructura de capital de ${esc(t)} a valor de mercado.`:''}</p>
  <p class="dcf-caveat"><b>Aviso.</b> Esta beta supone que ${esc(t)} tiene el riesgo de negocio medio de su industria y que mantendrá su endeudamiento actual. No sale de una regresión de sus cotizaciones, así que puede diferir de la beta que publican otros proveedores. Úsala como punto de partida y cámbiala si tienes una estimación mejor.</p>
  <table class="detail-data"><tbody>
   <tr><td>Coste del patrimonio (CAPM)<br><small>rf + βL × (ERP + prima país)</small></td><td>${pct(w.ke)}</td></tr>
   <tr><td>Coste de la deuda después de impuestos<br><small>Kd × (1 − t)</small></td><td>${pct(w.kdAfter)}</td></tr>
   <tr><td>Peso del patrimonio / de la deuda<br><small>E/(D+E) y D/(D+E), con la D/E de arriba</small></td><td>${pct(w.wE,1)} / ${pct(w.wD,1)}</td></tr>
   <tr><td><strong>WACC</strong>${w.direct?'<br><small>Introducido directamente</small>':''}</td><td><strong>${pct(w.wacc)}</strong></td></tr>
  </tbody></table></section>`;
 }
 function kpis(m){
  const r=m.result,q=state.market?.quote,c=m.currency;
  const items=[['Valor por acción',finite(r.perShare)?num(r.perShare,2)+'<small>'+c+'</small>':'Pendiente',finite(r.perShare)?'Patrimonio / acciones en circulación':(r.blocks.length?'No aplicable':'Revisa los supuestos')],
   ['Cotización',q?num(q.price,2)+'<small>'+esc(q.currency)+'</small>':state.marketLoading?'…':'—',q?.time?'Yahoo · '+new Date(q.time).toLocaleString('es-ES'):'Sin cotización'],
   ['Potencial',finite(r.upside)?(r.upside>=0?'+':'')+num(r.upside*100,1)+'<small>%</small>':'—','Valor por acción / cotización − 1'],
   ['WACC',r.blocks.length?'—':finite(r.wacc.wacc)?num(r.wacc.wacc*100,2)+'<small>%</small>':'Pendiente',r.blocks.length?'No aplicable':r.wacc.direct?'Introducido directamente':'CAPM + estructura de mercado'],
   ['Peso del valor terminal',finite(r.tvShare)?num(r.tvShare*100,0)+'<small>%</small>':'—',finite(r.tvShare)&&r.tvShare>TV_WARNING_SHARE?'Por encima del 75 %':'VP del valor terminal / EV']];
  return '<div class="headline-kpis dcf-kpis">'+items.map(([l,v,d])=>`<div class="kpi"><label>${l}</label><strong class="${/Pendiente/.test(v)?'pending-value':''}">${v}</strong><span class="delta">${d}</span></div>`).join('')+'</div>';
 }
 function projection(m){
  const r=m.result,c=m.currency;if(!r.rows?.length)return '';
  const h=m.hist.base,cols=r.rows;
  const row=(label,fn,cls='')=>`<tr class="${cls}"><td>${label}</td><td>${fn(null)}</td>${cols.map(x=>`<td>${fn(x)}</td>`).join('')}</tr>`;
  const d=(fn,base='')=>x=>x?mill(fn(x)):base;
  return `<section class="dcf-block"><div class="section-heading"><div><h2>De los ingresos al flujo libre.</h2><p>Millones de ${c}. Año 0 = ejercicio ${m.hist.date}. ${m.assumptions.midYear?'Flujos descontados a mitad de año.':'Flujos descontados a final de año.'}</p></div></div><div class="table-scroll"><table class="raw-table dcf-table"><thead><tr><th>Partida</th><th>Año 0</th>${cols.map(x=>`<th>Año ${x.t}</th>`).join('')}</tr></thead><tbody>
  ${row('Ingresos',d(x=>x.revenue,mill(h.revenue)))}${row('EBIT',d(x=>x.ebit,mill(h.ebit)))}${row('− Impuestos sobre el EBIT',d(x=>-(x.ebit-x.nopat)))}${row('= NOPAT',d(x=>x.nopat),'sub')}${row('+ Amortizaciones',d(x=>x.da))}${row('− Capex',d(x=>-x.capex))}${row('− Inversión en circulante',d(x=>-x.dNwc))}${row('= FCFF',d(x=>x.fcff),'total')}${row('Factor de descuento',x=>x?num(x.factor,4):'')}${row('Valor presente',d(x=>x.pv),'sub')}
  </tbody></table></div>
  <table class="detail-data dcf-bridge"><tbody>
   <tr><td>Suma del valor presente de los FCFF</td><td>${mill(r.pvExplicit)} M</td></tr>
   <tr><td>Valor terminal (${m.assumptions.tvMethod==='gordon'?'Gordon: FCFFₙ × (1 + g) / (WACC − g)':'múltiplo: EV/EBITDA × EBITDAₙ'})<br><small>Descontado ${m.assumptions.years} años: ${mill(r.pvTv)} M</small></td><td>${mill(r.tv)} M</td></tr>
   <tr><td><strong>Valor de empresa (EV)</strong></td><td><strong>${mill(r.ev)} M</strong></td></tr>
   <tr><td>− Deuda neta<br><small>Deuda financiera ${mill(h.debt)} M − efectivo e inversiones corrientes ${mill(h.cash)} M</small></td><td>${mill(r.netDebt)} M</td></tr>
   <tr><td>− Minoritarios (valor contable)</td><td>${mill(r.minorities)} M</td></tr>
   <tr><td><strong>Valor del patrimonio</strong></td><td><strong>${mill(r.equity)} M</strong></td></tr>
   <tr><td>÷ Acciones en circulación (cierre ${m.hist.date})</td><td>${finite(h.shares)?num(h.shares/1e6,1)+' M':'Pendiente'}</td></tr>
   <tr><td><strong>Valor por acción</strong></td><td><strong>${finite(r.perShare)?num(r.perShare,2)+' '+c:'Pendiente'}</strong></td></tr>
   <tr><td>Coherencia entre métodos<br><small>${m.assumptions.tvMethod==='gordon'?'Múltiplo EV/EBITDA implícito en Gordon':'Crecimiento a perpetuidad implícito en el múltiplo'}</small></td><td>${m.assumptions.tvMethod==='gordon'?(finite(r.impliedMultiple)?num(r.impliedMultiple,1)+'×':'—'):pct(r.impliedGrowth)}</td></tr>
  </tbody></table></section>`;
 }
 function sensitivityTable(m){
  const s=m.result.sensitivity;if(!s)return '';const g=s.axis==='g';
  const label=s.metric==='perShare'?'Valor por acción ('+m.currency+')':'Valor del patrimonio (M '+m.currency+')';
  const fmtCell=v=>finite(v)?(s.metric==='perShare'?num(v,2):mill(v)):'—';
  return `<section class="dcf-block"><div class="section-heading"><div><h2>Cuánto cambia si cambian los supuestos.</h2><p>${label}. Filas: WACC. Columnas: ${g?'crecimiento a perpetuidad':'múltiplo EV/EBITDA de salida'}. En el centro, el caso base.</p></div></div><div class="table-scroll"><table class="raw-table dcf-sens"><thead><tr><th>WACC \\ ${g?'g∞':'EV/EBITDA'}</th>${s.xs.map(x=>`<th>${g?pct(x,1):num(x,1)+'×'}</th>`).join('')}</tr></thead><tbody>${s.waccs.map((w,i)=>`<tr><td>${pct(w,2)}</td>${s.cells[i].map((v,j)=>`<td class="${i===2&&j===2?'center':''}">${fmtCell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="panel-foot">«—»: combinación sin solución (por ejemplo, g ≥ WACC).</p></section>`;
 }
 function render(){
  if(!report()||!period()||!sync())return;const m=model(),panel=$('dcfContent');
  if(!m){panel.innerHTML='<p class="pending-note">No hay datos suficientes para este ejercicio.</p>';return;}
  const r=m.result,a=m.assumptions;
  const alerts=[...r.blocks.map(b=>['block',b]),...(r.errors||[]).map(e=>['error',e]),...r.warnings.map(w=>['warn',w])];
  const tv=`<div class="dcf-group"><h3>Valor terminal</h3><div class="dcf-field"><label for="dcf-tvMethod">Método</label><select id="dcf-tvMethod" data-key="tvMethod"><option value="gordon"${a.tvMethod==='gordon'?' selected':''}>Crecimiento a perpetuidad (Gordon)</option><option value="multiple"${a.tvMethod==='multiple'?' selected':''}>Múltiplo EV/EBITDA de salida</option></select></div>
   ${a.tvMethod==='gordon'?field(['terminalGrowth','Crecimiento a perpetuidad (g∞)','pct'],m):field(['exitMultiple','Múltiplo EV/EBITDA de salida','num'],m)}
   <label class="dcf-check"><input type="checkbox" id="dcf-midYear" data-key="midYear"${a.midYear?' checked':''}> Convención de mitad de año (los flujos llegan, de media, a mitad de ejercicio)</label></div>`;
  const wacc=`<div class="dcf-group"><h3>Coste de capital</h3><div class="dcf-field"><label for="dcf-waccMode">Cómo se obtiene el WACC</label><select id="dcf-waccMode" data-key="waccMode"><option value="capm"${a.waccMode==='capm'?' selected':''}>Calculado: CAPM + estructura de capital</option><option value="direct"${a.waccMode==='direct'?' selected':''}>Lo introduzco directamente</option></select></div>${a.waccMode==='direct'?field(['waccDirect','WACC','pct'],m):CAPITAL.map(f=>field(f,m)).join('')}</div>`;
  panel.innerHTML=`${alerts.length?`<div class="dcf-alerts">${alerts.map(([k,t])=>`<p class="dcf-alert ${k}">${esc(t)}</p>`).join('')}</div>`:''}${kpis(m)}
  <div class="dcf-grid"><section class="dcf-assumptions"><div class="section-heading"><div><span class="eyebrow">SUPUESTOS</span><h2>Todo se puede cambiar.</h2><p>Cada valor muestra de dónde sale. Si lo cambias, queda marcado como supuesto del usuario.</p></div><button type="button" class="underlined-button" id="dcfResetAll"${Object.keys(state.overrides).length||state.industry||state.region?'':' disabled'}>Restablecer todo</button></div>
   <div class="dcf-group"><h3>Operación</h3>${OPERATING.map(f=>field(f,m)).join('')}</div>${tv}${wacc}</section>${betaNotice(m)}</div>
  ${projection(m)}${sensitivityTable(m)}
  <p class="panel-foot">FCFF = EBIT × (1 − t) + amortizaciones − capex − inversión en circulante. El EBIT de Yahoo parte del resultado antes de impuestos y puede incluir ingresos financieros (ver la pestaña Verificación SEC): si la diferencia es relevante, ajusta el margen al resultado operativo. Las proyecciones son supuestos, no previsiones: el resultado no es una recomendación de inversión.</p>`;
  bind();
 }
 function setOverride(key,value){
  // Vaciar un campo o escribir su valor de partida devuelve el supuesto de partida.
  const def=model().defaults[key];if(value===null||value===def)delete state.overrides[key];else state.overrides[key]=value;
 }
 function bind(){
  const panel=$('dcfContent');
  panel.querySelectorAll('input[type=number][data-key]').forEach(inp=>inp.addEventListener('change',()=>{
   const raw=inp.value.trim();const k=inp.dataset.key;let v=raw===''?null:Number(raw.replace(',','.'));if(v!==null&&!Number.isFinite(v))return;
   if(v!==null&&inp.dataset.type==='pct')v=v/100;if(k==='years'&&v!==null)v=Math.max(1,Math.min(15,Math.round(v)));
   setOverride(k,v);rerender(k);
  }));
  panel.querySelectorAll('select[data-key]').forEach(s=>s.addEventListener('change',()=>{setOverride(s.dataset.key,s.value);rerender(s.dataset.key);}));
  const mid=$('dcf-midYear');mid?.addEventListener('change',()=>{setOverride('midYear',mid.checked);rerender('midYear');});
  panel.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>{delete state.overrides[b.dataset.reset];rerender(b.dataset.reset);}));
  $('dcfResetAll')?.addEventListener('click',()=>{state.overrides={};state.industry=null;state.region=null;render();});
  $('dcfRegion')?.addEventListener('change',e=>{state.region=e.target.value===profile().baseRegion&&!state.industry?null:e.target.value;const names=industryNames(state.region||profile().baseRegion);if(state.industry&&!names.includes(state.industry))state.industry=null;delete state.overrides.betaU;delete state.overrides.exitMultiple;delete state.overrides.relevTax;render();});
  $('dcfIndustry')?.addEventListener('change',e=>{state.industry=e.target.value||null;delete state.overrides.betaU;delete state.overrides.exitMultiple;rerender('dcfIndustry');});
 }
 // Conserva el foco tras recalcular, para poder seguir editando con el teclado.
 function rerender(key){const id=key==='dcfIndustry'?'dcfIndustry':'dcf-'+key;render();const el=document.getElementById(id);if(el)el.focus();}
 return {render,reset(){state=freshState();marketSeq++;}};
}
