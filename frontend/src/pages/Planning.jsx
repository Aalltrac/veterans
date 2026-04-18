import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  X,
  Calendar,
  Clock,
  Eraser,
  Paintbrush,
  Copy,
  Trash2,
  Activity,
  Radio,
  AlertTriangle,
  Download,
} from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  DAYS,
  TIME_SLOTS,
  SESSION_TYPES,
  getCellKey,
  getMonday,
  getWeekId,
  addDays,
  formatWeekRange,
} from "../lib/timeSlots";

/* ============================================================
   Tactical HUD primitives — alignés sur Login / Availability / EvaPass
   ============================================================ */
const Bracket = ({ pos, color = "#7A8B42", size = 12 }) => {
  const map = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2",
  };
  return (
    <span
      aria-hidden
      className={`absolute pointer-events-none ${map[pos]}`}
      style={{ width: size, height: size, borderColor: color }}
    />
  );
};

const Panel = ({ children, className = "", glow = false }) => (
  <div
    className={`relative border border-[#27272A] bg-[#0A0D0A]/90 backdrop-blur-xl ${
      glow ? "shadow-[0_0_50px_rgba(122,139,66,0.18)]" : ""
    } ${className}`}
  >
    <Bracket pos="tl" />
    <Bracket pos="tr" />
    <Bracket pos="bl" />
    <Bracket pos="br" />
    {children}
  </div>
);

const SectionLabel = ({ icon: Icon, children }) => (
  <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains">
    {Icon && <Icon size={10} />}
    <span>// {children}</span>
  </div>
);

/* ============================================================
   Main component
   ============================================================ */
