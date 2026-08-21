import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { getUserServiceCenter, normalizeServiceCenter, serviceCenters, vacationBalance } from '../utils/employeeContext';
import { formatCzechDate as formatSharedCzechDate } from '../utils/format';
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

interface LastReportPreferences {
  serviceCenter?: string;
  selectedTractor?: number;
  selectedWorkType?: number;
  attachmentNames?: string[];
}

interface LastUsedReport {
  report_id: number;
  service_center?: string;
  tractor_id?: number;
  tractor_name?: string;
  work_type_id?: number;
  work_type?: string;
  attachments?: Array<{ name?: string } | string>;
  date?: string;
}

interface ReportTimeEntry {
  id?: number;
  user_id?: number | string;
  employee_name?: string;
  date?: string;
  time_start?: string;
  time_end?: string;
  work_type?: string;
  status?: string;
  created_at?: string;
}

type ReportMode = 'work' | 'leave' | 'training';
type MessageTone = 'info' | 'success' | 'error';

const processedPercentOptions = [25, 50, 75, 100];
const defaultStartTime = '07:00';
const followUpDurationMinutes = 60;
const lastReportPreferencesKey = 'adw_last_report_preferences';
const noTractorLabel = 'Bez techniky';
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

function normalizeClockTime(value?: string) {
  return value ? value.slice(0, 5) : '';
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeClockTime(value).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function sameReportDate(reportDate: string | undefined, targetDate: string) {
  return String(reportDate ?? '').slice(0, 10) === targetDate;
}

function formatCzechDate(value: string) {
  return formatSharedCzechDate(value);
}

function getLastReportPreferences(): LastReportPreferences {
  const saved = localStorage.getItem(lastReportPreferencesKey);
  if (!saved) return {};
  try {
    return JSON.parse(saved) as LastReportPreferences;
  } catch {
    return {};
  }
}

function saveLastReportPreferences(preferences: LastReportPreferences) {
  localStorage.setItem(lastReportPreferencesKey, JSON.stringify(preferences));
}

function isElevatedRole(role?: string) {
  return ['admin', 'reditel'].includes(String(role ?? '').toLocaleLowerCase('cs'));
}

function filterTractorsForServiceCenter(tractors: Tractor[], serviceCenter: string, role?: string) {
  const normalizedCenter = normalizeServiceCenter(serviceCenter);
  const elevated = isElevatedRole(role);
  return tractors.filter((tractor) => {
    const centers = Array.isArray(tractor.service_centers) ? tractor.service_centers : [];
    return centers.includes(normalizedCenter) || (elevated && centers.length === 0);
  });
}

function isPersonalVehicle(tractor: Tractor) {
  const text = `${tractor.tractor_name} ${tractor.tractor_code} ${tractor.vehicle_type ?? ''}`.toLocaleLowerCase('cs');
  return [
    'osobní',
    'osobni',
    'auto',
    'škoda',
    'skoda',
    'octavia',
    'fabia',
    'karoq',
    'kamiq',
    'superb',
    'touareg',
    'caddy',
    'dacia',
    'kia',
    'hyundai',
    'citroen',
    'peugeot',
    'opel',
    'ford'
  ].some((word) => text.includes(word));
}

function sortTractorsForWork(tractors: Tractor[]) {
  return [...tractors].sort((first, second) => {
    const firstPersonal = isPersonalVehicle(first) ? 1 : 0;
    const secondPersonal = isPersonalVehicle(second) ? 1 : 0;
    if (firstPersonal !== secondPersonal) return firstPersonal - secondPersonal;
    return first.tractor_name.localeCompare(second.tractor_name, 'cs-CZ') ||
      first.tractor_code.localeCompare(second.tractor_code, 'cs-CZ');
  });
}

function countWeekdaysInclusive(start: string, end: string) {
  if (!start || !end) return 0;
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;
  let days = 0;
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) days += 1;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function modeWorkTypeName(mode: ReportMode) {
  if (mode === 'leave') return 'Dovolená';
  if (mode === 'training') return 'Školení';
  return '';
}

function findWorkTypeId(workTypes: WorkType[], mode: ReportMode) {
  const name = modeWorkTypeName(mode);
  return workTypes.find((item) => item.name === name)?.id;
}

function findDefaultWorkTypeId(workTypes: WorkType[]) {
  return workTypes.find((item) => !['Dovolená', 'Školení'].includes(item.name))?.id;
}

function isOtherWorkTypeId(workTypes: WorkType[], workTypeId?: number) {
  return workTypes.some((item) => item.id === workTypeId && item.name === 'Ostatní');
}

function normalizeAttachmentNamesFromReport(attachments?: LastUsedReport['attachments']) {
  if (!Array.isArray(attachments)) return [attachmentOptions[0]];
  const names = attachments
    .map((item) => typeof item === 'string' ? item : item?.name)
    .filter((name): name is string => Boolean(name && attachmentOptions.includes(name) && name !== attachmentOptions[0]))
    .slice(0, 3);
  return names.length > 0 ? names : [attachmentOptions[0]];
}

function buildAttachmentEntries(names: string[]) {
  return names.slice(0, 3).map((name, index) => ({ id: Date.now() + index + 1, name }));
}

function belongsToCurrentUser(report: ReportTimeEntry, user: ReturnType<typeof getUser>) {
  if (!user) return false;
  if (report.user_id !== undefined && report.user_id !== null) {
    return Number(report.user_id) === Number(user.id);
  }
  return report.employee_name === user.full_name;
}

function getLatestEndTimeForDate(reports: ReportTimeEntry[], targetDate: string, user: ReturnType<typeof getUser>) {
  return reports
    .filter((report) => sameReportDate(report.date, targetDate) && belongsToCurrentUser(report, user) && normalizeClockTime(report.time_end))
    .map((report) => normalizeClockTime(report.time_end))
    .sort((first, second) => timeToMinutes(second) - timeToMinutes(first))[0] ?? null;
}

function getSuggestedTimesForDate(reports: ReportTimeEntry[], targetDate: string, currentEnd: string, user: ReturnType<typeof getUser>) {
  const suggestedStart = getLatestEndTimeForDate(reports, targetDate, user) ?? defaultStartTime;
  const suggestedEnd = timeToMinutes(currentEnd) > timeToMinutes(suggestedStart)
    ? normalizeClockTime(currentEnd)
    : addMinutesToTime(suggestedStart, followUpDurationMinutes);
  return { start: suggestedStart, end: suggestedEnd };
}

function isWorkReportEntry(report: ReportTimeEntry) {
  return !['Dovolená', 'Školení'].includes(String(report.work_type ?? ''));
}

function hasWorkReportForDate(reports: ReportTimeEntry[], targetDate: string, user: ReturnType<typeof getUser>) {
  return reports.some((report) => sameReportDate(report.date, targetDate) && belongsToCurrentUser(report, user) && isWorkReportEntry(report));
}

function getDateOffsetDays(value: string) {
  const today = new Date(`${getLocalTodayDate()}T12:00:00`);
  const selected = new Date(`${value}T12:00:00`);
  if (Number.isNaN(selected.getTime())) return 0;
  return Math.round((selected.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function confirmReportDate(value: string) {
  const offsetDays = getDateOffsetDays(value);
  if (offsetDays === 0) return true;
  const direction = offsetDays > 0 ? 'do budoucnosti' : 'do minulosti';
  const days = Math.abs(offsetDays);
  const dayLabel = days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní';
  return window.confirm(`Zadáváte výkaz ${direction} o ${days} ${dayLabel}. Chcete pokračovat?`);
}

function ReportForm() {
  const user = getUser();
  const lastPreferences = useMemo(getLastReportPreferences, []);
  const initialServiceCenter = serviceCenters.includes(lastPreferences.serviceCenter ?? '')
    ? lastPreferences.serviceCenter!
    : getUserServiceCenter(user);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [reports, setReports] = useState<ReportTimeEntry[]>([]);
  const [lastUsedReport, setLastUsedReport] = useState<LastUsedReport | null>(null);
  const [selectedTractor, setSelectedTractor] = useState<number | undefined>(undefined);
  const [selectedWorkType, setSelectedWorkType] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [date, setDate] = useState(getLocalTodayDate);
  const [timeStart, setTimeStart] = useState(defaultStartTime);
  const [timeEnd, setTimeEnd] = useState('15:30');
  const [serviceCenter, setServiceCenter] = useState(initialServiceCenter);
  const [reportMode, setReportMode] = useState<ReportMode>('work');
  const [halfDayLeave, setHalfDayLeave] = useState(false);
  const [absenceStart, setAbsenceStart] = useState(getLocalTodayDate);
  const [absenceEnd, setAbsenceEnd] = useState(getLocalTodayDate);
  const [absenceNote, setAbsenceNote] = useState('');
  const [fieldEntries, setFieldEntries] = useState<FieldEntry[]>([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100 }]);
  const [attachmentEntries, setAttachmentEntries] = useState<AttachmentEntry[]>(
    (lastPreferences.attachmentNames?.length ? lastPreferences.attachmentNames : [attachmentOptions[0]])
      .slice(0, 3)
      .map((name, index) => ({ id: Date.now() + 1 + index, name }))
  );
  const [fuelEnabled, setFuelEnabled] = useState(false);
  const [fuelDate, setFuelDate] = useState(getLocalTodayDate);
  const [fuelTractorId, setFuelTractorId] = useState<number | undefined>(undefined);
  const [fuelLiters, setFuelLiters] = useState(0);
  const [fuelNote, setFuelNote] = useState('');
  const [notes, setNotes] = useState('');
  const [otherWorkNote, setOtherWorkNote] = useState('');
  const [otherUsesFields, setOtherUsesFields] = useState(false);
  const [otherUsesTractor, setOtherUsesTractor] = useState(false);
  const [otherUsesAttachments, setOtherUsesAttachments] = useState(false);
  const isOtherWorkType = workTypes.some((item) => item.id === selectedWorkType && item.name === 'Ostatní');
  const selectedModeDays = countWeekdaysInclusive(absenceStart, absenceEnd);
  const selectedAbsenceUnits = halfDayLeave && reportMode === 'leave' ? 0.5 : selectedModeDays;
  const isAbsenceOverBalance = reportMode === 'leave' && selectedAbsenceUnits > vacationBalance.daysRemaining;
  const isLongAbsence = selectedModeDays > 20;
  const availableTractors = useMemo(
    () => sortTractorsForWork(filterTractorsForServiceCenter(tractors, serviceCenter, user?.role)),
    [serviceCenter, tractors, user?.role]
  );
  const totalArea = fieldEntries.reduce((sum, entry) => sum + Number(entry.amountHa || 0), 0);
  const canAddAttachment = attachmentEntries.length < 3 && attachmentEntries[attachmentEntries.length - 1]?.name !== attachmentOptions[0];
  const lastAttachmentNames = useMemo(() => normalizeAttachmentNamesFromReport(lastUsedReport?.attachments), [lastUsedReport]);
  const hasLastAttachments = lastAttachmentNames.some((name) => name !== attachmentOptions[0]);
  const canUseLastTractor = Boolean(lastUsedReport?.tractor_id && availableTractors.some((tractor) => tractor.id === lastUsedReport.tractor_id));
  const canUseLastWorkType = Boolean(lastUsedReport?.work_type_id && workTypes.some((item) => item.id === lastUsedReport.work_type_id && !['Dovolená', 'Školení'].includes(item.name)));
  const hasUsableLastReport = Boolean(lastUsedReport && (canUseLastTractor || canUseLastWorkType || hasLastAttachments));
  const fieldsRequired = reportMode === 'work' && (!isOtherWorkType || otherUsesFields);
  const tractorRequired = reportMode === 'work' && !isOtherWorkType;
  const showFieldSelection = reportMode === 'work' && (!isOtherWorkType || otherUsesFields);
  const showTractorSelection = reportMode === 'work' && (!isOtherWorkType || otherUsesTractor);
  const showAttachmentSelection = reportMode === 'work' && (!isOtherWorkType || otherUsesAttachments);

  const showFormMessage = (text: string, tone: MessageTone = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  useEffect(() => {
    const loadMetadata = async () => {
      setMetadataLoading(true);
      const [tractorResponse, fieldResponse, workTypeResponse, reportResponse, lastUsedResponse] = await Promise.allSettled([
        client.get('/tractors'),
        client.get('/fields'),
        client.get('/work-types'),
        client.get('/reports'),
        client.get('/reports/last-used')
      ]);
      const loadedTractors = tractorResponse.status === 'fulfilled' ? tractorResponse.value.data as Tractor[] : [];
      const loadedWorkTypes = workTypeResponse.status === 'fulfilled' ? workTypeResponse.value.data as WorkType[] : [];
      const lastUsed = lastUsedResponse.status === 'fulfilled' ? lastUsedResponse.value.data as LastUsedReport | null : null;

      if (tractorResponse.status === 'fulfilled') {
        setTractors(loadedTractors);
        if (loadedTractors.length > 0) {
          const matchingTractors = sortTractorsForWork(filterTractorsForServiceCenter(loadedTractors, initialServiceCenter, user?.role));
          const preferredTractorId = matchingTractors.some((tractor) => tractor.id === lastPreferences.selectedTractor)
            ? lastPreferences.selectedTractor
            : matchingTractors[0]?.id;
          setSelectedTractor(preferredTractorId);
          setFuelTractorId(preferredTractorId);
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
        setWorkTypes(loadedWorkTypes);
        if (loadedWorkTypes.length > 0) {
          const normalWorkTypes = loadedWorkTypes.filter((item) => !['Dovolená', 'Školení'].includes(item.name));
          const preferredWorkTypeId = normalWorkTypes.some((item) => item.id === lastPreferences.selectedWorkType)
            ? lastPreferences.selectedWorkType
            : normalWorkTypes[0]?.id ?? loadedWorkTypes[0].id;
          setSelectedWorkType(preferredWorkTypeId);
        }
      } else {
        console.error(workTypeResponse.reason);
      }

      if (reportResponse.status === 'fulfilled') {
        const loadedReports = reportResponse.value.data as ReportTimeEntry[];
        const suggestedTimes = getSuggestedTimesForDate(loadedReports, date, timeEnd, user);
        setReports(loadedReports);
        setTimeStart(suggestedTimes.start);
        setTimeEnd(suggestedTimes.end);
      } else {
        console.error(reportResponse.reason);
      }

      if (lastUsed) {
        setLastUsedReport(lastUsed);
        const matchingTractors = sortTractorsForWork(filterTractorsForServiceCenter(loadedTractors, initialServiceCenter, user?.role));
        const lastTractorIsValid = lastUsed.tractor_id && matchingTractors.some((tractor) => tractor.id === lastUsed.tractor_id);
        const lastWorkTypeIsValid = lastUsed.work_type_id && loadedWorkTypes.some((item) => item.id === lastUsed.work_type_id && !['Dovolená', 'Školení'].includes(item.name));
        if (lastTractorIsValid) {
          setSelectedTractor(lastUsed.tractor_id);
          setFuelTractorId(lastUsed.tractor_id);
        }
        if (lastWorkTypeIsValid) {
          setSelectedWorkType(lastUsed.work_type_id);
        }
        setAttachmentEntries(buildAttachmentEntries(normalizeAttachmentNamesFromReport(lastUsed.attachments)));
      } else if (lastUsedResponse.status === 'rejected') {
        console.error(lastUsedResponse.reason);
      }

      if (
        tractorResponse.status === 'rejected' ||
        fieldResponse.status === 'rejected' ||
        workTypeResponse.status === 'rejected'
      ) {
        showFormMessage('Nepodařilo se načíst číselníky. Zkontrolujte prosím, že běží backend.', 'error');
      } else {
        setMessage('');
      }
      setMetadataLoading(false);
    };
    loadMetadata();
  }, []);

  useEffect(() => {
    if (metadataLoading) return;
    const firstTractorId = availableTractors[0]?.id;
    if (isOtherWorkType && !otherUsesTractor) {
      setSelectedTractor(undefined);
    } else if (!availableTractors.some((tractor) => tractor.id === selectedTractor) && !isOtherWorkType) {
      setSelectedTractor(firstTractorId);
    }
    if (!availableTractors.some((tractor) => tractor.id === fuelTractorId)) {
      setFuelTractorId(firstTractorId);
    }
  }, [availableTractors, fuelTractorId, isOtherWorkType, metadataLoading, otherUsesTractor, selectedTractor]);

  useEffect(() => {
    if (metadataLoading || fields.length === 0) return;
    if (isOtherWorkType) {
      setOtherUsesFields(false);
      setOtherUsesTractor(false);
      setOtherUsesAttachments(false);
      setSelectedTractor(undefined);
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100 }]);
      setAttachmentEntries([{ id: Date.now() + 1, name: attachmentOptions[0] }]);
      return;
    }
    const hasSelectedField = fieldEntries.some((entry) => entry.fieldId);
    if (!hasSelectedField) {
      const firstFieldId = fields[0].id;
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100 }]);
    }
  }, [fields, isOtherWorkType, metadataLoading]);

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    const suggestedTimes = getSuggestedTimesForDate(reports, nextDate, timeEnd, user);
    setDate(nextDate);
    setAbsenceStart(nextDate);
    setAbsenceEnd(nextDate);
    setFuelDate(nextDate);
    setTimeStart(suggestedTimes.start);
    setTimeEnd(suggestedTimes.end);
  };

  const selectReportMode = (mode: ReportMode) => {
    if (reportMode === mode) {
      setReportMode('work');
      setHalfDayLeave(false);
      const workTypeId = findDefaultWorkTypeId(workTypes);
      if (workTypeId !== undefined) setSelectedWorkType(workTypeId);
      return;
    }
    setReportMode(mode);
    if (mode !== 'leave') setHalfDayLeave(false);
    const workTypeId = findWorkTypeId(workTypes, mode);
    if (workTypeId !== undefined) setSelectedWorkType(workTypeId);
  };

  const handleAbsenceStartChange = (value: string) => {
    setAbsenceStart(value);
    if (absenceEnd < value) setAbsenceEnd(value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showFormMessage('Kontroluji výkaz...', 'info');
    if (!confirmReportDate(reportMode === 'work' ? date : absenceStart)) {
      showFormMessage('Uložení bylo zrušeno.', 'info');
      return;
    }
    if (reportMode !== 'work') {
      const specialName = modeWorkTypeName(reportMode);
      const specialWorkType = workTypes.find((item) => item.name === specialName);
      if (!specialWorkType) {
        showFormMessage(`Číselník neobsahuje typ práce ${specialName}. Kontaktujte prosím správce aplikace.`, 'error');
        return;
      }
      if (!absenceStart || !absenceEnd || selectedModeDays <= 0) {
        showFormMessage('Vyberte platné datum od a do.', 'error');
        return;
      }
      if (reportMode === 'leave' && halfDayLeave) {
        if (absenceStart !== absenceEnd) {
          showFormMessage('Půldenní dovolená může být zadaná jen na jeden den.', 'error');
          return;
        }
        if (!hasWorkReportForDate(reports, absenceStart, user)) {
          showFormMessage('Půldenní dovolenou lze uložit až po zadání pracovní činnosti ve stejný den.', 'error');
          return;
        }
      }

      const title = reportMode === 'leave' ? 'Dovolená' : 'Školení';
      const extendedNotes = [
        `Středisko: ${serviceCenter}`,
        `${title}: ${formatCzechDate(absenceStart)} až ${formatCzechDate(absenceEnd)}`,
        `Počet pracovních dní: ${selectedAbsenceUnits}`,
        reportMode === 'leave' && halfDayLeave ? 'Půldenní dovolená: ano' : '',
        isLongAbsence ? 'Upozornění: nestandardně dlouhé období.' : '',
        isAbsenceOverBalance ? `Upozornění: zadáno více dní dovolené, než je aktuální zůstatek ${vacationBalance.daysRemaining}.` : '',
        absenceNote ? `Poznámka: ${absenceNote}` : ''
      ].filter(Boolean).join('\n');

      try {
        showFormMessage(`Ukládám ${title.toLocaleLowerCase('cs-CZ')}...`, 'info');
        const response = await client.post('/reports', {
          report_number: `RPT-${Date.now()}`,
          report_kind: reportMode,
          tractor_id: null,
          user_id: user?.id ?? 1,
          employee_name: user?.full_name,
          service_center: serviceCenter,
          field_id: null,
          field_entries: [],
          work_type_id: specialWorkType.id,
          date: absenceStart,
          time_start: null,
          time_end: null,
          break_hours: 0,
          hours_worked: reportMode === 'leave' && halfDayLeave ? 4 : selectedModeDays * 8,
          amount_ha: 0,
          fuel_liters: 0,
          attachments: [],
          notes: extendedNotes
        });
        const submittedReport: ReportTimeEntry = {
          id: response.data?.id,
          user_id: user?.id ?? 1,
          employee_name: user?.full_name,
          date: absenceStart,
          work_type: specialName,
          created_at: new Date().toISOString()
        };
        setReports((items) => [...items, submittedReport]);
        showFormMessage(`${title} byla uložena v rozsahu ${formatCzechDate(absenceStart)} až ${formatCzechDate(absenceEnd)}.`, 'success');
        window.alert(`${title} byla vytvořena.`);
      } catch (error) {
        console.error(error);
        showFormMessage(`${title} se nepodařilo uložit. Zkontrolujte datum a zkuste to znovu.`, 'error');
      }
      return;
    }

    const selectedFields = fieldEntries.filter((entry) => entry.fieldId);
    if (tractorRequired && (availableTractors.length === 0 || !selectedTractor)) {
      showFormMessage('Pro toto středisko není dostupná žádná technika.', 'error');
      return;
    }
    if ((fieldsRequired && selectedFields.length === 0) || !selectedWorkType) {
      showFormMessage('Vyplňte prosím všechny povinné položky.', 'error');
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
      .filter((entry) => showAttachmentSelection && entry.name && entry.name !== attachmentOptions[0])
      .map((entry, index) => ({ order: index + 1, name: entry.name }));
    const extendedNotes = [
      `Středisko: ${serviceCenter}`,
      fieldSummary.length ? `Pozemky: ${fieldSummary.map((item) => `${item.field_name} (${item.field_code}) - ${item.amount_ha} ha`).join('; ')}` : 'Pozemky: bez pozemku',
      isOtherWorkType ? `Technika: ${selectedTractor ? (availableTractors.find((tractor) => tractor.id === selectedTractor)?.tractor_name ?? 'zvolená technika') : noTractorLabel}` : '',
      `Přípojné zařízení: ${attachmentSummary.length ? attachmentSummary.map((item) => item.name).join('; ') : 'bez přípojného zařízení'}`,
      fuelEnabled && fuelLiters > 0 ? `Tankování PHM: ${fuelLiters} l dne ${fuelDate}` : '',
      isOtherWorkType && otherWorkNote ? `Poznámka k Ostatní práci: ${otherWorkNote}` : '',
      notes ? `Poznámka: ${notes}` : ''
    ].filter(Boolean).join('\n');

    try {
      showFormMessage('Ukládám pracovní výkaz...', 'info');
      const response = await client.post('/reports', {
        report_number: `RPT-${Date.now()}`,
        tractor_id: showTractorSelection ? selectedTractor ?? null : null,
        user_id: user?.id ?? 1,
        employee_name: user?.full_name,
        service_center: serviceCenter,
        field_id: selectedFields[0]?.fieldId ?? null,
        field_entries: fieldSummary,
        work_type_id: selectedWorkType,
        date,
        time_start: `${timeStart}:00`,
        time_end: `${timeEnd}:00`,
        break_hours: 0,
        hours_worked: Math.max(0, (Number(timeEnd.slice(0, 2)) + Number(timeEnd.slice(3, 5)) / 60) - (Number(timeStart.slice(0, 2)) + Number(timeStart.slice(3, 5)) / 60)),
        amount_ha: fieldSummary.reduce((sum, item) => sum + Number(item.amount_ha || 0), 0),
        fuel_liters: 0,
        fuel_entry: fuelEnabled && fuelLiters > 0 ? {
          date: fuelDate,
          tractor_id: fuelTractorId ?? selectedTractor ?? null,
          user_id: user?.id ?? 1,
          liters: fuelLiters,
          note: fuelNote
        } : undefined,
        attachments: attachmentSummary,
        notes: extendedNotes
      });
      const nextStart = normalizeClockTime(timeEnd);
      const nextEnd = addMinutesToTime(nextStart, followUpDurationMinutes);
      const submittedReport: ReportTimeEntry = {
        id: response.data?.id,
        user_id: user?.id ?? 1,
        employee_name: user?.full_name,
        date,
        time_start: `${normalizeClockTime(timeStart)}:00`,
        time_end: `${nextStart}:00`,
        work_type: workTypes.find((item) => item.id === selectedWorkType)?.name,
        created_at: new Date().toISOString()
      };
      setLastUsedReport({
        report_id: response.data?.id,
        service_center: serviceCenter,
        tractor_id: showTractorSelection ? selectedTractor : undefined,
        tractor_name: showTractorSelection ? availableTractors.find((tractor) => tractor.id === selectedTractor)?.tractor_name : undefined,
        work_type_id: selectedWorkType,
        work_type: workTypes.find((item) => item.id === selectedWorkType)?.name,
        attachments: attachmentSummary,
        date
      });
      setReports((items) => [...items, submittedReport]);
      setTimeStart(nextStart);
      setTimeEnd(nextEnd);
      saveLastReportPreferences({
        serviceCenter,
        selectedTractor: showTractorSelection ? selectedTractor : undefined,
        selectedWorkType,
        attachmentNames: showAttachmentSelection ? attachmentEntries.map((entry) => entry.name) : [attachmentOptions[0]]
      });
      showFormMessage(`Výkaz byl uložen. Další práce navazuje od ${nextStart}.`, 'success');
      window.alert('Výkaz byl vytvořen.');
    } catch (error) {
      console.error(error);
      showFormMessage('Výkaz se nepodařilo uložit. Zkontrolujte vyplněné údaje a zkuste to znovu.', 'error');
    }
  };

  const handleSelectTractor = (event: ChangeEvent<HTMLSelectElement>) => {
    const tractorId = event.target.value ? Number(event.target.value) : undefined;
    setSelectedTractor(tractorId);
    setFuelTractorId(tractorId);
  };

  const handleSelectWorkType = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextWorkType = Number(event.target.value);
    setSelectedWorkType(nextWorkType);
    if (isOtherWorkTypeId(workTypes, nextWorkType)) {
      setOtherUsesFields(false);
      setOtherUsesTractor(false);
      setOtherUsesAttachments(false);
      setSelectedTractor(undefined);
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100 }]);
      setAttachmentEntries([{ id: Date.now() + 1, name: attachmentOptions[0] }]);
      return;
    }
    setOtherUsesFields(false);
    setOtherUsesTractor(false);
    setOtherUsesAttachments(false);
    if (!availableTractors.some((tractor) => tractor.id === selectedTractor)) {
      setSelectedTractor(availableTractors[0]?.id);
    }
    const hasSelectedField = fieldEntries.some((entry) => entry.fieldId);
    if (!hasSelectedField && fields.length > 0) {
      const firstFieldId = fields[0].id;
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100 }]);
    }
  };
  const applyLastUsedTractor = () => {
    if (!lastUsedReport?.tractor_id || !canUseLastTractor) {
      showFormMessage('Techniku z posledního výkazu nelze pro toto středisko převzít.', 'error');
      return;
    }
    setSelectedTractor(lastUsedReport.tractor_id);
    setFuelTractorId(lastUsedReport.tractor_id);
    showFormMessage('Technika byla převzata z posledního výkazu.', 'success');
  };
  const applyLastUsedAttachments = () => {
    if (!hasLastAttachments) {
      showFormMessage('Z posledního výkazu není dostupné přípojné zařízení.', 'error');
      return;
    }
    setAttachmentEntries(buildAttachmentEntries(lastAttachmentNames));
    showFormMessage('Přípojné zařízení bylo převzato z posledního výkazu.', 'success');
  };
  const updateFieldEntry = (entryId: number, changes: Partial<FieldEntry>) => {
    setFieldEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  };
  const getAvailableFields = (currentEntryId: number) => {
    const selectedFieldIds = fieldEntries
      .filter((entry) => entry.id !== currentEntryId && entry.fieldId !== undefined)
      .map((entry) => entry.fieldId);
    return fields.filter((field) => !selectedFieldIds.includes(field.id));
  };
  const addFieldEntry = () => {
    const availableFields = getAvailableFields(-1);
    const firstFieldId = availableFields[0]?.id;
    if (firstFieldId !== undefined) {
      setFieldEntries((entries) => [...entries, { id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100 }]);
    }
  };
  const removeFieldEntry = (entryId: number) => {
    if (!window.confirm('Opravdu chcete odebrat tento pozemek z výkazu?')) return;
    setFieldEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.id !== entryId) : entries);
  };
  const updateAttachmentEntry = (entryId: number, name: string) => {
    setAttachmentEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, name } : entry));
  };
  const addAttachmentEntry = () => {
    if (!canAddAttachment) return;
    setAttachmentEntries((entries) => [...entries, { id: Date.now(), name: attachmentOptions[0] }]);
  };
  const enableOtherFields = (enabled: boolean) => {
    setOtherUsesFields(enabled);
    if (enabled && fields.length > 0 && !fieldEntries.some((entry) => entry.fieldId)) {
      const firstFieldId = fields[0].id;
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100 }]);
    }
    if (!enabled) {
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100 }]);
    }
  };
  const enableOtherTractor = (enabled: boolean) => {
    setOtherUsesTractor(enabled);
    if (!enabled) {
      setSelectedTractor(undefined);
    }
  };
  const enableOtherAttachments = (enabled: boolean) => {
    setOtherUsesAttachments(enabled);
    if (!enabled) {
      setAttachmentEntries([{ id: Date.now(), name: attachmentOptions[0] }]);
    }
  };
  const removeAttachmentEntry = (entryId: number) => {
    if (!window.confirm('Opravdu chcete odebrat toto přípojné zařízení z výkazu?')) return;
    setAttachmentEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.id !== entryId) : entries);
  };

  return (
    <div className="container">
      <div className="card report-card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Výkazy</p>
            <h1 className="page-title">Nový pracovní výkaz</h1>
          </div>
        </div>
        <div className="report-summary-strip">
          <span>{formatCzechDate(date)}</span>
          <strong>{totalArea.toFixed(2)} ha</strong>
          <span>{timeStart}-{timeEnd}</span>
        </div>
        {!metadataLoading && !hasUsableLastReport ? (
          <p className="field-hint field-hint--inline">Zatím není dostupný předchozí výkaz pro předvyplnění.</p>
        ) : null}
        {message ? <p className={`form-message form-message--${messageTone}`} role="status" aria-live="polite">{message}</p> : null}
        <form onSubmit={handleSubmit} className="report-form">
          <section className="report-section">
            <h2>Čas práce</h2>
            <div className="time-grid">
              <div className="field-row">
                <label htmlFor="date">Datum</label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                />
              </div>
              <div className="field-row">
                <label htmlFor="from">Od</label>
                <input id="from" type="time" min="07:00" max="15:30" value={timeStart} onChange={(event: ChangeEvent<HTMLInputElement>) => setTimeStart(event.target.value)} />
              </div>
              <div className="field-row">
                <label htmlFor="to">Do</label>
                <input id="to" type="time" min="07:00" max="15:30" value={timeEnd} onChange={(event: ChangeEvent<HTMLInputElement>) => setTimeEnd(event.target.value)} />
              </div>
            </div>
          </section>

          <section className="report-section">
            <h2>Středisko</h2>
              <div className="field-row">
              <label className="sr-only" htmlFor="serviceCenter">Středisko</label>
                <select
                  id="serviceCenter"
                  value={serviceCenter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setServiceCenter(event.target.value)}
                >
                {serviceCenters.map((center) => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="report-section report-section--compact">
            <h2>Typ práce</h2>
            <div className="report-mode-row">
              <div className="field-row">
                <label className="sr-only" htmlFor="workType">Typ práce</label>
                <select
                  id="workType"
                  value={reportMode === 'work' ? selectedWorkType ?? '' : selectedWorkType ?? ''}
                  onChange={(event) => {
                    setReportMode('work');
                    handleSelectWorkType(event);
                  }}
                >
                  {reportMode !== 'work' && selectedWorkType ? <option value={selectedWorkType}>{modeWorkTypeName(reportMode)}</option> : null}
                  {metadataLoading && <option value="">Načítám typy prací...</option>}
                  {!metadataLoading && workTypes.length === 0 && <option value="">Žádné typy prací</option>}
                  {workTypes.filter((item) => !['Dovolená', 'Školení'].includes(item.name)).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="quick-mode-actions" aria-label="Rychlé typy výkazu">
                <button
                  type="button"
                  className={`quick-mode-button ${reportMode === 'leave' ? 'active' : ''}`}
                  onClick={() => selectReportMode('leave')}
                >
                  <strong>Dovolená</strong>
                </button>
                <button
                  type="button"
                  className={`quick-mode-button ${reportMode === 'training' ? 'active' : ''}`}
                  onClick={() => selectReportMode('training')}
                >
                  <strong>Školení</strong>
                </button>
              </div>
            </div>
          </section>

          {reportMode !== 'work' ? (
            <section className="report-section special-report-panel">
              <div className="special-report-heading">
                <div>
                  <h2>{reportMode === 'leave' ? 'Dovolená' : 'Školení'}</h2>
                </div>
                {reportMode === 'leave' ? (
                  <div className="vacation-balance-card">
                    <span>Zbývá dovolené</span>
                    <strong>{vacationBalance.daysRemaining} dní</strong>
                    <small>platné k {formatCzechDate(vacationBalance.validTo)}</small>
                  </div>
                ) : null}
              </div>
              <div className="field-grid special-date-grid">
                <div className="field-row">
                  <label htmlFor="absenceStart">Od dne</label>
                  <input id="absenceStart" type="date" value={absenceStart} onChange={(event) => handleAbsenceStartChange(event.target.value)} />
                  <small className="date-format-hint">{formatCzechDate(absenceStart)}</small>
                </div>
                <div className="field-row">
                  <label htmlFor="absenceEnd">Do dne</label>
                  <input id="absenceEnd" type="date" min={absenceStart} value={absenceEnd} onChange={(event) => setAbsenceEnd(event.target.value)} />
                  <small className="date-format-hint">{formatCzechDate(absenceEnd)}</small>
                </div>
                <div className="absence-days-box">
                  <span>Pracovní dny</span>
                  <strong>{selectedAbsenceUnits}</strong>
                </div>
              </div>
              {reportMode === 'leave' ? (
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={halfDayLeave}
                    onChange={(event) => setHalfDayLeave(event.target.checked)}
                  />
                  Půldenní dovolená
                </label>
              ) : null}
              {(isLongAbsence || isAbsenceOverBalance) ? (
                <div className="absence-warning">
                  {isLongAbsence ? <span>Období má {selectedModeDays} pracovních dní. To je nestandardně dlouhé, zkontrolujte prosím datum od-do.</span> : null}
                  {isAbsenceOverBalance ? <span>Zadáváte více dovolené, než je aktuální zůstatek {vacationBalance.daysRemaining} dní. Uvidí to i schvalovatel.</span> : null}
                </div>
              ) : null}
              <div className="field-row">
                <label htmlFor="absenceNote">Poznámka</label>
                <textarea id="absenceNote" rows={4} value={absenceNote} onChange={(event) => setAbsenceNote(event.target.value)} />
              </div>
            </section>
          ) : null}

          {reportMode === 'work' && isOtherWorkType ? (
            <section className="report-section">
              <h2>Ostatní práce</h2>
              <div className="field-row">
                <label htmlFor="otherWorkNote">Poznámka k Ostatní práci</label>
                <textarea
                  id="otherWorkNote"
                  rows={3}
                  value={otherWorkNote}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setOtherWorkNote(event.target.value)}
                />
              </div>
            </section>
          ) : null}

          {reportMode === 'work' ? (
            <>
          <section className="report-section">
            <div className="section-line">
              <h2>Pozemky</h2>
            </div>
            {isOtherWorkType ? (
              <label className="toggle-row">
                <input type="checkbox" checked={otherUsesFields} onChange={(event) => enableOtherFields(event.target.checked)} />
                Práce probíhala na pozemku
              </label>
            ) : null}
            {showFieldSelection ? (
              <>
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
                          {!metadataLoading && getAvailableFields(entry.id).length === 0 && <option value="">Žádná dostupná pole</option>}
                          {getAvailableFields(entry.id).map((item) => (
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
                <button type="button" className="secondary add-row-button" onClick={addFieldEntry}>Přidat pole</button>
              </>
            ) : (
              <p className="field-hint">U typu práce Ostatní není pozemek povinný.</p>
            )}
          </section>

          <section className="report-section">
            <div className="section-line">
              <h2>Technika</h2>
              {canUseLastTractor ? (
                <button type="button" className="secondary" onClick={applyLastUsedTractor}>
                  Převzít z posledního výkazu
                </button>
              ) : null}
            </div>
            {isOtherWorkType ? (
              <label className="toggle-row">
                <input type="checkbox" checked={otherUsesTractor} onChange={(event) => enableOtherTractor(event.target.checked)} />
                Práce probíhala s technikou
              </label>
            ) : null}
            {showTractorSelection ? (
              <div className="field-grid">
                <div className="field-row">
                  <label className="sr-only" htmlFor="tractor">Technika</label>
                  <select id="tractor" value={selectedTractor ?? ''} onChange={handleSelectTractor}>
                    {isOtherWorkType ? <option value="">{noTractorLabel}</option> : null}
                    {metadataLoading && <option value="">Načítám traktory...</option>}
                    {!metadataLoading && availableTractors.length === 0 && <option value="">Pro toto středisko není dostupná žádná technika</option>}
                    {availableTractors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tractor_code && item.tractor_code !== item.tractor_name ? `${item.tractor_name} (${item.tractor_code})` : item.tractor_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="field-hint">U typu práce Ostatní není technika povinná.</p>
            )}
          </section>

          <section className="report-section">
            <h2>Tankování PHM</h2>
            <label className="toggle-row">
              <input type="checkbox" checked={fuelEnabled} onChange={(event) => setFuelEnabled(event.target.checked)} />
              Dnes proběhlo tankování
            </label>
            {fuelEnabled ? (
              <div className="field-grid">
                <div className="field-row">
                  <label htmlFor="fuelDate">Datum tankování</label>
                  <input id="fuelDate" type="date" value={fuelDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setFuelDate(event.target.value)} />
                </div>
                <div className="field-row">
                  <label htmlFor="fuelTractor">Stroj</label>
                  <select id="fuelTractor" value={fuelTractorId ?? selectedTractor ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFuelTractorId(Number(event.target.value))}>
                    {availableTractors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tractor_code && item.tractor_code !== item.tractor_name ? `${item.tractor_name} (${item.tractor_code})` : item.tractor_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row field-row--compact">
                  <label htmlFor="fuelLiters">Natankováno (l)</label>
                  <input
                    id="fuelLiters"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="0"
                    value={fuelLiters > 0 ? fuelLiters : ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setFuelLiters(event.target.value === '' ? 0 : Number(event.target.value))}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="fuelNote">Poznámka k tankování</label>
                  <input id="fuelNote" value={fuelNote} onChange={(event: ChangeEvent<HTMLInputElement>) => setFuelNote(event.target.value)} />
                </div>
              </div>
            ) : null}
          </section>

          <section className="report-section">
            <div className="section-line">
              <h2>Přípojné zařízení</h2>
              {hasLastAttachments ? (
                <button type="button" className="secondary" onClick={applyLastUsedAttachments}>
                  Převzít z posledního výkazu
                </button>
              ) : null}
            </div>
            {isOtherWorkType ? (
              <label className="toggle-row">
                <input type="checkbox" checked={otherUsesAttachments} onChange={(event) => enableOtherAttachments(event.target.checked)} />
                Práce probíhala s přípojným zařízením
              </label>
            ) : null}
            {showAttachmentSelection ? (
              <>
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
                {attachmentEntries.length < 3 ? (
                  <button type="button" className="secondary add-row-button" onClick={addAttachmentEntry} disabled={!canAddAttachment}>
                    Přidat zařízení
                  </button>
                ) : null}
                <p className="field-hint">Lze přidat maximálně 3 přípojná zařízení.</p>
              </>
            ) : (
              <p className="field-hint">U typu práce Ostatní není přípojné zařízení povinné.</p>
            )}
          </section>

          <section className="report-section">
            <h2>Doplňující údaje</h2>
            <div className="field-row">
              <label htmlFor="notes">Poznámka</label>
              <textarea id="notes" rows={4} value={notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} />
            </div>
          </section>
            </>
          ) : null}

          <div className="form-footer">
            {message ? <p className={`form-message form-message--${messageTone}`} role="status" aria-live="polite">{message}</p> : null}
            <button type="submit" className="primary">{reportMode === 'work' ? 'Uložit a odeslat' : `Uložit ${reportMode === 'leave' ? 'dovolenou' : 'školení'}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;
