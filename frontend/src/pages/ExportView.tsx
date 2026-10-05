import { useState } from 'react';
import client from '../api/client';
import { serviceCenters } from '../utils/employeeContext';

function ExportView() {
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [center, setCenter] = useState('all');
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const years = Array.from({ length: Math.max(1, now.getFullYear() - 2025 + 1) }, (_, index) => String(now.getFullYear() - index));
  const months = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ];

  const handleExport = async () => {
    setExporting(true);
    setStatus('');
    try {
      const response = await client.get('/export/csv', {
        responseType: 'blob',
        params: { center, year: Number(year), month: month === 'all' ? undefined : Number(month) }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = String(response.headers['content-disposition'] ?? '');
      const serverFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      link.setAttribute('download', serverFilename ?? `adw_schvalene_${year}_${month}_${center}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setStatus('Export byl připraven.');
    } catch (error) {
      console.error(error);
      setStatus('Chyba při exportu.');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Webová aplikace - exporty</p>
            <h1 className="page-title">Export schválených výkazů</h1>
          </div>
          <button type="button" className="primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Připravuji...' : 'Stáhnout CSV'}
          </button>
        </div>
        <div className="filter-bar">
          <label>
            Měsíc
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="all">Celý rok</option>
              {months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}
            </select>
          </label>
          <label>
            Rok
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Středisko
            <select value={center} onChange={(event) => setCenter(event.target.value)}>
              <option value="all">Vše</option>
              {serviceCenters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {status && <p className="form-message">{status}</p>}
      </div>
    </div>
  );
}

export default ExportView;
