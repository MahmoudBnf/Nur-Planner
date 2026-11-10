// When repeating money is due. Shared by the server (which logs it) and the
// client (which forecasts the rest of the month).
//   { freq: 'monthly', day: 1..31 } — the 31st means the last day of short months
//   { freq: 'weekly',  day: 0..6 }  — weekday
//   { freq: 'yearly',  day, month: 1..12 }
const lastDay = (y, m) => new Date(y, m, 0).getDate();

export function isDue(r, d) {
  const [y, m, day] = d.split('-').map(Number);
  if (r.freq === 'weekly') return new Date(y, m - 1, day).getDay() === Number(r.day);
  const dom = Math.min(Number(r.day) || 1, lastDay(y, m));
  if (r.freq === 'yearly') return m === Number(r.month) && day === dom;
  return day === dom;
}
