const noFieldWorkTypes = new Set([
  'Montáž', 'Demontáž', 'Oprava', 'Údržba', 'Práce s nakladačem', 'Práce s nakladačem, destou',
  'Krmení', 'Nahrnování', 'Dusání', 'Rozvoz Minimlékarna', 'Odkrývání silážních jam',
  'Zakrývání silážních jam', 'Úklid', 'Práce BPS', 'Čištění stroje', 'Čistění stroje', 'Jiné'
].map((name) => name.toLocaleLowerCase('cs-CZ')));

export function workTypeAllowsFields(workTypeName?: string | null) {
  return Boolean(workTypeName && !noFieldWorkTypes.has(workTypeName.toLocaleLowerCase('cs-CZ')));
}

export function reportHasFieldPerformance(report: { work_type?: string | null; field_name?: string | null }) {
  return workTypeAllowsFields(report.work_type) && Boolean(report.field_name);
}
