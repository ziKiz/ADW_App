import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { FieldRecord, Tractor, WorkType } from '../types';

function getLocalTodayDate() {
  const today = new Date();
  const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function getFieldArea(fields: FieldRecord[], fieldId?: number) {
  const field = fields.find((item) => item.id === fieldId);
  return Number(field?.area ?? 0);
}

function calculateProcessedArea(fields: FieldRecord[], fieldId: number | undefined, processedPercent: number) {
  return Number((getFieldArea(fields, fieldId) * processedPercent / 100).toFixed(2));
}

interface FieldEntry {
  id: number;
  fieldId?: number;
  amountHa: number;
  processedPercent: number;
}

interface AttachmentEntry {
  id: number;
  name: string;
}

const serviceCenters = ['Rostlinná výroba', 'Živočišná výroba', 'Mechanizace', 'BPS', 'Stavební skupina', 'Mini mlékárna'];
const processedPercentOptions = [25, 50, 75, 100];
const attachmentOptions = [
  'Bez přípojného zařízení',
  'Podv. Panav Dolly',
  'Podv. Panav Dolly II.',
  'METACO',
  'WIELTON NW 3',
  'PANAV NS 1 36',
  'PANAV NS 144H',
  'PANAV 3',
  'SCHWARZMULLER',
  'MV 2-022',
  'BSS PS2 08.06 Agro',
  'BSS P 73 SH',
  'BSS PS2 09.07 Agro',
  'BSS P93 S',
  'MV 2-027 (TR 76-30)',
  'NS 900 H',
  'MEGA 25 č.1',
  'MEGA 20 č.2',
  'MEGA 20 č.3',
  'ZDT NS 20 č.4',
  'JOSKIN - přepr. dob.'
];

function ReportForm() {
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedTractor, setSelectedTractor] = useState<number | undefined>(undefined);
  const [selectedWorkType, setSelectedWorkType] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [date, setDate] = useState(getLocalTodayDate);
  const [timeStart, setTimeStart] = useState('07:00');
  const [timeEnd, setTimeEnd] = useState('15:00');
  const [serviceCenter, setServiceCenter] = useState(serviceCenters[0]);
  const [fieldEntries, setFieldEntries] = useState<FieldEntry[]>([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100 }]);
  const [attachmentEntries, setAttachmentEntries] = useState<AttachmentEntry[]>([{ id: Date.now() + 1, name: attachmentOptions[0] }]);
  const [fuelLiters, setFuelLiters] = useState(0);
  const [notes, setNotes] = useState('');
  const user = getUser();

  useEffect(() => {
    const loadMetadata = async () => {
      setMetadataLoading(true);
      const [tractorResponse, fieldResponse, workTypeResponse] = await Promise.allSettled([
        client.get('/tractors'),
        client.get('/fields'),
        client.get('/work-types')
      ]);

      if (tractorResponse.status === 'fulfilled') {
        setTractors(tractorResponse.value.data);
        if (tractorResponse.value.data.length > 0) {
          setSelectedTractor(tractorResponse.value.data[0].id);
        }
      } else {
        console.error(tractorResponse.reason);
      }

      if (fieldResponse.status === 'fulfilled') {
        const loadedFields = fieldResponse.value.data as FieldRecord[];
        setFields(loadedFields);
        if (loadedFields.length > 0) {
          const firstFieldId = loadedFields[0].id;
          setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(loadedFields, firstFieldId), processedPercent: 100 }]);
        }
      } else {
        console.error(fieldResponse.reason);
      }

      if (workTypeResponse.status === 'fulfilled') {
        setWorkTypes(workTypeResponse.value.data);
        if (workTypeResponse.value.data.length > 0) {
          setSelectedWorkType(workTypeResponse.value.data[0].id);
        }
      } else {
        console.error(workTypeResponse.reason);
      }

      if (
        tractorResponse.status === 'rejected' ||
        fieldResponse.status === 'rejected' ||
        workTypeResponse.status === 'rejected'
      ) {
        setMessage('Nepodařilo se načíst číselníky. Zkontrolujte prosím, že běží backend.');
      } else {
        setMessage('');
      }
      setMetadataLoading(false);
    };
    loadMetadata();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedFields = fieldEntries.filter((entry) => entry.fieldId);
    if (!selectedTractor || selectedFields.length === 0 || !selectedWorkType) {
      setMessage('Vyplňte prosím všechny povinné položky.');
      return;
    }

    const fieldSummary = selectedFields.map((entry, index) => {
      const field = fields.find((item) => item.id === entry.fieldId);
      return {
        order: index + 1,
        field_id: entry.fieldId,
        field_name: field?.field_name ?? '',
        field_code: field?.field_code ?? '',
        amount_ha: entry.amountHa,
        processed_percent: entry.processedPercent
      };
    });
    const attachmentSummary = attachmentEntries
      .filter((entry) => entry.name && entry.name !== attachmentOptions[0])
      .map((entry, index) => ({ order: index + 1, name: entry.name }));
    const extendedNotes = [
      `Středisko: ${serviceCenter}`,
      `Pozemky: ${fieldSummary.map((item) => `${item.field_name} (${item.field_code}) - ${item.amount_ha} ha`).join('; ')}`,
      `Přípojné zařízení: ${attachmentSummary.length ? attachmentSummary.map((item) => item.name).join('; ') : 'bez přípojného zařízení'}`,
      notes ? `Poznámka: ${notes}` : ''
    ].filter(Boolean).join('\n');

    try {
      await client.post('/reports', {
        report_number: `RPT-${Date.now()}`,
        tractor_id: selectedTractor,
        user_id: user?.id ?? 1,
        service_center: serviceCenter,
        field_id: selectedFields[0].fieldId,
        field_entries: fieldSummary,
        work_type_id: selectedWorkType,
        date,
        time_start: `${timeStart}:00`,
        time_end: `${timeEnd}:00`,
        break_hours: 0,
        hours_worked: Math.max(0, (Number(timeEnd.slice(0, 2)) + Number(timeEnd.slice(3, 5)) / 60) - (Number(timeStart.slice(0, 2)) + Number(timeStart.slice(3, 5)) / 60)),
        amount_ha: fieldSummary.reduce((sum, item) => sum + Number(item.amount_ha || 0), 0),
        fuel_liters: fuelLiters,
        attachments: attachmentSummary,
        notes: extendedNotes
      });
      setMessage('Výkaz byl uložen.');
    } catch (error) {
      console.error(error);
      setMessage('Chyba při ukládání výkazu.');
    }
  };

  const handleSelectTractor = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTractor(Number(event.target.value));
  };

  const handleSelectWorkType = (event: ChangeEvent<HTMLSelectElement>) => setSelectedWorkType(Number(event.target.value));
  const updateFieldEntry = (entryId: number, changes: Partial<FieldEntry>) => {
    setFieldEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  };
  const addFieldEntry = () => {
    const firstFieldId = fields[0]?.id;
    setFieldEntries((entries) => [...entries, { id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100 }]);
  };
  const removeFieldEntry = (entryId: number) => {
    setFieldEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.id !== entryId) : entries);
  };
  const updateAttachmentEntry = (entryId: number, name: string) => {
    setAttachmentEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, name } : entry));
  };
  const addAttachmentEntry = () => {
    if (attachmentEntries.length >= 3) return;
    setAttachmentEntries((entries) => [...entries, { id: Date.now(), name: attachmentOptions[0] }]);
  };
  const removeAttachmentEntry = (entryId: number) => {
    setAttachmentEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.id !== entryId) : entries);
  };

  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Výkazy</p>
            <h1 className="page-title">Nový pracovní výkaz</h1>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="report-form">
          <section className="report-section">
            <h2>Čas práce</h2>
            <div className="time-grid">
              <div className="field-row">
                <label htmlFor="date">Datum</label>
                <input id="date" type="date" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)} />
              </div>
              <div className="field-row">
                <label htmlFor="from">Od</label>
                <input id="from" type="time" value={timeStart} onChange={(event: ChangeEvent<HTMLInputElement>) => setTimeStart(event.target.value)} />
              </div>
              <div className="field-row">
                <label htmlFor="to">Do</label>
                <input id="to" type="time" value={timeEnd} onChange={(event: ChangeEvent<HTMLInputElement>) => setTimeEnd(event.target.value)} />
              </div>
            </div>
          </section>

          <section className="report-section">
            <h2>Středisko</h2>
            <div className="segmented-control">
              {serviceCenters.map((center) => (
                <button
                  key={center}
                  type="button"
                  className={serviceCenter === center ? 'active' : ''}
                  onClick={() => setServiceCenter(center)}
                >
                  {center}
                </button>
              ))}
            </div>
          </section>

          <section className="report-section report-section--compact">
            <h2>Typ práce</h2>
            <div className="field-row">
              <label htmlFor="workType">Typ práce</label>
              <select id="workType" value={selectedWorkType ?? ''} onChange={handleSelectWorkType}>
                {metadataLoading && <option value="">Načítám typy prací...</option>}
                {!metadataLoading && workTypes.length === 0 && <option value="">Žádné typy prací</option>}
                {workTypes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="report-section">
            <div className="section-line">
              <h2>Pozemky</h2>
              <button type="button" className="secondary" onClick={addFieldEntry}>Přidat pole</button>
            </div>
            <div className="repeat-list">
              {fieldEntries.map((entry, index) => (
                <div className="repeat-row repeat-row--field" key={entry.id}>
                  <span className="row-number">{index + 1}</span>
                  <div className="field-row">
                    <label htmlFor={`field-${entry.id}`}>Pozemek</label>
                    <select
                      id={`field-${entry.id}`}
                      value={entry.fieldId ?? ''}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const fieldId = Number(event.target.value);
                        updateFieldEntry(entry.id, {
                          fieldId,
                          amountHa: calculateProcessedArea(fields, fieldId, entry.processedPercent)
                        });
                      }}
                    >
                      {metadataLoading && <option value="">Načítám pole...</option>}
                      {!metadataLoading && fields.length === 0 && <option value="">Žádná pole</option>}
                      {fields.map((item) => (
                        <option key={item.id} value={item.id}>{item.field_name} ({item.field_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row field-row--compact">
                    <label htmlFor={`percent-${entry.id}`}>Zpracováno</label>
                    <select
                      id={`percent-${entry.id}`}
                      value={entry.processedPercent}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const processedPercent = Number(event.target.value);
                        updateFieldEntry(entry.id, {
                          processedPercent,
                          amountHa: calculateProcessedArea(fields, entry.fieldId, processedPercent)
                        });
                      }}
                    >
                      {processedPercentOptions.map((option) => (
                        <option key={option} value={option}>{option} %</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row field-row--area">
                    <label>Výměra</label>
                    <strong>{entry.amountHa.toFixed(2)} ha</strong>
                  </div>
                  <button type="button" className="danger repeat-remove" onClick={() => removeFieldEntry(entry.id)} disabled={fieldEntries.length === 1}>Odebrat</button>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <h2>Technika</h2>
            <div className="field-grid">
              <div className="field-row">
                <label htmlFor="tractor">Traktor</label>
                <select id="tractor" value={selectedTractor ?? ''} onChange={handleSelectTractor}>
                  {metadataLoading && <option value="">Načítám traktory...</option>}
                  {!metadataLoading && tractors.length === 0 && <option value="">Žádné traktory</option>}
                  {tractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.tractor_code && item.tractor_code !== item.tractor_name ? `${item.tractor_name} (${item.tractor_code})` : item.tractor_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row field-row--compact">
                <label htmlFor="fuelLiters">PHM (l)</label>
                <input
                  id="fuelLiters"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={fuelLiters}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setFuelLiters(Number(event.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="section-line">
              <h2>Přípojné zařízení</h2>
              <button type="button" className="secondary" onClick={addAttachmentEntry} disabled={attachmentEntries.length >= 3}>
                Přidat zařízení
              </button>
            </div>
            <div className="repeat-list">
              {attachmentEntries.map((entry, index) => (
                <div className="repeat-row repeat-row--attachment" key={entry.id}>
                  <span className="row-number">{index + 1}</span>
                  <div className="field-row">
                    <label htmlFor={`attachment-${entry.id}`}>Zařízení</label>
                    <select
                      id={`attachment-${entry.id}`}
                      value={entry.name}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAttachmentEntry(entry.id, event.target.value)}
                    >
                      {attachmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <button type="button" className="danger repeat-remove" onClick={() => removeAttachmentEntry(entry.id)} disabled={attachmentEntries.length === 1}>Odebrat</button>
                </div>
              ))}
            </div>
            <p className="field-hint">Lze přidat maximálně 3 přípojná zařízení.</p>
          </section>

          <section className="report-section">
            <h2>Doplňující údaje</h2>
            <div className="field-row">
              <label htmlFor="notes">Poznámka</label>
              <textarea id="notes" rows={4} value={notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} />
            </div>
          </section>

          <div className="form-footer">
            {message ? <p className="form-message">{message}</p> : null}
            <button type="submit" className="primary">Uložit a odeslat</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;
