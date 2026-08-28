import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { getUserServiceCenter, normalizeServiceCenter, serviceCenters, vacationBalance } from '../utils/employeeContext';
import { formatCzechDate as formatSharedCzechDate } from '../utils/format';
import { AttachmentDevice, FieldRecord, Tractor, WorkType } from '../types';

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
  fieldSearch?: string;
}

interface AttachmentEntry {
  id: number;
  attachmentId?: number;
  attachmentSearch?: string;
}

interface LastReportPreferences {
  serviceCenter?: string;
  selectedTractor?: number;
  selectedWorkType?: number;
  attachmentIds?: number[];
  attachmentNames?: string[];
}

interface LastUsedReport {
  report_id: number;
  service_center?: string;
  tractor_id?: number;
  tractor_name?: string;
  work_type_id?: number;
  work_type?: string;
  attachments?: Array<{ id?: number; attachment_id?: number; attachment_code?: string; name?: string; attachment_name?: string; license_plate?: string } | string>;
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

type ReportMode = 'work' | 'leave' | 'training' | 'doctor' | 'blood';
type MessageTone = 'info' | 'success' | 'error';

const processedPercentOptions = [25, 50, 75, 100];
const defaultStartTime = '07:00';
const followUpDurationMinutes = 60;
const lastReportPreferencesKey = 'adw_last_report_preferences';
const noTractorLabel = 'Bez techniky';
const noAttachmentLabel = 'Bez přípojného zařízení';

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

function isEndAfterStart(start: string, end: string) {
  return timeToMinutes(end) > timeToMinutes(start);
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
  if (mode === 'doctor') return 'Doktor';
  if (mode === 'blood') return 'Darování krve';
  return '';
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function fieldSearchText(field: FieldRecord) {
  return normalizeSearch(`${field.field_name} ${field.field_code} ${field.quadrant ?? ''} ${field.crop ?? ''}`);
}

function tractorSearchText(tractor: Tractor) {
  return normalizeSearch(`${tractor.tractor_name} ${tractor.tractor_code} ${tractor.vehicle_type ?? ''}`);
}

function attachmentSearchText(attachment: AttachmentDevice) {
  return normalizeSearch(`${attachment.attachment_name} ${attachment.license_plate ?? ''} ${attachment.attachment_code ?? ''}`);
}

function formatAttachmentForWorker(attachment?: AttachmentDevice) {
  if (!attachment) return noAttachmentLabel;
  return attachment.license_plate ? `${attachment.attachment_name} (${attachment.license_plate})` : attachment.attachment_name;
}

function workTypeSearchText(workType: WorkType) {
  return normalizeSearch(`${workType.name} ${workType.description ?? ''}`);
}

function findWorkTypeId(workTypes: WorkType[], mode: ReportMode) {
  const name = modeWorkTypeName(mode);
  return workTypes.find((item) => item.name === name)?.id;
}

function findDefaultWorkTypeId(workTypes: WorkType[]) {
  return workTypes.find((item) => !['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(item.name))?.id;
}

function isOtherWorkTypeId(workTypes: WorkType[], workTypeId?: number) {
  return workTypes.some((item) => item.id === workTypeId && item.name === 'Ostatní');
}

function normalizeAttachmentIdsFromReport(reportAttachments: LastUsedReport['attachments'], attachments: AttachmentDevice[]) {
  if (!Array.isArray(reportAttachments)) return [];
  return reportAttachments
    .map((item) => {
      if (typeof item === 'string') {
        return attachments.find((attachment) => formatAttachmentForWorker(attachment) === item || attachment.attachment_name === item)?.id;
      }
      const rawId = item?.attachment_id ?? item?.id;
      if (rawId && attachments.some((attachment) => Number(attachment.id) === Number(rawId))) return Number(rawId);
      const rawName = item?.attachment_name ?? item?.name;
      return attachments.find((attachment) => attachment.attachment_name === rawName)?.id;
    })
    .filter((id): id is number => Boolean(id))
    .slice(0, 3);
}

function buildAttachmentEntries(attachmentIds: number[]) {
  const entries = attachmentIds.slice(0, 3).map((attachmentId, index) => ({ id: Date.now() + index + 1, attachmentId, attachmentSearch: '' }));
  return entries.length > 0 ? entries : [{ id: Date.now() + 1, attachmentId: undefined, attachmentSearch: '' }];
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
  return !['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(String(report.work_type ?? ''));
}

function reportTimeRange(report: ReportTimeEntry) {
  const start = normalizeClockTime(report.time_start);
  const end = normalizeClockTime(report.time_end);
  if (start && end) return { start, end };
  const type = String(report.work_type ?? '');
  if (['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(type)) return { start: '07:00', end: '15:00' };
  return null;
}

function hasTimeOverlap(reports: ReportTimeEntry[], targetDate: string, start: string, end: string, user: ReturnType<typeof getUser>) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return reports.some((report) => {
    if (!sameReportDate(report.date, targetDate) || !belongsToCurrentUser(report, user)) return false;
    const range = reportTimeRange(report);
    if (!range) return false;
    return timeToMinutes(range.start) < endMinutes && timeToMinutes(range.end) > startMinutes;
  });
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

function confirmReportSubmit(message: string) {
  return window.confirm(message);
}

function ReportForm() {
  const navigate = useNavigate();
  const user = getUser();
  const lastPreferences = useMemo(getLastReportPreferences, []);
  const initialServiceCenter = serviceCenters.includes(lastPreferences.serviceCenter ?? '')
    ? lastPreferences.serviceCenter!
    : getUserServiceCenter(user);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDevice[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [reports, setReports] = useState<ReportTimeEntry[]>([]);
  const [lastUsedReport, setLastUsedReport] = useState<LastUsedReport | null>(null);
  const [selectedTractor, setSelectedTractor] = useState<number | undefined>(undefined);
  const [tractorSearch, setTractorSearch] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState<number | undefined>(undefined);
  const [workTypeSearch, setWorkTypeSearch] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState(getLocalTodayDate);
  const [timeStart, setTimeStart] = useState(defaultStartTime);
  const [timeEnd, setTimeEnd] = useState('15:30');
  const [serviceCenter, setServiceCenter] = useState(initialServiceCenter);
  const [reportMode, setReportMode] = useState<ReportMode>('work');
  const [specialOptionsOpen, setSpecialOptionsOpen] = useState(false);
  const [halfDayLeave, setHalfDayLeave] = useState(false);
  const [absenceStart, setAbsenceStart] = useState(getLocalTodayDate);
  const [absenceEnd, setAbsenceEnd] = useState(getLocalTodayDate);
  const [doctorHours, setDoctorHours] = useState<4 | 8>(4);
  const [doctorStart, setDoctorStart] = useState(defaultStartTime);
  const [absenceNote, setAbsenceNote] = useState('');
  const [fieldEntries, setFieldEntries] = useState<FieldEntry[]>([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100, fieldSearch: '' }]);
  const [attachmentEntries, setAttachmentEntries] = useState<AttachmentEntry[]>(
    buildAttachmentEntries(lastPreferences.attachmentIds ?? [])
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
  const serviceCenterUsesFields = normalizeServiceCenter(serviceCenter) === 'Rostlinná výroba';
  const selectedModeDays = countWeekdaysInclusive(absenceStart, absenceEnd);
  const selectedAbsenceUnits = halfDayLeave && reportMode === 'leave' ? 0.5 : selectedModeDays;
  const doctorEnd = doctorHours === 8 ? '15:00' : addMinutesToTime(doctorStart, 4 * 60);
  const doctorTimeStart = doctorHours === 8 ? defaultStartTime : doctorStart;
  const isAbsenceOverBalance = reportMode === 'leave' && selectedAbsenceUnits > vacationBalance.daysRemaining;
  const isLongAbsence = selectedModeDays > 20;
  const availableTractors = useMemo(
    () => sortTractorsForWork(tractors),
    [tractors]
  );
  const visibleTractors = useMemo(() => {
    const query = normalizeSearch(tractorSearch.trim());
    if (!query) return availableTractors;
    return availableTractors.filter((tractor) => tractorSearchText(tractor).includes(query));
  }, [availableTractors, tractorSearch]);
  const normalWorkTypes = useMemo(
    () => workTypes.filter((item) => !['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(item.name)),
    [workTypes]
  );
  const visibleWorkTypes = useMemo(() => {
    const query = normalizeSearch(workTypeSearch.trim());
    if (!query) return normalWorkTypes;
    return normalWorkTypes.filter((item) => workTypeSearchText(item).includes(query));
  }, [normalWorkTypes, workTypeSearch]);
  const totalArea = fieldEntries.reduce((sum, entry) => sum + Number(entry.amountHa || 0), 0);
  const canAddAttachment = attachmentEntries.length < 3 && Boolean(attachmentEntries[attachmentEntries.length - 1]?.attachmentId);
  const lastAttachmentIds = useMemo(() => normalizeAttachmentIdsFromReport(lastUsedReport?.attachments, attachments), [attachments, lastUsedReport]);
  const hasLastAttachments = lastAttachmentIds.length > 0;
  const canUseLastTractor = Boolean(lastUsedReport?.tractor_id && availableTractors.some((tractor) => tractor.id === lastUsedReport.tractor_id));
  const canUseLastWorkType = Boolean(lastUsedReport?.work_type_id && normalWorkTypes.some((item) => item.id === lastUsedReport.work_type_id));
  const hasUsableLastReport = Boolean(lastUsedReport && (canUseLastTractor || canUseLastWorkType || hasLastAttachments));
  const fieldsRequired = reportMode === 'work' && serviceCenterUsesFields && (!isOtherWorkType || otherUsesFields);
  const showFieldSelection = reportMode === 'work' && serviceCenterUsesFields && (!isOtherWorkType || otherUsesFields);
  const showTractorSelection = reportMode === 'work' && (!isOtherWorkType || otherUsesTractor);
  const showAttachmentSelection = reportMode === 'work' && (!isOtherWorkType || otherUsesAttachments);

  const showFormMessage = (text: string, tone: MessageTone = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  useEffect(() => {
    const loadMetadata = async () => {
      setMetadataLoading(true);
      const [tractorResponse, fieldResponse, workTypeResponse, attachmentResponse, reportResponse, lastUsedResponse] = await Promise.allSettled([
        client.get('/tractors'),
        client.get('/fields'),
        client.get('/work-types'),
        client.get('/attachments'),
        client.get('/reports'),
        client.get('/reports/last-used')
      ]);
      const loadedTractors = tractorResponse.status === 'fulfilled' ? tractorResponse.value.data as Tractor[] : [];
      const loadedWorkTypes = workTypeResponse.status === 'fulfilled' ? workTypeResponse.value.data as WorkType[] : [];
      const loadedAttachments = attachmentResponse.status === 'fulfilled' ? attachmentResponse.value.data as AttachmentDevice[] : [];
      const lastUsed = lastUsedResponse.status === 'fulfilled' ? lastUsedResponse.value.data as LastUsedReport | null : null;

      if (tractorResponse.status === 'fulfilled') {
        setTractors(loadedTractors);
        if (loadedTractors.length > 0) {
          const matchingTractors = sortTractorsForWork(loadedTractors);
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
          setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(loadedFields, firstFieldId), processedPercent: 100, fieldSearch: '' }]);
        }
      } else {
        console.error(fieldResponse.reason);
      }

      if (workTypeResponse.status === 'fulfilled') {
        setWorkTypes(loadedWorkTypes);
        if (loadedWorkTypes.length > 0) {
          const normalWorkTypes = loadedWorkTypes.filter((item) => !['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(item.name));
          const preferredWorkTypeId = normalWorkTypes.some((item) => item.id === lastPreferences.selectedWorkType)
            ? lastPreferences.selectedWorkType
            : normalWorkTypes[0]?.id ?? loadedWorkTypes[0].id;
          setSelectedWorkType(preferredWorkTypeId);
        }
      } else {
        console.error(workTypeResponse.reason);
      }

      if (attachmentResponse.status === 'fulfilled') {
        setAttachments(loadedAttachments);
      } else {
        console.error(attachmentResponse.reason);
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
        const matchingTractors = sortTractorsForWork(loadedTractors);
        const lastTractorIsValid = lastUsed.tractor_id && matchingTractors.some((tractor) => tractor.id === lastUsed.tractor_id);
        const lastWorkTypeIsValid = lastUsed.work_type_id && loadedWorkTypes.some((item) => item.id === lastUsed.work_type_id && !['Dovolená', 'Školení', 'Doktor', 'Darování krve'].includes(item.name));
        if (lastTractorIsValid) {
          setSelectedTractor(lastUsed.tractor_id);
          setFuelTractorId(lastUsed.tractor_id);
        }
        if (lastWorkTypeIsValid) {
          setSelectedWorkType(lastUsed.work_type_id);
        }
        setAttachmentEntries(buildAttachmentEntries(normalizeAttachmentIdsFromReport(lastUsed.attachments, loadedAttachments)));
      } else if (lastUsedResponse.status === 'rejected') {
        console.error(lastUsedResponse.reason);
      }

      if (
        tractorResponse.status === 'rejected' ||
        fieldResponse.status === 'rejected' ||
        workTypeResponse.status === 'rejected' ||
        attachmentResponse.status === 'rejected'
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
    } else if (selectedTractor && !availableTractors.some((tractor) => tractor.id === selectedTractor) && !isOtherWorkType) {
      setSelectedTractor(firstTractorId);
    }
    if (!availableTractors.some((tractor) => tractor.id === fuelTractorId)) {
      setFuelTractorId(firstTractorId);
    }
  }, [availableTractors, fuelTractorId, isOtherWorkType, metadataLoading, otherUsesTractor, selectedTractor]);

  useEffect(() => {
    if (metadataLoading || fields.length === 0) return;
    if (isOtherWorkType || !serviceCenterUsesFields) {
      setOtherUsesFields(false);
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100, fieldSearch: '' }]);
      if (!serviceCenterUsesFields) return;
      setOtherUsesTractor(false);
      setOtherUsesAttachments(false);
      setSelectedTractor(undefined);
      setAttachmentEntries(buildAttachmentEntries([]));
      return;
    }
    const hasSelectedField = fieldEntries.some((entry) => entry.fieldId);
    if (!hasSelectedField) {
      const firstFieldId = fields[0].id;
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100, fieldSearch: '' }]);
    }
  }, [fields, isOtherWorkType, metadataLoading, serviceCenterUsesFields]);

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
      setSpecialOptionsOpen(false);
      const workTypeId = findDefaultWorkTypeId(workTypes);
      if (workTypeId !== undefined) setSelectedWorkType(workTypeId);
      return;
    }
    setReportMode(mode);
    setSpecialOptionsOpen(false);
    if (mode !== 'leave') setHalfDayLeave(false);
    if (mode === 'doctor' || mode === 'blood') setAbsenceEnd(absenceStart);
    const workTypeId = findWorkTypeId(workTypes, mode);
    if (workTypeId !== undefined) setSelectedWorkType(workTypeId);
  };

  const handleSpecialOptionsToggle = (enabled: boolean) => {
    setSpecialOptionsOpen(enabled);
    if (!enabled && reportMode !== 'work') {
      setReportMode('work');
      const workTypeId = findDefaultWorkTypeId(workTypes);
      if (workTypeId !== undefined) setSelectedWorkType(workTypeId);
    }
  };

  const handleAbsenceStartChange = (value: string) => {
    setAbsenceStart(value);
    if (reportMode === 'doctor' || reportMode === 'blood') {
      setAbsenceEnd(value);
      return;
    }
    if (absenceEnd < value) setAbsenceEnd(value);
  };

  const handleDoctorHoursChange = (value: 4 | 8) => {
    setDoctorHours(value);
    if (value === 8) {
      setDoctorStart(defaultStartTime);
    }
  };

  const handleDoctorStartChange = (value: string) => {
    setDoctorStart(value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
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
      if (reportMode === 'doctor') {
        setAbsenceEnd(absenceStart);
        if (!isEndAfterStart(doctorTimeStart, doctorEnd)) {
          showFormMessage('Konec návštěvy doktora musí být po začátku.', 'error');
          return;
        }
        if (hasTimeOverlap(reports, absenceStart, doctorTimeStart, doctorEnd, user)) {
          showFormMessage('V zadaném čase už existuje jiný výkaz. Upravte prosím čas doktora nebo navazující práce.', 'error');
          return;
        }
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

      const title = specialName;
      const submitSummary = reportMode === 'doctor'
        ? `${formatCzechDate(absenceStart)} (${doctorTimeStart}-${doctorEnd}, ${doctorHours} h)`
        : `${formatCzechDate(absenceStart)} až ${formatCzechDate(absenceEnd)}`;
      if (!confirmReportSubmit(`Opravdu chcete uložit ${title.toLocaleLowerCase('cs-CZ')} v rozsahu ${submitSummary}?`)) {
        showFormMessage('Uložení bylo zrušeno.', 'info');
        return;
      }
      const extendedNotes = [
        `Středisko: ${serviceCenter}`,
        reportMode === 'doctor' ? `Doktor: ${formatCzechDate(absenceStart)} ${doctorTimeStart}-${doctorEnd}` : `${title}: ${formatCzechDate(absenceStart)} až ${formatCzechDate(absenceEnd)}`,
        reportMode === 'doctor' ? `Počet hodin: ${doctorHours}` : `Počet pracovních dní: ${selectedAbsenceUnits}`,
        reportMode === 'leave' && halfDayLeave ? 'Půldenní dovolená: ano' : '',
        isLongAbsence ? 'Upozornění: nestandardně dlouhé období.' : '',
        isAbsenceOverBalance ? `Upozornění: zadáno více dní dovolené, než je aktuální zůstatek ${vacationBalance.daysRemaining}.` : '',
        absenceNote ? `Poznámka: ${absenceNote}` : ''
      ].filter(Boolean).join('\n');

      try {
        setIsSubmitting(true);
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
          time_start: reportMode === 'doctor' ? `${doctorTimeStart}:00` : null,
          time_end: reportMode === 'doctor' ? `${doctorEnd}:00` : null,
          break_hours: 0,
          hours_worked: reportMode === 'doctor' ? doctorHours : reportMode === 'leave' && halfDayLeave ? 4 : selectedModeDays * 8,
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
          time_start: reportMode === 'doctor' ? `${doctorTimeStart}:00` : undefined,
          time_end: reportMode === 'doctor' ? `${doctorEnd}:00` : undefined,
          work_type: specialName,
          created_at: new Date().toISOString()
        };
        setReports((items) => [...items, submittedReport]);
        if (reportMode === 'doctor') {
          setTimeStart(doctorEnd);
          setTimeEnd(addMinutesToTime(doctorEnd, followUpDurationMinutes));
        }
        showFormMessage(`${title} byl uložen v rozsahu ${submitSummary}.`, 'success');
        window.alert(`${title} byl vytvořen.`);
      } catch (error) {
        console.error(error);
        showFormMessage(`${title} se nepodařilo uložit. Zkontrolujte datum a zkuste to znovu.`, 'error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const selectedFields = showFieldSelection ? fieldEntries.filter((entry) => entry.fieldId) : [];
    if ((fieldsRequired && selectedFields.length === 0) || !selectedWorkType) {
      showFormMessage('Vyplňte prosím všechny povinné položky.', 'error');
      return;
    }
    if (!isEndAfterStart(timeStart, timeEnd)) {
      const nextEnd = addMinutesToTime(timeStart, followUpDurationMinutes);
      setTimeEnd(nextEnd);
      showFormMessage(`Konec práce musí být po začátku. Nastavil jsem konec na ${nextEnd}.`, 'error');
      return;
    }
    if (hasTimeOverlap(reports, date, timeStart, timeEnd, user)) {
      showFormMessage('V zadaném čase už existuje jiný výkaz. Výkaz se znovu neuložil.', 'error');
      return;
    }

    if (!confirmReportSubmit(`Opravdu chcete uložit a odeslat výkaz za ${formatCzechDate(date)} (${timeStart}-${timeEnd}, ${totalArea.toFixed(2)} ha)?`)) {
      showFormMessage('Odeslání bylo zrušeno.', 'info');
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
      .filter((entry) => showAttachmentSelection && entry.attachmentId)
      .map((entry, index) => {
        const attachment = attachments.find((item) => item.id === entry.attachmentId);
        return {
          order: index + 1,
          attachment_id: attachment?.id ?? entry.attachmentId,
          attachment_code: attachment?.attachment_code ?? '',
          name: attachment?.attachment_name ?? '',
          attachment_name: attachment?.attachment_name ?? '',
          license_plate: attachment?.license_plate ?? ''
        };
      })
      .filter((item) => item.name);
    const extendedNotes = [
      `Středisko: ${serviceCenter}`,
      fieldSummary.length ? `Pozemky: ${fieldSummary.map((item) => `${item.field_name} (${item.field_code}) - ${item.amount_ha} ha`).join('; ')}` : 'Pozemky: bez pozemku',
      isOtherWorkType ? `Technika: ${selectedTractor ? (availableTractors.find((tractor) => tractor.id === selectedTractor)?.tractor_name ?? 'zvolená technika') : noTractorLabel}` : '',
      `Přípojné zařízení: ${attachmentSummary.length ? attachmentSummary.map((item) => formatAttachmentForWorker({
        id: item.attachment_id ?? 0,
        attachment_code: item.attachment_code,
        attachment_name: item.attachment_name,
        license_plate: item.license_plate
      })).join('; ') : 'bez přípojného zařízení'}`,
      fuelEnabled && fuelLiters > 0 ? `Tankování PHM: ${fuelLiters} l dne ${fuelDate}` : '',
      isOtherWorkType && otherWorkNote ? `Poznámka k Ostatní práci: ${otherWorkNote}` : '',
      notes ? `Poznámka: ${notes}` : ''
    ].filter(Boolean).join('\n');

    try {
      setIsSubmitting(true);
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
        attachmentIds: showAttachmentSelection ? attachmentEntries.map((entry) => entry.attachmentId).filter((id): id is number => Boolean(id)) : []
      });
      showFormMessage(`Výkaz byl uložen. Další práce navazuje od ${nextStart}.`, 'success');
      window.alert('Výkaz byl vytvořen.');
    } catch (error) {
      console.error(error);
      showFormMessage('Výkaz se nepodařilo uložit. Pokud už v tomto čase výkaz existuje, upravte prosím čas práce.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTractor = (event: ChangeEvent<HTMLSelectElement>) => {
    const tractorId = event.target.value ? Number(event.target.value) : undefined;
    setSelectedTractor(tractorId);
    setFuelTractorId(tractorId);
    setTractorSearch('');
  };

  const handleTimeStartChange = (value: string) => {
    setTimeStart(value);
    if (!isEndAfterStart(value, timeEnd)) {
      setTimeEnd(addMinutesToTime(value, followUpDurationMinutes));
    }
  };

  const handleTimeEndChange = (value: string) => {
    setTimeEnd(isEndAfterStart(timeStart, value) ? value : addMinutesToTime(timeStart, followUpDurationMinutes));
  };

  const handleSelectWorkType = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextWorkType = Number(event.target.value);
    setSelectedWorkType(nextWorkType);
    setWorkTypeSearch('');
    if (isOtherWorkTypeId(workTypes, nextWorkType)) {
      setOtherUsesFields(false);
      setOtherUsesTractor(false);
      setOtherUsesAttachments(false);
      setSelectedTractor(undefined);
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100, fieldSearch: '' }]);
      setAttachmentEntries(buildAttachmentEntries([]));
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
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100, fieldSearch: '' }]);
    }
  };
  const applyLastUsedTractor = () => {
    if (!lastUsedReport?.tractor_id || !canUseLastTractor) {
      showFormMessage('Techniku z posledního výkazu už není v číselníku dostupná.', 'error');
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
    setAttachmentEntries(buildAttachmentEntries(lastAttachmentIds));
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
  const getVisibleFields = (entry: FieldEntry) => {
    const availableFields = getAvailableFields(entry.id);
    const query = normalizeSearch(entry.fieldSearch ?? '');
    const visibleFields = query
      ? availableFields.filter((field) => fieldSearchText(field).includes(query))
      : availableFields;
    const selectedField = fields.find((field) => field.id === entry.fieldId);
    if (selectedField && !visibleFields.some((field) => field.id === selectedField.id)) {
      return [selectedField, ...visibleFields];
    }
    return visibleFields;
  };
  const getAvailableAttachments = (currentEntryId: number) => {
    const selectedAttachmentIds = attachmentEntries
      .filter((entry) => entry.id !== currentEntryId && entry.attachmentId !== undefined)
      .map((entry) => entry.attachmentId);
    return attachments.filter((attachment) => !selectedAttachmentIds.includes(attachment.id));
  };
  const getVisibleAttachments = (entry: AttachmentEntry) => {
    const availableAttachments = getAvailableAttachments(entry.id);
    const query = normalizeSearch(entry.attachmentSearch ?? '');
    const visibleAttachments = query
      ? availableAttachments.filter((attachment) => attachmentSearchText(attachment).includes(query))
      : availableAttachments;
    const selectedAttachment = attachments.find((attachment) => attachment.id === entry.attachmentId);
    if (selectedAttachment && !visibleAttachments.some((attachment) => attachment.id === selectedAttachment.id)) {
      return [selectedAttachment, ...visibleAttachments];
    }
    return visibleAttachments;
  };
  const addFieldEntry = () => {
    const availableFields = getAvailableFields(-1);
    const firstFieldId = availableFields[0]?.id;
    if (firstFieldId !== undefined) {
      setFieldEntries((entries) => [...entries, { id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100, fieldSearch: '' }]);
    }
  };
  const removeFieldEntry = (entryId: number) => {
    if (!window.confirm('Opravdu chcete odebrat tento pozemek z výkazu?')) return;
    setFieldEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.id !== entryId) : entries);
  };
  const updateAttachmentEntry = (entryId: number, changes: Partial<AttachmentEntry>) => {
    setAttachmentEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  };
  const addAttachmentEntry = () => {
    if (!canAddAttachment) return;
    setAttachmentEntries((entries) => [...entries, { id: Date.now(), attachmentId: undefined, attachmentSearch: '' }]);
  };
  const enableOtherFields = (enabled: boolean) => {
    setOtherUsesFields(enabled);
    if (enabled && fields.length > 0 && !fieldEntries.some((entry) => entry.fieldId)) {
      const firstFieldId = fields[0].id;
      setFieldEntries([{ id: Date.now(), fieldId: firstFieldId, amountHa: getFieldArea(fields, firstFieldId), processedPercent: 100, fieldSearch: '' }]);
    }
    if (!enabled) {
      setFieldEntries([{ id: Date.now(), fieldId: undefined, amountHa: 0, processedPercent: 100, fieldSearch: '' }]);
    }
  };
  const enableOtherTractor = (enabled: boolean) => {
    setOtherUsesTractor(enabled);
    if (!enabled) {
      setSelectedTractor(undefined);
      setTractorSearch('');
    }
  };
  const enableOtherAttachments = (enabled: boolean) => {
    setOtherUsesAttachments(enabled);
    if (!enabled) {
      setAttachmentEntries(buildAttachmentEntries([]));
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
          <button className="mobile-back-button" type="button" aria-label="Zpět" onClick={() => navigate(-1)}>‹</button>
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
                <input id="from" type="time" value={timeStart} onChange={(event: ChangeEvent<HTMLInputElement>) => handleTimeStartChange(event.target.value)} />
              </div>
              <div className="field-row">
                <label htmlFor="to">Do</label>
                <input id="to" type="time" min={timeStart} value={timeEnd} onChange={(event: ChangeEvent<HTMLInputElement>) => handleTimeEndChange(event.target.value)} />
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
              {(!specialOptionsOpen && reportMode === 'work') ? (
              <div className="field-row">
                <label htmlFor="work-type-search">Hledat typ práce</label>
                <input
                  id="work-type-search"
                  type="search"
                  className="field-search-input"
                  placeholder="Název práce"
                  value={workTypeSearch}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setWorkTypeSearch(event.target.value)}
                />
                {workTypeSearch ? (
                  <div className="field-search-results">
                    {visibleWorkTypes.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={selectedWorkType === item.id ? 'active' : ''}
                        onClick={() => {
                          setReportMode('work');
                          setSpecialOptionsOpen(false);
                          setSelectedWorkType(item.id);
                          setWorkTypeSearch('');
                        }}
                      >
                        <span>{item.name}</span>
                      </button>
                    ))}
                    {visibleWorkTypes.length === 0 ? <p>Žádný typ práce neodpovídá hledání.</p> : null}
                  </div>
                ) : null}
                <label className="sr-only" htmlFor="workType">Typ práce</label>
                <select
                  id="workType"
                  value={selectedWorkType ?? ''}
                  onChange={(event) => {
                    setReportMode('work');
                    setSpecialOptionsOpen(false);
                    handleSelectWorkType(event);
                  }}
                >
                  {metadataLoading && <option value="">Načítám typy prací...</option>}
                  {!metadataLoading && workTypes.length === 0 && <option value="">Žádné typy prací</option>}
                  {visibleWorkTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              ) : null}
              <label className="toggle-row special-type-toggle">
                <input type="checkbox" checked={specialOptionsOpen || reportMode !== 'work'} onChange={(event) => handleSpecialOptionsToggle(event.target.checked)} />
                Ostatní
              </label>
            </div>
            {(specialOptionsOpen || reportMode !== 'work') ? (
              <div className="special-type-actions" aria-label="Ostatní typy výkazu">
                {[
                  ['leave', 'Dovolená'],
                  ['training', 'Školení'],
                  ['doctor', 'Doktor'],
                  ['blood', 'Darování krve']
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`quick-mode-button ${reportMode === mode ? 'active' : ''}`}
                    onClick={() => selectReportMode(mode as ReportMode)}
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {reportMode !== 'work' ? (
            <section className="report-section special-report-panel">
              <div className="special-report-heading">
                <div>
                  <h2>{modeWorkTypeName(reportMode)}</h2>
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
                </div>
                {!['doctor', 'blood'].includes(reportMode) ? (
                  <div className="field-row">
                    <label htmlFor="absenceEnd">Do dne</label>
                    <input id="absenceEnd" type="date" min={absenceStart} value={absenceEnd} onChange={(event) => setAbsenceEnd(event.target.value)} />
                  </div>
                ) : null}
                {reportMode === 'doctor' ? (
                  <>
                    <div className="field-row">
                      <label htmlFor="doctorHours">Rozsah</label>
                      <select id="doctorHours" value={doctorHours} onChange={(event) => handleDoctorHoursChange(Number(event.target.value) as 4 | 8)}>
                        <option value={4}>4 hodiny</option>
                        <option value={8}>8 hodin</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label htmlFor="doctorStart">Od</label>
                      <input id="doctorStart" type="time" value={doctorTimeStart} disabled={doctorHours === 8} onChange={(event) => handleDoctorStartChange(event.target.value)} />
                    </div>
                    <div className="field-row">
                      <label htmlFor="doctorEnd">Do</label>
                      <input id="doctorEnd" type="time" value={doctorEnd} disabled />
                    </div>
                  </>
                ) : null}
                <div className="absence-days-box">
                  <span>{reportMode === 'doctor' ? 'Hodiny' : 'Pracovní dny'}</span>
                  <strong>{reportMode === 'doctor' ? doctorHours : selectedAbsenceUnits}</strong>
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
            {serviceCenterUsesFields && isOtherWorkType ? (
              <label className="toggle-row">
                <input type="checkbox" checked={otherUsesFields} onChange={(event) => enableOtherFields(event.target.checked)} />
                Práce probíhala na pozemku
              </label>
            ) : null}
            {showFieldSelection ? (
              <>
                <div className="repeat-list">
                  {fieldEntries.map((entry, index) => {
                    const visibleFields = getVisibleFields(entry);
                    return (
                      <div className="repeat-row repeat-row--field" key={entry.id}>
                        <span className="row-number">{index + 1}</span>
                        <div className="field-row">
                          <label htmlFor={`field-search-${entry.id}`}>Hledat pozemek</label>
                          <input
                            id={`field-search-${entry.id}`}
                            type="search"
                            className="field-search-input"
                            placeholder="Název nebo kód pole"
                            value={entry.fieldSearch ?? ''}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => updateFieldEntry(entry.id, { fieldSearch: event.target.value })}
                          />
                          {entry.fieldSearch ? (
                            <div className="field-search-results">
                              {visibleFields.slice(0, 8).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={entry.fieldId === item.id ? 'active' : ''}
                                  onClick={() => updateFieldEntry(entry.id, {
                                    fieldId: item.id,
                                    amountHa: calculateProcessedArea(fields, item.id, entry.processedPercent),
                                    fieldSearch: ''
                                  })}
                                >
                                  <span>{item.field_name}</span>
                                  <small>{Number(item.area ?? 0).toFixed(2)} ha</small>
                                </button>
                              ))}
                              {visibleFields.length === 0 ? <p>Žádný pozemek neodpovídá hledání.</p> : null}
                            </div>
                          ) : null}
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
                            {!metadataLoading && visibleFields.length === 0 && <option value="" disabled>Žádný pozemek neodpovídá hledání</option>}
                            {visibleFields.map((item) => (
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
                    );
                  })}
                </div>
                <button type="button" className="secondary add-row-button" onClick={addFieldEntry}>Přidat pole</button>
              </>
            ) : (
              <p className="field-hint">{serviceCenterUsesFields ? 'U typu práce Ostatní není pozemek povinný.' : 'Pozemky se vybírají pouze pro středisko RV.'}</p>
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
                  <label htmlFor="tractor-search">Hledat techniku</label>
                  <input
                    id="tractor-search"
                    type="search"
                    className="field-search-input"
                    placeholder="Název, SPZ nebo typ"
                    value={tractorSearch}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setTractorSearch(event.target.value)}
                  />
                  {tractorSearch ? (
                    <div className="field-search-results">
                      <button
                        type="button"
                        className={selectedTractor === undefined ? 'active' : ''}
                        onClick={() => {
                          setSelectedTractor(undefined);
                          setTractorSearch('');
                        }}
                      >
                        <span>{noTractorLabel}</span>
                        <small>bez stroje</small>
                      </button>
                      {visibleTractors.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={selectedTractor === item.id ? 'active' : ''}
                          onClick={() => {
                            setSelectedTractor(item.id);
                            setFuelTractorId(item.id);
                            setTractorSearch('');
                          }}
                        >
                          <span>{item.tractor_name}</span>
                          <small>{item.tractor_code && item.tractor_code !== item.tractor_name ? item.tractor_code : item.vehicle_type ?? 'stroj'}</small>
                        </button>
                      ))}
                      {visibleTractors.length === 0 ? <p>Žádná technika neodpovídá hledání.</p> : null}
                    </div>
                  ) : null}
                  <label className="sr-only" htmlFor="tractor">Technika</label>
                  <select id="tractor" value={selectedTractor ?? ''} onChange={handleSelectTractor}>
                    <option value="">{noTractorLabel}</option>
                    {metadataLoading && <option value="">Načítám traktory...</option>}
                    {!metadataLoading && availableTractors.length === 0 && <option value="">Není dostupná žádná technika</option>}
                    {visibleTractors.map((item) => (
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
                  {attachmentEntries.map((entry, index) => {
                    const visibleAttachments = getVisibleAttachments(entry);
                    return (
                      <div className="repeat-row repeat-row--attachment" key={entry.id}>
                        <span className="row-number">{index + 1}</span>
                        <div className="field-row">
                          <label htmlFor={`attachment-search-${entry.id}`}>Hledat zařízení</label>
                          <input
                            id={`attachment-search-${entry.id}`}
                            type="search"
                            placeholder="Název nebo SPZ"
                            value={entry.attachmentSearch ?? ''}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => updateAttachmentEntry(entry.id, { attachmentSearch: event.target.value })}
                          />
                          {entry.attachmentSearch ? (
                            <div className="field-search-results">
                              <button
                                type="button"
                                className={entry.attachmentId === undefined ? 'active' : ''}
                                onClick={() => updateAttachmentEntry(entry.id, { attachmentId: undefined, attachmentSearch: '' })}
                              >
                                <span>{noAttachmentLabel}</span>
                                <small>bez zařízení</small>
                              </button>
                              {visibleAttachments.slice(0, 8).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={entry.attachmentId === item.id ? 'active' : ''}
                                  onClick={() => updateAttachmentEntry(entry.id, { attachmentId: item.id, attachmentSearch: '' })}
                                >
                                  <span>{item.attachment_name}</span>
                                  <small>{item.license_plate || 'bez SPZ'}</small>
                                </button>
                              ))}
                              {visibleAttachments.length === 0 ? <p>Žádné zařízení neodpovídá hledání.</p> : null}
                            </div>
                          ) : null}
                          <label className="sr-only" htmlFor={`attachment-${entry.id}`}>Zařízení</label>
                          <select
                            id={`attachment-${entry.id}`}
                            value={entry.attachmentId ?? ''}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAttachmentEntry(entry.id, {
                              attachmentId: event.target.value ? Number(event.target.value) : undefined,
                              attachmentSearch: ''
                            })}
                          >
                            <option value="">{noAttachmentLabel}</option>
                            {visibleAttachments.map((item) => (
                              <option key={item.id} value={item.id}>{formatAttachmentForWorker(item)}</option>
                            ))}
                          </select>
                        </div>
                        <button type="button" className="danger repeat-remove" onClick={() => removeAttachmentEntry(entry.id)} disabled={attachmentEntries.length === 1}>Odebrat</button>
                      </div>
                    );
                  })}
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
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Ukládám...' : reportMode === 'work' ? 'Uložit a odeslat' : `Uložit ${reportMode === 'leave' ? 'dovolenou' : reportMode === 'training' ? 'školení' : 'doktora'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;
