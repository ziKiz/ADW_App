import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TractorSeed {
  code: string;
  name: string;
  service_centers: string[];
}

export interface FieldSeed {
  code: string;
  name: string;
  source: string;
  quadrant?: string | null;
  area?: number | null;
  culture?: string | null;
  crop?: string | null;
  erosion?: string | null;
}

export interface WorkTypeSeed {
  id: number;
  name: string;
  description: string;
}

const documentsDir = path.resolve(__dirname, '../../..', 'Documents');
const fieldsWorkbook = 'Seznam poli.xlsx';
const tractorsWorkbook = 'seznam a rozřazení strojů.xlsx';

const fallbackTractors: TractorSeed[] = [
  { name: 'FENDT VARIO 724', code: 'S05 0148', service_centers: ['Rostlinná výroba'] },
  { name: 'FENDT VARIO 724', code: 'S05 8924', service_centers: ['Rostlinná výroba'] },
  { name: 'FENDT 1165 PÁSÁK', code: 'S07 2384', service_centers: ['Rostlinná výroba'] },
  { name: 'FENDT 516', code: 'S07 6568', service_centers: ['Rostlinná výroba'] },
  { name: 'FENDT 828', code: 'S07 6551', service_centers: ['Rostlinná výroba'] },
  { name: 'FENDT 211', code: 'J03 7561', service_centers: ['Rostlinná výroba'] },
  { name: 'NEW HOLLAND TS135A', code: 'J02 2050', service_centers: ['Rostlinná výroba'] },
  { name: 'NEW HOLLAND TM155', code: 'J03 3668', service_centers: ['Rostlinná výroba'] },
  { name: 'Challenger MT 865 C', code: 'J01 6057', service_centers: ['Rostlinná výroba'] },
  { name: 'Challenger MT 545 B', code: 'J02 3322', service_centers: ['Rostlinná výroba'] }
];

export const fallbackWorkTypes: WorkTypeSeed[] = [
  { id: 1, name: 'Orání', description: 'Příprava půdy před setím' },
  { id: 2, name: 'Setí', description: 'Založení plodiny na pole' },
  { id: 3, name: 'Sklizeň', description: 'Sklizeň úrody' },
  { id: 4, name: 'Mulčování', description: 'Odstranění porostu a údržba mezí' },
  { id: 5, name: 'Hnojení', description: 'Aplikace hnojiva nebo živin' },
  { id: 6, name: 'Ostatní', description: 'Ostatní práce mimo hlavní kategorie' },
  { id: 7, name: 'Dovolená', description: 'Celodenní absence z důvodu dovolené' },
  { id: 8, name: 'Školení', description: 'Účast na školení nebo interní vzdělávání' }
];

const fallbackFields: FieldSeed[] = [
  { code: '1001', name: 'U háje', source: 'local-fallback' },
  { code: '1002', name: 'Nad rybníkem', source: 'local-fallback' },
  { code: '1003', name: 'Za kravínem', source: 'local-fallback' },
  { code: '1004', name: 'Dlouhé díly', source: 'local-fallback' },
  { code: '1005', name: 'Pod silnicí', source: 'local-fallback' },
  { code: '1006', name: 'Kopaniny', source: 'local-fallback' },
  { code: '1007', name: 'Na stráni', source: 'local-fallback' },
  { code: '1008', name: 'U lesa', source: 'local-fallback' },
  { code: '1009', name: 'Za potokem', source: 'local-fallback' },
  { code: '1010', name: 'Lány', source: 'local-fallback' },
  { code: '1011', name: 'Pod vinicí', source: 'local-fallback' },
  { code: '1012', name: 'Kamenice', source: 'local-fallback' },
  { code: '1013', name: 'Nad vsí', source: 'local-fallback' },
  { code: '1014', name: 'U kapličky', source: 'local-fallback' },
  { code: '1015', name: 'Roviny', source: 'local-fallback' },
  { code: '1016', name: 'Přední pole', source: 'local-fallback' },
  { code: '1017', name: 'Zadní pole', source: 'local-fallback' },
  { code: '1018', name: 'Mezilesí', source: 'local-fallback' },
  { code: '1019', name: 'U topolů', source: 'local-fallback' },
  { code: '1020', name: 'Novina', source: 'local-fallback' }
];

const excelFiles = [
  'ADWFARM_pozemky_01062026.xls',
  'Agro Mohelno_pozemky_01062026.xls',
  'RSL_pozemky_01062026.xls',
  'RSR_pozemky_01062026.xls',
  'Archiv/tisk_zem_parcel (13).xls',
  'Archiv/tisk_zem_parcel (14).xls',
  'Archiv/tisk_zem_parcel (15).xls',
  'tisk_zem_parcel (13).xls',
  'tisk_zem_parcel (14).xls',
  'tisk_zem_parcel (15).xls'
];

const fieldCodePattern = /^(?:\d{4}(?:\/\d+)?|\d{2,4})$/;
const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
const skippedText = new Set([
  'Zem. parcely',
  'Zk. k',
  'Eroze',
  'Kultura',
  'Plodina',
  'Hlavn',
  'Plat. od',
  'Plat. do',
  'Multi',
  'Arial',
  'Arial1',
  'Trval',
  'travn',
  'porost',
  'Louky',
  'vy s leguminozami',
  'vy na orn',
  'vy pro ochrann',
  'Oves nah',
  'jarn',
  'k set',
  'Jetelotr',
  'Tritikale ozim',
  'Tritik',
  'le 26',
  'le ozim',
  'krmn'
]);

let cachedFields: FieldSeed[] | null = null;
let cachedTractors: TractorSeed[] | null = null;

