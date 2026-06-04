import { seedLocalFieldsFromDocuments, seedLocalTractorsFromDocuments } from '../data/localAdminData';

const audit = {
  userName: 'Import z Documents'
};

const fields = seedLocalFieldsFromDocuments(audit);
const tractors = seedLocalTractorsFromDocuments(audit);

console.log('Lokální číselníky doplněny podle složky Documents.');
console.log(`Pozemky: ${fields.length} z Documents/Seznam poli.xlsx`);
console.log(`Stroje: ${tractors.length} z Documents/Seznam stroju.JPG`);
