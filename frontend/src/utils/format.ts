export function formatCzechDate(value?: string | Date) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(String(value).includes('T') ? String(value) : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function formatCzechDateTime(value?: string | Date) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatCzechDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
