import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  User as UserIcon,
  Zap,
  Keyboard,
  Paintbrush,
  Copy,
  Check,
  Target,
  Activity,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  DAYS,
  TIME_SLOTS,
  AVAILABILITY_STATES,
  getCellKey,
  getMonday,
  getWeekId,
  addDays,
  formatWeekRange,
} from "../lib/timeSlots";

const TEAM_VIEW = "__team__";

/* ============================================================
   Tactical HUD primitives — reusable decorative shells
   ============================================================ */

// Corner brackets giving panels a military HUD feel
const Bracket = ({ pos, color = "#7A8B42" }) => {
  const base = "absolute w-3 h-3 pointer-events-none";
  const map = {
    tl: `top-0 left-0 border-t border-l`,
    tr: `top-0 right-0 border-t border-r`,
    bl: `bottom-0 left-0 border-b border-l`,
    br: `bottom-0 right-0 border-b border-r`,
  };
  return <span className={`${base} ${map[pos]}`} style={{ borderColor: color }} />;
};

const Panel = ({ children, className = "", glow = false }) => (
  <div
    className={`relative bg-[#0B0F0B]/70 backdrop-blur-xl border border-[#27272A] ${
      glow ? "shadow-[0_0_40px_-10px_rgba(122,139,66,0.4)]" : ""
    } ${className}`}
    style={{
      backgroundImage:
        "radial-gradient(circle at 20% 0%, rgba(122,139,66,0.08) 0%, transparent 50%)",
    }}
  >
    <Bracket pos="tl" />
    <Bracket pos="tr" />
    <Bracket pos="bl" />
    <Bracket pos="br" />
    {children}
  </div>
);

/* ============================================================
   Heatmap helper — maps availability count to olive intensity
   ============================================================ */
const heatStyle = (count, total) => {
  if (!count || !total) return {};
  const ratio = Math.min(count / total, 1);
  // Olive → lime progression
  const alpha = 0.1 + ratio * 0.55;
  return {
    background: `linear-gradient(135deg, rgba(122,139,66,${alpha}) 0%, rgba(195,220,92,${alpha * 0.7}) 100%)`,
    boxShadow: ratio > 0.6 ? `inset 0 0 20px rgba(195,220,92,${ratio * 0.3})` : "none",
  };
};

/* ============================================================
   Main component
   ============================================================ */
