/**
 * Opening hours and slot arithmetic.
 * Shared by the React app and the Netlify function so both agree on what a
 * valid slot is — the server re-validates everything the client sends.
 */

export const OPEN_HOUR = 8 // first bookable hour
export const CLOSE_HOUR = 20 // first hour that is no longer bookable
export const OPEN_DAYS = [1, 2, 3, 4, 5] // Mon–Fri (JS getDay: Sun = 0)
export const DEFAULT_MAX_HOURS = 4

/** All bookable start hours in a day: 8 … 19 */
export const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)

export const pad = (n) => String(n).padStart(2, '0')

/** Local-time YYYY-MM-DD (never use toISOString here — it shifts across the date line). */
export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromIso(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(d, n) {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

/** Monday of the week containing `d`. */
export function startOfWeek(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  const day = c.getDay() // 0 = Sunday
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1))
  return c
}

export function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(fromIso(s).getTime())
}

/** Is the Centre open on this date at this start hour? */
export function isOpenAt(dateStr, hour) {
  if (!isValidDate(dateStr)) return false
  if (!Number.isInteger(hour) || hour < OPEN_HOUR || hour >= CLOSE_HOUR) return false
  return OPEN_DAYS.includes(fromIso(dateStr).getDay())
}

export function isOpenDay(dateStr) {
  return isValidDate(dateStr) && OPEN_DAYS.includes(fromIso(dateStr).getDay())
}

/** A booking must start and finish inside the same opening day. */
export function fitsInDay(hour, hours) {
  return hour + hours <= CLOSE_HOUR
}

/** Half-open interval overlap: [aStart, aStart+aLen) ∩ [bStart, bStart+bLen) */
export function overlaps(aStart, aLen, bStart, bLen) {
  return aStart < bStart + bLen && bStart < aStart + aLen
}

/** Epoch ms for the start of a slot, in the server/browser local zone. */
export function slotStartTime(dateStr, hour) {
  const d = fromIso(dateStr)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

export function slotEndTime(dateStr, hour, hours) {
  return slotStartTime(dateStr, hour) + hours * 3600_000
}

export function isPastSlot(dateStr, hour, now = Date.now()) {
  return slotStartTime(dateStr, hour) < now
}

export const fmtHour = (h) => `${pad(h)}:00`

/** "14. rujna 2026." / "14 September 2026" */
export function formatDate(dateStr, dict) {
  const d = fromIso(dateStr)
  const month = dict.months[d.getMonth()]
  return dict.code === 'hr'
    ? `${d.getDate()}. ${month} ${d.getFullYear()}.`
    : `${d.getDate()} ${month} ${d.getFullYear()}`
}

export function formatDateShort(dateStr, dict) {
  const d = fromIso(dateStr)
  const weekday = dict.days[(d.getDay() + 6) % 7]
  return `${weekday} ${d.getDate()}.${d.getMonth() + 1}.`
}

export function formatRange(dateStr, hour, hours, dict) {
  return `${formatDate(dateStr, dict)} · ${fmtHour(hour)} – ${fmtHour(hour + hours)}`
}
