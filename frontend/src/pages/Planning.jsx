import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
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
  Sunrise,
  Sun,
  Moon,
  BarChart3,
  Keyboard,
  Target,
  Zap,
  ClipboardCopy,
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

const Panel = ({ children, className = "", glow = false, scan = false }) => (
  <div
    className={`relative border border-[#27272A] bg-[#0A0D0A]/90 backdrop-blur-xl ${
      glow ? "shadow-[0_0_50px_rgba(122,139,66,0.18)]" : ""
    } ${className}`}
  >
    <Bracket pos="tl" />
    <Bracket pos="tr" />
    <Bracket pos="bl" />
    <Bracket pos="br" />
    {scan && (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, #C3DC5C 2px 3px)",
        }}
      />
    )}
    {children}
  </div>
);

const SectionLabel = ({ icon: Icon, children }) => (
  <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains">
    {Icon && <Icon size={10} />}
    <span>// {children}</span>
  </div>
);

const Corner = ({ color = "#C3DC5C" }) => (
  <span
    aria-hidden
    className="absolute top-0 right-0 w-2 h-2"
    style={{
      background: color,
      clipPath: "polygon(100% 0, 0 0, 100% 100%)",
      filter: `drop-shadow(0 0 4px ${color})`,
    }}
  />
);

/* Day-part meta: split the 24 slots visually */
const DAY_PARTS = [
  { key: "dawn", label: "Early", icon: Sunrise, from: 0, to: 7 },
  { key: "day", label: "Day", icon: Sun, from: 8, to: 17 },
  { key: "night", label: "Night", icon: Moon, from: 18, to: 23 },
];

/* ============================================================
   Main component
   ============================================================ */
