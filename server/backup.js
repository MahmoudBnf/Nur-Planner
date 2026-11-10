// `npm run backup` — copies today's db.json into server/data/backups/.
import { dailyBackup } from './db.js';

console.log('Backup written to', dailyBackup());
