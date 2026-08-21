import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

interface Contact {
  id: number;
  name: string;
  title: string;
  phone: string;
  phone_extension?: string;
  group: string;
  section: 'Pracovní' | 'Vedení společnosti';
}

const fallbackContacts: Contact[] = [];
const groupOrder = [
  'Vedení',
  'Ekonomické oddělení',
  'Správa majetku',
  'Rostlinná výroba',
  'Živočišná výroba',
  'Mechanizace',
  'Stavební skupina',
  'BPS',
  'Mlékárna',
  'Vrátnice',
  'Jídelna'
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

function sortContacts(contacts: Contact[]) {
  return [...contacts].sort((first, second) => {
    const groupCompare = (groupOrder.indexOf(first.group) === -1 ? 99 : groupOrder.indexOf(first.group)) -
      (groupOrder.indexOf(second.group) === -1 ? 99 : groupOrder.indexOf(second.group));
    if (groupCompare !== 0) return groupCompare;
    return first.name.localeCompare(second.name, 'cs-CZ');
  });
}

function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>(fallbackContacts);
  const [section, setSection] = useState<Contact['section']>('Pracovní');
  const [query, setQuery] = useState('');
  useEffect(() => {
    client.get('/contacts')
      .then((response) => {
        const apiContacts = (response.data as any[]).map((contact) => ({
          id: contact.id,
          section: contact.section,
          group: contact.group ?? contact.contact_group,
          name: contact.name ?? contact.full_name,
          title: contact.title ?? contact.position ?? '',
          phone: contact.phone ?? contact.mobile ?? '',
          phone_extension: contact.phone_extension ?? contact.extension ?? ''
        })).filter((contact) => contact.name && contact.phone);
        if (apiContacts.length > 0) setContacts(sortContacts(apiContacts));
      })
      .catch((error) => console.error(error));
  }, []);

  const sectionContacts = useMemo(() => contacts.filter((contact) => contact.section === section), [contacts, section]);
  const groups = useMemo(() => [...new Set(sectionContacts.map((contact) => contact.group))], [sectionContacts]);
  const [selectedGroup, setSelectedGroup] = useState('Rostlinná výroba');
  const activeGroup = groups.includes(selectedGroup) ? selectedGroup : groups[0];
  const normalizedQuery = normalizeSearch(query);
  const filteredContacts = sectionContacts.filter((contact) => {
    if (!normalizedQuery) return contact.group === activeGroup;
    return normalizeSearch(`${contact.name} ${contact.title} ${contact.group} ${contact.phone} ${contact.phone_extension ?? ''}`).includes(normalizedQuery);
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

        <div className="contact-group-select">
          <label htmlFor="contactGroup">Vyber oddělení</label>
          <select
            id="contactGroup"
            value={activeGroup ?? ''}
            onChange={(event) => setSelectedGroup(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="compact-contact-list">
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="compact-contact-row">
              <div>
                <strong>{contact.name}</strong>
                <span>{contact.title}</span>
                {normalizedQuery ? <em>{contact.group}</em> : null}
                <small>{formatPhone(contact.phone)}{contact.phone_extension ? ` · Klapka ${contact.phone_extension}` : ''}</small>
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
