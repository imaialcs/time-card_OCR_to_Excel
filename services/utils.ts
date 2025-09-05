/**
 * Parses a time string (e.g., "9:00", "900", "1830") into hours as a decimal number.
 * Returns null if the format is invalid.
 */
export const parseTime = (timeStr: string): number | null => {
  if (!timeStr) return null;

  const s = String(timeStr).replace(':', '');
  if (s.length < 3 || s.length > 4) return null;

  try {
    const hours = parseInt(s.substring(0, s.length - 2), 10);
    const minutes = parseInt(s.substring(s.length - 2), 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return hours + minutes / 60;
  } catch (e) {
    return null;
  }
};