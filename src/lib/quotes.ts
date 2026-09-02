// Curated rather than pulled from a quotes API — keeps the digest's one
// external dependency (Pushover) as the only network call that can fail it,
// and a public API has no reliable way to filter to this specific theme
// anyway. Rotates by day-of-year so it's stable across the day (useful if
// the digest is ever re-sent) and doesn't repeat for months.
export type Quote = { text: string; author: string };

export const PRODUCTIVITY_QUOTES: Quote[] = [
  { text: "Time is the coin of your life. It is the only coin you have, and only you can determine how it will be spent.", author: "Carl Sandburg" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "It is not enough to be busy; so are the ants. The question is: what are we busy about?", author: "Henry David Thoreau" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The bad news is time flies. The good news is you're the pilot.", author: "Michael Altshuler" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "You may delay, but time will not.", author: "Benjamin Franklin" },
  { text: "Time is what we want most, but what we use worst.", author: "William Penn" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "Ordinary people think merely of spending time; great people think of using it.", author: "Arthur Schopenhauer" },
  { text: "The two most powerful warriors are patience and time.", author: "Leo Tolstoy" },
  { text: "Someday is not a day of the week.", author: "Denise Brennan-Nelson" },
  { text: "Procrastination is the thief of time.", author: "Edward Young" },
  { text: "Well begun is half done.", author: "Aristotle" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "You can do anything, but not everything.", author: "David Allen" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Either you run the day, or the day runs you.", author: "Jim Rohn" },
  { text: "Never confuse motion with action.", author: "Benjamin Franklin" },
  { text: "It's not always that we need to do more but rather that we need to focus on less.", author: "Nathan W. Morris" },
  { text: "If you spend too much time thinking about a thing, you'll never get it done.", author: "Bruce Lee" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
];

function dayOfYear(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const start = Date.UTC(year, 0, 1);
  const target = Date.UTC(year, month - 1, day);
  return Math.floor((target - start) / (24 * 60 * 60 * 1000)) + 1;
}

// Deterministic per calendar date (ET, since that's what the digest is
// built around) — same date always yields the same quote.
export function quoteOfTheDay(isoDate: string): Quote {
  const index = dayOfYear(isoDate) % PRODUCTIVITY_QUOTES.length;
  return PRODUCTIVITY_QUOTES[index];
}
