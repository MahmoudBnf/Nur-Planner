// Prayer names and the checkpoint message sent at each prayer. Shared by the
// client (in-app reminders) and the server (phone notifications).
export const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const PRAYER_NUDGES = {
  Fajr: "After the prayer: Qur'an, or the first step of your main task.",
  Dhuhr: 'Checkpoint — have you started your main task? If not, 5 minutes now.',
  Asr: 'After Asr: study, work, exercise — the productive afternoon block.',
  Maghrib: 'Finish what matters today and prepare tomorrow.',
  Isha: 'After Isha: choose your recreation deliberately, then sleep on time.',
};
