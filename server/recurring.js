// Logs repeating money (salary, subscriptions…) as real transactions when
// their date comes. Like routines, each occurrence has a key remembered in
// `recurringKeys`, so an occurrence you delete is never recreated.
import { getDb, save, newId } from './db.js';
import { addDays } from '../shared/routines.js';
import { isDue } from '../shared/recurring.js';

export function syncRecurring(today) {
  const db = getDb();
  const created = [];
  for (const r of db.recurring) {
    if (!r.active) continue;
    const start = r.startDate || r.createdAt.slice(0, 10);
    // Catch up at most ~2 months if the app wasn't opened.
    for (let d = [start, addDays(today, -62)].sort()[1]; d <= today; d = addDays(d, 1)) {
      const key = `${r.id}:${d}`;
      if (!isDue(r, d) || db.recurringKeys[key]) continue;
      const tx = {
        id: newId(), createdAt: new Date().toISOString(),
        type: r.type, amount: Number(r.amount) || 0, category: r.category, note: r.note || '',
        date: d, recurringId: r.id, recurringKey: key,
      };
      db.transactions.push(tx);
      db.recurringKeys[key] = true;
      created.push(tx);
    }
  }
  if (created.length) save();
  return { created };
}