function findDocumentFile(fileName: string) {
  const directPath = path.join(documentsDir, fileName);
  if (fs.existsSync(directPath)) return directPath;
  const archivePath = path.join(documentsDir, 'Archiv', fileName);
  if (fs.existsSync(archivePath)) return archivePath;
  return null;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getSharedStrings(workbookPath: string) {
  const output = execFileSync('unzip', ['-p', workbookPath, 'xl/sharedStrings.xml'], { encoding: 'utf8' });
  return [...output.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join('')
      .trim()
  );
}

function readWorkbookSheet(workbookPath: string, sheetNumber: number, sharedStrings: string[]) {
  const output = execFileSync('unzip', ['-p', workbookPath, `xl/worksheets/sheet${sheetNumber}.xml`], { encoding: 'utf8' });
  return [...output.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: Record<string, string> = { __row: rowMatch[1] };
    for (const cellMatch of rowMatch[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*[^/])>([\s\S]*?)<\/c>/g)) {
      const [, column, attributes, body] = cellMatch;
      const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
      if (!valueMatch) continue;
      const rawValue = valueMatch[1];
      row[column] = attributes.includes('t="s"') ? sharedStrings[Number(rawValue)] : rawValue;
    }
    return row;
  });
}

function normalizeServiceCenterName(value: string) {
  if (value === 'Bioplynová stanice') return 'BPS';
  if (value === 'Mini Mlékárna') return 'Mini mlékárna';
  return value;
}

function isServiceCenterMark(value?: string) {
  return ['x', '×', '1', 'ano'].includes(String(value ?? '').trim().toLocaleLowerCase('cs'));
}

function extractWorkbookTractors(): TractorSeed[] {
  const workbookPath = path.join(documentsDir, tractorsWorkbook);
  if (!fs.existsSync(workbookPath)) return [];

  const sharedStrings = getSharedStrings(workbookPath);
  const rows = readWorkbookSheet(workbookPath, 1, sharedStrings);
  const header = rows[0] ?? {};
  const serviceColumns = ['C', 'D', 'E', 'F', 'G', 'H']
    .map((column) => ({ column, name: normalizeServiceCenterName(header[column]?.trim() ?? '') }))
    .filter((item) => item.name);

  return rows.slice(1)
    .map((row) => ({
      name: row.A?.trim() ?? '',
      code: row.B?.trim() || `bez SPZ - řádek ${row.__row}`,
      service_centers: serviceColumns
        .filter((item) => isServiceCenterMark(row[item.column]))
        .map((item) => item.name)
    }))
    .filter((tractor) => tractor.name && tractor.code);
}

function extractWorkbookFields(): FieldSeed[] {
  const workbookPath = findDocumentFile(fieldsWorkbook);
  if (!workbookPath) return [];

  const sharedStrings = getSharedStrings(workbookPath);
  const fieldsByKey = new Map<string, FieldSeed>();

  for (const sheetNumber of [1, 2, 3]) {
    const rows = readWorkbookSheet(workbookPath, sheetNumber, sharedStrings);
    for (const row of rows.slice(1)) {
      const code = row.B?.trim();
      const name = row.D?.trim();
      if (!code || !name || !fieldCodePattern.test(code)) continue;

      const key = `${code}:${name}`;
      if (!fieldsByKey.has(key)) {
        fieldsByKey.set(key, {
          code,
          name,
          source: fieldsWorkbook,
          quadrant: row.A?.trim() || null,
          area: row.F ? Number(row.F) : null,
          culture: row.G?.trim() || null,
          crop: row.H?.trim() || null,
          erosion: row.E?.trim() || null
        });
      }
    }
  }

  return [...fieldsByKey.values()];
}

function isNoise(value: string) {
  return (
    !value ||
    skippedText.has(value) ||
    datePattern.test(value) ||
    value.startsWith('MbP') ||
    value.startsWith('333') ||
    value.startsWith('ffff') ||
    value.startsWith('Q8') ||
    value.startsWith('Ga') ||
    value.startsWith('p=')
  );
}

export function extractDocumentFields() {
  if (cachedFields) return cachedFields;

  const fieldsByCode = new Map<string, FieldSeed>();
  const workbookFields = extractWorkbookFields();
  for (const field of workbookFields) {
    fieldsByCode.set(`${field.code}:${field.name}`, field);
  }

  for (const fileName of excelFiles) {
    const filePath = path.join(documentsDir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const output = execFileSync('strings', [filePath], { encoding: 'utf8' });
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.replace(/\f/g, '').trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length - 1; index += 1) {
      const code = lines[index];
      if (!fieldCodePattern.test(code) || datePattern.test(code) || code.includes('-')) {
        continue;
      }

      let nameIndex = index + 1;
      while (nameIndex < lines.length && isNoise(lines[nameIndex])) {
        nameIndex += 1;
      }

      const name = lines[nameIndex];
      if (
        !name ||
        isNoise(name) ||
        fieldCodePattern.test(name) ||
        !/[A-Za-z]/.test(name) ||
        name.length < 2
      ) {
        continue;
      }

      const key = `${code}:${name}`;
      if (!fieldsByCode.has(key)) {
        fieldsByCode.set(key, { code, name, source: fileName });
      }
    }
  }

  cachedFields = (fieldsByCode.size > 0 ? [...fieldsByCode.values()] : fallbackFields).sort((first, second) =>
    first.name.localeCompare(second.name, 'cs') || first.code.localeCompare(second.code, 'cs')
  );
  return cachedFields;
}

export function extractDocumentTractors() {
  if (cachedTractors) return cachedTractors;
  const tractors = extractWorkbookTractors();
  cachedTractors = tractors.length > 0 ? tractors : fallbackTractors;
  return cachedTractors;
}

export const documentTractors = extractDocumentTractors();
