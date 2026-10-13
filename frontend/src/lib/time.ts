export const utcToday = () => new Date().toISOString().slice(0,10);
export const utcTime = (iso: string) => iso.slice(11,16);
export function nextDay(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0,10);
}
export function validateTime(date: string, start: string, end: string): string | null {
  const a = new Date(`${date}T${start}:00Z`), b = new Date(`${date}T${end}:00Z`);
  const duration = (b.getTime()-a.getTime())/60000;
  if (!Number.isFinite(duration)) return 'Enter a valid date and time.';
  if (duration < 15 || duration > 240) return 'Choose a duration between 15 minutes and 4 hours.';
  if (a.getUTCMinutes()%15 || b.getUTCMinutes()%15) return 'Use 15-minute time slots.';
  if (start < '08:00' || end > '20:00') return 'Business hours are 08:00–20:00 UTC.';
  if (a < new Date()) return 'Choose a future start time (UTC).';
  return null;
}
