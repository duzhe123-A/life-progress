"use strict";

const LifeCalendar = (() => {
  const DAY_MS = 86400000;

  function toDay({ year, month, day }) {
    const utc = new Date(0);
    utc.setUTCFullYear(year, month - 1, day);
    return utc.getTime() / DAY_MS;
  }

  function daysInMonth(year, month) {
    return toDay({ year, month: month + 1, day: 1 }) - toDay({ year, month, day: 1 });
  }

  function fromLocalDate(date) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }

  function parseISO(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return { year, month, day };
  }

  function toISO({ year, month, day }) {
    return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  }

  function plusMonths(date, count) {
    const monthIndex = date.month - 1 + count;
    const year = date.year + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12 + 12) % 12 + 1;
    return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
  }

  function dayAtAge(birth, years) {
    return toDay(plusMonths(birth, years * 12));
  }

  function localDateAtDay(day) {
    const utcDate = new Date(day * DAY_MS);
    const local = new Date(0);
    local.setFullYear(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
    local.setHours(12, 0, 0, 0);
    return local;
  }

  function ageAt(birth, today) {
    const todayDay = toDay(today);
    let years = today.year - birth.year;
    if (toDay(plusMonths(birth, years * 12)) > todayDay) years -= 1;
    const yearStart = plusMonths(birth, years * 12);
    let months = Math.min(11, (today.year - yearStart.year) * 12 + today.month - yearStart.month);
    if (toDay(plusMonths(yearStart, months)) > todayDay) months -= 1;
    const days = todayDay - toDay(plusMonths(yearStart, months));
    return { years, months, days };
  }

  function calculate(birth, baseline, now = new Date()) {
    const today = fromLocalDate(now);
    const todayDay = toDay(today);
    const birthday = toDay(birth);
    if (birthday > todayDay) throw new RangeError("Birthday is in the future.");
    const start = toDay({ year: today.year, month: 1, day: 1 });
    const end = toDay({ year: today.year + 1, month: 1, day: 1 });
    const yearDays = end - start;
    const yearElapsed = todayDay - start;
    const dayFraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    const lifeDays = dayAtAge(birth, baseline) - birthday;
    const livedDays = todayDay - birthday;
    return {
      today,
      age: ageAt(birth, today),
      yearDays,
      yearElapsed,
      yearPercent: (yearElapsed + dayFraction) / yearDays * 100,
      livedDays,
      lifePercent: Math.min(livedDays / lifeDays * 100, 100),
      reachedBaseline: livedDays >= lifeDays
    };
  }

  return { parseISO, toISO, toDay, fromLocalDate, dayAtAge, localDateAtDay, calculate };
})();

if (typeof module !== "undefined" && module.exports) module.exports = LifeCalendar;

