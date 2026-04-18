// 36 time slots of 40 minutes starting at 00:00
export const DAYS = [
  { key: "mon", label: "Lundi", short: "Lun" },
  { key: "tue", label: "Mardi", short: "Mar" },
  { key: "wed", label: "Mercredi", short: "Mer" },
  { key: "thu", label: "Jeudi", short: "Jeu" },
  { key: "fri", label: "Vendredi", short: "Ven" },
  { key: "sat", label: "Samedi", short: "Sam" },
  { key: "sun", label: "Dimanche", short: "Dim" },
];

export const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const totalMin = i * 40;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { index: i, label };
});

export const SESSION_TYPES = [
  { key: "mixte", label: "Session mixte", classes: "bg-cyan-900/50 text-cyan-300 border-cyan-500/60" },
  { key: "scrim", label: "Session scrim", classes: "bg-red-900/50 text-red-300 border-red-500/60" },
  { key: "is", label: "Session IS", classes: "bg-purple-900/50 text-purple-300 border-purple-500/60" },
  { key: "ligue_locale", label: "Ligue Locale", classes: "bg-amber-900/50 text-amber-300 border-amber-500/60" },
  { key: "coaching", label: "Coaching", classes: "bg-blue-900/50 text-blue-300 border-blue-500/60" },
  { key: "tournois", label: "Tournois", classes: "bg-orange-900/50 text-orange-300 border-orange-500/60" },
  { key: "evenement", label: "Evènement", classes: "bg-pink-900/50 text-pink-300 border-pink-500/60" },
];

export const AVAILABILITY_STATES = [
  { key: "disponible", label: "Disponible", short: "DISPO", classes: "bg-[#7A8B42]/30 text-[#C3DC5C] border-[#7A8B42]/60" },
  { key: "indisponible", label: "Indisponible", short: "INDISPO", classes: "bg-red-900/50 text-red-300 border-red-500/60" },
  { key: "incertain", label: "Incertain", short: "INCERTAIN", classes: "bg-amber-900/50 text-amber-300 border-amber-500/60" },
];

export function getCellKey(dayKey, slotIndex) {
  return `${dayKey}-${slotIndex}`;
}

// ISO week id like 2026-W07
export function getWeekId(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Get Monday of the week for a date
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${fmt(monday)} — ${fmt(sunday)}`;}