export default function Availability() {
  const { user } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [allDocs, setAllDocs] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(TEAM_VIEW);
  const [saving, setSaving] = useState(false);

  // Enhancements state
  const [paintMode, setPaintMode] = useState(false);
  const [paintState, setPaintState] = useState("disponible"); // state to paint
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null); // { dayKey, slotIndex }
  const [copied, setCopied] = useState(false);
  const paintedRef = useRef(new Set()); // avoid re-writing same cell during a drag

  const weekId = useMemo(() => getWeekId(monday), [monday]);

  /* ------------ Firestore subscriptions (unchanged) ------------ */
  useEffect(() => {
    const q = query(collection(db, "availabilities"), where("weekId", "==", weekId));
    const unsub = onSnapshot(q, (snap) => {
      const docs = [];
      snap.forEach((d) => docs.push(d.data()));
      setAllDocs(docs);
    });
    return unsub;
  }, [weekId]);

  useEffect(() => {
    const myId = `${user.uid}_${weekId}`;
    setDoc(
      doc(db, "availabilities", myId),
      {
        userId: user.uid,
        userName: user.displayName || user.email,
        userPhoto: user.photoURL || null,
        weekId,
      },
      { merge: true }
    ).catch(() => {});
  }, [user, weekId]);

  const myDoc = useMemo(
    () =>
      allDocs.find((d) => d.userId === user.uid) || {
        userId: user.uid,
        userName: user.displayName || user.email,
        userPhoto: user.photoURL,
        slots: {},
      },
    [allDocs, user]
  );

  const selectedDoc = useMemo(() => {
    if (selectedUserId === TEAM_VIEW) return null;
    return allDocs.find((d) => d.userId === selectedUserId) || null;
  }, [allDocs, selectedUserId]);

  const teamAgg = useMemo(() => {
    const agg = {};
    for (const d of allDocs) {
      const slots = d.slots || {};
      for (const [key, v] of Object.entries(slots)) {
        if (!agg[key]) agg[key] = { disponible: 0, indisponible: 0, incertain: 0, users: [] };
        if (agg[key][v] !== undefined) agg[key][v] += 1;
        agg[key].users.push({ name: d.userName, state: v });
      }
    }
    return agg;
  }, [allDocs]);

  const teamSize = allDocs.length || 1;

  /* ------------ Feature (a): Weekly stats ------------ */
  const weekStats = useMemo(() => {
    let totalAvailable = 0;
    let totalCells = 0;
    let bestKey = null;
    let bestCount = 0;

    for (const day of DAYS) {
      for (const slot of TIME_SLOTS) {
        const k = getCellKey(day.key, slot.index);
        const a = teamAgg[k]?.disponible || 0;
        totalAvailable += a;
        totalCells += teamSize;
        if (a > bestCount) {
          bestCount = a;
          bestKey = { day: day.label, slot: slot.label, count: a, key: k };
        }
      }
    }
    const rate = totalCells ? Math.round((totalAvailable / totalCells) * 100) : 0;
    return { rate, bestKey, bestCount };
  }, [teamAgg, teamSize]);

  /* ------------ Cell state mutation ------------ */
  const setCellState = useCallback(
    async (dayKey, slotIndex, forcedState) => {
      const key = getCellKey(dayKey, slotIndex);
      const current = myDoc.slots?.[key];

      let next;
      if (forcedState !== undefined) {
        next = forcedState; // null => clear
      } else {
        const order = [undefined, "disponible", "indisponible", "incertain"];
        const idx = order.indexOf(current);
        next = order[(idx === -1 ? 0 : idx + 1) % order.length];
      }

      setSaving(true);
      const ref = doc(db, "availabilities", `${user.uid}_${weekId}`);
      try {
        await setDoc(
          ref,
          {
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhoto: user.photoURL || null,
            weekId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        if (next === undefined || next === null) {
          await updateDoc(ref, { [`slots.${key}`]: deleteField() });
        } else {
          await updateDoc(ref, { [`slots.${key}`]: next });
        }
      } finally {
        setSaving(false);
      }
    },
    [myDoc, user, weekId]
  );

  /* ------------ Feature (c): Drag-paint handlers ------------ */
  const handleCellMouseDown = (dayKey, slotIndex) => {
    if (!isOwnView) return;
    if (paintMode) {
      setIsDragging(true);
      paintedRef.current = new Set([getCellKey(dayKey, slotIndex)]);
      setCellState(dayKey, slotIndex, paintState);
    } else {
      setCellState(dayKey, slotIndex); // cycle
    }
  };
  const handleCellEnter = (dayKey, slotIndex) => {
    setHoveredCell({ dayKey, slotIndex });
    if (!isDragging || !paintMode || !isOwnView) return;
    const k = getCellKey(dayKey, slotIndex);
    if (paintedRef.current.has(k)) return;
    paintedRef.current.add(k);
    setCellState(dayKey, slotIndex, paintState);
  };
  useEffect(() => {
    const up = () => {
      setIsDragging(false);
      paintedRef.current = new Set();
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  /* ------------ Feature (d): Keyboard shortcuts ------------ */
  useEffect(() => {
    const onKey = (e) => {
      if (!hoveredCell || selectedUserId !== user.uid) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const map = { 1: "disponible", 2: "indisponible", 3: "incertain", 0: null };
      if (e.key in map) {
        e.preventDefault();
        setCellState(hoveredCell.dayKey, hoveredCell.slotIndex, map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredCell, selectedUserId, user.uid, setCellState]);

  /* ------------ Feature (e): Export / Copy ------------ */
  const exportAsText = async () => {
    const lines = [];
    lines.push(`# Disponibilités — ${weekId}`);
    lines.push(`Semaine : ${formatWeekRange(monday)}`);
    lines.push("");
    const header = ["UTC", ...DAYS.map((d) => d.label)].join(" ");
    lines.push(header);
    for (const slot of TIME_SLOTS) {
      const row = [slot.label];
      for (const d of DAYS) {
        const k = getCellKey(d.key, slot.index);
        if (isTeamView) {
          const a = teamAgg[k];
          row.push(a ? `✓${a.disponible}/?${a.incertain}/✕${a.indisponible}` : "—");
        } else {
          const sDoc = isOwnView ? myDoc : selectedDoc;
          const st = sDoc?.slots?.[k];
          const short = AVAILABILITY_STATES.find((s) => s.key === st)?.short || "—";
          row.push(short);
        }
      }
      lines.push(row.join("	"));
    }
    try {
      await navigator.clipboard.writeText(lines.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  const getState = (k) => AVAILABILITY_STATES.find((s) => s.key === k);

  const isTeamView = selectedUserId === TEAM_VIEW;
  const isOwnView = selectedUserId === user.uid;

  const userList = useMemo(() => {
    const others = allDocs.filter((d) => d.userId !== user.uid);
    return [myDoc, ...others];
  }, [allDocs, myDoc, user.uid]);

  /* ============================================================
     Render
     ============================================================ */
  return (
    <div
      className="relative min-h-screen p-4 md:p-8 text-zinc-200 select-none"
      style={{
        background:
          "radial-gradient(ellipse at top, #0F1510 0%, #070908 55%, #050605 100%)",
      }}
      data-testid="availability-root"
    >
      {/* Grain overlay for tactical texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
      {/* Scan-line decoration */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] bg-[repeating-linear-gradient(0deg,transparent_0_2px,#C3DC5C_2px_3px)]" />

      <div className="relative max-w-[1400px] mx-auto space-y-6">
        {/* ---------- HERO / TITLE ---------- */}
        <Panel className="p-6 md:p-8" glow>
          <div className="flex items-center gap-3 text-[#C3DC5C] font-rajdhani uppercase tracking-[0.4em] text-xs">
            <Activity size={14} className="animate-pulse" />
            <span>Squad Availability Matrix</span>
            <span className="ml-auto text-[10px] text-zinc-500">
              // LIVE · {allDocs.length} OPERATIVES
            </span>
          </div>
          <h1
            className="mt-2 font-rajdhani font-bold uppercase tracking-wider text-4xl md:text-5xl bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg,#F4F8E8 0%,#C3DC5C 60%,#7A8B42 100%)",
            }}
          >
            Disponibilités
          </h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
            Cliquez sur votre grille pour cycler :{" "}
            <span className="text-emerald-400">Disponible</span> →{" "}
            <span className="text-red-400">Indisponible</span> →{" "}
            <span className="text-amber-400">Incertain</span> → Vide. Raccourcis{" "}
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A] text-[10px]">1</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A] text-[10px]">2</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A] text-[10px]">3</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A] text-[10px]">0</kbd>{" "}
            au survol.
          </p>
        </Panel>

        {/* ---------- STATS BAR (feature a) ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <TrendingUp size={12} /> Taux de dispo équipe
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="font-rajdhani font-bold text-4xl"
                style={{ color: weekStats.rate >= 50 ? "#C3DC5C" : "#E6B955" }}
                data-testid="stat-availability-rate"
              >
                {weekStats.rate}%
              </span>
              <span className="text-xs text-zinc-500">des créneaux</span>
            </div>
            <div className="mt-3 h-1.5 bg-[#1B221B] overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${weekStats.rate}%`,
                  background: "linear-gradient(90deg,#7A8B42,#C3DC5C)",
                  boxShadow: "0 0 12px rgba(195,220,92,0.6)",
                }}
              />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Trophy size={12} /> Meilleur créneau scrim
            </div>
            {weekStats.bestKey ? (
              <>
                <div className="mt-2 font-rajdhani text-2xl font-bold text-[#C3DC5C]" data-testid="stat-best-slot">
                  {weekStats.bestKey.day} · {weekStats.bestKey.slot}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="text-emerald-400 font-semibold">{weekStats.bestKey.count}</span>/
                  {teamSize} joueurs disponibles
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-zinc-600">Aucune donnée cette semaine</div>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Users size={12} /> Effectif semaine
            </div>
            <div className="mt-2 font-rajdhani text-4xl font-bold text-white">
              {allDocs.length}
            </div>
            <div className="mt-1 text-xs text-zinc-500">opérateurs connectés</div>
          </Panel>
        </div>

        {/* ---------- WEEK NAV + TOOLBAR ---------- */}
        <Panel className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setMonday(addDays(monday, -7))}
              data-testid="availability-prev-week"
              className="p-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all duration-200"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="px-4 py-2 border border-[#27272A] bg-[#0B0F0B]/60">
              <div className="font-rajdhani uppercase tracking-[0.3em] text-[10px] text-zinc-500">
                Semaine
              </div>
              <div className="font-rajdhani font-bold text-lg text-white">{weekId}</div>
              <div className="text-[11px] text-zinc-500">{formatWeekRange(monday)}</div>
            </div>

            <button
              onClick={() => setMonday(addDays(monday, 7))}
              data-testid="availability-next-week"
              className="p-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all duration-200"
            >
              <ChevronRight size={18} />
            </button>

            <div className="flex-1" />

            {/* Paint mode toggle */}
            <button
              onClick={() => setPaintMode((v) => !v)}
              disabled={!isOwnView}
              data-testid="toggle-paint-mode"
              className={`flex items-center gap-2 px-3 py-2 border text-xs font-rajdhani uppercase tracking-wider transition-all ${
                paintMode
                  ? "bg-[#7A8B42]/25 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_15px_rgba(195,220,92,0.35)]"
                  : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
              } ${!isOwnView ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Paintbrush size={13} />
              Peinture
            </button>

            {paintMode && isOwnView && (
              <div className="flex items-center gap-1 px-2 py-1 border border-[#27272A] bg-[#0B0F0B]/70">
                {AVAILABILITY_STATES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setPaintState(s.key)}
                    data-testid={`paint-${s.key}`}
                    title={s.label}
                    className={`px-2 py-1 text-[10px] font-rajdhani uppercase tracking-wider border transition-all ${
                      paintState === s.key
                        ? `${s.classes} border`
                        : "border-transparent text-zinc-500 hover:text-white"
                    }`}
                  >
                    {s.short}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={exportAsText}
              data-testid="export-copy"
              className="flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] text-xs font-rajdhani uppercase tracking-wider transition-all"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? "Copié !" : "Exporter"}
            </button>
          </div>

          {/* View selector tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedUserId(TEAM_VIEW)}
              data-testid="view-team"
              className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all duration-200 ${
                isTeamView
                  ? "bg-[#7A8B42]/20 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_20px_rgba(122,139,66,0.35)]"
                  : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
              }`}
            >
              <Users size={13} />
              Vue équipe ({allDocs.length})
            </button>
            <button
              onClick={() => setSelectedUserId(user.uid)}
              data-testid="view-me"
              className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all duration-200 ${
                isOwnView
                  ? "bg-[#7A8B42]/20 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_20px_rgba(122,139,66,0.35)]"
                  : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
              }`}
            >
              <UserIcon size={13} />
              Mes dispos
            </button>
            {userList
              .filter((d) => d.userId !== user.uid)
              .map((d) => {
                const active = selectedUserId === d.userId;
                return (
                  <button
                    key={d.userId}
                    onClick={() => setSelectedUserId(d.userId)}
                    data-testid={`user-tab-${d.userId}`}
                    className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all duration-200 ${
                      active
                        ? "bg-[#7A8B42]/20 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_20px_rgba(122,139,66,0.35)]"
                        : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
                    }`}
                  >
                    {d.userPhoto ? (
                      <img
                        src={d.userPhoto}
                        alt=""
                        className="w-5 h-5 rounded-full ring-1 ring-[#7A8B42]/40"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-[10px]">
                        {d.userName?.[0] || "?"}
                      </span>
                    )}
                    {d.userName}
                  </button>
                );
              })}
          </div>
        </Panel>

        {/* ---------- LEGEND + CONTEXT ---------- */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {AVAILABILITY_STATES.map((s) => (
              <div
                key={s.key}
                className={`flex items-center gap-2 px-2.5 py-1 border text-[11px] font-rajdhani uppercase tracking-wider ${s.classes}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {s.label}
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500 font-rajdhani uppercase tracking-wider">
            {isTeamView && (
              <>
                <Target size={12} className="text-[#C3DC5C]" />
                Vue agrégée — heatmap automatique
              </>
            )}
            {!isTeamView && !isOwnView && selectedDoc && (
              <>
                <UserIcon size={12} />
                Consultation — {selectedDoc.userName}
              </>
            )}
            {isOwnView && (
              <>
                <Zap size={12} className="text-[#C3DC5C] animate-pulse" />
                Mode édition {paintMode ? "· Peinture active" : "· Clic pour cycler"}
                {saving && <span className="text-[#C3DC5C]"> · sync…</span>}
              </>
            )}
          </div>
        </div>

        {/* ---------- GRID ---------- */}
        <Panel className="p-3 md:p-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#0B0F0B]/90 backdrop-blur text-left px-3 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]">
                  UTC
                </th>
                {DAYS.map((d, i) => {
                  const date = addDays(monday, i);
                  const isToday =
                    new Date().toDateString() === date.toDateString();
                  return (
                    <th
                      key={d.key}
                      className={`px-2 py-3 border-b border-[#27272A] font-rajdhani uppercase tracking-wider ${
                        isToday ? "text-[#C3DC5C]" : "text-zinc-300"
                      }`}
                    >
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {date.toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                      {isToday && (
                        <div className="mx-auto mt-1 w-1 h-1 rounded-full bg-[#C3DC5C] shadow-[0_0_8px_#C3DC5C]" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => (
                <tr key={slot.index} className="group">
                  <td className="sticky left-0 bg-[#0B0F0B]/90 backdrop-blur px-3 py-1.5 border-b border-[#1B221B] text-zinc-500 font-mono text-[11px] group-hover:text-[#C3DC5C] transition-colors">
                    {slot.label}
                  </td>
                  {DAYS.map((d) => {
                    const key = getCellKey(d.key, slot.index);
                    const isBest =
                      weekStats.bestKey?.key === key && weekStats.bestCount > 0;

                    /* ---------- TEAM VIEW CELL ---------- */
                    if (isTeamView) {
                      const agg = teamAgg[key];
                      const tooltip = agg?.users
                        ?.map((u) => `${u.name}: ${u.state}`)
                        .join(" ");
                      return (
                        <td
                          key={key}
                          title={tooltip}
                          onMouseEnter={() => setHoveredCell({ dayKey: d.key, slotIndex: slot.index })}
                          className="p-1 border-b border-[#1B221B] align-middle"
                        >
                          <div
                            className={`relative w-full min-h-[36px] px-2 py-1 flex items-center justify-center text-[11px] font-rajdhani tracking-wider transition-all duration-200 ${
                              isBest
                                ? "ring-1 ring-[#C3DC5C] shadow-[0_0_18px_rgba(195,220,92,0.55)]"
                                : "ring-1 ring-transparent hover:ring-[#27272A]"
                            }`}
                            style={heatStyle(agg?.disponible || 0, teamSize)}
                          >
                            {isBest && (
                              <Target
                                size={10}
                                className="absolute -top-1 -right-1 text-[#C3DC5C] drop-shadow-[0_0_4px_#C3DC5C]"
                              />
                            )}
                            {agg ? (
                              <div className="flex items-center gap-1.5">
                                {agg.disponible > 0 && (
                                  <span className="text-emerald-400 font-semibold">
                                    ✓{agg.disponible}
                                  </span>
                                )}
                                {agg.incertain > 0 && (
                                  <span className="text-amber-400">?{agg.incertain}</span>
                                )}
                                {agg.indisponible > 0 && (
                                  <span className="text-red-400/80">✕{agg.indisponible}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </div>
                        </td>
                      );
                    }

                    /* ---------- INDIVIDUAL VIEW CELL ---------- */
                    const sDoc = isOwnView ? myDoc : selectedDoc;
                    const stateKey = sDoc?.slots?.[key];
                    const state = getState(stateKey);
                    const editable = isOwnView;
                    return (
                      <td
                        key={key}
                        className="p-1 border-b border-[#1B221B] align-middle"
                      >
                        <button
                          onMouseDown={() => editable && handleCellMouseDown(d.key, slot.index)}
                          onMouseEnter={() => handleCellEnter(d.key, slot.index)}
                          onMouseLeave={() => setHoveredCell(null)}
                          disabled={!editable || saving}
                          data-testid={`cell-${key}`}
                          className={`w-full min-h-[36px] px-2 py-1 text-center font-rajdhani tracking-wider text-[11px] transition-all duration-150 ${
                            state
                              ? `${state.classes} border hover:brightness-125 hover:shadow-[0_0_15px_rgba(195,220,92,0.25)]`
                              : "bg-transparent hover:bg-[#1B221B] border border-transparent hover:border-[#27272A]"
                          } ${editable ? "cursor-pointer" : "cursor-default"} ${
                            hoveredCell?.dayKey === d.key &&
                            hoveredCell?.slotIndex === slot.index &&
                            editable
                              ? "ring-1 ring-[#C3DC5C]/50"
                              : ""
                          }`}
                        >
                          {state ? state.short : <span className="text-zinc-700">—</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* ---------- FOOTER SHORTCUTS HELP ---------- */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-600 font-rajdhani uppercase tracking-[0.25em] pt-2">
          <div className="flex items-center gap-2">
            <Keyboard size={12} />
            <span>Raccourcis :</span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A]">1</kbd> dispo
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A]">2</kbd> indispo
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A]">3</kbd> incertain
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-[#1B221B] border border-[#27272A]">0</kbd> vider
          </span>
          <span className="text-zinc-700">//</span>
          <span>Maintenir clic en mode peinture pour remplir plusieurs cases</span>
        </div>
      </div>
    </div>
  );
}
