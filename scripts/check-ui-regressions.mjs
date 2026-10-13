import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];

function includes(source, expected, message) {
  if (!source.includes(expected)) failures.push(message);
}

const usersView = read('frontend/src/pages/UsersView.tsx');
includes(usersView, 'editorRef.current?.scrollIntoView', 'Editor uživatele se po kliknutí Upravit neposune do viditelné části.');
includes(usersView, "querySelector<HTMLInputElement>('input:not([type=\"checkbox\"])')?.focus()", 'Editor uživatele po otevření nezíská fokus.');
includes(usersView, 'ref={editorRef}', 'Editor uživatele není připojený k viditelnému ref elementu.');

const approvals = read('frontend/src/pages/ApprovalDashboard.tsx');
includes(approvals, "requestedStatus: 'approved' | 'rejected'", 'Schválení a vrácení nemají oddělené vyhodnocení oprávnění.');
includes(approvals, "approvalActionForViewer(selectedReport, user, 'rejected')", 'Vrácení výkazu nepoužívá samostatné oprávnění.');
includes(approvals, 'Načítám detail výkazu…', 'Detail výkazu nemá viditelný načítací stav.');
includes(approvals, 'Načítám výkazy…', 'Seznam výkazů nemá viditelný načítací stav.');

const dashboard = read('frontend/src/pages/Dashboard.tsx');
includes(dashboard, '!reportHasFieldPerformance(report)', 'Přehled stále může zobrazit hektary u činnosti bez pozemku.');

if (failures.length) {
  console.error('Regresní kontrola UI selhala:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Regresní kontrola UI OK.');
