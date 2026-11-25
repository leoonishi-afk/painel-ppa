let data;
let filtered = [];
let page = 0;
let printing = false;
const pageSize = 20;
const $ = id => document.getElementById(id);
const currency = n => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(n);
const compact = n => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', notation:'compact', maximumFractionDigits:1}).format(n);
const percent = n => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(n)+'%';
const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code = c => `${c.slice(0,1)}.${c.slice(1)}`;
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function setOptions(id, values){
  for(const [value,label] of values){const option=document.createElement('option');option.value=value;option.textContent=label;$(id).appendChild(option);}
}
function runFilters(){
  const pg=$('programFilter').value, entity=$('entityFilter').value, query=normalize($('searchFilter').value.trim());
  filtered=data.acoes.filter(a=>(!pg || a.programa===pg) && (!entity || a.entidade===entity) && (!query || normalize(`${a.acao} ${a.codigo} ${code(a.codigo)} ${a.programa}`).includes(query)));
  filtered.sort((a,b)=>b.liquidado-a.liquidado || a.acao.localeCompare(b.acao,'pt-BR'));
  page=0;render();
}
function render(){
  const sum = key => filtered.reduce((n,a)=>n+a[key],0);
  const init=sum('inicial'), liq=sum('liquidado');
  $('budget').textContent=currency(init);$('spent').textContent=currency(liq);
  $('spentPct').textContent=init ? `${percent(liq/init*100)} do valor inicial`:'Sem valor inicial para comparação';
  $('actionsExecuted').textContent=filtered.filter(a=>a.marcador_financeiro===1).length.toLocaleString('pt-BR');
  $('actionCount').textContent=`de ${filtered.length.toLocaleString('pt-BR')} ${filtered.length===1?'registro':'registros'} de ação`;
  $('revenue').textContent=currency(data.totais.receita_arrecadada);
  renderBars();renderTable();
}
function renderBars(){
  const totals=new Map(); for(const a of filtered) totals.set(a.programa,(totals.get(a.programa)||0)+a.liquidado);
  const entries=[...totals].sort((a,b)=>b[1]-a[1]), max=entries[0]?.[1]||1;
  $('programCount').textContent=`${entries.length} ${entries.length===1?'programa':'programas'}`;
  $('programBars').innerHTML=entries.length ? entries.map(([id,value])=>{
    const p=data.programas.find(x=>x.codigo===id),name=p?p.nome:`Programa ${id}`;
    return `<div class="bar-item"><span class="bar-name" title="${escapeHtml(name)}">${escapeHtml(id)} · ${escapeHtml(name)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(0,Math.min(100,value/max*100))}%"></span></span><span class="bar-value">${escapeHtml(compact(value))}</span></div>`;
  }).join(''):'<p class="empty">Nenhum programa encontrado.</p>';
}
function renderTable(){
  const start=printing?0:page*pageSize, end=printing?filtered.length:Math.min(start+pageSize,filtered.length);
  $('actionsTable').innerHTML=filtered.length ? filtered.slice(start,end).map(a=>{
    const p=data.programas.find(x=>x.codigo===a.programa), prog=p?p.nome:`Programa ${a.programa}`;
    const ratio=a.inicial>0?percent(a.liquidado/a.inicial*100):'—';
    return `<tr><td><strong>${escapeHtml(code(a.codigo))} · ${escapeHtml(a.acao)}</strong><small>${escapeHtml(a.programa)} · ${escapeHtml(prog)}</small></td><td>${escapeHtml(a.entidade)}</td><td class="number">${escapeHtml(currency(a.inicial))}</td><td class="number">${escapeHtml(currency(a.liquidado))}</td><td class="number">${escapeHtml(ratio)}</td><td class="center"><span class="marker ${a.marcador_financeiro?'':'zero'}" title="${a.marcador_financeiro?'Com despesa liquidada':'Sem despesa liquidada'}">${a.marcador_financeiro}</span></td></tr>`;
  }).join(''):'<tr><td class="empty" colspan="6">Nenhuma ação encontrada para os filtros selecionados.</td></tr>';
  $('tableDescription').textContent=`${filtered.length.toLocaleString('pt-BR')} ${filtered.length===1?'registro':'registros'} de ação na seleção`;
  $('pageLabel').textContent=filtered.length ? `Exibindo ${start+1}–${end} de ${filtered.length}`:'Nenhum registro';
  $('prevBtn').disabled=page===0;$('nextBtn').disabled=(page+1)*pageSize>=filtered.length;
}
function downloadCsv(){
  const headings=['Programa','Ação','Descrição','Entidade','Unidade','Orçado','Liquidado','Percentual financeiro','Marcador financeiro'];
  const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  const br=n=>Number(n).toFixed(2).replace('.',',');
  const rows=filtered.map(a=>[a.programa,code(a.codigo),a.acao,a.entidade,a.unidade,br(a.inicial),br(a.liquidado),a.inicial>0?br(a.liquidado/a.inicial*100):'',a.marcador_financeiro]);
  const csv='\ufeff'+[headings,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='monitoramento-ppa-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function initialize(){
  try{
    const res=await fetch('painel.json'); if(!res.ok) throw new Error('Dados não disponíveis');data=await res.json();
    setOptions('programFilter',data.programas.map(p=>[p.codigo,`${p.codigo} · ${p.nome}`]));
    const entities=[...new Set(data.acoes.map(a=>a.entidade))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    setOptions('entityFilter',entities.map(x=>[x,x]));
    $('revenueBudget').textContent=currency(data.totais.receita_prevista);$('revenueActual').textContent=currency(data.totais.receita_arrecadada);
    $('fiscalBudget').textContent=currency(data.totais.inicial);$('fiscalSpent').textContent=currency(data.totais.liquidado);
    const rate=data.totais.receita_arrecadada/data.totais.receita_prevista*100;$('revenuePct').textContent=`${percent(rate)} da previsão inicial`;$('revenueBar').style.width=`${Math.max(0,Math.min(100,rate))}%`;
    for(const id of ['programFilter','entityFilter'])$(id).addEventListener('change',runFilters);
    $('searchFilter').addEventListener('input',runFilters);
    $('resetBtn').addEventListener('click',()=>{$('programFilter').value='';$('entityFilter').value='';$('searchFilter').value='';runFilters();});
    $('prevBtn').addEventListener('click',()=>{if(page>0){page--;renderTable();}});$('nextBtn').addEventListener('click',()=>{if((page+1)*pageSize<filtered.length){page++;renderTable();}});
    $('csvBtn').addEventListener('click',downloadCsv);
    $('printBtn').addEventListener('click',()=>{printing=true;renderTable();requestAnimationFrame(()=>window.print());});
    window.addEventListener('afterprint',()=>{printing=false;renderTable();});
    runFilters();
  }catch(e){$('errorMessage').hidden=false;console.error(e);}
}
initialize();
