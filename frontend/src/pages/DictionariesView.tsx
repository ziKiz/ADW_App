import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { FieldRecord, Tractor } from '../types';
import { getUser } from '../utils/auth';

type EditedDictionary =
  | { kind: 'fields'; item: FieldRecord }
  | { kind: 'tractors'; item: Tractor };

type DictionaryTab = 'fields' | 'tractors';
type SortDirection = 'asc' | 'desc';

function formatAuditDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function normalize(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('cs-CZ');
}

function compareValues(first: unknown, second: unknown, direction: SortDirection) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  const result = Number.isFinite(firstNumber) && Number.isFinite(secondNumber)
    ? firstNumber - secondNumber
    : String(first ?? '').localeCompare(String(second ?? ''), 'cs-CZ', { numeric: true, sensitivity: 'base' });

  return direction === 'asc' ? result : -result;
}

function DictionariesView() {
  const [activeTab, setActiveTab] = useState<DictionaryTab>('fields');
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [edited, setEdited] = useState<EditedDictionary | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('field_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const isAdmin = getUser()?.role === 'admin';

  useEffect(() => {
    Promise.allSettled([
      client.get('/fields'),
      client.get('/tractors')
    ]).then(([fieldResponse, tractorResponse]) => {
      if (fieldResponse.status === 'fulfilled') setFields(fieldResponse.value.data);
      if (tractorResponse.status === 'fulfilled') setTractors(tractorResponse.value.data);
    });
  }, []);

  const sortOptions = useMemo(() => {
    if (activeTab === 'fields') {
      return [
        { value: 'field_name', label: 'Název' },
        { value: 'field_code', label: 'Kód' },
        { value: 'area', label: 'Výměra' },
        { value: 'culture', label: 'Kultura' },
        { value: 'crop', label: 'Plodina' },
        { value: 'updated_at', label: 'Poslední úprava' }
      ];
    }
    if (activeTab === 'tractors') {
      return [
        { value: 'tractor_name', label: 'Název' },
        { value: 'tractor_code', label: 'Kód' },
        { value: 'vehicle_type', label: 'Typ' },
        { value: 'updated_at', label: 'Poslední úprava' }
      ];
    }
    return [];
  }, [activeTab]);

  const selectTab = (tab: DictionaryTab, defaultSortKey: string) => {
    setActiveTab(tab);
    setSortKey(defaultSortKey);
    setSortDirection('asc');
    setSearchTerm('');
  };

  const filteredFields = useMemo(() => {
    const term = normalize(searchTerm);
    return fields
      .filter((field) => [
        field.field_code,
        field.field_name,
        field.area,
        field.culture,
        field.crop,
        field.erosion,
        field.updated_by
      ].some((value) => normalize(value).includes(term)))
      .sort((first, second) => compareValues(first[sortKey as keyof FieldRecord], second[sortKey as keyof FieldRecord], sortDirection));
  }, [fields, searchTerm, sortDirection, sortKey]);

  const filteredTractors = useMemo(() => {
    const term = normalize(searchTerm);
    return tractors
      .filter((tractor) => [
        tractor.tractor_code,
        tractor.tractor_name,
        tractor.vehicle_type,
        tractor.status,
        tractor.updated_by
      ].some((value) => normalize(value).includes(term)))
      .sort((first, second) => compareValues(first[sortKey as keyof Tractor], second[sortKey as keyof Tractor], sortDirection));
  }, [searchTerm, sortDirection, sortKey, tractors]);

  const startNew = () => {
    if (activeTab === 'fields') {
      setEdited({
        kind: 'fields',
        item: { id: 0, field_code: '', field_name: '', area: 0, culture: '', crop: '' }
      });
    }
    if (activeTab === 'tractors') {
      setEdited({
        kind: 'tractors',
        item: { id: 0, tractor_code: '', tractor_name: '', vehicle_type: 'traktor', status: 'active' }
      });
    }
  };

  const saveEdited = async () => {
    if (!edited) return;
    const endpoint = edited.kind === 'fields' ? 'fields' : 'tractors';
    const request = edited.item.id
      ? client.put(`/${endpoint}/${edited.item.id}`, edited.item)
      : client.post(`/${endpoint}`, edited.item);
    try {
      const response = await request;
      if (edited.kind === 'fields') {
        const saved = response.data as FieldRecord;
        setFields((current) => edited.item.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]);
      }
      if (edited.kind === 'tractors') {
        const saved = response.data as Tractor;
        setTractors((current) => edited.item.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]);
      }
      setEdited(null);
      setMessage('Záznam byl uložen.');
    } catch (error) {
      console.error(error);
      setMessage('Záznam se nepodařilo uložit.');
    }
  };

  return (
    <div className="container">
      <section className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Databáze</p>
            <h1 className="page-title">Číselníky</h1>
          </div>
          {isAdmin ? <button className="primary" type="button" onClick={startNew}>Nový záznam</button> : null}
        </div>
        {message ? <p className="form-message">{message}</p> : null}
        <div className="tabs">
          <button className={activeTab === 'fields' ? 'active' : ''} type="button" onClick={() => selectTab('fields', 'field_name')}>Pozemky <b>{fields.length}</b></button>
          <button className={activeTab === 'tractors' ? 'active' : ''} type="button" onClick={() => selectTab('tractors', 'tractor_name')}>Stroje <b>{tractors.length}</b></button>
        </div>

        <div className="filter-bar dictionary-filter">
          <label>
            Hledat
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Kód, název, plodina..." />
          </label>
          <label>
            Seřadit podle
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Směr
            <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
              <option value="asc">Vzestupně</option>
              <option value="desc">Sestupně</option>
            </select>
          </label>
          <p className="filter-result">
            {activeTab === 'fields' ? filteredFields.length : filteredTractors.length} nalezeno
          </p>
        </div>

        {activeTab === 'fields' ? (
          <>
            {filteredFields.length > 120 ? <p className="table-hint">Zobrazeno prvních 120 položek. Zpřesněte hledání pro kratší seznam.</p> : null}
            <table className="approval-table">
              <thead>
                <tr>
                  <th>Kód</th>
                  <th>Název pozemku</th>
                  <th>Výměra</th>
                  <th>Kultura</th>
                  <th>Plodina</th>
                  <th>Poslední úprava</th>
                  <th>Upravil</th>
                  {isAdmin ? <th>Akce</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredFields.slice(0, 120).map((field) => (
                  <tr key={field.id}>
                    <td data-label="Kód">{field.field_code}</td>
                    <td data-label="Název pozemku">{field.field_name}</td>
                    <td data-label="Výměra">{field.area ? `${field.area} ha` : '-'}</td>
                    <td data-label="Kultura">{field.culture ?? '-'}</td>
                    <td data-label="Plodina">{field.crop ?? '-'}</td>
                    <td data-label="Poslední úprava">{formatAuditDate(field.updated_at)}</td>
                    <td data-label="Upravil">{field.updated_by ?? '-'}</td>
                    {isAdmin ? <td data-label="Akce"><button className="edit-action" type="button" onClick={() => setEdited({ kind: 'fields', item: field })}>Upravit</button></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {activeTab === 'tractors' ? (
          <table className="approval-table">
            <thead>
              <tr>
                <th>Kód</th>
                <th>Název stroje</th>
                <th>Typ</th>
                <th>Poslední úprava</th>
                <th>Upravil</th>
                {isAdmin ? <th>Akce</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredTractors.map((tractor) => (
                <tr key={tractor.id}>
                  <td data-label="Kód">{tractor.tractor_code}</td>
                  <td data-label="Název stroje">{tractor.tractor_name}</td>
                  <td data-label="Typ">{tractor.vehicle_type ?? '-'}</td>
                  <td data-label="Poslední úprava">{formatAuditDate(tractor.updated_at)}</td>
                  <td data-label="Upravil">{tractor.updated_by ?? '-'}</td>
                  {isAdmin ? <td data-label="Akce"><button className="edit-action" type="button" onClick={() => setEdited({ kind: 'tractors', item: tractor })}>Upravit</button></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {edited ? (
          <div className="modal-backdrop" role="presentation">
            <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dictionaryDetailTitle">
              <div className="modal-heading">
                <div>
                  <p className="eyebrow">Administrace</p>
                  <h2 id="dictionaryDetailTitle">{edited.item.id ? 'Detail číselníku' : 'Nový záznam'}</h2>
                </div>
                <button className="icon-action view" type="button" aria-label="Zavřít" onClick={() => setEdited(null)}>×</button>
              </div>
              <div className="detail-grid">
                {edited.kind === 'fields' ? (
                  <>
                    <label>Kód<input value={edited.item.field_code} onChange={(event) => setEdited({ kind: 'fields', item: { ...edited.item, field_code: event.target.value } })} /></label>
                    <label>Název pozemku<input value={edited.item.field_name} onChange={(event) => setEdited({ kind: 'fields', item: { ...edited.item, field_name: event.target.value } })} /></label>
                    <label>Výměra<input type="number" step="0.01" value={edited.item.area ?? 0} onChange={(event) => setEdited({ kind: 'fields', item: { ...edited.item, area: Number(event.target.value) } })} /></label>
                    <label>Kultura<input value={edited.item.culture ?? ''} onChange={(event) => setEdited({ kind: 'fields', item: { ...edited.item, culture: event.target.value } })} /></label>
                    <label className="detail-grid__wide">Plodina<input value={edited.item.crop ?? ''} onChange={(event) => setEdited({ kind: 'fields', item: { ...edited.item, crop: event.target.value } })} /></label>
                  </>
                ) : null}
                {edited.kind === 'tractors' ? (
                  <>
                    <label>Kód<input value={edited.item.tractor_code} onChange={(event) => setEdited({ kind: 'tractors', item: { ...edited.item, tractor_code: event.target.value } })} /></label>
                    <label>Název stroje<input value={edited.item.tractor_name} onChange={(event) => setEdited({ kind: 'tractors', item: { ...edited.item, tractor_name: event.target.value } })} /></label>
                    <label>Typ<input value={edited.item.vehicle_type ?? ''} onChange={(event) => setEdited({ kind: 'tractors', item: { ...edited.item, vehicle_type: event.target.value } })} /></label>
                  </>
                ) : null}
              </div>
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => setEdited(null)}>Zavřít</button>
                <button className="primary" type="button" onClick={saveEdited}>{edited.item.id ? 'Uložit změny' : 'Vytvořit záznam'}</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default DictionariesView;
