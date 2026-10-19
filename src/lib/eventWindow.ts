import { shiftISODate } from "@/lib/schedule";

// The client no longer downloads every event ever created. It loads a date
// window around today and widens it when the user navigates outside it (or
// opens search, which needs the full history).

export type DateWindow = { from: string; to: string };

export const ALL_TIME: DateWindow = { from: "1970-01-01", to: "2999-12-31" };

const LOOKBACK_DAYS = 60;
const LOOKAHEAD_DAYS = 120;
// Extra slack when widening, so paging month by month doesn't refetch each click.
const PADDING_DAYS = 45;

export function defaultWindow(today: string): DateWindow {
  return { from: shiftISODate(today, -LOOKBACK_DAYS), to: shiftISODate(today, LOOKAHEAD_DAYS) };
}

export function covers(win: DateWindow, from: string, to: string): boolean {
  return win.from <= from && to <= win.to;
}

/** The window grown to include [from, to] (with padding), or `win` itself if it already does. */
export function widenWindow(win: DateWindow, from: string, to: string): DateWindow {
  if (covers(win, from, to)) return win;
  return {
    from: from < win.from ? shiftISODate(from, -PADDING_DAYS) : win.from,
    to: to > win.to ? shiftISODate(to, PADDING_DAYS) : win.to,
  };
}

export function eventsUrl(win: DateWindow): string {
  return `/api/events?from=${win.from}&to=${win.to}`;
}
