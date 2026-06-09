import { useState } from 'react';
import client from '../api/client';

function ExportView() {
  const [status, setStatus] = useState('');

  const handleExport = async () => {
    try {
      const response = await client.get('/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'adw_reports.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setStatus('Export byl připraven.');
    } catch (error) {
      console.error(error);
      setStatus('Chyba při exportu.');
    }
  };
  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Webová aplikace - exporty</p>
            <h1 className="page-title">Exporty</h1>
          </div>
          <button type="button" className="primary" onClick={handleExport}>Export do Excelu</button>
        </div>
        <div className="filter-bar">
          <label>
            Měsíc
            <select defaultValue="may"><option value="may">Květen</option></select>
          </label>
          <label>
            Rok
            <select defaultValue="2026"><option value="2026">2026</option></select>
          </label>
          <label>
            Středisko
            <select defaultValue="all"><option value="all">Vše</option></select>
          </label>
          <label>
            Stav výkazů
            <select defaultValue="approved"><option value="approved">Schválené</option></select>
          </label>
        </div>
        <h2 className="table-title">Historie exportů</h2>
        <table className="approval-table">
          <thead>
            <tr>
              <th>Datum exportu</th>
              <th>Období</th>
              <th>Středisko</th>
              <th>Soubor</th>
              <th>Stav</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Datum exportu">25. 5. 2026 10:15</td>
              <td data-label="Období">Květen 2026</td>
              <td data-label="Středisko">Vše</td>
              <td data-label="Soubor">Vykazy_2026_05.xlsx</td>
              <td data-label="Stav"><span className="status-green">Stáhnout</span></td>
            </tr>
            <tr>
              <td data-label="Datum exportu">30. 4. 2026 09:20</td>
              <td data-label="Období">Duben 2026</td>
              <td data-label="Středisko">Vše</td>
              <td data-label="Soubor">Vykazy_2026_04.xlsx</td>
              <td data-label="Stav"><span className="status-green">Stáhnout</span></td>
            </tr>
          </tbody>
        </table>
        {status && <p className="form-message">{status}</p>}
      </div>
    </div>
  );
}

export default ExportView;
