let regionFormat = 'en-US';

export function setRegionFormat(value: unknown) {
  if (typeof value !== 'string') return;
  try { new Intl.DateTimeFormat(value); regionFormat = value; } catch { /* Keep the last valid server region. */ }
}

export function displayDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat(regionFormat, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

export function displayNumber(value: number) {
  return new Intl.NumberFormat(regionFormat).format(value);
}
