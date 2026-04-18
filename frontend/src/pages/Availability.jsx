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
  Calendar,
  Sparkles,
  Crosshair,
  FileDown,
  Radio,
  Swords,
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
const COMPARE_VIEW = "__compare__";

/* ============================================================
   HUD Primitives
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
      className={`absolute pointer-events-none ${map[pos]}`}
      style={{ width: size, height: size, borderColor: color }}
    />
  );
};

const Panel = ({ children, className = "", glow = false, accent = "#7A8B42" }) => (
  <div
    className={`relative bg-[#0B0F0B]/75 backdrop-blur-xl border border-[#1F2420] ${
      glow ? "shadow-[0_0_60px_-20px_rgba(122,139,66,0.55)]" : ""
    } ${className}`}
    style={{
      backgroundImage:
        "radial-gradient(circle at 15% 0%, rgba(122,139,66,0.09) 0%, transparent 55%), radial-gradient(circle at 85% 100%, rgba(195,220,92,0.04) 0%, transparent 60%)",
    }}
  >
    <Bracket pos="tl" color={accent} />
    <Bracket pos="tr" color={accent} />
    <Bracket pos="bl" color={accent} />
    <Bracket pos="br" color={accent} />
    {children}
  </div>
);

/* Animated SVG progress ring */
const RingProgress = ({ value = 0, size = 72, stroke = 6 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color = value >= 66 ? "#C3DC5C" : value >= 33 ? "#E6B955" : "#E67E52";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#1F2420" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${c}`}
        style={{
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: "stroke-dasharray 0.9s cubic-bezier(.65,.05,.36,1)",
        }}
      />
    </svg>
  );
};

/* Sparkbar — tiny vertical bars per day */
const SparkBar = ({ values = [], max = 1 }) => (
  <div className="flex items-end gap-[3px] h-6 mt-2">
    {values.map((v, i) => {
      const h = max ? Math.max(2, (v / max) * 100) : 2;
      const intense = v / (max || 1);
      return (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] transition-all"
          style={{
            height: `${h}%`,
            background: `linear-gradient(180deg,#C3DC5C ${Math.round(
              intense * 100
            )}%, #3D4626 100%)`,
            boxShadow: intense > 0.6 ? "0 0 6px rgba(195,220,92,0.6)" : "none",
          }}
        />
      );
    })}
  </div>
);

/* Heatmap gradient with richer stops */
const heatStyle = (count, total, highlighted = false) => {
  if (!count || !total) return {};
  const ratio = Math.min(count / total, 1);
  const alpha = 0.12 + ratio * 0.6;
  return {
    background: `linear-gradient(135deg,
      rgba(122,139,66,${alpha}) 0%,
      rgba(195,220,92,${alpha * 0.8}) 60%,
      rgba(230,246,145,${alpha * 0.55}) 100%)`,
    boxShadow:
      ratio > 0.55
        ? `inset 0 0 22px rgba(195,220,92,${ratio * 0.35})${
            highlighted ? ", 0 0 18px rgba(195,220,92,0.5)" : ""
          }`
        : highlighted
        ? "0 0 14px rgba(195,220,92,0.35)"
        : "none",
  };
};

/* ============================================================
   Main
   ============================================================ */
