import type { SettingsPayload } from "@/hooks/settingsStore";
import { Category } from "@/lib/categories";
import { ScheduleEvent, shiftISODate } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import { weekDates } from "@/lib/monthGrid";

// Sample data for the public demo (/demo): a fictional college student's
// week — classes, a campus job, club sports and other extracurriculars,
// chores. Everything is placed relative to `today` so the demo always opens
// on a full, current-looking week.

export type DemoData = {
  todos: Todo[];
  events: ScheduleEvent[];
  settings: SettingsPayload;
};

// The category keys are fixed in lib/categories; the demo gives them
// everyday names through the same per-user label setting a real account
// uses, so none of the app owner's own category names show up.
export const DEMO_CATEGORY_LABELS: Record<Category, string> = {
  school: "School",
  rush: "Extracurriculars",
  career: "Work",
  house: "Chores",
  lloyd: "Health",
  other: "Other",
};

export const DEMO_SETTINGS: SettingsPayload = {
  categoryColors: { house: "amber" },
  categoryLabels: DEMO_CATEGORY_LABELS,
  categoryOrder: ["school", "rush", "career", "house", "lloyd", "other"],
  canvasFeedUrl: "",
};

const SEMESTER_WEEKS = 12;

export function buildDemoData(today: string, newId: () => string = () => crypto.randomUUID()): DemoData {
  // Sunday-first, matching the dashboard's week view.
  const [sun, mon, tue, wed, thu, fri, sat] = weekDates(today);
  const nextWeek = (date: string) => shiftISODate(date, 7);
  const semesterEnd = shiftISODate(sun, SEMESTER_WEEKS * 7);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  const events: ScheduleEvent[] = [];
  const todos: Todo[] = [];

  function weekly(
    title: string,
    days: string[],
    time: string,
    endTime: string,
    category: Category,
    exceptions?: string[]
  ) {
    for (const date of days) {
      events.push({
        id: newId(),
        title,
        date,
        time,
        endTime,
        category,
        recurrence: { freq: "weekly", interval: 1, until: semesterEnd, ...(exceptions ? { exceptions } : {}) },
      });
    }
  }

  function once(event: Omit<ScheduleEvent, "id">) {
    events.push({ id: newId(), ...event });
  }

  // Class schedule.
  weekly("CS 121 Lecture", [mon, wed, fri], "10:00", "10:50", "school");
  weekly("MATH 231 Calculus II", [mon, wed, fri], "11:15", "12:05", "school");
  weekly("PSYC 100 Intro Psych", [tue, thu], "09:30", "10:45", "school");
  weekly("ENGL 202 Writing", [tue, thu], "13:30", "14:45", "school");
  weekly("CHEM 112 Lab", [wed], "14:00", "16:50", "school");

  // Extracurriculars, work, health, chores.
  weekly("Club soccer practice", [tue, thu], "17:30", "19:00", "rush");
  weekly("Robotics club", [wed], "18:30", "20:00", "rush");
  // Choir is off next week, to show a skipped date in a recurring series.
  weekly("Choir rehearsal", [mon], "19:00", "20:30", "rush", [nextWeek(mon)]);
  weekly("Library front desk shift", [mon], "14:00", "17:00", "career");
  weekly("Library front desk shift", [fri], "13:00", "17:00", "career");
  weekly("Gym", [tue, thu], "07:30", "08:30", "lloyd");
  weekly("Grocery run", [sat], "13:00", "14:00", "house");
  weekly("Laundry", [sun], "16:00", "17:00", "house");

  once({ title: "MATH 231 office hours", date: tue, time: "15:00", endTime: "15:30", category: "school" });
  once({
    title: "Study group: Calc midterm",
    date: sun,
    time: "14:00",
    endTime: "16:00",
    category: "school",
    notes: [
      { id: newId(), text: "Library room 204" },
      { id: newId(), text: "Bring practice exam 2" },
    ],
  });
  once({ title: "Soccer game vs. State", date: sat, time: "10:00", endTime: "12:00", category: "rush" });
  once({ title: "Movie night with roommates", date: fri, time: "20:00", endTime: "22:30", category: "other" });
  once({ title: "Dentist appointment", date: nextWeek(tue), time: "16:00", endTime: "17:00", category: "lloyd" });
  once({ title: "Mom's birthday", date: nextWeek(wed), time: "", category: "other" });
  once({
    title: "Regional robotics competition",
    date: nextWeek(sat),
    endDate: nextWeek(sun),
    time: "",
    category: "rush",
  });

  // Course assignments, as if synced from Canvas: each one is a todo plus an
  // all-day entry on its due date, and they show in the Assignments panel.
  const assignments: { title: string; due: number; done?: boolean }[] = [
    { title: "Reading response 5 [ENGL 202]", due: -1 },
    { title: "Lab 7 report [CHEM 112]", due: 2 },
    { title: "Quiz 8 [PSYC 100]", due: 3 },
    { title: "Project 2: Hash maps [CS 121]", due: 5 },
    { title: "Midterm 2 [MATH 231]", due: 9 },
    { title: "Essay 2 draft [ENGL 202]", due: 12 },
    { title: "Problem Set 5 [MATH 231]", due: -3, done: true },
  ];
  assignments.forEach((a, i) => {
    const id = newId();
    const canvasId = `demo-assignment-${i + 1}`;
    const dueDate = shiftISODate(today, a.due);
    todos.push({
      id,
      title: a.title,
      dueDate,
      category: "school",
      canvasId,
      done: Boolean(a.done),
      ...(a.done ? { completedAt: daysAgo(2) } : {}),
    });
    events.push({ id: newId(), title: a.title, date: dueDate, time: "", todoId: id, canvasId, category: "school" });
  });

  const subtasks = (...items: [string, boolean?][]) =>
    items.map(([title, done]) => ({ id: newId(), title, done: Boolean(done) }));

  const plain: Omit<Todo, "id">[] = [
    { title: "Email advisor about spring classes", category: "school", dueDate: shiftISODate(today, 3), priority: "medium", done: false },
    { title: "Pay club soccer dues", category: "rush", dueDate: shiftISODate(today, 4), priority: "high", done: false },
    {
      title: "Order servo motors for robotics",
      category: "rush",
      description: "Need 4 for the arm — check the club's parts budget first.",
      subtasks: subtasks(["Get budget approval", true], ["Compare prices"], ["Submit order form"]),
      done: false,
    },
    { title: "Practice choir solo", category: "rush", done: false },
    { title: "Submit timesheet", category: "career", dueDate: shiftISODate(today, 2), priority: "high", done: false },
    { title: "Swap Saturday shift with Jordan", category: "career", done: false },
    {
      title: "Update résumé for summer internships",
      category: "career",
      priority: "low",
      subtasks: subtasks(["Add library job", true], ["Add robotics project"], ["Ask career center to review"]),
      done: false,
    },
    { title: "Clean bathroom", category: "house", dueDate: shiftISODate(today, 1), priority: "low", done: false },
    { title: "Take out recycling", category: "house", done: false },
    {
      title: "Restock groceries",
      category: "house",
      subtasks: subtasks(["Eggs"], ["Rice"], ["Coffee", true], ["Bananas"]),
      done: false,
    },
    { title: "Refill prescription", category: "lloyd", dueDate: shiftISODate(today, 2), done: false },
    { title: "Book dentist cleaning", category: "lloyd", done: true, completedAt: daysAgo(4) },
    { title: "Call grandma", category: "other", done: false },
    { title: "Renew driver's license", category: "other", dueDate: shiftISODate(today, 20), priority: "low", done: false },
    { title: "Pick a movie for Friday", category: "other", done: true, completedAt: daysAgo(1) },
  ];
  for (const todo of plain) todos.push({ id: newId(), ...todo });

  // A todo already dragged onto the calendar.
  const scheduled = todos.find((t) => t.title === "Clean bathroom")!;
  events.push({
    id: newId(),
    title: scheduled.title,
    date: shiftISODate(today, 1),
    time: "18:00",
    endTime: "18:30",
    todoId: scheduled.id,
    category: scheduled.category,
  });

  return {
    todos,
    events,
    settings: DEMO_SETTINGS,
  };
}
