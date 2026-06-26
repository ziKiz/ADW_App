import { useEffect, useState, useMemo } from 'react';
import { formatCzechDate } from '../utils/format';

interface ServiceEntry {
  date: string;
  person: string;
  role: string;
  shift: string;
}

function ServiceSchedule() {
  const [services, setServices] = useState<ServiceEntry[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}demo-data/service-schedule.json`)
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error('Failed to load service schedule:', err));
  }, []);

  const getNext7Days = (services: ServiceEntry[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next7Days = [];
    for (let i = 0; i < 8; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const serviceForDay = services.find((s) => s.date === dateStr);
      next7Days.push({
        date: dateStr,
        dateObj: date,
        service: serviceForDay,
        isToday: i === 0
      });
    }
    return next7Days;
  };

  const scheduleData = useMemo(() => getNext7Days(services), [services]);

  const formatDate = (date: Date, isToday: boolean) => {
    const dayName = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(date);
    const dateNum = formatCzechDate(date);
    return { dayName, dateNum, isToday };
  };

  const shiftColors: Record<string, string> = {
    'Ranní': '#4CAF50',
    'Odpolední': '#2196F3',
    'Celodenní': '#FF9800'
  };

  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Plánování</p>
            <h1 className="page-title">Rozpis služeb</h1>
          </div>
        </div>

        <p className="section-title">Přehled služeb na dalších 7 dní</p>

        <div className="service-schedule-grid">
          {scheduleData.map((day) => {
            const { dayName, dateNum, isToday } = formatDate(day.dateObj, day.isToday);
            const service = day.service;

            return (
              <div
                key={day.date}
                className={`service-day-card ${isToday ? 'today' : ''}`}
              >
                <div className="day-header">
                  <div className="day-label">
                    <strong>{dayName}</strong>
                    <span className="date-num">{dateNum}</span>
                  </div>
                  {isToday && <span className="today-badge">Dnes</span>}
                </div>

                {service ? (
                  <div className="day-content">
                    <div className="service-person">{service.person}</div>
                    <div className="service-role">{service.role}</div>
                    <div
                      className="service-shift"
                      style={{ backgroundColor: shiftColors[service.shift] || '#999' }}
                    >
                      {service.shift}
                    </div>
                  </div>
                ) : (
                  <div className="day-content empty">
                    <span>Bez služby</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="service-legend">
          <h3>Legenda směn</h3>
          <div className="legend-items">
            {Object.entries(shiftColors).map(([shift, color]) => (
              <div key={shift} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: color }}></div>
                <span>{shift}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceSchedule;