export default function Planning() {
  const { isAdmin } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [slots, setSlots] = useState({});
  const [editingCell, setEditingCell] = useState(null); // {day, index}
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // Brush mode: quick-paint a selected session type by clicking cells
  const [brushKey, setBrushKey] = useState(null); // null | "erase" | sessionKey
  const [flash, setFlash] = useState(""); // small status strip

  const weekId = useMemo(() => getWeekId(monday), [monday]);
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  const isCurrentWeek = getWeekId(todayMonday) === weekId;

  useEffect(() => setMounted(true), []);

  // Live clock (UTC)
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Firestore sync
  useEffect(() => {
    const ref = doc(db, "plannings", weekId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSlots(snap.data().slots || {});
      else setSlots({});
    });
    return unsub;
  }, [weekId]);

  // Keyboard shortcuts: ← → = semaine, T = aujourd'hui, Esc = close modal / brush
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        setEditingCell(null);
        setBrushKey(null);
      }
      if (editingCell) return;
      if (e.key === "ArrowLeft") setMonday((m) => addDays(m, -7));
      if (e.key === "ArrowRight") setMonday((m) => addDays(m, 7));
      if (e.key.toLowerCase() === "t") setMonday(getMonday(new Date()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingCell]);

  const handleSetSession = useCallback(
    async (dayKey, slotIndex, sessionKey) => {
      if (!isAdmin) return;
      setSaving(true);
      const key = getCellKey(dayKey, slotIndex);
      const newSlots = { ...slots };
      if (sessionKey === null) delete newSlots[key];
      else newSlots[key] = sessionKey;
      try {
        await setDoc(
          doc(db, "plannings", weekId),
          { slots: newSlots, weekId, updatedAt: new Date().toISOString() },
          { merge: true }
        );
        setSlots(newSlots);
        setEditingCell(null);
      } finally {
        setSaving(false);
      }
    },
    [isAdmin, slots, weekId]
  );

  const clearWeek = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Vider toute la semaine ${weekId} ?`)) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "plannings", weekId),
        { slots: {}, weekId, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setSlots({});
      setFlash("Semaine vidée");
    } finally {
      setSaving(false);
      setTimeout(() => setFlash(""), 2000);
    }
  };

  const copyFromLastWeek = async () => {
    if (!isAdmin) return;
    const prevId = getWeekId(addDays(monday, -7));
    // Read once via a one-shot snapshot trick: use onSnapshot that we immediately unsub.
    const ref = doc(db, "plannings", prevId);
    const unsub = onSnapshot(ref, async (snap) => {
      unsub();
      const prev = snap.exists() ? snap.data().slots || {} : {};
      if (!Object.keys(prev).length) {
        setFlash("Semaine précédente vide");
        setTimeout(() => setFlash(""), 2000);
        return;
      }
      setSaving(true);
      try {
        await setDoc(
          doc(db, "plannings", weekId),
          { slots: prev, weekId, updatedAt: new Date().toISOString() },
          { merge: true }
        );
        setSlots(prev);
        setFlash("Semaine précédente copiée");
      } finally {
        setSaving(false);
        setTimeout(() => setFlash(""), 2000);
      }
    });
  };

  const exportCsv = () => {
    const header = ["Heure", ...DAYS.map((d) => d.label)].join(",");
    const rows = TIME_SLOTS.map((slot) => {
      const cells = DAYS.map((d) => {
        const s = SESSION_TYPES.find(
          (x) => x.key === slots[getCellKey(d.key, slot.index)]
        );
        return s ? s.label : "";
      });
      return [slot.label, ...cells].join(",");
    });
    const csv = [`# Planning ${weekId} — ${formatWeekRange(monday)}`, header, ...rows].join("");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning_${weekId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSession = (key) => SESSION_TYPES.find((s) => s.key === key);

  // Week stats
  const stats = useMemo(() => {
    const total = Object.keys(slots).length;
    const byType = SESSION_TYPES.map((t) => ({
      ...t,
      count: Object.values(slots).filter((v) => v === t.key).length,
    }));
    const capacity = DAYS.length * TIME_SLOTS.length;
    const pct = capacity ? Math.round((total / capacity) * 100) : 0;
    return { total, byType, capacity, pct };
  }, [slots]);

  // Current UTC hour for "now" row highlight
  const nowHour = clock.getUTCHours();
  const todayKey = DAYS[(clock.getUTCDay() + 6) % 7]?.key; // lundi-indexed

  const onCellClick = (dayKey, slotIndex) => {
    if (!isAdmin) return;
    if (brushKey === null) {
      setEditingCell({ day: dayKey, index: slotIndex });
      return;
    }
    const target = brushKey === "erase" ? null : brushKey;
    handleSetSession(dayKey, slotIndex, target);
  };

  const utcTime = clock.toISOString().slice(11, 19);

  return (
    <div
      className={`relative space-y-6 font-chivo transition-all duration-700 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      data-testid="planning-page"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-[#7A8B42]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[32rem] h-[32rem] rounded-full bg-[#C3DC5C]/5 blur-3xl" />

      {/* ---------- HEADER ---------- */}
      <Panel glow className="px-5 py-4 sm:px-6 sm:py-5 overflow-hidden">
        {/* Diagonal accent */}
        <div
          className="absolute top-0 right-0 h-1 w-28 bg-[#C3DC5C]"
          style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)" }}
        />

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <SectionLabel icon={Calendar}>Weekly Operation Plan</SectionLabel>
            <h1 className="font-rajdhani font-bold uppercase tracking-[0.2em] text-3xl sm:text-4xl text-white leading-none mt-2">
              Planning
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-2 font-jetbrains uppercase tracking-[0.2em]">
              {isAdmin
                ? "Cliquez sur un créneau pour attribuer une session"
                : "Consultation uniquement — Admin requis pour modifier"}
            </p>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonday(addDays(monday, -7))}
              data-testid="planning-prev-week"
              className="relative p-2.5 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42]/60 hover:bg-[#1B221B]/40 transition-all"
              aria-label="Semaine précédente"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="relative px-5 py-2 border border-[#27272A] bg-[#141A14] min-w-[240px] text-center">
              <Bracket pos="tl" size={8} />
              <Bracket pos="br" size={8} />
              <div className="font-jetbrains text-[10px] text-zinc-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2" data-testid="week-id">
                {isCurrentWeek && (
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-[#C3DC5C] animate-ping opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C3DC5C]" />
                  </span>
                )}
                {weekId}
              </div>
              <div className="font-rajdhani font-semibold uppercase tracking-wider text-[#C3DC5C] text-sm mt-0.5">
                {formatWeekRange(monday)}
              </div>
            </div>

            <button
              onClick={() => setMonday(addDays(monday, 7))}
              data-testid="planning-next-week"
              className="relative p-2.5 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42]/60 hover:bg-[#1B221B]/40 transition-all"
              aria-label="Semaine suivante"
            >
              <ChevronRight size={18} />
            </button>

            <button
              onClick={() => setMonday(getMonday(new Date()))}
              data-testid="planning-today"
              disabled={isCurrentWeek}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2.5 border border-[#7A8B42]/40 text-[#C3DC5C] font-rajdhani font-semibold uppercase tracking-[0.2em] text-xs hover:bg-[#7A8B42]/15 hover:shadow-[0_0_18px_rgba(195,220,92,0.25)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Clock size={12} /> Aujourd'hui
            </button>
          </div>
        </div>

        {/* HUD status strip */}
        <div className="mt-5 pt-4 border-t border-[#27272A]/70 flex flex-wrap items-center justify-between gap-3 font-jetbrains text-[10px] uppercase tracking-[0.25em] text-zinc-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[#C3DC5C]">
              <Radio size={10} />
              {saving ? "Sync…" : "Live Sync"}
            </span>
            <span className="hidden sm:inline text-zinc-600">//</span>
            <span className="hidden sm:inline flex items-center gap-1.5">
              <Activity size={10} className="text-[#7A8B42]" />
              {stats.total}/{stats.capacity} créneaux · {stats.pct}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#7A8B42]" data-testid="planning-clock">
              UTC {utcTime}
            </span>
            <kbd className="hidden md:inline px-1.5 py-0.5 border border-[#27272A] bg-[#1B221B] text-zinc-400">← →</kbd>
            <kbd className="hidden md:inline px-1.5 py-0.5 border border-[#27272A] bg-[#1B221B] text-zinc-400">T</kbd>
          </div>
        </div>
      </Panel>

      {/* ---------- LEGEND + STATS + BRUSH TOOLBAR ---------- */}
      <Panel className="px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Legend / brush picker */}
          <div className="space-y-2" data-testid="session-legend">
            <SectionLabel icon={Paintbrush}>
              {isAdmin && brushKey ? "Brush Mode — clique pour peindre" : "Session Types"}
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map((s) => {
                const active = brushKey === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => isAdmin && setBrushKey(active ? null : s.key)}
                    disabled={!isAdmin}
                    className={`relative px-2.5 py-1.5 border text-[11px] font-jetbrains uppercase tracking-[0.2em] transition-all ${
                      s.classes
                    } ${
                      active
                        ? "ring-2 ring-offset-2 ring-offset-[#0A0D0A] ring-[#C3DC5C] scale-[1.03]"
                        : isAdmin ? "hover:brightness-125" : "cursor-default"
                    }`}
                    title={`${stats.byType.find((t) => t.key === s.key)?.count || 0} créneaux`}
                  >
                    {s.label}
                    <span className="ml-2 opacity-70">
                      {stats.byType.find((t) => t.key === s.key)?.count || 0}
                    </span>
                  </button>
                );
              })}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setBrushKey(brushKey === "erase" ? null : "erase")}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] font-jetbrains uppercase tracking-[0.2em] transition-all ${
                      brushKey === "erase"
                        ? "border-red-500/70 bg-red-950/40 text-red-300 ring-2 ring-offset-2 ring-offset-[#0A0D0A] ring-red-500/60"
                        : "border-[#27272A] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                    }`}
                  >
                    <Eraser size={12} /> Gomme
                  </button>
                  {brushKey && (
                    <button
                      onClick={() => setBrushKey(null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#27272A] text-zinc-500 hover:text-white text-[11px] font-jetbrains uppercase tracking-[0.2em]"
                    >
                      <X size={12} /> Off
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Admin tools */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyFromLastWeek}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-300 hover:text-[#C3DC5C] hover:border-[#7A8B42]/50 font-rajdhani uppercase tracking-wider text-xs transition-all disabled:opacity-50"
                data-testid="planning-copy-prev"
              >
                <Copy size={13} /> Copier sem. préc.
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-300 hover:text-[#C3DC5C] hover:border-[#7A8B42]/50 font-rajdhani uppercase tracking-wider text-xs transition-all"
                data-testid="planning-export"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={clearWeek}
                disabled={saving || !stats.total}
                className="inline-flex items-center gap-2 px-3 py-2 border border-red-900/50 text-red-400/90 hover:text-red-300 hover:border-red-500/60 hover:bg-red-950/30 font-rajdhani uppercase tracking-wider text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="planning-clear"
              >
                <Trash2 size={13} /> Vider
              </button>
            </div>
          )}
        </div>

        {/* Capacity bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-jetbrains uppercase tracking-[0.25em] text-zinc-500 mb-1.5">
            <span>Occupation semaine</span>
            <span className="text-[#C3DC5C]">{stats.pct}%</span>
          </div>
          <div className="relative h-1.5 bg-[#1B221B] border border-[#27272A] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7A8B42] to-[#C3DC5C] transition-all duration-700"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>

        {/* Flash / read-only banners */}
        {flash && (
          <div className="mt-3 text-[11px] font-jetbrains uppercase tracking-[0.25em] text-[#C3DC5C] border border-[#7A8B42]/40 bg-[#1B221B]/50 px-3 py-2">
            ▸ {flash}
          </div>
        )}
        {!isAdmin && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300 border border-amber-500/30 bg-amber-900/10 px-3 py-2 font-jetbrains uppercase tracking-[0.25em]">
            <Lock size={12} /> Mode lecture seule — contacte un admin
          </div>
        )}
      </Panel>

      {/* ---------- GRID ---------- */}
      <Panel className="overflow-hidden">
        <div
          className={`overflow-auto max-h-[calc(100vh-360px)] ${
            brushKey ? "cursor-crosshair" : ""
          }`}
          data-testid="planning-grid"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-[#141A14] border-r border-b border-[#27272A] w-24 px-2 py-3 text-[10px] font-jetbrains uppercase tracking-[0.3em] text-[#7A8B42]">
                  UTC
                </th>
                {DAYS.map((d, i) => {
                  const date = addDays(monday, i);
                  const isToday =
                    isCurrentWeek && d.key === todayKey;
                  return (
                    <th
                      key={d.key}
                      className={`sticky top-0 z-20 border-r border-b border-[#27272A] px-2 py-3 min-w-[120px] transition-colors ${
                        isToday ? "bg-[#1B221B]" : "bg-[#141A14]"
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={`font-rajdhani font-bold uppercase tracking-[0.2em] text-sm ${
                            isToday ? "text-[#C3DC5C]" : "text-white"
                          }`}
                        >
                          {d.label}
                        </div>
                        <div className="text-[10px] font-jetbrains text-zinc-500 mt-0.5">
                          {date.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                        {isToday && (
                          <div className="mt-1 h-0.5 w-8 bg-[#C3DC5C] shadow-[0_0_8px_#C3DC5C]" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => {
                // parse hour from label (expects "HH:MM" prefix) to detect "now" row
                const hourMatch = /^(\d{1,2})/.exec(slot.label || "");
                const slotHour = hourMatch ? parseInt(hourMatch[1], 10) : -1;
                const isNowRow = isCurrentWeek && slotHour === nowHour;

                return (
                  <tr key={slot.index} className="group">
                    <td
                      className={`sticky left-0 z-10 border-r border-b border-[#27272A] px-2 py-1 text-center font-jetbrains text-xs tracking-widest transition-colors ${
                        isNowRow
                          ? "bg-[#1B221B] text-[#C3DC5C]"
                          : "bg-[#141A14] text-zinc-400 group-hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {isNowRow && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C3DC5C] animate-pulse shadow-[0_0_6px_#C3DC5C]" />
                        )}
                        {slot.label}
                      </div>
                    </td>
                    {DAYS.map((d) => {
                      const key = getCellKey(d.key, slot.index);
                      const sessionKey = slots[key];
                      const session = getSession(sessionKey);
                      const isTodayCol = isCurrentWeek && d.key === todayKey;
                      return (
                        <td
                          key={key}
                          className={`border-r border-b border-[#1F2937] p-0.5 ${
                            isTodayCol ? "bg-[#C3DC5C]/[0.02]" : ""
                          }`}
                          data-testid={`planning-cell-${d.key}-${slot.index}`}
                        >
                          <button
                            onClick={() => onCellClick(d.key, slot.index)}
                            disabled={!isAdmin}
                            title={
                              session
                                ? `${session.label} — ${d.label} ${slot.label}`
                                : `Libre — ${d.label} ${slot.label}`
                            }
                            className={`relative group/cell w-full min-h-[40px] px-2 py-1 text-left transition-all duration-150 ${
                              session
                                ? `${session.classes} border hover:brightness-125 hover:shadow-[0_0_14px_rgba(195,220,92,0.25)]`
                                : "bg-transparent border border-transparent hover:bg-[#1B221B] hover:border-[#7A8B42]/30"
                            } ${isAdmin ? "cursor-pointer" : "cursor-default"} ${
                              isNowRow && isTodayCol && !session
                                ? "ring-1 ring-[#C3DC5C]/40"
                                : ""
                            }`}
                          >
                            {session ? (
                              <span className="text-[10px] font-jetbrains font-semibold uppercase tracking-[0.15em] drop-shadow-sm">
                                {session.label}
                              </span>
                            ) : (
                              <span className="text-[10px] font-jetbrains text-zinc-700 group-hover/cell:text-[#7A8B42] transition-colors">
                                {isAdmin ? (brushKey ? "+" : "—") : "—"}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---------- EDIT MODAL ---------- */}
      {editingCell && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]"
          onClick={() => setEditingCell(null)}
          data-testid="planning-edit-modal"
        >
          {/* Scan line overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, #C3DC5C 2px, #C3DC5C 3px)",
            }}
          />
          <div
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Panel glow className="overflow-hidden">
              <div
                className="absolute top-0 right-0 h-1 w-20 bg-[#C3DC5C]"
                style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)" }}
              />
              <div className="flex items-start justify-between px-5 py-4 border-b border-[#27272A]">
                <div>
                  <SectionLabel icon={Paintbrush}>Attribuer session</SectionLabel>
                  <div className="font-rajdhani font-bold uppercase tracking-[0.15em] text-white text-lg mt-1.5">
                    {DAYS.find((d) => d.key === editingCell.day)?.label}
                    <span className="text-[#7A8B42] mx-2">·</span>
                    {TIME_SLOTS[editingCell.index].label}
                  </div>
                  <div className="text-[10px] font-jetbrains text-zinc-500 uppercase tracking-[0.25em] mt-1">
                    {addDays(monday, DAYS.findIndex((d) => d.key === editingCell.day))
                      .toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                  </div>
                </div>
                <button
                  onClick={() => setEditingCell(null)}
                  data-testid="close-edit-modal"
                  className="p-1 text-zinc-500 hover:text-white hover:bg-[#1B221B] transition-colors"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-2">
                {SESSION_TYPES.map((s) => {
                  const current = slots[getCellKey(editingCell.day, editingCell.index)] === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleSetSession(editingCell.day, editingCell.index, s.key)}
                      disabled={saving}
                      data-testid={`session-option-${s.key}`}
                      className={`relative w-full px-4 py-3 border text-left font-rajdhani font-semibold uppercase tracking-[0.15em] transition-all hover:brightness-125 hover:translate-x-0.5 ${s.classes} ${
                        current ? "ring-2 ring-offset-2 ring-offset-[#0A0D0A] ring-[#C3DC5C]" : ""
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        {s.label}
                        {current && (
                          <span className="text-[10px] font-jetbrains tracking-[0.25em] opacity-80">
                            // ACTIF
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => handleSetSession(editingCell.day, editingCell.index, null)}
                  disabled={saving}
                  data-testid="session-option-clear"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#27272A] text-zinc-400 hover:text-red-300 hover:border-red-500/50 hover:bg-red-950/20 font-rajdhani font-semibold uppercase tracking-[0.15em] transition-all"
                >
                  <Eraser size={14} /> Vider le créneau
                </button>
              </div>

              <div className="px-5 py-3 border-t border-[#27272A] flex items-center justify-between text-[10px] font-jetbrains uppercase tracking-[0.25em] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  {saving ? (
                    <>
                      <AlertTriangle size={10} className="text-[#E6B955] animate-pulse" />
                      Écriture…
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C3DC5C] animate-pulse" />
                      Firestore · {weekId}
                    </>
                  )}
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 border border-[#27272A] bg-[#1B221B] text-zinc-400">Esc</kbd> pour fermer
                </span>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}