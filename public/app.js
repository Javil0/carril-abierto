import { fields, definitions, ratioAnalysis, dupontAnalysis, altmanAnalysis, previousIsComparable, contextNotes, freeCashFlow, netDebt } from './finance.mjs';
import { compareWithSec, fillFromSec } from './verify.mjs';
import { position } from './peers.mjs';
const $=id=>document.getElementById(id),finite=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=(n,d=2)=>finite(n)?new Intl.NumberFormat('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
const money=n=>finite(n)?fmt(n/1e6,2):'—';
let report=null,selectedDate=null,activeFilter='Todos',requestSequence=0,toastTimer;
let secData=null,secError=null,secLoading=false,secOriginal=null,secFilled=[],peerData=null,peerError=null,peerList='',peerSequence=0;
const current=()=>report?.periods.find(p=>p.date===selectedDate);
const previous=()=>report?.periods[report.periods.findIndex(p=>p.date===selectedDate)+1];
const ratios=()=>ratioAnalysis(current(),previous());
const valueText=r=>r.value===null?'Pendiente':fmt(r.value,2)+' '+r.unit;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayLabel=()=>new Date(report.retrievedAt).toLocaleString('es-ES');
function renderKpis(){
 const now=ratios(),prior=previous()?ratioAnalysis(previous(),report.periods[report.periods.indexOf(previous())+1]):[];
 $('headlineKpis').innerHTML=['current','roe','netDebtEbitda','fcfYield'].map(id=>{
  const r=now.find(r=>r.id===id),before=prior.find(r=>r.id===id);const delta=finite(r.value)&&finite(before?.value)&&current().currency===previous().currency?r.value-before.value:null;
  return `<button type="button" class="kpi" data-kpi="${r.id}" aria-label="${r.name}: ver fórmula y datos"><label>${r.name}</label><strong class="${r.value===null?'pending-value':''}">${r.value===null?'Pendiente':fmt(r.value,r.unit==='%'?1:2)+`<small>${r.unit}</small>`}</strong><span class="delta">${delta===null?(r.reason?'Ver fórmula y datos':'Sin comparación disponible'):(delta>=0?'+':'')+fmt(delta,2)+' '+(r.unit==='%'?'p. p.':'×')+' frente a '+previous().date.slice(0,4)}</span></button>`;
 }).join('')+'<button type="button" class="lime-tag" id="kpiMethod">↗ Cada fórmula, a la vista</button>';
 $('headlineKpis').querySelectorAll('[data-kpi]').forEach(b=>b.addEventListener('click',()=>openRatio(b.dataset.kpi)));
 $('kpiMethod').addEventListener('click',openMethod);
}
function renderChart(){
 const selected=current(),periods=report.periods.filter(p=>p.date<=selected.date&&p.currency===selected.currency).slice(0,4).reverse();
 const chartValues=periods.flatMap(p=>[p.values.revenue,p.values.netIncome]).filter(finite);const maximum=Math.max(0,...chartValues),minimum=Math.min(0,...chartValues);
 const step=maximum>0?Math.pow(10,Math.floor(Math.log10(maximum))):1;const ceiling=maximum>0?Math.ceil(maximum/step)*step:1;const floor=minimum<0?Math.floor(minimum/step)*step:0,range=ceiling-floor,baseline=-floor/range*100;
 $('chartSubtitle').textContent='Ingresos y beneficio neto · millones de '+selected.currency;
 const axis=Array.from({length:5},(_,i)=>'<span>'+fmt((ceiling-(range*i/4))/1e6,0)+'</span>').join('');
 $('revenueChart').innerHTML='<div class="axis">'+axis+'</div><div class="chart-plot"><div class="zero-line" style="top:'+ceiling/range*100+'%"></div>'+periods.map(p=>{
  const v=p.values;return `<div class="chart-group" tabindex="0" aria-label="${p.date}: ingresos ${money(v.revenue)}, beneficio ${money(v.netIncome)}, millones de ${p.currency}"><div class="bar-tooltip">${p.date}<br>Ingresos ${money(v.revenue)} M<br>Beneficio ${money(v.netIncome)} M</div>${['revenue','netIncome'].map((key,i)=>`<div class="chart-bar ${i?'lime':''}" style="position:absolute;left:${i?'50%':'calc(50% - 31px)'};${finite(v[key])&&v[key]<0?'top:'+ceiling/range*100+'%':'bottom:'+baseline+'%'};height:${finite(v[key])?Math.abs(v[key])/range*100:0}%;${finite(v[key])&&v[key]<0?'border-radius:0 0 5px 5px':''}"></div>`).join('')}<span>${p.date.slice(0,4)}${finite(v.netIncome)&&v.netIncome<0?' · pérdida':''}</span></div>`;
 }).join('')+'</div>';
 const v=selected.values,valid=[v.assets,v.totalEquity,v.debt,v.liabilities].every(finite)&&v.assets>0&&v.totalEquity>=0&&v.debt>=0&&v.liabilities-v.debt>=0&&Math.abs(v.assets-v.totalEquity-v.liabilities)<=Math.max(1,v.assets*1e-6);
 $('assetTotal').textContent=money(v.assets)+' M';
 if(valid){const e=v.totalEquity/v.assets*100,d=v.debt/v.assets*100,o=100-e-d;$('fundingDonut').style.background=`conic-gradient(#def985 0 ${e}%,#8d9b9e ${e}% ${e+d}%,#e1e5df ${e+d}% 100%)`;$('fundingLegend').innerHTML=[['Patrimonio total',e,'lime'],['Deuda',d,'dark'],['Otros pasivos',o,'light']].map(([label,value,color])=>`<div><span><i class="legend-dot ${color}"></i>${label}</span><b>${fmt(value,1)} %</b></div>`).join('');}
 else{$('fundingDonut').style.background='#e1e5df';$('fundingLegend').innerHTML='<p class="pending-note">'+(finite(v.totalEquity)&&v.totalEquity<0?'Patrimonio negativo: el pasivo supera al activo, así que no hay un reparto porcentual con sentido. Consulta el balance.':'La estructura no admite una composición porcentual estándar o faltan datos. Consulta el balance.')+'</p>';}
}
function renderRatios(){
 $('ratioYear').textContent=current().date;$('ratioPrior').textContent=previous()?.date||'Anterior';
 const prior=previous()?ratioAnalysis(previous(),report.periods[report.periods.indexOf(previous())+1]):[];
 $('ratioRows').innerHTML=ratios().filter(r=>activeFilter==='Todos'||r.category===activeFilter).map(r=>{
  const p=prior.find(p=>p.id===r.id);return `<tr><td><button class="ratio-name" data-ratio="${r.id}">${r.name}</button><span class="ratio-category">${r.category}</span></td><td>${valueText(r)}</td><td>${p?valueText(p):'—'}</td><td>${sectorCell(r)}</td><td>${r.value===null?'<span class="pending-note">'+escapeHtml(r.reason)+'</span>':r.reading}</td><td><button class="row-open" data-ratio="${r.id}" aria-label="Ver fórmula de ${r.name}">↗</button></td></tr>`;
 }).join('');$('ratioRows').querySelectorAll('[data-ratio]').forEach(b=>b.addEventListener('click',()=>openRatio(b.dataset.ratio)));
}
function renderAdvanced(){
 const d=dupontAnalysis(current(),previous());
 $('dupontFlow').innerHTML=d.value===null?'<p class="pending-note">'+escapeHtml(d.reason)+'</p>':`<div class="dupont-factor"><strong>${fmt(d.factors.margin*100,1)}<small style="display:inline;font-size:13px"> %</small></strong><small>Margen atribuible ordinario</small></div><span class="operator">×</span><div class="dupont-factor"><strong>${fmt(d.factors.turnover,2)}</strong><small>Rotación de activos</small></div><span class="operator">×</span><div class="dupont-factor"><strong>${fmt(d.factors.multiplier,2)}</strong><small>Multiplicador ordinario</small></div><span class="operator">=</span><div class="dupont-factor result"><strong>${fmt(d.value,1)}<small style="display:inline;font-size:12px"> %</small></strong><small>ROE</small></div>`;
 const z=altmanAnalysis(current());$('zValue').textContent=z.value===null?'Pendiente':fmt(z.value,2);$('zValue').classList.toggle('pending-value',z.value===null);$('zZone').textContent=z.zone||'Faltan datos';$('zMarker').hidden=z.value===null;if(z.value!==null)$('zMarker').style.left=Math.max(0,Math.min(z.value/5*100,100))+'%';
}
function balanceTable(title,rows){
 return `<section class="balance-card"><h3>${title}</h3><table class="balance-table"><thead><tr><th>Partida</th><th>${current().date}</th><th>${previous()?.date||'Anterior'}</th></tr></thead><tbody>`+rows.map(([label,key,type])=>{const get=v=>v?(typeof key==='function'?key(v):v[key]):null;return `<tr class="${type==='section'?'section-row':type==='total'?'total-row':''}"><td class="${type==='detail'?'indent':''}">${label}</td><td>${money(get(current().values))}</td><td>${money(get(previous()?.values))}</td></tr>`;}).join('')+'</tbody></table></section>';
}
function renderBalance(){
 const assets=[['Activo corriente','currentAssets','section'],['Efectivo y equivalentes','cash','detail'],['Inversiones corrientes','shortInvestments','detail'],['Cuentas por cobrar','receivables','detail'],['Inventarios','inventory','detail'],['Otros activos corrientes','otherCurrent','detail'],['Activo no corriente','nonCurrentAssets','section'],['Inmovilizado neto','ppe','detail'],['Fondo de comercio e intangibles','intangibles','detail'],['Inversiones y anticipos','longInvestments','detail'],['Otros activos no corrientes','otherNonCurrent','detail'],['Total activo','assets','total']];
 const funding=[['Pasivo corriente','currentLiabilities','section'],['Cuentas por pagar','payables','detail'],['Deuda corriente','shortDebt','detail'],['Otros pasivos corrientes','otherCurrentLiabilities','detail'],['Pasivo no corriente','nonCurrentLiabilities','section'],['Deuda no corriente','longDebt','detail'],['Otros pasivos no corrientes','otherLongLiabilities','detail'],['Pasivo total','liabilities','section'],['Patrimonio de accionistas','stockholdersEquity','section'],['Capital social','capital','detail'],['Beneficios retenidos','retained','detail'],['Otros ajustes de patrimonio','otherEquity','detail'],['Patrimonio total, incluidos minoritarios','totalEquity','total']];
 const cash=[['Flujo de caja operativo','ocf','section'],['Inversión en inmovilizado (capex)','capex','detail'],['Flujo de caja libre (calculado)',freeCashFlow,'total'],['Flujo de caja libre publicado por Yahoo','fcfReported','detail'],['EBITDA','ebitda','section'],['Deuda financiera total','debt','section'],['Efectivo e inversiones corrientes','cashShortTotal','detail'],['Deuda neta (negativa = caja neta)',netDebt,'total']];
 $('balanceTables').innerHTML=balanceTable('Lo que tiene la empresa.',assets)+balanceTable('Cómo se financia.',funding)+balanceTable('Lo que genera en caja.',cash);
 const difference=current().balanceCheck,tolerance=Math.max(1,Math.abs(current().values.assets)*1e-6);$('balanceCheck').textContent=difference===null?'Comprobación pendiente':Math.abs(difference)<=tolerance?'✓ Activo = pasivo + patrimonio':'Diferencia: '+money(difference)+' M '+current().currency;
}
function renderRaw(){
 $('rawYear').textContent=current().date;$('rawPrior').textContent=previous()?.date||'Anterior';
 const q=$('rawSearch').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const rows=current().raw.filter(r=>(r.label+' '+r.code+' '+r.document).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
 $('rawRows').innerHTML=rows.map(r=>`<tr><td>${r.label}<code>${r.code}</code></td><td>${r.document}</td><td>${money(r.value)}</td><td>${money(previous()?.values[r.key])}</td><td>${(r.status==='derived'||r.status==='sec')?escapeHtml(r.derivation):r.status==='available'?'Publicado por Yahoo':r.status==='currency_mismatch'?'Excluido: moneda distinta':'No disponible en la fuente'}</td></tr>`).join('');$('rawEmpty').hidden=rows.length!==0;
}
function renderAll(){
 if(!report||!current())return;
 document.title=report.ticker+' · Carril';$('companyEyebrow').textContent=report.ticker+' · ESTADOS FINANCIEROS ANUALES';$('displayUnits').textContent='Importes · millones de '+current().currency;
 $('reportSource').replaceChildren();const stamp=document.createElement('span');stamp.textContent='Yahoo Finance · consulta '+todayLabel()+' · '+current().currency+' sin conversión de divisa';$('reportSource').append(stamp);
 for(const[label,url]of [['Balance',report.sourceUrl],['Resultados',report.incomeSourceUrl],['Valoración',report.valuationSourceUrl]]){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label+' ↗';$('reportSource').append(a);}
 const warnings=[...current().warnings,...contextNotes(current())];if(secFilled.length)warnings.push('Incluye cifras tomadas del 10-K de la SEC: '+secFilled.join(', ')+'.');if(!previousIsComparable(current(),previous()))warnings.push('No hay un cierre anterior comparable: los ratios con promedios quedan pendientes.');$('reportWarnings').textContent=warnings.join(' ');$('reportWarnings').hidden=!warnings.length;
 $('rawSourceNote').textContent='Partidas de '+current().date+' en millones de '+current().currency+'. «—» no equivale a cero. Fechas y cifras conservan las etiquetas de Yahoo.';
 renderKpis();renderChart();renderRatios();renderAdvanced();renderBalance();renderRaw();renderPeerBar();renderSec();
}
function navigate(tab){location.hash='/analisis/'+tab+'?ticker='+encodeURIComponent(report.ticker);}
function showHome(){ $('homeView').hidden=false;$('analysisView').hidden=true;$('homeNav').classList.add('active');$('analysisNav').classList.remove('active'); }
function route(){
 const[path,query='']=location.hash.slice(1).split('?');if(!(path||'').startsWith('/analisis')){showHome();return;}
 const t=new URLSearchParams(query).get('ticker')||report?.ticker||$('tickerInput').value;const requested=path.split('/')[2],tab=['ratios','balance','datos','verificacion'].includes(requested)?requested:'ratios';
 if(!report&&!String(t||'').trim()){history.replaceState(null,'','#/');showHome();$('inputError').textContent='Escribe un ticker para ver su análisis.';$('tickerInput').focus();return;}
 if(!report||report.ticker!==t.toUpperCase()){loadTicker(t,tab);return;}
 $('homeView').hidden=true;$('analysisView').hidden=false;$('homeNav').classList.remove('active');$('analysisNav').classList.add('active');
 document.querySelectorAll('[role=tab]').forEach(b=>{const selected=b.dataset.tab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('panel-'+b.dataset.tab).hidden=!selected;});renderAll();if(tab==='verificacion'&&!secData&&!secLoading&&!secError)loadSec();
}
async function loadTicker(value,tab='ratios'){
 const ticker=value.trim().toUpperCase();showHome();$('inputError').textContent='';if(!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(ticker)){$('inputError').textContent='Introduce un ticker válido, como AAPL o SAN.MC.';return;}
 const sequence=++requestSequence,button=$('tickerForm').querySelector('button[type=submit]');button.disabled=true;button.classList.add('loading-button');$('tickerInput').value=ticker;$('lookupStatus').textContent='Consultando balance, resultados y capitalización histórica de '+ticker+'…';
 try{const r=await fetch('/api/financials?ticker='+encodeURIComponent(ticker),{signal:AbortSignal.timeout(25000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron descargar los datos.');if(sequence!==requestSequence)return;if(!data.periods?.length)throw new Error('No hay ejercicios anuales disponibles.');report=data;secData=null;secError=null;secOriginal=null;secFilled=[];peerData=null;peerError=null;peerList='';$('secFill').checked=false;selectedDate=data.periods[0].date;activeFilter='Todos';$('yearSelect').replaceChildren();for(const period of data.periods){const option=document.createElement('option');option.value=period.date;option.textContent=period.date;$('yearSelect').append(option);}document.querySelectorAll('#ratioFilters button').forEach(b=>{const on=b.dataset.filter==='Todos';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});$('lookupStatus').textContent='';navigate(tab);route();window.scrollTo({top:0,behavior:'smooth'});loadPeers();}
 catch(e){if(sequence===requestSequence){$('inputError').textContent=e.name==='TimeoutError'?'La consulta ha tardado demasiado. Inténtalo más tarde.':e.message;$('lookupStatus').textContent='';}}
 finally{if(sequence===requestSequence){button.disabled=false;button.classList.remove('loading-button');}}
}
$('tickerForm').addEventListener('submit',e=>{e.preventDefault();loadTicker($('tickerInput').value);});document.querySelectorAll('[data-ticker]').forEach(b=>b.addEventListener('click',()=>loadTicker(b.dataset.ticker)));
document.querySelectorAll('[role=tab]').forEach(b=>{b.addEventListener('click',()=>navigate(b.dataset.tab));b.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[role=tab]')],i=tabs.indexOf(b);let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();navigate(tabs[n].dataset.tab);tabs[n].focus();});});
$('yearSelect').addEventListener('change',e=>{selectedDate=e.target.value;renderAll();loadPeers();});
$('ratioFilters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;$('ratioFilters').querySelectorAll('button').forEach(c=>{const selected=c===b;c.classList.toggle('active',selected);c.setAttribute('aria-pressed',String(selected));});renderRatios();}));$('rawSearch').addEventListener('input',renderRaw);
function openDialog(title,label,html){$('detailTitle').textContent=title;$('detailLabel').textContent=label;$('detailContent').innerHTML=html;$('detailDialog').showModal();}
function openRatio(id){const r=ratios().find(r=>r.id===id);openDialog(r.name,r.category.toUpperCase()+' · '+current().date,`<div class="formula-box">${r.formula}<br><strong>${valueText(r)}</strong></div><p class="detail-note">${r.value===null?escapeHtml(r.reason):r.reading}</p><table class="detail-data"><tbody>${r.parts.map(p=>`<tr><td>${p.label}<br><small>${p.date||'Sin periodo comparable'}</small></td><td>${money(p.value)} M ${current().currency}</td></tr>`).join('')}<tr><td>Numerador de la fórmula</td><td>${money(r.numerator)} M</td></tr><tr><td>Denominador de la fórmula</td><td>${money(r.denominator)} M</td></tr></tbody></table>${sectorDetail(r)}<p class="detail-foot">Datos de Yahoo Finance. Los promedios usan saldos inicial y final de la misma moneda. La deuda financiera no es el pasivo total; el ROE usa beneficio y patrimonio ordinarios. Verifica las cuentas originales para análisis de inversión.</p>`);}
$('closeDetail').addEventListener('click',()=>$('detailDialog').close());$('detailDialog').addEventListener('click',e=>{if(e.target===$('detailDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function openMethod(){openDialog('Puedes seguir cada cálculo.','MÉTODO DE CARRIL',`<div class="method-list"><p><strong>Fuentes y periodos.</strong><br>Yahoo Finance: balance, cuenta de resultados y capitalización histórica del mismo periodo anual. Las fechas son etiquetas del proveedor; pueden estar normalizadas al final del mes fiscal.</p><p><strong>Trece ratios, sin una puntuación universal.</strong><br>La selección está inspirada en el análisis financiero del CFA. Los valores requieren contexto sectorial. No es una clasificación oficial del CFA Institute.</p><p><strong>Promedios coherentes.</strong><br>Inventarios, activos y patrimonio medios usan el cierre anterior en la misma moneda. Si falta ese cierre, el indicador queda pendiente.</p><p><strong>Flujo de caja.</strong><br>FCF = flujo de caja operativo − capex (Yahoo publica el capex en negativo; se usa su valor absoluto) y se contrasta con el FCF publicado. El FCF yield usa la capitalización del mismo cierre. La cobertura por flujo operativo divide la caja operativa entre la deuda financiera.</p><p><strong>Contraste con la SEC.</strong><br>La pestaña Verificación compara cada partida de Yahoo con el 10-K presentado en EDGAR para el mismo cierre (tolerancia del 0,5 %). Solo se pueden rellenar huecos de Yahoo, nunca sustituir cifras, y siempre de forma visible y reversible. El EBIT de Yahoo no equivale al resultado operativo del 10-K y se marca como definición distinta.</p><p><strong>Comparación sectorial.</strong><br>Mediana y rango intercuartílico (P25–P75) de un grupo de comparables definido por el equipo, calculados con las mismas fórmulas y el ejercicio más cercano (como mucho 200 días). Los comparables con un ratio pendiente (p. ej. ROE con patrimonio negativo) no entran en esa estadística, y sin al menos 3 valores no se publica mediana. Estar por encima o por debajo del rango es descriptivo: no implica que sea mejor o peor.</p><p><strong>Patrimonio negativo y caja neta.</strong><br>Si el patrimonio ordinario es negativo (habitual tras recompras masivas), D/E, ROE y DuPont quedan pendientes en lugar de mostrar cifras con el signo invertido. Si la deuda neta es negativa, deuda neta/EBITDA sale negativa y se etiqueta como caja neta: es holgura, no un apalancamiento menor.</p><p><strong>DuPont y Altman.</strong><br>DuPont descompone el ROE ordinario. Altman se calcula automáticamente si están disponibles los cinco componentes; usa capitalización histórica del mismo periodo. La versión clásica está diseñada para industriales cotizadas y su interpretación depende del sector.</p><p><strong>Limitaciones.</strong><br>La disponibilidad depende de Yahoo. Los datos ausentes no se sustituyen por cero ni por ejemplos. Las explicaciones son reglas de código y no respuestas de IA.</p></div>`);}
$('methodButton').addEventListener('click',openMethod);$('previewMethod').addEventListener('click',openMethod);$('fundingMore').addEventListener('click',()=>navigate('balance'));
$('altmanDetails').addEventListener('click',()=>{const z=altmanAnalysis(current());openDialog('Las cinco piezas de Altman.','VERSIÓN CLÁSICA · INDUSTRIAL COTIZADA',`<div class="formula-box">Z = 1,2 X₁ + 1,4 X₂ + 3,3 X₃ + 0,6 X₄ + X₅<br><strong>${z.value===null?'Pendiente':fmt(z.value,2)}</strong></div>${z.reason?'<p class="detail-note">'+escapeHtml(z.reason)+'</p>':''}<table class="detail-data"><tbody>${z.terms.map(t=>`<tr><td>${t.label}<br><small>${fmt(t.weight,1)} × ${fmt(t.value,4)}</small></td><td>${finite(t.value)?fmt(t.weight*t.value,4):'Pendiente'}</td></tr>`).join('')}</tbody></table><p class="detail-note">Menor que 1,81: mayor riesgo; de 1,81 a 2,99: zona gris; mayor que 2,99: zona segura según la versión clásica. El cálculo es automático. La versión clásica está diseñada para industriales cotizadas; su interpretación depende del sector. Este modelo no garantiza solvencia.</p><p class="detail-foot">Capitalización histórica: ${money(current().values.marketEquity)} M ${current().currency}, periodo ${current().date}. No se sustituye por la cotización de hoy.</p>`);});
$('exportButton').addEventListener('click',()=>{if(!report)return;const header=['ticker','ejercicio','moneda','partida','identificador','documento','valor_unidades','estado'];const rows=current().raw.map(r=>[report.ticker,current().date,current().currency,r.label,r.code,r.document,r.value??'',r.status]);const csv='\ufeff'+[header,...rows].map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(';')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='carril-'+report.ticker+'-'+current().date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);clearTimeout(toastTimer);$('toast').textContent='Datos del ejercicio exportados en unidades monetarias completas.';$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);});
// ---------- Comparación sectorial ----------
const posLabel={above:'Por encima del rango',below:'Por debajo del rango',inside:'Dentro del rango'};
function sectorCell(r){
 if(peerError)return '<span class="muted-cell">—</span>';if(!peerData)return '<span class="muted-cell">…</span>';
 const st=peerData.stats?.[r.id];if(!st)return '<span class="muted-cell">—</span>';
 if(st.median===null)return `<span class="muted-cell" title="${escapeHtml(st.reason||'')}">Insuficiente (${st.n})</span>`;
 const pos=position(r.value,st);
 return `<span class="sector-value" title="P25–P75: ${fmt(st.p25,2)} – ${fmt(st.p75,2)} ${r.unit} · ${st.n} comparables">${fmt(st.median,2)} ${r.unit}</span>${pos?`<span class="pos-chip ${pos}">${posLabel[pos]}</span>`:''}`;
}
const shortReason=t=>!t?'sin dato':/^Patrimonio ordinario negativo/.test(t)?'patrimonio negativo':/^Falta/.test(t)?t.replace(/\.$/,'').toLowerCase():t.split(/[.:]/)[0].toLowerCase();
function sectorDetail(r){
 const st=peerData?.stats?.[r.id];if(!st)return '';
 const rows=st.values.map(v=>`<tr><td>${escapeHtml(v.ticker)}<br><small>${v.date}</small></td><td>${v.value===null?'<span class="pending-note">Excluido: '+escapeHtml(shortReason(v.reason))+'</span>':fmt(v.value,2)+' '+r.unit}</td></tr>`).join('');
 return `<h3 class="detail-sub">Frente al sector · ${escapeHtml(peerData.group?.name||'')}</h3><table class="detail-data"><tbody>${rows}<tr><td><strong>Mediana</strong> (${st.n} con dato)</td><td><strong>${st.median===null?'Insuficiente':fmt(st.median,2)+' '+r.unit}</strong></td></tr>${st.median===null?'':`<tr><td>Rango intercuartílico</td><td>${fmt(st.p25,2)} – ${fmt(st.p75,2)} ${r.unit}</td></tr>`}</tbody></table>`;
}
function renderPeerBar(){
 if(!report)return;const g=peerData?.group;
 $('peerTitle').textContent='Frente al sector'+(g?' · '+g.name:'');
 let text;
 if(peerError)text=peerError;else if(!peerData)text='Cargando comparables…';
 else if(!g)text=peerData.message||'Sin grupo de comparables.';
 else{text='Mediana de '+peerData.peers.map(p=>p.ticker+(p.date!==current().date?' ('+p.date+')':'')).join(', ')+'.';if(peerData.excluded.length)text+=' Sin datos: '+peerData.excluded.map(e=>e.ticker).join(', ')+'.';if(g.warning)text+=' '+g.warning;}
 $('peerStatus').textContent=text;
}
async function loadPeers(){
 if(!report||!current())return;const seq=++peerSequence;peerData=null;peerError=null;renderPeerBar();renderRatios();
 try{const r=await fetch('/api/peers?ticker='+encodeURIComponent(report.ticker)+'&date='+current().date+(peerList?'&peers='+encodeURIComponent(peerList):''),{signal:AbortSignal.timeout(45000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron descargar los comparables.');if(seq!==peerSequence)return;peerData=data;}
 catch(e){if(seq!==peerSequence)return;peerError=e.name==='TimeoutError'?'Los comparables han tardado demasiado. Inténtalo más tarde.':e.message;}
 renderPeerBar();renderRatios();
}
// ---------- Contraste con la SEC ----------
const secLabel={match:['✓ Coincide','ok'],differs:['⚠ Difiere','bad'],yahoo_missing:['＋ Solo en el 10-K','info'],sec_missing:['— Solo en Yahoo','muted'],definition:['≠ Definición distinta','warn'],both_missing:['— Sin dato','muted']};
const basePeriod=()=>{const p=current();if(!secOriginal)return p;const o=secOriginal[report.periods.indexOf(p)];return {...p,values:o.values};};
function secComparison(){const p=current();return secData?compareWithSec(basePeriod(),secData.periods?.[p.date]):null;}
function renderSec(){
 if(!report)return;$('secButton').disabled=secLoading;
 const c=secComparison();
 $('secStatus').textContent=secLoading?'Consultando el 10-K en EDGAR…':secError?secError:secData?secData.entity+' · CIK '+secData.cik+' · ejercicio '+current().date:'Pulsa «Comprobar con la SEC» para descargar el 10-K de esta empresa.';
 $('secStatus').classList.toggle('error-text',!!secError);
 $('secTable').hidden=$('secSummary').hidden=$('secActions').hidden=!c;if(!c)return;
 const s=c.summary;$('secSummary').innerHTML=[['ok',s.match,'coinciden'],['bad',s.differs,'difieren'],['info',s.yahooMissing,'solo en el 10-K'],['warn',s.definition,'definición distinta'],['muted',s.secMissing+s.bothMissing,'sin contraste']].map(([k,n,l])=>`<span class="sec-chip ${k}"><b>${n}</b> ${l}</span>`).join('');
 $('secRows').innerHTML=c.rows.map(r=>{const [label,cls]=secLabel[r.status];const src=r.source;return `<tr><td>${r.label}${r.note?`<small class="sec-note">${escapeHtml(r.note)}</small>`:''}</td><td>${money(r.yahoo)}</td><td>${money(r.sec)}</td><td>${r.diff===null?'—':(r.diff>=0?'+':'')+fmt(r.diff*100,2)+' %'}</td><td><span class="sec-chip ${cls}">${label}</span></td><td>${src?`<a href="${src.url}" target="_blank" rel="noopener noreferrer">10-K · ${src.filed} ↗</a><code>${escapeHtml(src.tag)}${src.derived?' (derivado)':''}</code>`:'—'}</td></tr>`;}).join('');
}
async function loadSec(){
 if(!report)return;const ticker=report.ticker;secLoading=true;secError=null;renderSec();
 try{const r=await fetch('/api/sec?ticker='+encodeURIComponent(ticker)+'&dates='+report.periods.map(p=>p.date).join(','),{signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo consultar la SEC.');if(report?.ticker!==ticker)return;secData=data;}
 catch(e){if(report?.ticker===ticker)secError=e.name==='TimeoutError'?'La SEC ha tardado demasiado. Inténtalo más tarde.':e.message;}
 finally{secLoading=false;if(report?.ticker===ticker)renderSec();}
}
$('secButton').addEventListener('click',()=>{secData=null;loadSec();});
$('secFill').addEventListener('change',e=>{
 if(!secData){e.target.checked=false;return;}
 if(e.target.checked){secOriginal=report.periods.map(p=>({values:structuredClone(p.values),raw:structuredClone(p.raw)}));secFilled=[];for(const p of report.periods){const keys=fillFromSec(p,secData.periods?.[p.date]);for(const k of keys)secFilled.push(fields.find(f=>f[0]===k)?.[1]+' ('+p.date+')');}showToast(secFilled.length?'Completadas '+secFilled.length+' partidas con el 10-K.':'No había huecos de Yahoo que el 10-K pudiera completar.');}
 else if(secOriginal){report.periods.forEach((p,i)=>{p.values=secOriginal[i].values;p.raw=secOriginal[i].raw;});secOriginal=null;secFilled=[];showToast('Vuelves a ver solo las cifras de Yahoo.');}
 renderAll();
});
$('secExport').addEventListener('click',()=>{const c=secComparison();if(!c)return;const header=['ticker','ejercicio','partida','yahoo','sec_10k','diferencia_pct','estado','etiqueta_xbrl','presentado','enlace'];const rows=c.rows.map(r=>[report.ticker,current().date,r.label,r.yahoo??'',r.sec??'',r.diff===null?'':(r.diff*100).toFixed(4),secLabel[r.status][0],r.source?.tag||'',r.source?.filed||'',r.source?.url||'']);const csv='\ufeff'+[header,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='carril-'+report.ticker+'-'+current().date+'-contraste-sec.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function showToast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
window.addEventListener('hashchange',route);route();