export default function Planning() {
  const { isAdmin } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [slots, setSlots] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  const [brushKey, setBrushKey] = useState(null);
  const [flash, setFlash] = useState("");
  const [focusDay, setFocusDay] = useState(null); // zoom on a single day column
  const [showHelp, setShowHelp] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);

  const gridRef = useRef(null);

  const weekId = useMemo(() => getWeekId(monday), [monday]);
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  const isCurrentWeek = getWeekId(todayMonday) === weekId;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ref = doc(db, "plannings", weekId);
    const unsub = onSnapshot(ref, (snap) => {
      setSlots(snap.exists() ? snap.data().slots || {} : {});
    });
    return unsub;
  }, [weekId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        setEditingCell(null);
        setBrushKey(null);
        setFocusDay(null);
        setShowHelp(false);
      }
      if (editingCell) return;
      if (e.key === "ArrowLeft") setMonday((m) => addDays(m, -7));
      if (e.key === "ArrowRight") setMonday((m) => addDays(m, 7));
      if (e.key.toLowerCase() === "t") setMonday(getMonday(new Date()));
      if (e.key.toLowerCase() === "c") setCompact((c) => !c);
      if (e.key === "?") setShowHelp((s) => !s);
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
    try {
      const snap = await getDoc(doc(db, "plannings", prevId));
      const prev = snap.exists() ? snap.data().slots || {} : {};
      if (!Object.keys(prev).length) {
        setFlash("Semaine précédente vide");
        setTimeout(() => setFlash(""), 2000);
        return;
      }
      setSaving(true);
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
  };

  /* NEW: duplicate an entire day column onto another day */
  const duplicateDay = async (fromKey, toKey) => {
    if (!isAdmin || fromKey === toKey) return;
    const next = { ...slots };
    // wipe target
    TIME_SLOTS.forEach((s) => delete next[getCellKey(toKey, s.index)]);
    // copy source
    TIME_SLOTS.forEach((s) => {
      const v = slots[getCellKey(fromKey, s.index)];
      if (v) next[getCellKey(toKey, s.index)] = v;
    });
    setSaving(true);
    try {
      await setDoc(
        doc(db, "plannings", weekId),
        { slots: next, weekId, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setSlots(next);
      setFlash(`${fromKey.toUpperCase()} → ${toKey.toUpperCase()} dupliqué`);
    } finally {
      setSaving(false);
      setTimeout(() => setFlash(""), 2000);
    }
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

  const stats = useMemo(() => {
    const total = Object.keys(slots).length;
    const byType = SESSION_TYPES.map((t) => ({
      ...t,
      count: Object.values(slots).filter((v) => v === t.key).length,
    }));
    const capacity = DAYS.length * TIME_SLOTS.length;
    const pct = capacity ? Math.round((total / capacity) * 100) : 0;
    const byDay = DAYS.map((d) => ({
      ...d,
      count: TIME_SLOTS.reduce(
        (acc, s) => acc + (slots[getCellKey(d.key, s.index)] ? 1 : 0),
        0
      ),
    }));
    const maxDay = Math.max(1, ...byDay.map((d) => d.count));
    return { total, byType, capacity, pct, byDay, maxDay };
  }, [slots]);

  const nowHour = (clock.getUTCHours() + 2) % 24;
  const nowMinutes = clock.getUTCMinutes();
  const todayKey = DAYS[((clock.getUTCDay() + 6 + (clock.getUTCHours() + 2 >= 24 ? 1 : 0)) % 7)]?.key;

  const onCellClick = (dayKey, slotIndex) => {
    if (!isAdmin) return;
    if (brushKey === null) {
      setEditingCell({ day: dayKey, index: slotIndex });
      return;
    }
    const target = brushKey === "erase" ? null : brushKey;
    handleSetSession(dayKey, slotIndex, target);
  };

  const utcTime = new Date(clock.getTime() + 2 * 3600 * 1000).toISOString().slice(11, 19);
  const visibleDays = focusDay ? DAYS.filter((d) => d.key === focusDay) : DAYS;

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
      <Panel glow scan className="px-5 py-4 sm:px-6 sm:py-5 overflow-hidden">
        <div
          className="absolute top-0 right-0 h-1 w-28 bg-[#C3DC5C]"
          style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)" }}
        />
        <Corner />

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <SectionLabel icon={Calendar}>Weekly Operation Plan</SectionLabel>
            <h1 className="font-rajdhani font-bold uppercase tracking-[0.2em] text-3xl sm:text-4xl text-white leading-none mt-2 relative">
              Planning

            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-2 font-jetbrains uppercase tracking-[0.2em]">
              {isAdmin
                ? "Cliquez sur un créneau pour attribuer une session"
                : "Consultation uniquement — Admin requis pour modifier"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonday(addDays(monday, -7))}
              data-testid="planning-prev-week"
              className="relative p-2.5 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42]/60 hover:bg-[#1B221B]/40 transition-all hover:-translate-x-0.5"
              aria-label="Semaine précédente"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="relative px-5 py-2 border border-[#27272A] bg-[#141A14] min-w-[240px] text-center overflow-hidden">
              <Bracket pos="tl" size={8} />
              <Bracket pos="br" size={8} />
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(80% 50% at 50% 0%, rgba(195,220,92,0.12), transparent 70%)",
                }}
              />
              <div className="relative font-jetbrains text-[10px] text-zinc-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2" data-testid="week-id">
                {isCurrentWeek && (
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-[#C3DC5C] animate-ping opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C3DC5C]" />
                  </span>
                )}
                {weekId}
              </div>
              <div className="relative font-rajdhani font-semibold uppercase tracking-wider text-[#C3DC5C] text-sm mt-0.5">
                {formatWeekRange(monday)}
              </div>
            </div>

            <button
              onClick={() => setMonday(addDays(monday, 7))}
              data-testid="planning-next-week"
              className="relative p-2.5 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42]/60 hover:bg-[#1B221B]/40 transition-all hover:translate-x-0.5"
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

        {/* HUD status strip + mini day bars */}
        <div className="mt-5 pt-4 border-t border-[#27272A]/70 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 font-jetbrains text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span className="flex items-center gap-2 text-[#C3DC5C]">
              <Radio size={10} className={saving ? "animate-pulse" : ""} />
              {saving ? "Sync…" : "Live Sync"}
            </span>
            <span className="text-zinc-600">//</span>
            <span className="flex items-center gap-1.5">
              <Activity size={10} className="text-[#7A8B42]" />
              {stats.total}/{stats.capacity} · {stats.pct}%
            </span>
          </div>

          {/* Mini day distribution */}
          <div className="hidden lg:flex items-end justify-center gap-1 h-10" aria-hidden>
            {stats.byDay.map((d) => {
              const h = Math.max(4, (d.count / stats.maxDay) * 100);
              const isToday = isCurrentWeek && d.key === todayKey;
              return (
                <div key={d.key} className="flex flex-col items-center gap-1" title={`${d.label} · ${d.count}`}>
                  <div
                    className={`w-3 transition-all duration-500 ${
                      isToday ? "bg-[#C3DC5C] shadow-[0_0_6px_#C3DC5C]" : "bg-[#7A8B42]/70"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                  <span className={`text-[8px] font-jetbrains tracking-widest ${isToday ? "text-[#C3DC5C]" : "text-zinc-600"}`}>
                    {d.label.slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 font-jetbrains text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <span className="text-[#7A8B42]" data-testid="planning-clock">
              UTC+2 {utcTime}
            </span>
            <button
              onClick={() => setCompact((c) => !c)}
              className="px-1.5 py-0.5 border border-[#27272A] hover:border-[#7A8B42]/50 hover:text-[#C3DC5C] transition-colors"
              title="Basculer densité (C)"
            >
              {compact ? "EXP" : "CMP"}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[#27272A] hover:border-[#7A8B42]/50 hover:text-[#C3DC5C] transition-colors"
              title="Raccourcis (?)"
            >
              <Keyboard size={10} /> ?
            </button>
          </div>
        </div>
      </Panel>

      {/* ---------- LEGEND + STATS + BRUSH TOOLBAR ---------- */}
      <Panel className="px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2 flex-1" data-testid="session-legend">
            <SectionLabel icon={Paintbrush}>
              {isAdmin && brushKey ? "Brush Mode — clique pour peindre" : "Session Types"}
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map((s) => {
                const active = brushKey === s.key;
                const count = stats.byType.find((t) => t.key === s.key)?.count || 0;
                const sharePct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <button
                    key={s.key}
                    onClick={() => isAdmin && setBrushKey(active ? null : s.key)}
                    disabled={!isAdmin}
                    className={`relative px-2.5 py-1.5 border text-[11px] font-jetbrains uppercase tracking-[0.2em] transition-all overflow-hidden ${s.classes} ${
                      active
                        ? "ring-2 ring-offset-2 ring-offset-[#0A0D0A] ring-[#C3DC5C] scale-[1.03] shadow-[0_0_14px_rgba(195,220,92,0.4)]"
                        : isAdmin ? "hover:brightness-125 hover:-translate-y-0.5" : "cursor-default"
                    }`}
                    title={`${count} créneaux · ${sharePct}%`}
                  >
                    <span className="relative z-10">{s.label}</span>
                    <span className="relative z-10 ml-2 opacity-70">{count}</span>
                    {/* share bar */}
                    <span
                      className="absolute left-0 bottom-0 h-[2px] bg-current opacity-70"
                      style={{ width: `${sharePct}%` }}
                    />
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

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyFromLastWeek}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-300 hover:text-[#C3DC5C] hover:border-[#7A8B42]/50 hover:bg-[#1B221B]/50 font-rajdhani uppercase tracking-wider text-xs transition-all disabled:opacity-50"
                data-testid="planning-copy-prev"
              >
                <Copy size={13} /> Copier sem. préc.
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-300 hover:text-[#C3DC5C] hover:border-[#7A8B42]/50 hover:bg-[#1B221B]/50 font-rajdhani uppercase tracking-wider text-xs transition-all"
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

        {/* Capacity bar with shimmer + type stack */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-jetbrains uppercase tracking-[0.25em] text-zinc-500 mb-1.5">
            <span className="flex items-center gap-2">
              <BarChart3 size={10} className="text-[#7A8B42]" />
              Occupation semaine
            </span>
            <span className="text-[#C3DC5C]">{stats.pct}%</span>
          </div>
          <div className="relative h-2 bg-[#1B221B] border border-[#27272A] overflow-hidden">
            {/* stacked segments */}
            <div className="absolute inset-0 flex">
              {stats.byType.map((t) => {
                const w = (t.count / stats.capacity) * 100;
                if (!w) return null;
                return (
                  <div
                    key={t.key}
                    className={`${t.classes} border-0 opacity-90`}
                    style={{ width: `${w}%` }}
                    title={`${t.label} · ${t.count}`}
                  />
                );
              })}
            </div>
            {/* shimmer */}
            <div
              className="absolute inset-y-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{ animation: "shimmer 2.8s linear infinite" }}
            />
          </div>
        </div>

        {flash && (
          <div className="mt-3 text-[11px] font-jetbrains uppercase tracking-[0.25em] text-[#C3DC5C] border border-[#7A8B42]/40 bg-[#1B221B]/50 px-3 py-2 flex items-center gap-2">
            <Zap size={12} className="text-[#C3DC5C]" />
            {flash}
          </div>
        )}
        {!isAdmin && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300 border border-amber-500/30 bg-amber-900/10 px-3 py-2 font-jetbrains uppercase tracking-[0.25em]">
            <Lock size={12} /> Mode lecture seule — contacte un admin
          </div>
        )}
        {focusDay && (
          <div className="mt-3 flex items-center justify-between text-[11px] font-jetbrains uppercase tracking-[0.25em] text-[#C3DC5C] border border-[#7A8B42]/40 bg-[#1B221B]/50 px-3 py-2">
            <span className="flex items-center gap-2">
              <Target size={12} />
              Focus · {DAYS.find((d) => d.key === focusDay)?.label}
            </span>
            <button onClick={() => setFocusDay(null)} className="hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}
      </Panel>

      {/* ---------- GRID ---------- */}
      <Panel className="overflow-hidden" scan>
        <div
          ref={gridRef}
          className={`overflow-auto max-h-[calc(100vh-380px)] ${
            brushKey ? "cursor-crosshair" : ""
          }`}
          data-testid="planning-grid"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-[#141A14] border-r border-b border-[#27272A] w-24 px-2 py-3 text-[10px] font-jetbrains uppercase tracking-[0.3em] text-[#7A8B42]">
                  UTC+2
                </th>
                {visibleDays.map((d, i) => {
                  const realIndex = DAYS.findIndex((x) => x.key === d.key);
                  const date = addDays(monday, realIndex);
                  const isToday = isCurrentWeek && d.key === todayKey;
                  const count = stats.byDay.find((x) => x.key === d.key)?.count || 0;
                  const pct = Math.round((count / TIME_SLOTS.length) * 100);
                  return (
                    <th
                      key={d.key}
                      className={`sticky top-0 z-20 border-r border-b border-[#27272A] px-2 py-3 min-w-[120px] transition-colors relative group ${
                        isToday ? "bg-[#1B221B]" : "bg-[#141A14]"
                      }`}
                    >
                      <button
                        onClick={() => setFocusDay(focusDay === d.key ? null : d.key)}
                        className="flex flex-col items-center w-full"
                        title="Focus sur ce jour"
                      >
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
                        <div className="mt-1 h-[3px] w-10 bg-[#1B221B] overflow-hidden">
                          <div
                            className={`h-full ${isToday ? "bg-[#C3DC5C] shadow-[0_0_6px_#C3DC5C]" : "bg-[#7A8B42]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                      {isAdmin && (
                        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const tgt = window.prompt(
                                `Dupliquer ${d.key.toUpperCase()} vers quel jour ? (${DAYS.map(x=>x.key).join(", ")})`
                              );
                              if (tgt && DAYS.some((x) => x.key === tgt)) duplicateDay(d.key, tgt);
                            }}
                            className="p-1 border border-[#27272A] bg-[#0A0D0A] text-zinc-500 hover:text-[#C3DC5C] hover:border-[#7A8B42]/60"
                            title="Dupliquer colonne"
                          >
                            <ClipboardCopy size={10} />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, rowIdx) => {
                const hourMatch = /^(\d{1,2})/.exec(slot.label || "");
                const slotHour = hourMatch ? parseInt(hourMatch[1], 10) : -1;
                const isNowRow = isCurrentWeek && slotHour === nowHour;
                const part = DAY_PARTS.find((p) => slotHour >= p.from && slotHour <= p.to);
                const prevPart =
                  rowIdx > 0
                    ? (() => {
                        const prevHm = /^(\d{1,2})/.exec(TIME_SLOTS[rowIdx - 1].label || "");
                        const prevH = prevHm ? parseInt(prevHm[1], 10) : -1;
                        return DAY_PARTS.find((p) => prevH >= p.from && prevH <= p.to);
                      })()
                    : null;
                const showDivider = part && (!prevPart || prevPart.key !== part.key);
                const Ic = part?.icon;

                return (
                  <>
                    {showDivider && (
                      <tr key={`div-${slot.index}`} aria-hidden>
                        <td
                          colSpan={1 + visibleDays.length}
                          className="bg-[#0F130F] border-b border-[#27272A] px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2 text-[9px] font-jetbrains uppercase tracking-[0.4em] text-[#7A8B42]">
                            {Ic && <Ic size={10} />}
                            <span>// {part.label}</span>
                            <span className="flex-1 h-px bg-gradient-to-r from-[#7A8B42]/40 to-transparent" />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={slot.index} className="group">
                      <td
                        className={`sticky left-0 z-10 border-r border-b border-[#27272A] px-2 ${
                          compact ? "py-0.5" : "py-1"
                        } text-center font-jetbrains text-xs tracking-widest transition-colors ${
                          isNowRow
                            ? "bg-[#1B221B] text-[#C3DC5C]"
                            : "bg-[#141A14] text-zinc-400 group-hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 relative">
                          {isNowRow && (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#C3DC5C] animate-pulse shadow-[0_0_6px_#C3DC5C]" />
                              {/* now-line across grid */}
                              <span
                                aria-hidden
                                className="absolute left-full top-1/2 h-px bg-gradient-to-r from-[#C3DC5C] via-[#C3DC5C]/60 to-transparent pointer-events-none"
                                style={{
                                  width: "200vw",
                                  transform: `translateY(${(nowMinutes / 60) * 100 - 50}%)`,
                                  boxShadow: "0 0 6px #C3DC5C",
                                }}
                              />
                            </>
                          )}
                          {slot.label}
                        </div>
                      </td>
                      {visibleDays.map((d) => {
                        const key = getCellKey(d.key, slot.index);
                        const sessionKey = slots[key];
                        const session = getSession(sessionKey);
                        const isTodayCol = isCurrentWeek && d.key === todayKey;
                        const hovered = hoverCell === key;
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
                              onMouseEnter={() => setHoverCell(key)}
                              onMouseLeave={() => setHoverCell((k) => (k === key ? null : k))}
                              disabled={!isAdmin}
                              title={
                                session
                                  ? `${session.label} — ${d.label} ${slot.label}`
                                  : `Libre — ${d.label} ${slot.label}`
                              }
                              className={`relative group/cell w-full ${
                                compact ? "min-h-[28px] px-1.5 py-0.5" : "min-h-[40px] px-2 py-1"
                              } text-left transition-all duration-150 overflow-hidden ${
                                session
                                  ? `${session.classes} border hover:brightness-125 hover:shadow-[0_0_14px_rgba(195,220,92,0.25)] hover:-translate-y-[1px]`
                                  : "bg-transparent border border-transparent hover:bg-[#1B221B] hover:border-[#7A8B42]/30"
                              } ${isAdmin ? "cursor-pointer" : "cursor-default"} ${
                                isNowRow && isTodayCol && !session
                                  ? "ring-1 ring-[#C3DC5C]/40"
                                  : ""
                              } ${hovered && isAdmin ? "ring-1 ring-[#7A8B42]/50" : ""}`}
                            >
                              {session && (
                                <span
                                  aria-hidden
                                  className="absolute top-0 right-0 w-1.5 h-1.5 bg-current opacity-80"
                                  style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
                                />
                              )}
                              {session ? (
                                <span className="text-[10px] font-jetbrains font-semibold uppercase tracking-[0.15em] drop-shadow-sm">
                                  {session.label}
                                </span>
                              ) : (
                                <span className="text-[10px] font-jetbrains text-zinc-700 group-hover/cell:text-[#7A8B42] transition-colors">
                                  {isAdmin ? (brushKey ? "+" : "—") : "—"}
                                </span>
                              )}
                              {/* corner tick on hover for empty cells */}
                              {!session && isAdmin && (
                                <span
                                  aria-hidden
                                  className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#7A8B42] group-hover/cell:w-full transition-all duration-300"
                                />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </>
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
            <Panel glow scan className="overflow-hidden animate-[slideUp_260ms_ease-out]">
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
                {SESSION_TYPES.map((s, i) => {
                  const current = slots[getCellKey(editingCell.day, editingCell.index)] === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleSetSession(editingCell.day, editingCell.index, s.key)}
                      disabled={saving}
                      data-testid={`session-option-${s.key}`}
                      style={{ animation: `slideUp 200ms ease-out ${i * 40}ms backwards` }}
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

      {/* ---------- SHORTCUTS HELP ---------- */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]"
          onClick={() => setShowHelp(false)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <Panel glow className="p-5 animate-[slideUp_260ms_ease-out]">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel icon={Keyboard}>Shortcuts</SectionLabel>
                <button onClick={() => setShowHelp(false)} className="p-1 text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <ul className="space-y-2 text-[11px] font-jetbrains uppercase tracking-[0.2em] text-zinc-400">
                {[
                  ["← / →", "Semaine préc/suiv"],
                  ["T", "Aujourd'hui"],
                  ["C", "Densité compact"],
                  ["Esc", "Fermer modals"],
                  ["?", "Afficher cette aide"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between border-b border-[#27272A]/50 pb-1.5">
                    <kbd className="px-2 py-0.5 border border-[#27272A] bg-[#1B221B] text-[#C3DC5C]">{k}</kbd>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}