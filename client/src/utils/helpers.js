/**
 * Shared utility functions used across the app.
 */

/** Get uppercase initials from a name string. "Alice Brown" → "AB" */
export function getInitials(name) {
  if (!name) return '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

/** Public display name: first name + last initial. "Sarah Thompson" → "Sarah T." */
export function getDisplayName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Day name arrays */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Split a time slot (e.g. 09:00–12:00) into 1-hour segments.
 * Used by CalendarView and BookingModal.
 */
export function splitSlotIntoHours(slot) {
  const [startH, startM] = slot.start_time.split(':').map(Number);
  const [endH] = slot.end_time.split(':').map(Number);
  const hours = [];
  for (let h = startH; h < endH; h++) {
    hours.push({
      slotId: slot.id,
      dayOfWeek: slot.day_of_week,
      hour: h,
      startTime: `${String(h).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(h + 1).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      maxHours: endH - h,
    });
  }
  return hours;
}

/**
 * Format an SQLite datetime string for display.
 * "2025-06-14T10:30:00.000Z" → "14 Jun 2025"
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
