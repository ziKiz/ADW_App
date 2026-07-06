import { useMemo, useState } from 'react';

interface Contact {
  id: number;
  name: string;
  title: string;
  phone: string;
  group: string;
  section: 'Pracovní' | 'Vedení společnosti';
}

const contacts: Contact[] = [
  { id: 1, section: 'Vedení společnosti', group: 'Vedení', name: 'Miroslav Anděl', title: 'Majitel', phone: '602720691' },
  { id: 2, section: 'Vedení společnosti', group: 'Vedení', name: 'Ing. Petr Kuba', title: 'Výkonný ředitel', phone: '602533261' },
  { id: 3, section: 'Vedení společnosti', group: 'Ekonomické oddělení', name: 'Jaroslava Murínová', title: 'Vedoucí ekonomického oddělení', phone: '606766604' },
  { id: 4, section: 'Vedení společnosti', group: 'Ekonomické oddělení', name: 'Bc. Martina Pacasová', title: 'Účetní', phone: '606716890' },
  { id: 5, section: 'Vedení společnosti', group: 'Ekonomické oddělení', name: 'Vladimíra Pavelková', title: 'Asistentka, pomocná účetní, pokladní', phone: '725790813' },
  { id: 6, section: 'Vedení společnosti', group: 'Ekonomické oddělení', name: 'Ing. Petr Olejník', title: 'Controlling', phone: '602291730' },
  { id: 7, section: 'Vedení společnosti', group: 'Ekonomické oddělení', name: 'Ing. Iveta Pavlíčková', title: 'Účetní', phone: '736625525' },

  { id: 8, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Filip Daňhel', title: 'Agronom', phone: '727891125' },
  { id: 9, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Jana Bulíčková', title: 'Administrativní pracovnice', phone: '702016654' },
  { id: 10, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Ing. Zbyněk Pokorný', title: 'Vedoucí rostlinné výroby', phone: '606023572' },
  { id: 11, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Roman Bastl', title: 'RV', phone: '724766146' },
  { id: 12, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Pavel Dvořák', title: 'RV', phone: '702016659' },
  { id: 13, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Dušan Dvořák', title: 'RV', phone: '728215155' },
  { id: 14, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Pavel Klíma', title: 'RV', phone: '702016658' },
  { id: 15, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Bohuslav Kabelka', title: 'RV', phone: '702016644' },
  { id: 16, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Rostislav Kabelka', title: 'RV', phone: '725429303' },
  { id: 17, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Jan Novák', title: 'RV', phone: '702016661' },
  { id: 18, section: 'Pracovní', group: 'Rostlinná výroba', name: 'David Pacas', title: 'RV', phone: '702016647' },
  { id: 19, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Stanislav Papula', title: 'RV', phone: '702016656' },
  { id: 20, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Leoš Skucius', title: 'RV', phone: '702016650' },
  { id: 21, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Stanislav Šťáva', title: 'RV', phone: '702016653' },
  { id: 22, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Václav Trojan', title: 'RV', phone: '702016660' },
  { id: 23, section: 'Pracovní', group: 'Rostlinná výroba', name: 'Jiří Venhoda', title: 'RV', phone: '702016633' },

  { id: 24, section: 'Pracovní', group: 'Živočišná výroba', name: 'Vít Špaček', title: 'Hlavní zootechnik', phone: '728215168' },
  { id: 25, section: 'Pracovní', group: 'Živočišná výroba', name: 'Ing. Jana Bobulová', title: 'Zootechnik', phone: '702015765' },
  { id: 26, section: 'Pracovní', group: 'Živočišná výroba', name: 'Bc. Kateřina Kopečková', title: 'Zootechnik', phone: '603225494' },
  { id: 27, section: 'Pracovní', group: 'Živočišná výroba', name: 'Bronislav Benáček', title: 'ŽV', phone: '720959823' },
  { id: 28, section: 'Pracovní', group: 'Živočišná výroba', name: 'Jan Eliáš', title: 'ŽV', phone: '736625527' },
  { id: 29, section: 'Pracovní', group: 'Živočišná výroba', name: 'Antonín Herout', title: 'ŽV-Domamil', phone: '739273107' },
  { id: 30, section: 'Pracovní', group: 'Živočišná výroba', name: 'Zdeňka Horáčková', title: 'ŽV', phone: '728215172' },
  { id: 31, section: 'Pracovní', group: 'Živočišná výroba', name: 'Pavel Jordánek', title: 'ŽV', phone: '725969707' },
  { id: 32, section: 'Pracovní', group: 'Živočišná výroba', name: 'Roman Nahodil', title: 'ŽV-Domamil', phone: '702016636' },
  { id: 33, section: 'Pracovní', group: 'Živočišná výroba', name: 'Antonín Plichta st.', title: 'ŽV', phone: '702015762' },
  { id: 34, section: 'Pracovní', group: 'Živočišná výroba', name: 'Marek Vojtěch', title: 'ŽV', phone: '702016648' },
  { id: 35, section: 'Pracovní', group: 'Živočišná výroba', name: 'Vít Smažil', title: 'ŽV', phone: '702016649' },
  { id: 36, section: 'Pracovní', group: 'Živočišná výroba', name: 'Aneta Šťávová', title: 'ŽV', phone: '603210908' },
  { id: 37, section: 'Pracovní', group: 'Živočišná výroba', name: 'Dana Šťávová', title: 'ŽV', phone: '702016642' },
  { id: 38, section: 'Pracovní', group: 'Živočišná výroba', name: 'Pavlo Monko', title: 'ŽV', phone: '728215202' },
  { id: 39, section: 'Pracovní', group: 'Živočišná výroba', name: 'Miloš Kopuletý', title: 'ŽV', phone: '721980584' },
  { id: 40, section: 'Pracovní', group: 'Živočišná výroba', name: 'Lukáš Matula', title: 'ŽV', phone: '775549356' },

  { id: 41, section: 'Pracovní', group: 'Mechanizace', name: 'Ing. Martina Novotná', title: 'Vedoucí technického oddělení', phone: '737949804' },
  { id: 42, section: 'Pracovní', group: 'Mechanizace', name: 'Jan Chromý', title: 'Senior technik', phone: '606333656' },
  { id: 43, section: 'Pracovní', group: 'Mechanizace', name: 'Karel Trnka', title: 'Mechanizátor', phone: '601573011' },
  { id: 44, section: 'Pracovní', group: 'Mechanizace', name: 'Petr Chvátal', title: 'Dílny', phone: '702015763' },
  { id: 45, section: 'Pracovní', group: 'Mechanizace', name: 'Lukáš Dvořák', title: 'Dílny', phone: '702016646' },
  { id: 46, section: 'Pracovní', group: 'Mechanizace', name: 'Martin Skucius', title: 'Dílny', phone: '724974574' },
  { id: 47, section: 'Pracovní', group: 'Mechanizace', name: 'David Ševčík', title: 'Dílny', phone: '606023571' },
  { id: 48, section: 'Pracovní', group: 'Mechanizace', name: 'František Zach', title: 'Dílny', phone: '725853218' },
  { id: 49, section: 'Pracovní', group: 'Mechanizace', name: 'Filip Fiksa', title: 'Dílny', phone: '736625526' },
  { id: 50, section: 'Pracovní', group: 'Mechanizace', name: 'Jan Raab', title: 'Dílny', phone: '607007869' },

  { id: 51, section: 'Pracovní', group: 'Stavební skupina', name: 'Petr Hugo Solař', title: 'Vedoucí stavební skupiny', phone: '702022153' },
  { id: 52, section: 'Pracovní', group: 'Stavební skupina', name: 'Radek Gábor', title: 'Stavební skupina', phone: '702015769' },
  { id: 53, section: 'Pracovní', group: 'Stavební skupina', name: 'František Novák', title: 'Stavební skupina', phone: '702022154' },
  { id: 54, section: 'Pracovní', group: 'Stavební skupina', name: 'Martin Venhoda', title: 'Stavební skupina', phone: '702016655' },

  { id: 55, section: 'Pracovní', group: 'BPS', name: 'Ing. Veronika Suková', title: 'Vedoucí BPS', phone: '733141585' },
  { id: 56, section: 'Pracovní', group: 'BPS', name: 'Vlastimil Kopřiva', title: 'BPS L', phone: '725969712' },
  { id: 57, section: 'Pracovní', group: 'BPS', name: 'Josef Joura', title: 'BPS K', phone: '702016652' },
  { id: 58, section: 'Pracovní', group: 'BPS', name: 'Milan Karpíšek', title: 'BPS K', phone: '702016635' },
  { id: 59, section: 'Pracovní', group: 'BPS', name: 'Daniel Souček', title: 'Návoz BPS', phone: '607052840' },

  { id: 60, section: 'Pracovní', group: 'Mlékárna', name: 'Ing. Monika Ledecká', title: 'Vedoucí mlékárny', phone: '739065075' },
  { id: 61, section: 'Pracovní', group: 'Mlékárna', name: 'Mlékárna', title: 'Přesměrováno na paní Ledeckou', phone: '724282783' },
  { id: 62, section: 'Pracovní', group: 'Mlékárna', name: 'Prodejna Lesonice', title: 'Natálie Jeřábková', phone: '721980611' },
  { id: 63, section: 'Pracovní', group: 'Mlékárna', name: 'Prodejna Třebíč', title: 'Světlana Svobodová', phone: '702007285' },

  { id: 64, section: 'Pracovní', group: 'Vrátnice', name: 'Anna Hrdličková', title: 'Vrátnice, váha', phone: '725969721' },
  { id: 65, section: 'Pracovní', group: 'Jídelna', name: 'Jídelna - pí. Kvapilová', title: 'Jídelna', phone: '734620210' },
  { id: 66, section: 'Pracovní', group: 'Jídelna', name: 'Jídelna', title: 'Náhradní číslo', phone: '602857333' },

  { id: 67, section: 'Pracovní', group: 'Správa majetku', name: 'Lubomír Šiller', title: 'Vedoucí správy pozemků', phone: '725969494' },
  { id: 68, section: 'Pracovní', group: 'Správa majetku', name: 'Marta Beránková', title: 'Pracovnice správy nájemních smluv', phone: '602553977' },
  { id: 69, section: 'Pracovní', group: 'Správa majetku', name: 'Blanka Saláková', title: 'Pracovnice správy nájemních smluv', phone: '702015768' }
];

function telHref(phone: string) {
  return `tel:+420${phone.replace(/\D/g, '').replace(/^420/, '')}`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^420/, '');
  return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function Contacts() {
  const [section, setSection] = useState<Contact['section']>('Pracovní');
  const [query, setQuery] = useState('');
  const sectionContacts = useMemo(() => contacts.filter((contact) => contact.section === section), [section]);
  const groups = useMemo(() => [...new Set(sectionContacts.map((contact) => contact.group))], [sectionContacts]);
  const [selectedGroup, setSelectedGroup] = useState('Rostlinná výroba');
  const activeGroup = groups.includes(selectedGroup) ? selectedGroup : groups[0];
  const normalizedQuery = normalizeSearch(query);
  const filteredContacts = sectionContacts.filter((contact) => {
    if (!normalizedQuery) return contact.group === activeGroup;
    return normalizeSearch(`${contact.name} ${contact.title} ${contact.group} ${contact.phone}`).includes(normalizedQuery);
  });

  const switchSection = (nextSection: Contact['section']) => {
    setSection(nextSection);
    const firstGroup = contacts.find((contact) => contact.section === nextSection)?.group ?? '';
    setSelectedGroup(firstGroup);
  };

  return (
    <div className="container">
      <div className="card contacts-card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Kontakty</p>
            <h1 className="page-title">Důležité kontakty</h1>
          </div>
        </div>

        <div className="segmented-control contacts-section-tabs">
          {(['Pracovní', 'Vedení společnosti'] as Contact['section'][]).map((item) => (
            <button key={item} type="button" className={section === item ? 'active' : ''} onClick={() => switchSection(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="contact-search">
          <label htmlFor="contactSearch">Hledat kontakt</label>
          <div>
            <input
              id="contactSearch"
              type="search"
              placeholder="Jméno, funkce, oddělení nebo číslo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? <button type="button" onClick={() => setQuery('')}>Vymazat</button> : null}
          </div>
        </div>

        <div className="contact-filter-row" aria-label="Kategorie kontaktů">
          {groups.map((group) => (
            <button key={group} type="button" className={activeGroup === group ? 'active' : ''} onClick={() => setSelectedGroup(group)}>
              {group}
            </button>
          ))}
        </div>

        <div className="compact-contact-list">
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="compact-contact-row">
              <div>
                <strong>{contact.name}</strong>
                <span>{contact.title}</span>
                {normalizedQuery ? <em>{contact.group}</em> : null}
                <small>{formatPhone(contact.phone)}</small>
              </div>
              <a className="call-action" href={telHref(contact.phone)} aria-label={`Volat ${contact.name}`}>Volat</a>
            </article>
          ))}
        </div>
        {filteredContacts.length === 0 ? (
          <p className="empty-state">Žádný kontakt neodpovídá hledání.</p>
        ) : (
          <p className="contact-result-count">{filteredContacts.length} kontaktů</p>
        )}
      </div>
    </div>
  );
}

export default Contacts;