export default function Availability() {
  const { user } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [allDocs, setAllDocs] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(TEAM_VIEW);
  const [saving, setSaving] = useState(false);

  const [paintMode, setPaintMode] = useState(false);
  const [paintState, setPaintState] = useState("disponible");
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [copied, setCopied] = useState(false);
  const [scrimThreshold, setScrimThreshold] = useState(3);
  const [legendFilter, setLegendFilter] = useState(null); // filter ind. view
  const [compareUserId, setCompareUserId] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const paintedRef = useRef(new Set());

  const weekId = useMemo(() => getWeekId(monday), [monday]);

  /* Firestore subs */
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

  /* Live clock for current-slot indicator */
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    if (selectedUserId === TEAM_VIEW || selectedUserId === COMPARE_VIEW) return null;
    return allDocs.find((d) => d.userId === selectedUserId) || null;
  }, [allDocs, selectedUserId]);

  const compareDoc = useMemo(
    () => (compareUserId ? allDocs.find((d) => d.userId === compareUserId) : null),
    [allDocs, compareUserId]
  );

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

  /* Weekly stats + per-day breakdown for sparkline */
  const weekStats = useMemo(() => {
    let totalAvailable = 0;
    let totalCells = 0;
    let bestKey = null;
    let bestCount = 0;
    const perDay = DAYS.map(() => 0);
    const scrimSlots = [];

    DAYS.forEach((day, di) => {
      for (const slot of TIME_SLOTS) {
        const k = getCellKey(day.key, slot.index);
        const a = teamAgg[k]?.disponible || 0;
        totalAvailable += a;
        totalCells += teamSize;
        perDay[di] += a;
        if (a > bestCount) {
          bestCount = a;
          bestKey = { day: day.label, slot: slot.label, count: a, key: k };
        }
        if (a >= scrimThreshold) scrimSlots.push(k);
      }
    });
    const rate = totalCells ? Math.round((totalAvailable / totalCells) * 100) : 0;
    return { rate, bestKey, bestCount, perDay, scrimSlots: new Set(scrimSlots) };
  }, [teamAgg, teamSize, scrimThreshold]);

  /* Cell mutation */
  const setCellState = useCallback(
    async (dayKey, slotIndex, forcedState) => {
      const key = getCellKey(dayKey, slotIndex);
      const current = myDoc.slots?.[key];
      let next;
      if (forcedState !== undefined) {
        next = forcedState;
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

  /* Batch fill for templates */
  const batchSet = async (pairs) => {
    setSaving(true);
    const ref = doc(db, "availabilities", `${user.uid}_${weekId}`);
    const payload = { updatedAt: new Date().toISOString() };
    for (const [k, v] of pairs) {
      if (v === null) payload[`slots.${k}`] = deleteField();
      else payload[`slots.${k}`] = v;
    }
    try {
      await setDoc(
        ref,
        { userId: user.uid, userName: user.displayName || user.email, weekId },
        { merge: true }
      );
      await updateDoc(ref, payload);
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (type) => {
    const pairs = [];
    for (const d of DAYS) {
      for (const s of TIME_SLOTS) {
        const k = getCellKey(d.key, s.index);
        const hour = Number((s.label || "0").toString().split(":")[0]) || 0;
        if (type === "reset") pairs.push([k, null]);
        else if (type === "weekend") {
          const weekend = d.key === "sat" || d.key === "sun" || d.key === "samedi" || d.key === "dimanche";
          pairs.push([k, weekend && hour >= 18 ? "disponible" : null]);
        } else if (type === "evenings") {
          pairs.push([k, hour >= 20 && hour <= 23 ? "disponible" : null]);
        } else if (type === "full") pairs.push([k, "disponible"]);
      }
    }
    batchSet(pairs);
  };

  /* Drag-paint */
  const handleCellMouseDown = (dayKey, slotIndex) => {
    if (!isOwnView) return;
    if (paintMode) {
      setIsDragging(true);
      paintedRef.current = new Set([getCellKey(dayKey, slotIndex)]);
      setCellState(dayKey, slotIndex, paintState);
    } else {
      setCellState(dayKey, slotIndex);
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

  /* Keyboard: digits + arrows + T (today) */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "t" || e.key === "T") {
        setMonday(getMonday(new Date()));
        return;
      }
      if (!hoveredCell) return;

      // Arrow navigation
      const dayIdx = DAYS.findIndex((d) => d.key === hoveredCell.dayKey);
      const slotIdx = hoveredCell.slotIndex;
      if (e.key === "ArrowRight" && dayIdx < DAYS.length - 1) {
        e.preventDefault();
        setHoveredCell({ dayKey: DAYS[dayIdx + 1].key, slotIndex: slotIdx });
      } else if (e.key === "ArrowLeft" && dayIdx > 0) {
        e.preventDefault();
        setHoveredCell({ dayKey: DAYS[dayIdx - 1].key, slotIndex: slotIdx });
      } else if (e.key === "ArrowDown" && slotIdx < TIME_SLOTS.length - 1) {
        e.preventDefault();
        setHoveredCell({ dayKey: hoveredCell.dayKey, slotIndex: slotIdx + 1 });
      } else if (e.key === "ArrowUp" && slotIdx > 0) {
        e.preventDefault();
        setHoveredCell({ dayKey: hoveredCell.dayKey, slotIndex: slotIdx - 1 });
      }

      if (selectedUserId !== user.uid) return;
      const map = { 1: "disponible", 2: "indisponible", 3: "incertain", 0: null };
      if (e.key in map) {
        e.preventDefault();
        setCellState(hoveredCell.dayKey, hoveredCell.slotIndex, map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredCell, selectedUserId, user.uid, setCellState]);

  /* Export — supports txt / md / csv */
  const buildExport = (format = "txt") => {
    const sep = format === "csv" ? "," : format === "md" ? " | " : "     ";
    const rows = [];
    if (format === "md") rows.push(`# Disponibilités — ${weekId}`, `_${formatWeekRange(monday)}_`, "");
    else rows.push(`# Disponibilités — ${weekId}`, `Semaine : ${formatWeekRange(monday)}`, "");
    const header = ["UTC", ...DAYS.map((d) => d.label)];
    rows.push(header.join(sep));
    if (format === "md") rows.push(header.map(() => "---").join(" | "));
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
      rows.push(row.join(sep));
    }
    return rows.join("");
  };

  const exportAs = async (format) => {
    try {
      await navigator.clipboard.writeText(buildExport(format));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const getState = (k) => AVAILABILITY_STATES.find((s) => s.key === k);

  const isTeamView = selectedUserId === TEAM_VIEW;
  const isCompareView = selectedUserId === COMPARE_VIEW;
  const isOwnView = selectedUserId === user.uid;

  const userList = useMemo(() => {
    const others = allDocs.filter((d) => d.userId !== user.uid);
    return [myDoc, ...others];
  }, [allDocs, myDoc, user.uid]);

  /* current UTC day/slot for live indicator */
  const now = new Date(nowTick);
  const todayIdx = DAYS.findIndex((_, i) => {
    const d = addDays(monday, i);
    return d.toDateString() === now.toDateString();
  });
  const currentSlotIndex = useMemo(() => {
    const h = now.getUTCHours();
    return TIME_SLOTS.findIndex((s) => Number((s.label || "").split(":")[0]) === h);
  }, [nowTick]);

  /* ============================================================
     Render
     ============================================================ */
  return (
    <div
      className="relative min-h-screen p-4 md:p-8 text-zinc-200 select-none"
      style={{
        background:
          "radial-gradient(ellipse at top,#10170F 0%,#070908 55%,#040504 100%)",
      }}
      data-testid="availability-root"
    >
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
      {/* Scan lines */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] bg-[repeating-linear-gradient(0deg,transparent_0_2px,#C3DC5C_2px_3px)]" />
      {/* Vignette edges */}
      <div className="pointer-events-none fixed inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.65)_100%)]" />

      <div className="relative max-w-[1440px] mx-auto space-y-6">
        {/* HERO */}
        <Panel className="p-6 md:p-8 overflow-hidden" glow>
          <div className="flex items-center gap-3 text-[#C3DC5C] font-rajdhani uppercase tracking-[0.4em] text-xs">
            <Radio size={14} className="animate-pulse" />
            <span>Squad Availability Matrix</span>
            <span className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              LIVE · {allDocs.length} OPERATIVES
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-6 flex-wrap">
            <h1
              className="font-rajdhani font-black uppercase tracking-wider text-4xl md:text-6xl leading-[0.9] bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg,#F4F8E8 0%,#C3DC5C 55%,#7A8B42 100%)",
                textShadow: "0 0 40px rgba(195,220,92,0.15)",
              }}
            >
              Disponibilités<span className="text-[#C3DC5C]">.</span>
            </h1>
            <div className="font-mono text-[11px] text-zinc-500 leading-5 border-l border-[#1F2420] pl-4">
              <div>WK {weekId}</div>
              <div>{formatWeekRange(monday)}</div>
              <div className="text-[#7A8B42]">SYNC {saving ? "…" : "OK"}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500 max-w-2xl leading-relaxed">
            Clic pour cycler :{" "}
            <span className="text-emerald-400">Dispo</span> →{" "}
            <span className="text-red-400">Indispo</span> →{" "}
            <span className="text-amber-400">Incertain</span> → Vide. Raccourcis{" "}
            <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] text-[10px] font-mono">1</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] text-[10px] font-mono">2</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] text-[10px] font-mono">3</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] text-[10px] font-mono">0</kbd>{" "}
            · flèches pour naviguer · <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] text-[10px] font-mono">T</kbd> semaine courante.
          </p>
        </Panel>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <TrendingUp size={12} /> Taux de dispo équipe
            </div>
            <div className="mt-3 flex items-center gap-4">
              <RingProgress value={weekStats.rate} />
              <div>
                <div
                  className="font-rajdhani font-black text-4xl leading-none"
                  style={{ color: weekStats.rate >= 50 ? "#C3DC5C" : "#E6B955" }}
                  data-testid="stat-availability-rate"
                >
                  {weekStats.rate}%
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-rajdhani">
                  des créneaux
                </div>
              </div>
            </div>
            <SparkBar values={weekStats.perDay} max={Math.max(1, ...weekStats.perDay)} />
            <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-rajdhani uppercase">
              {DAYS.map((d) => (
                <span key={d.key}>{d.label.slice(0, 1)}</span>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Trophy size={12} /> Meilleur créneau scrim
            </div>
            {weekStats.bestKey ? (
              <>
                <div
                  className="mt-3 font-rajdhani text-2xl font-bold text-[#C3DC5C] drop-shadow-[0_0_8px_rgba(195,220,92,0.35)]"
                  data-testid="stat-best-slot"
                >
                  {weekStats.bestKey.day} · {weekStats.bestKey.slot}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#1B221B] relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${(weekStats.bestKey.count / teamSize) * 100}%`,
                        background: "linear-gradient(90deg,#7A8B42,#C3DC5C,#E6F691)",
                        boxShadow: "0 0 12px #C3DC5C",
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-emerald-400">
                    {weekStats.bestKey.count}/{teamSize}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-zinc-600">Aucune donnée cette semaine</div>
            )}
            <div className="mt-4 pt-3 border-t border-[#1F2420]">
              <div className="flex items-center justify-between text-[10px] font-rajdhani uppercase tracking-[0.25em] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Crosshair size={11} /> Seuil scrim-ready
                </span>
                <span className="font-mono text-[#C3DC5C]">≥ {scrimThreshold}</span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(2, teamSize)}
                value={scrimThreshold}
                onChange={(e) => setScrimThreshold(Number(e.target.value))}
                data-testid="scrim-threshold"
                className="w-full mt-2 accent-[#C3DC5C]"
              />
              <div className="text-[10px] text-zinc-600 mt-1">
                {weekStats.scrimSlots.size} créneaux qualifiés
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Users size={12} /> Effectif semaine
            </div>
            <div className="mt-3 font-rajdhani text-5xl font-black text-white leading-none">
              {allDocs.length}
              <span className="text-zinc-700 text-xl">/{teamSize}</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 uppercase tracking-wider font-rajdhani">
              opérateurs connectés
            </div>
            <div className="mt-4 flex -space-x-2">
              {allDocs.slice(0, 8).map((d) =>
                d.userPhoto ? (
                  <img
                    key={d.userId}
                    src={d.userPhoto}
                    alt=""
                    title={d.userName}
                    className="w-7 h-7 rounded-full ring-2 ring-[#0B0F0B] border border-[#7A8B42]/50"
                  />
                ) : (
                  <span
                    key={d.userId}
                    title={d.userName}
                    className="w-7 h-7 rounded-full ring-2 ring-[#0B0F0B] bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-[10px]"
                  >
                    {d.userName?.[0] || "?"}
                  </span>
                )
              )}
              {allDocs.length > 8 && (
                <span className="w-7 h-7 rounded-full ring-2 ring-[#0B0F0B] bg-[#1B221B] text-[10px] flex items-center justify-center text-zinc-400">
                  +{allDocs.length - 8}
                </span>
              )}
            </div>
          </Panel>
        </div>

        {/* TEMPLATES */}
        {isOwnView && (
          <Panel className="p-3 md:p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 pr-2 border-r border-[#1F2420]">
                <Sparkles size={12} className="text-[#C3DC5C]" /> Templates rapides
              </span>
              {[
                { k: "weekend", label: "Week-end Gamer", hint: "sam/dim ≥18h" },
                { k: "evenings", label: "Soirées 20-23", hint: "semaine 20-23h" },
                { k: "full", label: "Tout dispo", hint: "remplir" },
                { k: "reset", label: "Reset", hint: "tout vider", danger: true },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => applyTemplate(t.k)}
                  data-testid={`template-${t.k}`}
                  title={t.hint}
                  className={`group relative px-3 py-1.5 border text-[11px] font-rajdhani uppercase tracking-wider transition-all ${
                    t.danger
                      ? "border-[#27272A] text-zinc-500 hover:border-red-500/60 hover:text-red-300 hover:shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                      : "border-[#27272A] text-zinc-300 hover:border-[#C3DC5C] hover:text-[#C3DC5C] hover:shadow-[0_0_12px_rgba(195,220,92,0.3)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {/* NAV + TOOLBAR */}
        <Panel className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setMonday(addDays(monday, -7))}
              data-testid="availability-prev-week"
              className="p-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="px-4 py-2 border border-[#27272A] bg-[#0B0F0B]/60 min-w-[180px]">
              <div className="font-rajdhani uppercase tracking-[0.3em] text-[10px] text-zinc-500">
                Semaine
              </div>
              <div className="font-rajdhani font-bold text-lg text-white">{weekId}</div>
              <div className="text-[11px] text-zinc-500 font-mono">{formatWeekRange(monday)}</div>
            </div>

            <button
              onClick={() => setMonday(addDays(monday, 7))}
              data-testid="availability-next-week"
              className="p-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all"
            >
              <ChevronRight size={18} />
            </button>

            <button
              onClick={() => setMonday(getMonday(new Date()))}
              data-testid="goto-today"
              className="flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] text-[11px] font-rajdhani uppercase tracking-wider transition-all"
            >
              <Calendar size={13} /> Aujourd'hui
            </button>

            <div className="flex-1" />

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

            {/* Export dropdown */}
            <div className="flex items-center border border-[#27272A]">
              <button
                onClick={() => exportAs("txt")}
                data-testid="export-txt"
                className="flex items-center gap-1.5 px-3 py-2 text-zinc-400 hover:text-[#C3DC5C] text-xs font-rajdhani uppercase tracking-wider border-r border-[#27272A]"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? "OK" : "TXT"}
              </button>
              <button
                onClick={() => exportAs("md")}
                data-testid="export-md"
                className="px-3 py-2 text-zinc-400 hover:text-[#C3DC5C] text-xs font-rajdhani uppercase tracking-wider border-r border-[#27272A]"
              >
                MD
              </button>
              <button
                onClick={() => exportAs("csv")}
                data-testid="export-csv"
                className="flex items-center gap-1.5 px-3 py-2 text-zinc-400 hover:text-[#C3DC5C] text-xs font-rajdhani uppercase tracking-wider"
              >
                <FileDown size={12} /> CSV
              </button>
            </div>
          </div>

          {/* View tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: TEAM_VIEW, icon: Users, label: `Vue équipe (${allDocs.length})`, test: "view-team" },
              { id: user.uid, icon: UserIcon, label: "Mes dispos", test: "view-me" },
              { id: COMPARE_VIEW, icon: Swords, label: "Comparer", test: "view-compare" },
            ].map((tab) => {
              const active = selectedUserId === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedUserId(tab.id)}
                  data-testid={tab.test}
                  className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all ${
                    active
                      ? "bg-[#7A8B42]/20 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_20px_rgba(122,139,66,0.35)]"
                      : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
            {userList
              .filter((d) => d.userId !== user.uid)
              .map((d) => {
                const active = selectedUserId === d.userId;
                return (
                  <button
                    key={d.userId}
                    onClick={() => setSelectedUserId(d.userId)}
                    data-testid={`user-tab-${d.userId}`}
                    className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all ${
                      active
                        ? "bg-[#7A8B42]/20 border-[#C3DC5C] text-[#C3DC5C] shadow-[0_0_20px_rgba(122,139,66,0.35)]"
                        : "border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]"
                    }`}
                  >
                    {d.userPhoto ? (
                      <img src={d.userPhoto} alt="" className="w-5 h-5 rounded-full ring-1 ring-[#7A8B42]/40" />
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

          {/* Compare selector */}
          {isCompareView && (
            <div className="mt-3 flex items-center gap-2 flex-wrap p-3 bg-[#0B0F0B]/60 border border-dashed border-[#27272A]">
              <span className="text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
                Comparer avec :
              </span>
              {allDocs
                .filter((d) => d.userId !== user.uid)
                .map((d) => {
                  const on = compareUserId === d.userId;
                  return (
                    <button
                      key={d.userId}
                      onClick={() => setCompareUserId(on ? null : d.userId)}
                      data-testid={`compare-${d.userId}`}
                      className={`px-2 py-1 border text-[11px] font-rajdhani uppercase transition-all ${
                        on
                          ? "border-[#C3DC5C] text-[#C3DC5C] bg-[#7A8B42]/20"
                          : "border-[#27272A] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {d.userName}
                    </button>
                  );
                })}
            </div>
          )}
        </Panel>

        {/* LEGEND + CONTEXT */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {AVAILABILITY_STATES.map((s) => {
              const on = legendFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setLegendFilter(on ? null : s.key)}
                  data-testid={`legend-${s.key}`}
                  className={`flex items-center gap-2 px-2.5 py-1 border text-[11px] font-rajdhani uppercase tracking-wider transition-all ${
                    s.classes
                  } ${on ? "ring-2 ring-[#C3DC5C] scale-105" : "opacity-80 hover:opacity-100"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {s.label}
                </button>
              );
            })}
            {legendFilter && (
              <button
                onClick={() => setLegendFilter(null)}
                className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider font-rajdhani"
              >
                effacer filtre
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500 font-rajdhani uppercase tracking-wider">
            {isTeamView && (
              <>
                <Target size={12} className="text-[#C3DC5C]" />
                Heatmap agrégée · {weekStats.scrimSlots.size} scrim-ready
              </>
            )}
            {isCompareView && (
              <>
                <Swords size={12} className="text-[#C3DC5C]" />
                Comparaison — overlap mis en évidence
              </>
            )}
            {!isTeamView && !isCompareView && !isOwnView && selectedDoc && (
              <>
                <UserIcon size={12} />
                Consultation — {selectedDoc.userName}
              </>
            )}
            {isOwnView && (
              <>
                <Zap size={12} className="text-[#C3DC5C] animate-pulse" />
                Mode édition {paintMode ? "· Peinture" : "· Clic pour cycler"}
                {saving && <span className="text-[#C3DC5C]"> · sync…</span>}
              </>
            )}
          </div>
        </div>

        {/* GRID */}
        <Panel className="p-3 md:p-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#0B0F0B]/95 backdrop-blur z-10 text-left px-3 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]">
                  UTC
                </th>
                {DAYS.map((d, i) => {
                  const date = addDays(monday, i);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const isWeekend = i >= 5;
                  return (
                    <th
                      key={d.key}
                      className={`relative px-2 py-3 border-b border-[#27272A] font-rajdhani uppercase tracking-wider ${
                        isToday
                          ? "text-[#C3DC5C] bg-[#7A8B42]/10"
                          : isWeekend
                          ? "text-amber-200/80"
                          : "text-zinc-300"
                      }`}
                    >
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                      </div>
                      {isToday && (
                        <>
                          <div className="mx-auto mt-1 w-1 h-1 rounded-full bg-[#C3DC5C] shadow-[0_0_8px_#C3DC5C] animate-pulse" />
                          <span className="absolute top-1 right-1 text-[8px] tracking-widest text-[#C3DC5C]/80">
                            ● NOW
                          </span>
                        </>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => {
                const isCurrentSlot = slot.index === currentSlotIndex;
                return (
                  <tr key={slot.index} className="group">
                    <td
                      className={`sticky left-0 z-10 bg-[#0B0F0B]/95 backdrop-blur px-3 py-1.5 border-b border-[#1B221B] font-mono text-[11px] transition-colors ${
                        isCurrentSlot
                          ? "text-[#C3DC5C] font-bold"
                          : "text-zinc-500 group-hover:text-[#C3DC5C]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCurrentSlot && (
                          <span className="w-1 h-1 rounded-full bg-[#C3DC5C] shadow-[0_0_6px_#C3DC5C] animate-pulse" />
                        )}
                        {slot.label}
                      </div>
                    </td>
                    {DAYS.map((d, di) => {
                      const key = getCellKey(d.key, slot.index);
                      const isBest =
                        weekStats.bestKey?.key === key && weekStats.bestCount > 0;
                      const isScrim = weekStats.scrimSlots.has(key);
                      const isTodayCol = di === todayIdx;
                      const isNowCell = isTodayCol && isCurrentSlot;

                      /* TEAM VIEW */
                      if (isTeamView) {
                        const agg = teamAgg[key];
                        const tooltip = agg?.users?.map((u) => `${u.name}: ${u.state}`).join("");
                        return (
                          <td
                            key={key}
                            title={tooltip}
                            onMouseEnter={() =>
                              setHoveredCell({ dayKey: d.key, slotIndex: slot.index })
                            }
                            className="p-1 border-b border-[#1B221B] align-middle"
                          >
                            <div
                              className={`relative w-full min-h-[36px] px-2 py-1 flex items-center justify-center text-[11px] font-rajdhani tracking-wider transition-all ${
                                isBest
                                  ? "ring-1 ring-[#C3DC5C] shadow-[0_0_20px_rgba(195,220,92,0.6)]"
                                  : isScrim
                                  ? "ring-1 ring-[#7A8B42]/70"
                                  : "ring-1 ring-transparent hover:ring-[#27272A]"
                              } ${isNowCell ? "outline outline-1 outline-[#C3DC5C]/70" : ""}`}
                              style={heatStyle(agg?.disponible || 0, teamSize, isScrim)}
                            >
                              {isBest && (
                                <Target
                                  size={10}
                                  className="absolute -top-1 -right-1 text-[#C3DC5C] drop-shadow-[0_0_4px_#C3DC5C] animate-pulse"
                                />
                              )}
                              {agg ? (
                                <div className="flex items-center gap-1.5 font-mono">
                                  {agg.disponible > 0 && (
                                    <span className="text-emerald-300 font-semibold">
                                      ✓{agg.disponible}
                                    </span>
                                  )}
                                  {agg.incertain > 0 && (
                                    <span className="text-amber-300">?{agg.incertain}</span>
                                  )}
                                  {agg.indisponible > 0 && (
                                    <span className="text-red-400/70">✕{agg.indisponible}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-700">·</span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      /* COMPARE VIEW */
                      if (isCompareView) {
                        const a = myDoc.slots?.[key];
                        const b = compareDoc?.slots?.[key];
                        const overlap = a === "disponible" && b === "disponible";
                        const partial =
                          (a === "disponible" && b === "incertain") ||
                          (b === "disponible" && a === "incertain");
                        return (
                          <td key={key} className="p-1 border-b border-[#1B221B] align-middle">
                            <div
                              className={`w-full min-h-[36px] flex items-center justify-center text-[11px] font-rajdhani border transition-all ${
                                overlap
                                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                                  : partial
                                  ? "bg-amber-500/15 border-amber-400/60 text-amber-200"
                                  : "border-transparent text-zinc-700"
                              }`}
                            >
                              {overlap ? "✓✓" : partial ? "≈" : a || b ? "·" : "—"}
                            </div>
                          </td>
                        );
                      }

                      /* INDIVIDUAL */
                      const sDoc = isOwnView ? myDoc : selectedDoc;
                      const stateKey = sDoc?.slots?.[key];
                      const state = getState(stateKey);
                      const editable = isOwnView;
                      const dimmed = legendFilter && stateKey && stateKey !== legendFilter;
                      return (
                        <td key={key} className="p-1 border-b border-[#1B221B] align-middle">
                          <button
                            onMouseDown={() => editable && handleCellMouseDown(d.key, slot.index)}
                            onMouseEnter={() => handleCellEnter(d.key, slot.index)}
                            onMouseLeave={() => setHoveredCell(null)}
                            disabled={!editable || saving}
                            data-testid={`cell-${key}`}
                            className={`relative w-full min-h-[36px] px-2 py-1 text-center font-rajdhani tracking-wider text-[11px] transition-all duration-150 ${
                              state
                                ? `${state.classes} border hover:brightness-125 hover:shadow-[0_0_15px_rgba(195,220,92,0.3)]`
                                : "bg-transparent hover:bg-[#1B221B] border border-transparent hover:border-[#27272A]"
                            } ${editable ? "cursor-pointer active:scale-95" : "cursor-default"} ${
                              hoveredCell?.dayKey === d.key &&
                              hoveredCell?.slotIndex === slot.index &&
                              editable
                                ? "ring-1 ring-[#C3DC5C]/60"
                                : ""
                            } ${dimmed ? "opacity-25" : ""} ${
                              isNowCell ? "outline outline-1 outline-[#C3DC5C]/70" : ""
                            }`}
                          >
                            {state ? state.short : <span className="text-zinc-700">·</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        {/* HOVER INFO */}
        {hoveredCell && (
          <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
            <div className="bg-[#0B0F0B]/95 backdrop-blur border border-[#7A8B42]/60 px-3 py-2 shadow-[0_0_25px_rgba(122,139,66,0.4)]">
              <div className="text-[9px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
                Créneau ciblé
              </div>
              <div className="font-mono text-[12px] text-[#C3DC5C]">
                {DAYS.find((d) => d.key === hoveredCell.dayKey)?.label} ·{" "}
                {TIME_SLOTS[hoveredCell.slotIndex]?.label}
              </div>
              {isTeamView && teamAgg[getCellKey(hoveredCell.dayKey, hoveredCell.slotIndex)] && (
                <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                  {teamAgg[getCellKey(hoveredCell.dayKey, hoveredCell.slotIndex)].disponible}{" "}
                  dispo / {teamSize}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-600 font-rajdhani uppercase tracking-[0.25em] pt-2">
          <div className="flex items-center gap-2">
            <Keyboard size={12} />
            <span>Raccourcis :</span>
          </div>
          {[
            ["1", "dispo"],
            ["2", "indispo"],
            ["3", "incertain"],
            ["0", "vider"],
            ["← ↑ ↓ →", "naviguer"],
            ["T", "aujourd'hui"],
          ].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-[#131813] border border-[#27272A] font-mono text-zinc-300">
                {k}
              </kbd>
              {l}
            </span>
          ))}
          <span className="text-zinc-700">//</span>
          <span>Maintien clic en mode peinture pour remplir plusieurs cases</span>
        </div>
      </div>
    </div>
  );
}