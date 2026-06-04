import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'backend', 'local-data');
const outputFile = path.join(root, 'ADW_mobile_demo.html');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  return Number(value ?? 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function hours(report) {
  return Math.max(
    0,
    (Number(report.time_end.slice(0, 2)) + Number(report.time_end.slice(3, 5)) / 60) -
      (Number(report.time_start.slice(0, 2)) + Number(report.time_start.slice(3, 5)) / 60)
  );
}

function isOverdue(report) {
  const reportDate = new Date(`${report.date.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return (today.getTime() - reportDate.getTime()) / 86400000 > 2;
}

const fields = readJson('fields.json');
const tractors = readJson('tractors.json');
const users = readJson('users.json');
const workTypes = readJson('work-types.json');
const auditLog = readJson('audit-log.json');

const fieldsById = new Map(fields.map((field) => [field.id, field]));
const tractorsById = new Map(tractors.map((tractor) => [tractor.id, tractor]));
const usersById = new Map(users.map((user) => [user.id, user]));
const workTypesById = new Map(workTypes.map((workType) => [workType.id, workType]));

const reports = readJson('reports.json')
  .map((report) => {
    const field = fieldsById.get(report.field_id);
    const tractor = tractorsById.get(report.tractor_id);
    const user = usersById.get(report.user_id);
    const workType = workTypesById.get(report.work_type_id);
    return {
      ...report,
      employee_name: report.employee_name || user?.full_name || user?.username || `Zaměstnanec ${report.user_id}`,
      field_name: report.field_name || field?.field_name || `Pole ${report.field_id}`,
      tractor_name: report.tractor_name || tractor?.tractor_name || `Stroj ${report.tractor_id}`,
      work_type: report.work_type || workType?.name || `Činnost ${report.work_type_id}`
    };
  })
  .sort((first, second) => String(second.created_at || second.date).localeCompare(String(first.created_at || first.date)));

const pendingReports = reports.filter((report) => report.status === 'pending');
const overdueReports = pendingReports.filter(isOverdue);
const suspiciousFuelReports = pendingReports.filter((report) => num(report.amount_ha) > 0 && num(report.fuel_liters) / num(report.amount_ha) > 11);
const longShiftReports = pendingReports.filter((report) => hours(report) > 10);
const employees = [...new Set(reports.map((report) => report.employee_name))].sort((a, b) => a.localeCompare(b, 'cs'));
const today = new Date().toISOString().slice(0, 10);
const todayEmployees = new Set(reports.filter((report) => report.date.slice(0, 10) === today).map((report) => report.employee_name));
const missingEmployees = employees.filter((employee) => !todayEmployees.has(employee));
const machineFuel = [...reports.reduce((map, report) => {
  const current = map.get(report.tractor_name) || { fuel: 0, ha: 0 };
  current.fuel += num(report.fuel_liters);
  current.ha += num(report.amount_ha);
  map.set(report.tractor_name, current);
  return map;
}, new Map())]
  .map(([name, values]) => ({ name, value: values.ha > 0 ? values.fuel / values.ha : 0 }))
  .sort((first, second) => second.value - first.value);

function metric(label, value, danger = false) {
  return `<article class="metric ${danger ? 'red' : ''}"><i>!</i><div><span>${escapeHtml(label)}</span><strong>${value}</strong></div></article>`;
}

function reportCard(report) {
  const fuelPerHa = num(report.amount_ha) > 0 ? num(report.fuel_liters) / num(report.amount_ha) : 0;
  const overdue = isOverdue(report);
  return `<article class="row">
    <div class="rowTop"><b>${escapeHtml(report.employee_name)}</b><span class="tag ${overdue ? 'red' : ''}">${overdue ? 'Po termínu' : report.status === 'approved' ? 'Schváleno' : report.status === 'rejected' ? 'Vráceno' : 'Ke schválení'}</span></div>
    <small>${formatDate(report.date)} · ${escapeHtml(report.work_type)}</small>
    <p>${escapeHtml(report.field_name)} · ${escapeHtml(report.tractor_name)}</p>
    <p>${report.time_start.slice(0, 5)}-${report.time_end.slice(0, 5)} · ${num(report.amount_ha).toFixed(1)} ha · ${num(report.fuel_liters).toFixed(0)} l · ${fuelPerHa.toFixed(1)} l/ha</p>
  </article>`;
}

function fieldCard(field) {
  return `<article class="row">
    <div class="rowTop"><b>${escapeHtml(field.field_name)}</b><span class="tag">${escapeHtml(field.field_code)}</span></div>
    <div class="kv">
      <div><span>Výměra</span><strong>${field.area ?? '-'} ha</strong></div>
      <div><span>Kultura</span><strong>${escapeHtml(field.culture || '-')}</strong></div>
      <div><span>Plodina</span><strong>${escapeHtml(field.crop || '-')}</strong></div>
      <div><span>Eroze</span><strong>${escapeHtml(field.erosion || '-')}</strong></div>
    </div>
  </article>`;
}

function tractorCard(tractor) {
  return `<article class="row"><div class="rowTop"><b>${escapeHtml(tractor.tractor_name)}</b><span class="tag">${escapeHtml(tractor.tractor_code)}</span></div><p>${escapeHtml(tractor.vehicle_type)} · ${escapeHtml(tractor.status)}</p></article>`;
}

function userCard(user) {
  return `<article class="row"><div class="rowTop"><b>${escapeHtml(user.full_name)}</b><span class="tag">${escapeHtml(user.role)}</span></div><p>${escapeHtml(user.email)} · ${user.active ? 'Aktivní' : 'Neaktivní'}</p></article>`;
}

function auditCard(item) {
  return `<article class="row"><div class="rowTop"><b>${escapeHtml(item.collection)}</b><span class="tag">${escapeHtml(item.action)}</span></div><p>${formatDateTime(item.changed_at)} · ${escapeHtml(item.changed_by)}</p><p>${escapeHtml(JSON.stringify(item.after || {}).slice(0, 160))}</p></article>`;
}

function option(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

const clientData = {
  reports,
  fields,
  tractors,
  users,
  workTypes
};

const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ADW offline demo</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111815;background:#f5f6f4;--green:#00862f;--dark:#003b34;--soft:#eef8f1;--yellow:#ffdd00;--muted:#68746d;--line:#dfe5e1;--danger:#d92d20;--warning:#ec8500}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#f8faf7 0%,#eef2ef 100%)}button,input,select,textarea{font:inherit}.top{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#07383d;color:#fff;box-shadow:0 8px 22px rgba(0,0,0,.14)}.brand{display:grid;gap:2px}.brand strong{font-size:1.65rem;line-height:1;color:var(--yellow);font-weight:1000}.brand span{font-size:.72rem;color:#dce9e5}.pill{border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 10px;color:#eaf4ef;font-size:.78rem;font-weight:800}.tabs{position:sticky;top:62px;z-index:9;display:flex;gap:8px;overflow:auto;padding:10px 12px;background:#fff;border-bottom:1px solid var(--line)}.tabs a{flex:0 0 auto;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--dark);padding:8px 12px;font-weight:900;text-decoration:none}main{padding:12px;display:grid;gap:12px}.section{display:grid;gap:12px;scroll-margin-top:118px}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.eyebrow{margin:0;color:var(--muted);font-size:.72rem;font-weight:900;text-transform:uppercase}.title{margin:2px 0 0;font-size:1.35rem;line-height:1.12}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metric,.panel{border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:0 12px 26px rgba(17,24,21,.07)}.metric{display:flex;gap:10px;align-items:center;min-height:82px;padding:12px}.metric i{display:grid;place-items:center;width:42px;height:42px;border-radius:999px;background:#fff7e8;color:var(--warning);font-style:normal;font-size:1.2rem;font-weight:1000}.metric.red i{background:#fff1ef;color:var(--danger)}.metric span{display:block;color:#2c3631;font-size:.82rem;font-weight:900}.metric strong{display:block;color:var(--warning);font-size:1.8rem;line-height:1}.metric.red strong{color:var(--danger)}.panel{padding:12px}.panel h2{margin:0 0 10px;font-size:1rem}.attention{display:grid;gap:8px}.attention article{display:flex;align-items:center;gap:10px;border:1px solid #f1d7c4;border-radius:8px;background:#fffaf6;padding:10px}.attention strong{min-width:28px;color:var(--warning);font-size:1.25rem}.attention span{font-size:.82rem;font-weight:800}.scroll{max-height:340px;overflow-y:scroll;scrollbar-gutter:stable;scrollbar-color:#98aaa1 #edf2ef;scrollbar-width:thin}.scroll.small{max-height:190px}.list{display:grid;gap:8px}.row{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px;display:grid;gap:6px}.rowTop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.row b{font-size:.92rem}.row small{color:var(--muted);font-weight:800}.row p{margin:0;color:#39443f;font-size:.8rem;font-weight:800}.tag{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:.72rem;font-weight:1000;background:#fff7e8;color:var(--warning)}.tag.red{background:#fff1ef;color:var(--danger)}.kv{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kv div{border:1px solid var(--line);border-radius:8px;background:#fbfcfb;padding:9px}.kv span{display:block;color:var(--muted);font-size:.72rem;font-weight:800}.kv strong{display:block;margin-top:2px;font-size:.9rem}.mini{display:grid;gap:0}.miniLine{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line);padding:7px 0;font-size:.82rem;font-weight:800}.miniLine:last-child{border-bottom:0}.miniLine em{font-style:normal;color:var(--danger)}.bar{display:grid;grid-template-columns:92px 1fr 38px;align-items:center;gap:8px;font-size:.78rem;font-weight:800}.bar b{height:9px;background:#eef2ef;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--warning));border-radius:999px}.formGrid{display:grid;gap:10px}.formGrid label{display:grid;gap:5px;color:#39443f;font-size:.76rem;font-weight:900}.formGrid input,.formGrid select,.formGrid textarea{width:100%;min-height:42px;border:1px solid #d8dfdc;border-radius:8px;background:#fff;padding:10px 12px}.formGrid textarea{min-height:92px}.button{border:0;border-radius:8px;background:linear-gradient(180deg,#09a33c 0%,#00862f 100%);color:#fff;padding:12px 14px;font-weight:1000}.notice{display:none;border:1px solid #cfe6d5;border-radius:8px;background:var(--soft);color:var(--green);padding:10px;font-weight:900}.muted{color:var(--muted)}@media(min-width:760px){main{max-width:980px;margin:0 auto}.bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.attention{grid-template-columns:repeat(3,1fr)}.formGrid{grid-template-columns:repeat(2,1fr)}.formGrid .wide{grid-column:1/-1}}
</style>
</head>
<body>
<header class="top"><div class="brand"><strong>ADW</strong><span>Rolnická společnost Lesonice a.s.</span></div><span class="pill">Offline demo</span></header>
<nav class="tabs">
  <a href="#overview">Přehled</a>
  <a href="#reports">Výkazy (${reports.length})</a>
  <a href="#new-report">Nový výkaz</a>
  <a href="#fields">Pole (${fields.length})</a>
  <a href="#tractors">Stroje (${tractors.length})</a>
  <a href="#users">Lidé (${users.length})</a>
  <a href="#audit">Audit (${auditLog.length})</a>
</nav>
<main>
  <section class="section" id="overview">
    <div class="head"><div><p class="eyebrow">Aktualizováno ${formatDateTime(new Date())}</p><h1 class="title">Přehled vedoucího</h1></div></div>
    <div class="grid2">${metric('Ke schválení', pendingReports.length)}${metric('Po termínu', overdueReports.length, true)}</div>
    <section class="panel"><h2>Na co si dát pozor</h2><div class="attention"><article><strong>${suspiciousFuelReports.length}</strong><span>výkazů má podezřelou spotřebu PHM</span></article><article><strong>${longShiftReports.length}</strong><span>výkazů obsahuje směnu nad 10 hodin</span></article><article><strong>${missingEmployees.length}</strong><span>zaměstnanci dnes ještě nemají výkaz</span></article></div></section>
    <section class="panel"><h2>Výkazy ke schválení</h2><div class="scroll"><div class="list">${pendingReports.slice(0, 40).map(reportCard).join('')}</div></div></section>
    <div class="bottom">
      <section class="panel"><h2>Kdo dnes chybí</h2><div class="scroll small mini">${missingEmployees.map((employee) => `<div class="miniLine"><b>${escapeHtml(employee)}</b><em>Nezadáno</em></div>`).join('')}</div></section>
      <section class="panel"><h2>Stroje a spotřeba PHM</h2><div class="scroll small list">${machineFuel.map((item) => `<div class="bar"><span>${escapeHtml(item.name)}</span><b><i style="width:${Math.min(100, item.value * 8)}%"></i></b><strong>${item.value.toFixed(1)}</strong></div>`).join('')}</div></section>
      <section class="panel"><h2>Poslední aktivita</h2><div class="scroll small mini">${reports.slice(0, 40).map((report) => `<div class="miniLine"><b>${formatDate(report.date)}</b><span>${escapeHtml(report.employee_name)} · ${escapeHtml(report.work_type)}</span></div>`).join('')}</div></section>
    </div>
  </section>
  <section class="section" id="reports"><h1 class="title">Výkazy <span class="muted">(${reports.length})</span></h1><section class="panel"><div class="scroll"><div class="list">${reports.map(reportCard).join('')}</div></div></section></section>
  <section class="section" id="new-report"><h1 class="title">Nový výkaz</h1><section class="panel"><p class="muted">Demo formulář ukládá nový výkaz jen do tohoto prohlížeče v telefonu. Soubor samotný se nepřepisuje.</p><div id="saveNotice" class="notice">Výkaz uložen do demo režimu.</div><form id="reportForm" class="formGrid">
    <label>Zaměstnanec<select name="user_id">${users.map((user) => option(user.id, user.full_name)).join('')}</select></label>
    <label>Datum<input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
    <label>Od<input type="time" name="time_start" value="07:00" /></label>
    <label>Do<input type="time" name="time_end" value="15:00" /></label>
    <label>Pole<select name="field_id">${fields.map((field) => option(field.id, `${field.field_name} (${field.field_code})`)).join('')}</select></label>
    <label>Stroj<select name="tractor_id">${tractors.map((tractor) => option(tractor.id, `${tractor.tractor_name} (${tractor.tractor_code})`)).join('')}</select></label>
    <label>Činnost<select name="work_type_id">${workTypes.map((workType) => option(workType.id, workType.name)).join('')}</select></label>
    <label>Počet ha<input type="number" name="amount_ha" min="0" step="0.01" value="8.50" /></label>
    <label>PHM (l)<input type="number" name="fuel_liters" min="0" step="0.1" value="65" /></label>
    <label class="wide">Poznámka<textarea name="notes">Demo výkaz z telefonu</textarea></label>
    <button class="button wide" type="submit">Uložit demo výkaz</button>
  </form></section></section>
  <section class="section" id="fields"><h1 class="title">Pole <span class="muted">(${fields.length})</span></h1><section class="panel"><div class="scroll"><div class="list">${fields.map(fieldCard).join('')}</div></div></section></section>
  <section class="section" id="tractors"><h1 class="title">Stroje <span class="muted">(${tractors.length})</span></h1><section class="panel"><div class="scroll"><div class="list">${tractors.map(tractorCard).join('')}</div></div></section></section>
  <section class="section" id="users"><h1 class="title">Lidé <span class="muted">(${users.length})</span></h1><section class="panel"><div class="scroll"><div class="list">${users.map(userCard).join('')}</div></div></section></section>
  <section class="section" id="audit"><h1 class="title">Audit <span class="muted">(${auditLog.length})</span></h1><section class="panel"><div class="scroll"><div class="list">${auditLog.map(auditCard).join('')}</div></div></section></section>
</main>
<script id="adw-data" type="application/json">${JSON.stringify(clientData).replace(/</g, '\\u003c')}</script>
<script>
(function(){
  const data = JSON.parse(document.getElementById('adw-data').textContent);
  const storageKey = 'adw_offline_demo_reports';
  const addedReports = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const reportsSection = document.querySelector('#reports .list');
  const overviewSection = document.querySelector('#overview .list');
  const notice = document.getElementById('saveNotice');
  const form = document.getElementById('reportForm');

  function escapeHtml(value){return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
  function formatDate(value){return new Intl.DateTimeFormat('cs-CZ').format(new Date(value))}
  function number(value){return Number(value || 0)}
  function card(report){
    const fuelPerHa = number(report.amount_ha) > 0 ? number(report.fuel_liters) / number(report.amount_ha) : 0;
    return '<article class="row"><div class="rowTop"><b>'+escapeHtml(report.employee_name)+'</b><span class="tag">Ke schválení</span></div><small>'+formatDate(report.date)+' · '+escapeHtml(report.work_type)+'</small><p>'+escapeHtml(report.field_name)+' · '+escapeHtml(report.tractor_name)+'</p><p>'+report.time_start.slice(0,5)+'-'+report.time_end.slice(0,5)+' · '+number(report.amount_ha).toFixed(1)+' ha · '+number(report.fuel_liters).toFixed(0)+' l · '+fuelPerHa.toFixed(1)+' l/ha</p></article>';
  }
  function prependAddedReports(){
    if (!addedReports.length) return;
    const html = addedReports.map(card).join('');
    reportsSection.insertAdjacentHTML('afterbegin', html);
    overviewSection.insertAdjacentHTML('afterbegin', html);
  }
  prependAddedReports();

  form.addEventListener('submit', function(event){
    event.preventDefault();
    const formData = new FormData(form);
    const user = data.users.find((item) => String(item.id) === String(formData.get('user_id')));
    const field = data.fields.find((item) => String(item.id) === String(formData.get('field_id')));
    const tractor = data.tractors.find((item) => String(item.id) === String(formData.get('tractor_id')));
    const workType = data.workTypes.find((item) => String(item.id) === String(formData.get('work_type_id')));
    const report = {
      id: Date.now(),
      report_number: 'MOBILE-' + Date.now(),
      employee_name: user?.full_name || 'Demo uživatel',
      field_name: field?.field_name || 'Demo pole',
      tractor_name: tractor?.tractor_name || 'Demo stroj',
      work_type: workType?.name || 'Demo činnost',
      date: String(formData.get('date')),
      time_start: String(formData.get('time_start')) + ':00',
      time_end: String(formData.get('time_end')) + ':00',
      amount_ha: Number(formData.get('amount_ha')),
      fuel_liters: Number(formData.get('fuel_liters')),
      notes: String(formData.get('notes') || ''),
      status: 'pending'
    };
    addedReports.unshift(report);
    localStorage.setItem(storageKey, JSON.stringify(addedReports));
    reportsSection.insertAdjacentHTML('afterbegin', card(report));
    overviewSection.insertAdjacentHTML('afterbegin', card(report));
    notice.style.display = 'block';
    location.hash = '#reports';
  });
})();
</script>
</body>
</html>`;

fs.writeFileSync(outputFile, html, 'utf8');
console.log(outputFile);
