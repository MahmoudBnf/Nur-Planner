// Shared vocabulary of the app: priorities, prayer anchors, avoidance reasons.

// The four-level priority framework (obligations → rights → growth → rest).
export const CATEGORIES = {
  deen: { label: 'Deen', long: 'Obligations to Allah', color: 'var(--cat-1)' },
  duty: { label: 'Duty', long: 'Rights & responsibilities', color: 'var(--cat-2)' },
  growth: { label: 'Growth', long: 'Beneficial development', color: 'var(--cat-3)' },
  rest: { label: 'Rest', long: 'Rest & recreation', color: 'var(--cat-4)' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export { PRAYERS, PRAYER_NUDGES } from '../../../shared/reminders.js';
export const PRAYER_AR = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };

// Time blocks of the day, anchored on salah.
// Each block runs from its prayer to the next one; "isha" runs until Fajr.
export const ANCHORS = {
  fajr: { label: 'After Fajr', prayer: 'Fajr', hint: "Qur'an, beneficial reading, your most important task" },
  dhuhr: { label: 'Around Dhuhr', prayer: 'Dhuhr', hint: 'Check-in: have you started the important thing?' },
  asr: { label: 'After Asr', prayer: 'Asr', hint: 'Study, work, exercise, practical responsibilities' },
  maghrib: { label: 'Maghrib → Isha', prayer: 'Maghrib', hint: 'Finish what matters, family, prepare tomorrow' },
  isha: { label: 'After Isha', prayer: 'Isha', hint: 'Free time, games, hobbies — chosen deliberately. Then sleep.' },
  any: { label: 'Anytime', hint: 'Not tied to a time block' },
};
export const ANCHOR_KEYS = Object.keys(ANCHORS);

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WD = WEEKDAYS.map((d) => d.slice(0, 3));

// One-click starting points on the Routines page.
export const ROUTINE_TEMPLATES = [
  { title: 'Read Surat Al-Kahf', category: 'deen', points: 20, kind: 'weekly', mode: 'window',
    window: { startDay: 4, startAnchor: 'maghrib', endDay: 5, endAnchor: 'maghrib' }, steps: ['Open the mushaf at Al-Kahf'] },
  { title: "Revise 3 ahzab of Qur'an", category: 'deen', points: 20, kind: 'daily', anchor: 'fajr',
    steps: ['Sit with the mushaf right after Fajr', 'Hizb 1', 'Hizb 2', 'Hizb 3'] },
  { title: 'Morning & evening adhkar', category: 'deen', points: 10, kind: 'daily', anchor: 'fajr', steps: ['Open the adhkar after the prayer'] },
  { title: 'Fast Monday / Thursday', category: 'deen', points: 30, kind: 'daily', days: [1, 4], anchor: 'any', steps: ['Make niyyah the night before and wake for suhoor'] },
  { title: 'Typing challenge', category: 'growth', points: 10, kind: 'daily', anchor: 'isha', time: '22:00', steps: ['Open the typing site and do one test'] },
  { title: 'Work on my pet project', category: 'growth', points: 20, kind: 'weekly', mode: 'open', target: 3, steps: ['Open the project and read my last note'] },
  { title: 'Call / visit family', category: 'duty', points: 20, kind: 'weekly', mode: 'open', target: 1, steps: [] },
  { title: 'Exercise', category: 'duty', points: 20, kind: 'weekly', mode: 'open', target: 3, steps: ['Put on the sports clothes'] },
];

// ontime / late are within the prayer's time; qada = made up after its time;
// missed = not prayed yet (still owed, listed under "To make up").
export const PRAYER_STATES = {
  ontime: { label: 'On time', hint: 'Early in its time', short: '✓', cls: 'good' },
  late: { label: 'Late', hint: 'Late, but still within its time', short: '~', cls: 'warn' },
  qada: { label: 'Qada’', hint: 'Prayed after its time ended', short: '↺', cls: 'serious' },
  missed: { label: 'Missed', hint: 'Not prayed — still owed', short: '✗', cls: 'bad' },
};
export const PRAYER_STATE_KEYS = Object.keys(PRAYER_STATES);
// Prayed within its time (what "protect salah" means).
export const inTime = (s) => s === 'ontime' || s === 'late';

export const TASK_STATUS = {
  todo: { label: 'To do' },
  done: { label: 'Done', icon: '✓', cls: 'good' },
  partial: { label: 'Partly', icon: '~', cls: 'warn' },
  notdone: { label: 'Not done', icon: '✗', cls: 'bad' },
};

// "Name the reason" — each one has a different fix.
export const AVOID_REASONS = {
  unclear: {
    label: 'Unclear',
    feel: "I don't know what the first step is",
    fix: 'Define the next physical action. Write it in one sentence: "open X and do Y".',
  },
  intimidating: {
    label: 'Intimidating',
    feel: 'I might fail, struggle or feel incompetent',
    fix: 'Make the first attempt tiny and allow yourself to be a beginner. Five minutes of bad work is still a start.',
  },
  overwhelming: {
    label: 'Overwhelming',
    feel: 'The task feels too large',
    fix: 'Break it down. Pick only the first small piece and ignore the rest for now.',
  },
  boring: {
    label: 'Boring / effortful',
    feel: 'I want an easier reward',
    fix: "Start anyway — you don't need to feel like it. Put the phone in another room and do 5 minutes.",
  },
  exhausted: {
    label: 'Exhausted',
    feel: 'I genuinely need rest',
    fix: 'Rest properly — a real break, nap or sleep, not scrolling. Then decide when you will start.',
  },
  habit: {
    label: 'Habit / autopilot',
    feel: 'I opened my phone without deciding to',
    fix: 'Change the environment: phone out of reach, app blocker, materials already open.',
  },
};

export const CHALLENGE_ITEMS = [
  { key: 'salah', label: 'Protect salah', hint: 'Pray within the prescribed times; use prayer as a checkpoint.' },
  { key: 'important', label: 'Start one important task', hint: 'At least five focused minutes before optional social media.' },
  { key: 'unfamiliar', label: 'Practise starting something unfamiliar', hint: 'Give a new or challenging activity five minutes.' },
  { key: 'recreation', label: 'Choose recreation deliberately', hint: "Enjoy games or anime without letting scrolling decide your evening." },
  { key: 'review', label: 'Review the day', hint: "One success, one obstacle, and tomorrow's first action." },
];

export const NEW_KINDS = ['Game', 'Skill', 'Book', 'Course', 'Sport', 'Project', 'Other'];
export const NEW_STATUS = {
  waiting: 'Not tried yet',
  tried: 'Tried',
  keeping: 'Keeping it',
  dropped: 'Not for me',
};

export const REMINDERS = [
  { text: 'Don’t wait for motivation; make the first step small enough to take without it.' },
  { text: 'Decide your priorities before distractions decide them for you.' },
  { text: 'When you fall behind, return to the next right action instead of punishing yourself.' },
  { text: 'I start first. I allow myself to feel unmotivated while starting.' },
  { text: 'You don’t need to eliminate the uncomfortable feeling — just stop treating it as a command.' },
  { text: 'And that there is not for man except that [good] for which he strives.', src: "Qur'an 53:39" },
  { text: 'So when you have decided, then rely upon Allah.', src: "Qur'an 3:159" },
  { text: 'The aim is to become reliable, not relentlessly busy.' },
  { text: 'The moment you notice the pattern is an opportunity to restart — not tomorrow, not Monday. Now.' },
  { text: 'Five minutes of starting beats an hour of planning.' },
  {
    text: 'The most beloved deeds to Allah are those done consistently, even if small.',
    src: 'Hadith — Bukhari & Muslim',
  },
];

export const DUA = {
  ar: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
  tr: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
  en: 'O Allah, help me to remember You, thank You, and worship You well.',
};

// ---- money ----
export const EXPENSE_CATS = {
  food: { label: 'Food & groceries', icon: '🛒' },
  eating: { label: 'Eating out & snacks', icon: '☕' },
  transport: { label: 'Transport', icon: '🚌' },
  bills: { label: 'Bills & phone', icon: '💡' },
  family: { label: 'Family & home', icon: '🏠' },
  health: { label: 'Health', icon: '💊' },
  education: { label: 'Books & learning', icon: '📚' },
  games: { label: 'Games & fun', icon: '🎮' },
  subscriptions: { label: 'Subscriptions', icon: '🔁' },
  clothes: { label: 'Clothes & shopping', icon: '👕' },
  sadaqa: { label: 'Sadaqa & gifts', icon: '🤲' },
  other: { label: 'Other', icon: '•' },
};
export const INCOME_CATS = {
  salary: { label: 'Salary', icon: '💼' },
  freelance: { label: 'Freelance / side work', icon: '💻' },
  family: { label: 'From family', icon: '🏠' },
  gift: { label: 'Gift', icon: '🎁' },
  sale: { label: 'Sold something', icon: '🏷️' },
  other: { label: 'Other', icon: '•' },
};
export const CURRENCIES = ['DZD', 'MAD', 'TND', 'EGP', 'SAR', 'AED', 'EUR', 'USD', 'GBP', 'TRY'];
const COUNTRY_CURRENCY = {
  Algeria: 'DZD', Morocco: 'MAD', Tunisia: 'TND', Egypt: 'EGP', 'Saudi Arabia': 'SAR', 'United Arab Emirates': 'AED',
  France: 'EUR', Germany: 'EUR', Belgium: 'EUR', Spain: 'EUR', Italy: 'EUR', Netherlands: 'EUR',
  'United Kingdom': 'GBP', Turkey: 'TRY', 'United States': 'USD', Canada: 'USD',
};
// How a currency is written locally, after the amount (150 DA). Others use the standard format.
export const CURRENCY_LABELS = { DZD: 'DA' };
export const currencyOf = (settings) => settings.currency || COUNTRY_CURRENCY[settings.location?.country] || 'USD';
