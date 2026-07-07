import { useEffect, useState, useMemo } from 'react';
import { formatCzechDate } from '../utils/format';

interface ServiceContact {
  person: string;
  contact_name?: string;
  phone?: string;
}

interface ServiceEntry {
  date: string;
  workshop?: ServiceContact | null;
  bps_service?: ServiceContact | null;
  bps_feeding?: ServiceContact | null;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function phoneHref(phone?: string) {
  const normalized = String(phone ?? '').replace(/\s/g, '');
  return normalized ? `tel:+420${normalized.replace(/^\+?420/, '')}` : '';
}

function sameContact(first?: ServiceContact | null, second?: ServiceContact | null) {
  if (!first || !second) return false;
  return (first.phone && first.phone === second.phone) || (first.contact_name ?? first.person) === (second.contact_name ?? second.person);
}

function serviceLabel(contact?: ServiceContact | null) {
  return contact?.contact_name ?? contact?.person ?? 'Bez služby';
}

function ServiceLine({ label, contact }: { label: string; contact?: ServiceContact | null }) {
  if (!contact) {
    return (
      <div className="service-line service-line--empty">
        <span>{label}</span>
        <strong>Bez služby</strong>
      </div>
    );
  }

  return (
    <div className="service-line">
      <span>{label}</span>
      <strong>{serviceLabel(contact)}</strong>
      {contact.phone ? <a className="call-action" href={phoneHref(contact.phone)} aria-label={`Volat ${serviceLabel(contact)}`}>Volat</a> : null}
    </div>
  );
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
      const dateStr = toLocalDateKey(date);

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
            const singleBpsContact = service ? sameContact(service.bps_service, service.bps_feeding) : false;

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
                  <div className="day-content service-combined-list">
                    <ServiceLine label="Dílna" contact={service.workshop} />
                    {singleBpsContact ? (
                      <ServiceLine label="BPS" contact={service.bps_service} />
                    ) : (
                      <>
                        <ServiceLine label="BPS služba" contact={service.bps_service} />
                        <ServiceLine label="BPS krmení" contact={service.bps_feeding} />
                      </>
                    )}
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
      </div>
    </div>
  );
}

export default ServiceSchedule;
