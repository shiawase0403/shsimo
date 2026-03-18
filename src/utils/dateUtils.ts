export function toUTC8InputString(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const utc8Time = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(utc8Time).toISOString().slice(0, 16);
}

export function fromUTC8InputString(inputString: string | null | undefined): string | null {
  if (!inputString) return null;
  // inputString is like "2026-03-18T08:00"
  // We append "+08:00" to tell the Date constructor it's UTC+8
  const date = new Date(`${inputString}+08:00`);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatUTC8(dateString: string | null | undefined, format: 'datetime' | 'date' | 'time' = 'datetime'): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const utc8Time = date.getTime() + (8 * 60 * 60 * 1000);
  const utc8Date = new Date(utc8Time);
  
  const year = utc8Date.getUTCFullYear();
  const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Date.getUTCDate()).padStart(2, '0');
  const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
  
  if (format === 'date') return `${year}-${month}-${day}`;
  if (format === 'time') return `${hours}:${minutes}`;
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function isOngoingUTC8(startTime: string, endTime: string): boolean {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  return now >= start && now <= end;
}

export function isTodayUTC8(dateString: string): boolean {
  const now = new Date();
  const nowUtc8Time = now.getTime() + (8 * 60 * 60 * 1000);
  const nowUtc8Date = new Date(nowUtc8Time);
  
  const date = new Date(dateString);
  const dateUtc8Time = date.getTime() + (8 * 60 * 60 * 1000);
  const dateUtc8Date = new Date(dateUtc8Time);
  
  return nowUtc8Date.getUTCFullYear() === dateUtc8Date.getUTCFullYear() &&
         nowUtc8Date.getUTCMonth() === dateUtc8Date.getUTCMonth() &&
         nowUtc8Date.getUTCDate() === dateUtc8Date.getUTCDate();
}

export function isFutureUTC8(dateString: string): boolean {
  const now = new Date();
  const date = new Date(dateString);
  return date > now;
}

export function isSameDayUTC8(dateString: string, compareDate: Date): boolean {
  const date = new Date(dateString);
  const dateUtc8Time = date.getTime() + (8 * 60 * 60 * 1000);
  const dateUtc8Date = new Date(dateUtc8Time);
  
  return dateUtc8Date.getUTCFullYear() === compareDate.getFullYear() &&
         dateUtc8Date.getUTCMonth() === compareDate.getMonth() &&
         dateUtc8Date.getUTCDate() === compareDate.getDate();
}
