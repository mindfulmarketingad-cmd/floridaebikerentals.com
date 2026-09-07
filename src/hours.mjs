/**
 * Opening hours, parsed once at build time.
 *
 * Google's hours arrive as display strings ("9AM - 5:30PM", "12 - 5PM",
 * "Open 24 hours", "9:30AM - 12:30PM, 1:30 - 4PM"). Parsing them in the
 * browser would mean shipping this file twice, so it happens here and the
 * pages carry the result as numbers; the client only has to compare a clock
 * reading against them.
 *
 * A range is { o, c } in minutes from that day's midnight. `c` may run past
 * 1440 for a shop that closes after midnight, so a Friday 9PM-2AM reads as
 * { o: 1260, c: 1560 } on Friday rather than being lost or split.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "9:30AM" -> 570. Returns null when there is no meridiem to work from. */
function parseTime(text, fallbackMeridiem) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(text).trim());
  if (!match) return null;
  const meridiem = (match[3] || fallbackMeridiem || "").toLowerCase();
  if (!meridiem) return null;
  let hour = Number(match[1]) % 12;
  if (meridiem === "pm") hour += 12;
  return hour * 60 + Number(match[2] || 0);
}

/** The meridiem written in a time, if it has one. */
function meridiemOf(text) {
  const match = /(am|pm)\s*$/i.exec(String(text).trim());
  return match ? match[1].toLowerCase() : "";
}

/** One day's display string -> the ranges it covers. */
export function parseDayHours(text, closed) {
  const value = String(text || "").trim();
  if (closed || !value || /closed/i.test(value)) return [];
  if (/open\s*24\s*hours/i.test(value)) return [{ o: 0, c: 1440 }];

  const ranges = [];
  for (const part of value.split(",")) {
    const halves = part.split(/[-–—]/);
    if (halves.length !== 2) continue;
    // "12 - 5PM" means noon to five: a time with no meridiem of its own
    // borrows the one written on the other end of the range.
    const endMeridiem = meridiemOf(halves[1]);
    const open = parseTime(halves[0], endMeridiem);
    const close = parseTime(halves[1], meridiemOf(halves[0]));
    if (open === null || close === null) continue;
    ranges.push({ o: open, c: close <= open ? close + 1440 : close });
  }
  return ranges;
}

/**
 * A listing's week as seven arrays of ranges, indexed the way JavaScript's
 * getDay() is: 0 is Sunday.
 */
export function weekHours(listing) {
  const week = [[], [], [], [], [], [], []];
  for (const row of listing.hours || []) {
    const index = DAYS.indexOf(row.day);
    if (index === -1) continue;
    week[index] = parseDayHours(row.hours, row.closed);
  }
  return week;
}

/** Whether any day of the week runs to `hour` (24h clock) or later. */
export function closesAtOrAfter(listing, hour) {
  const cutoff = hour * 60;
  return weekHours(listing).some((day) => day.some((range) => range.c >= cutoff));
}

/** The latest closing time in the week, in minutes, or null if never open. */
export function latestClose(listing) {
  let latest = null;
  for (const day of weekHours(listing)) {
    for (const range of day) if (latest === null || range.c > latest) latest = range.c;
  }
  return latest;
}

/** How many days of the week the listing posts any open hours for. */
export function openDayCount(listing) {
  return weekHours(listing).filter((day) => day.length > 0).length;
}

/**
 * Florida keeps two clocks: the panhandle west of the Apalachicola River runs
 * on Central time and the rest of the state on Eastern. Longitude splits them
 * closely enough for opening hours - the river sits near -85.0, and there is
 * no listing near enough to the line for the difference to matter.
 */
export function zoneFor(listing) {
  return typeof listing.lng === "number" && listing.lng < -85.0 ? "America/Chicago" : "America/New_York";
}

/** Minutes past midnight, formatted the way the source data writes them. */
export function formatMinutes(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${hour24 < 12 ? "AM" : "PM"}`;
}
