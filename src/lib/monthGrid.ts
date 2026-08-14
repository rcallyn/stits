export type MonthGridDay = { date: string; day: number; inMonth: boolean };

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// `month` is 1-indexed (1 = January). Returns full weeks (Sun-Sat), padded
// with adjacent-month days so every row has 7 cells — the same layout an
// iOS-style month calendar uses.
export function buildMonthGrid(year: number, month: number): MonthGridDay[][] {
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: MonthGridDay[] = [];

  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month - 1, 1 - (startWeekday - i));
    cells.push({ date: isoFromDate(d), day: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: isoFromDate(new Date(year, month - 1, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.date.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({ date: isoFromDate(d), day: d.getDate(), inMonth: false });
  }

  const weeks: MonthGridDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function startOfWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dt.getDay());
  return isoFromDate(dt);
}

export function weekDates(date: string): string[] {
  const [y, m, d] = startOfWeek(date).split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => isoFromDate(new Date(y, m - 1, d + i)));
}
