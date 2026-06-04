import { getLocalFields, getLocalTractors, getLocalUsers, getLocalWorkTypes } from '../data/localAdminData';
import { seedLocalReports } from '../data/localReports';

const users = getLocalUsers();
const fields = getLocalFields();
const tractors = getLocalTractors();
const workTypes = getLocalWorkTypes();
const reports = seedLocalReports();

console.log(`Lokální demo databáze uložena do backend/local-data.`);
console.log(`Uživatelé: ${users.length}`);
console.log(`Pozemky: ${fields.length}`);
console.log(`Stroje: ${tractors.length}`);
console.log(`Činnosti: ${workTypes.length}`);
console.log(`Výkazy: ${reports.length} za období 2026-04-01 až 2026-05-31`);
