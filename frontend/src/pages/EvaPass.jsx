import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Save,
  Ticket,
  Calendar as CalIcon,
  Pencil,
  X,
  Activity,
  TrendingDown,
  TrendingUp,
  Clock,
  History as HistoryIcon,
  Flame,
  Trophy,
  Target,
  Timer,
  Zap,
  Minus,
  Plus,
  Medal,
  Award,
  Crown,
  AlertTriangle,
  Gauge,
  CheckCircle2,
  Share2,
  Check,
  Sparkles,
  Rocket,
  Search,
  Crosshair,
  Radio,
} from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

/* ============================================================
   Tactical HUD primitives — aligned with Availability.jsx
   ============================================================ */
const Bracket = ({ pos, color = "#7A8B42", size = 14 }) => {
  const map = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2",
  };
  return (
    <span
      className={`absolute pointer-events-none transition-all duration-300 ${map[pos]}`}
      style={{
        width: size,
        height: size,
        borderColor: color,
        boxShadow: `0 0 6px ${color}55`,
      }}
    />
  );
};

const Panel = ({ children, className = "", glow = false, accent = "#7A8B42", ...rest }) => (
  <div
    className={`relative bg-[#0B0F0B]/70 backdrop-blur-xl border border-[#27272A] ${
      glow ? "shadow-[0_0_40px_-10px_rgba(122,139,66,0.45)]" : ""
    } ${className}`}
    style={{
      backgroundImage:
        "radial-gradient(circle at 20% 0%, rgba(122,139,66,0.10) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(122,139,66,0.05) 0%, transparent 45%)",
    }}
    {...rest}
  >
    <Bracket pos="tl" color={accent} />
    <Bracket pos="tr" color={accent} />
    <Bracket pos="bl" color={accent} />
    <Bracket pos="br" color={accent} />
    {children}
  </div>
);

/* Animated integer counter */
const useCounter = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  const start = useRef(Date.now());
  const from = useRef(0);
  const to = useRef(target);
  useEffect(() => {
    from.current = value;
    to.current = target;
    start.current = Date.now();
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from.current + (to.current - from.current) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
};

/* Radial progress ring */
const RingProgress = ({ value = 0, size = 120, stroke = 8, label, sub, color }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamp = Math.max(0, Math.min(100, value));
  const dash = (clamp / 100) * c;
  const auto = color || (clamp >= 66 ? "#C3DC5C" : clamp >= 33 ? "#E6B955" : "#E67E52");
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1B221B"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={auto}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{
            filter: `drop-shadow(0 0 6px ${auto}aa)`,
            transition: "stroke-dasharray 0.8s ease, stroke 0.3s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-rajdhani font-bold text-2xl" style={{ color: auto }}>
          {label}
        </div>
        {sub && (
          <div className="text-[9px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mt-0.5">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

/* Sparkline — SVG mini chart */
const Sparkline = ({ values = [], width = 120, height = 36, color = "#C3DC5C" }) => {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[9px] font-rajdhani uppercase tracking-widest text-zinc-700"
        style={{ width, height }}
      >
        // pas de donnée
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
      {/* dot for last point */}
      <circle
        cx={(values.length - 1) * step}
        cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
        r="2.5"
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
};

/* ============================================================
   Helpers
   ============================================================ */
const formatDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
};

const formatRelative = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

const daysUntil = (s) => {
  if (!s) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(s);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
};

/* ============================================================
   Countdown hook
   ============================================================ */
const useCountdown = (isoDate) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isoDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isoDate]);

  if (!isoDate) return null;
  const target = new Date(isoDate).getTime();
  const diff = target - now;
  const abs = Math.abs(diff);
  return {
    past: diff < 0,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
    diffMs: diff,
  };
};

/* Flip digit — animate each digit change individually */
const FlipDigit = ({ value, label, urgent = false }) => {
  const strVal = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        key={strVal}
        className="relative px-3 py-2 min-w-[60px] text-center border bg-[#0A0D0A]/85 overflow-hidden"
        style={{
          borderColor: urgent ? "#E6B955" : "#27272A",
          animation: "evaFlip 500ms cubic-bezier(.2,.8,.2,1)",
          boxShadow: urgent
            ? "inset 0 0 18px rgba(230,185,85,0.12), 0 0 14px rgba(230,185,85,0.25)"
            : "inset 0 0 14px rgba(195,220,92,0.06)",
        }}
      >
        <span
          className="font-rajdhani font-bold text-3xl md:text-4xl tabular-nums"
          style={{
            color: urgent ? "#E6B955" : "#C3DC5C",
            textShadow: urgent
              ? "0 0 10px rgba(230,185,85,0.55)"
              : "0 0 10px rgba(195,220,92,0.45)",
          }}
        >
          {strVal}
        </span>
        {/* horizontal split line like flip clock */}
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/50" />
        {/* corner accents */}
        <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l border-[#7A8B42]/60" />
        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r border-[#7A8B42]/60" />
      </div>
      <div className="mt-1.5 text-[9px] font-rajdhani uppercase tracking-[0.35em] text-zinc-500">
        {label}
      </div>
    </div>
  );
};

/* ============================================================
   Main component
   ============================================================ */
export default function EvaPass() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [tokens, setTokens] = useState("");
  const [resetDate, setResetDate] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("tokens"); // "tokens" | "reset" | "name"
  const [copied, setCopied] = useState(false);

  const initializedRef = useRef(false);
  const formRef = useRef(null);
  const tokensInputRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "evapass"), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push(d.data()));
      setPasses(arr);
    });
    return unsub;
  }, []);

  const myPass = useMemo(
    () => passes.find((p) => p.userId === user.uid),
    [passes, user.uid]
  );

  useEffect(() => {
    if (myPass && !initializedRef.current) {
      setTokens(myPass.tokens?.toString() ?? "");
      setResetDate(myPass.resetDate ?? "");
      setGoal(myPass.goal?.toString() ?? "");
      initializedRef.current = true;
    }
  }, [myPass]);

  const hasChanges =
    (myPass?.tokens?.toString() ?? "") !== tokens ||
    (myPass?.resetDate ?? "") !== resetDate ||
    (myPass?.goal?.toString() ?? "") !== goal;

  /* ---------- Save + append usage history ---------- */
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const newTokens = tokens === "" ? 0 : Number(tokens);
      const newGoal = goal === "" ? null : Number(goal);
      const prevTokens = myPass?.tokens ?? null;
      const history = Array.isArray(myPass?.history) ? [...myPass.history] : [];
      if (prevTokens !== null && prevTokens !== newTokens) {
        history.unshift({
          at: new Date().toISOString(),
          delta: newTokens - prevTokens,
          tokens: newTokens,
        });
      }
      const trimmed = history.slice(0, 20);

      await setDoc(
        doc(db, "evapass", user.uid),
        {
          userId: user.uid,
          userName: user.displayName || user.email,
          userPhoto: user.photoURL || null,
          tokens: newTokens,
          resetDate: resetDate || null,
          goal: newGoal,
          updatedAt: new Date().toISOString(),
          history: trimmed,
        },
        { merge: true }
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      console.error("EvaPass save error", err);
      alert("Erreur lors de l'enregistrement: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const quickAdjust = (delta) => {
    const current = tokens === "" ? 0 : Number(tokens);
    const next = Math.max(0, current + delta);
    setTokens(String(next));
  };

  const setResetPreset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setResetDate(d.toISOString().slice(0, 10));
  };

  const focusEdit = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => tokensInputRef.current?.focus(), 400);
  };

  const resetForm = () => {
    setTokens(myPass?.tokens?.toString() ?? "");
    setResetDate(myPass?.resetDate ?? "");
    setGoal(myPass?.goal?.toString() ?? "");
  };

  /* ---------- Global keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea";
      // Ctrl/Cmd+S → save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (hasChanges) handleSave();
        return;
      }
      if (inField) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        quickAdjust(1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        quickAdjust(-1);
      } else if (e.key === "Escape" && hasChanges) {
        resetForm();
      } else if (e.key.toLowerCase() === "e") {
        focusEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, tokens]);

  /* ---------- Derived stats ---------- */
  const sorted = useMemo(() => {
    const base = [...passes];
    if (sortMode === "tokens") base.sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
    else if (sortMode === "reset") {
      base.sort((a, b) => {
        const da = a.resetDate ? new Date(a.resetDate).getTime() : Infinity;
        const dbb = b.resetDate ? new Date(b.resetDate).getTime() : Infinity;
        return da - dbb;
      });
    } else base.sort((a, b) => (a.userName || "").localeCompare(b.userName || ""));
    return base;
  }, [passes, sortMode]);

  const filteredSorted = useMemo(
    () =>
      sorted.filter((p) =>
        (p.userName || "").toLowerCase().includes(search.trim().toLowerCase())
      ),
    [sorted, search]
  );

  const rankSorted = useMemo(
    () => [...passes].sort((a, b) => (b.tokens || 0) - (a.tokens || 0)),
    [passes]
  );
  const teamTokens = passes.reduce((s, p) => s + (p.tokens || 0), 0);
  const teamAvg = passes.length ? Math.round(teamTokens / passes.length) : 0;
  const topPlayer = rankSorted[0];
  const myRank = rankSorted.findIndex((p) => p.userId === user.uid);

  const countdown = useCountdown(myPass?.resetDate);
  const myDays = daysUntil(myPass?.resetDate);

  const urgencyColor =
    myDays === null
      ? "#7A8B42"
      : myDays < 0
        ? "#ef4444"
        : myDays <= 3
          ? "#E6B955"
          : "#C3DC5C";

  const myHistory = useMemo(
    () => (Array.isArray(myPass?.history) ? myPass.history : []),
    [myPass?.history]
  );

  /* Sparkline data (chronological: oldest → newest) */
  const sparkSeries = useMemo(() => {
    if (!myHistory.length) return [myPass?.tokens ?? 0];
    const chrono = [...myHistory].reverse();
    const series = chrono.map((h) => h.tokens);
    if (typeof myPass?.tokens === "number") series.push(myPass.tokens);
    return series;
  }, [myHistory, myPass]);

  /* Burn rate over last 7 days */
  const burn = useMemo(() => {
    if (myHistory.length < 1) return null;
    const cutoff = Date.now() - 7 * 86400000;
    const recent = myHistory.filter((h) => new Date(h.at).getTime() >= cutoff);
    if (!recent.length) return null;
    const spent = recent
      .filter((h) => h.delta < 0)
      .reduce((s, h) => s + Math.abs(h.delta), 0);
    const span = Math.max(
      1,
      (Date.now() -
        Math.min(...recent.map((h) => new Date(h.at).getTime()))) /
        86400000
    );
    const perDay = spent / span;
    const current = myPass?.tokens ?? 0;
    const daysToZero = perDay > 0 ? Math.floor(current / perDay) : null;
    return { perDay: Math.round(perDay * 10) / 10, daysToZero, spent };
  }, [myHistory, myPass]);

  /* Goal analysis */
  const goalAnalysis = useMemo(() => {
    const target = myPass?.goal;
    if (!target || myDays === null || myDays < 0) return null;
    const current = myPass?.tokens ?? 0;
    const delta = target - current;
    const perDayNeeded = myDays > 0 ? delta / myDays : delta;
    return {
      target,
      delta,
      perDayNeeded: Math.round(perDayNeeded * 10) / 10,
      reachable: burn ? burn.perDay * -1 + perDayNeeded <= 0 : null,
      progress: target > 0 ? Math.min(100, (current / target) * 100) : 0,
    };
  }, [myPass, myDays, burn]);

  /* Achievements */
  const achievements = useMemo(() => {
    const a = [];
    if (myRank === 0 && (myPass?.tokens || 0) > 0)
      a.push({ icon: Crown, label: "Leader d'escouade", color: "#C3DC5C" });
    if ((myPass?.tokens || 0) >= 100)
      a.push({ icon: Sparkles, label: "100+ tokens", color: "#E6B955" });
    if (myHistory.length >= 10)
      a.push({ icon: Activity, label: "Actif · 10 updates", color: "#7A8B42" });
    if (
      goalAnalysis &&
      goalAnalysis.target > 0 &&
      (myPass?.tokens || 0) >= goalAnalysis.target
    )
      a.push({ icon: Target, label: "Objectif atteint", color: "#C3DC5C" });
    if (myDays !== null && myDays > 14)
      a.push({ icon: Rocket, label: "Marathonien", color: "#7A8B42" });
    return a;
  }, [myRank, myPass, myHistory, goalAnalysis, myDays]);

  /* Animated team-avg & tokens counters */
  const animMyTokens = useCounter(myPass?.tokens ?? 0);
  const animTeamAvg = useCounter(teamAvg);
  const animTotalOps = useCounter(passes.length);

  /* Copy share-card */
  const copyShare = async () => {
    const lines = [
      `# Eva Pass — ${user.displayName || user.email}`,
      `Tokens : ${myPass?.tokens ?? 0}`,
      `Reset  : ${formatDate(myPass?.resetDate)} (${myDays ?? "—"}j)`,
      `Rang   : ${myRank >= 0 ? `#${myRank + 1}/${passes.length}` : "—"}`,
      goalAnalysis ? `Objectif : ${goalAnalysis.target} (${goalAnalysis.progress.toFixed(0)}%)` : null,
      burn ? `Burn rate : ${burn.perDay}/j (~${burn.daysToZero ?? "∞"}j restants)` : null,
    ]
      .filter(Boolean)
      .join("");
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const podium = rankSorted.slice(0, 3).filter((p) => (p.tokens || 0) > 0);

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
      data-testid="evapass-page"
    >
      {/* Keyframes */}
      <style>{`
        @keyframes evaFlip {
          0%   { transform: translateY(-8px) rotateX(55deg); opacity: 0.2; filter: blur(2px); }
          60%  { transform: translateY(2px) rotateX(-8deg);  opacity: 1;   filter: blur(0); }
          100% { transform: translateY(0) rotateX(0);        opacity: 1; }
        }
        @keyframes evaPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(195,220,92,0.35); }
          50%    { box-shadow: 0 0 28px 8px rgba(195,220,92,0.15); }
        }
        @keyframes evaSweep {
          0%   { transform: rotate(0deg);   opacity: 0.55; }
          100% { transform: rotate(360deg); opacity: 0.55; }
        }
        @keyframes evaEntrance {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes evaTicker {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes evaShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .eva-enter { animation: evaEntrance 520ms cubic-bezier(.2,.8,.2,1) both; }
        .eva-shimmer {
          background: linear-gradient(110deg,
            #F4F8E8 0%, #F4F8E8 40%, #FFFFFF 50%, #C3DC5C 60%, #7A8B42 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: evaShimmer 5.5s linear infinite;
        }
      `}</style>

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
      {/* Scan-lines */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] bg-[repeating-linear-gradient(0deg,transparent_0_2px,#C3DC5C_2px_3px)]" />
      {/* Vignette edges */}
      <div className="pointer-events-none fixed inset-0 shadow-[inset_0_0_220px_60px_rgba(0,0,0,0.9)]" />

      <div className="relative max-w-[1400px] mx-auto space-y-6">
        {/* ============================================================
            HERO
            ============================================================ */}
        <Panel className="p-6 md:p-8 overflow-hidden eva-enter" glow>
          {/* Radar sweep behind hero */}
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] pointer-events-none opacity-30 hidden md:block">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(195,220,92,0.35), transparent 40%)",
                animation: "evaSweep 6s linear infinite",
                maskImage: "radial-gradient(circle, black 40%, transparent 80%)",
              }}
            />
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-[#7A8B42]/25"
                style={{ transform: `scale(${1 - i * 0.22})` }}
              />
            ))}
          </div>

          <div className="relative flex items-center gap-3 text-[#C3DC5C] font-rajdhani uppercase tracking-[0.4em] text-xs">
            <Radio size={14} className="animate-pulse" />
            <span>Battle Pass Tracker</span>
            <span className="hidden md:inline-block w-px h-3 bg-[#27272A]" />
            <span className="hidden md:inline text-[10px] text-zinc-500">
              // SYNC {saving ? "…" : "OK"}
            </span>
            <span className="ml-auto text-[10px] text-zinc-500 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C3DC5C] animate-pulse shadow-[0_0_8px_#C3DC5C]" />
              LIVE · {animTotalOps} OPÉRATEURS
            </span>
          </div>

          <h1
            className="relative mt-3 font-rajdhani font-black uppercase tracking-wider text-4xl md:text-6xl eva-shimmer"
            style={{ lineHeight: 1 }}
          >
            Eva Pass<span className="text-[#7A8B42]">.</span>
          </h1>

          <p className="relative mt-3 text-sm text-zinc-400 max-w-2xl font-rajdhani">
            Mets à jour tes <span className="text-[#C3DC5C]">tokens</span> et ta date
            de <span className="text-[#C3DC5C]">reset</span> à tout moment. Visible par
            toute l'escouade. Historique des 20 dernières modifications conservé
            automatiquement.
          </p>

          {/* Hero shortcuts strip */}
          <div className="relative mt-5 flex flex-wrap gap-2 items-center">
            {[
              ["+ / −", "ajuster tokens"],
              ["E", "éditer"],
              ["Ctrl+S", "sauver"],
              ["Esc", "annuler"],
            ].map(([k, l]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 text-[10px] font-rajdhani uppercase tracking-widest text-zinc-500"
              >
                <kbd className="px-1.5 py-0.5 border border-[#27272A] text-[#C3DC5C] bg-[#0A0D0A] font-mono text-[10px]">
                  {k}
                </kbd>
                {l}
              </span>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={copyShare}
              data-testid="evapass-share"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] text-[11px] font-rajdhani uppercase tracking-widest transition-all"
            >
              {copied ? <Check size={12} /> : <Share2 size={12} />}
              {copied ? "Copié" : "Partager mes stats"}
            </button>
          </div>
        </Panel>

        {/* ============================================================
            STATS STRIP (4 KPI cards)
            ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My tokens */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Ticket size={12} /> Mes tokens
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="font-rajdhani font-bold text-4xl text-[#C3DC5C] drop-shadow-[0_0_10px_rgba(195,220,92,0.4)] tabular-nums"
                data-testid="stat-my-tokens"
              >
                {animMyTokens}
              </span>
              <span className="text-xs text-zinc-500 font-rajdhani uppercase tracking-widest">
                restants
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#1B221B] overflow-hidden">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((myPass?.tokens ?? 0) / Math.max(1, topPlayer?.tokens || 1)) * 100)}%`,
                    background: "linear-gradient(90deg,#7A8B42,#C3DC5C)",
                    boxShadow: "0 0 12px rgba(195,220,92,0.6)",
                  }}
                />
              </div>
              <Sparkline values={sparkSeries} width={60} height={22} />
            </div>
          </Panel>

          {/* Rank */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Trophy size={12} /> Classement
            </div>
            <div className="mt-2 font-rajdhani text-4xl font-bold text-white tabular-nums flex items-center gap-2">
              {myRank >= 0 ? `#${myRank + 1}` : "—"}
              <span className="text-sm text-zinc-500">/ {passes.length}</span>
              {myRank === 0 && (myPass?.tokens || 0) > 0 && (
                <Crown size={20} className="text-[#C3DC5C] drop-shadow-[0_0_8px_#C3DC5C]" />
              )}
              {myRank === 1 && <Medal size={20} className="text-zinc-300" />}
              {myRank === 2 && <Medal size={20} className="text-amber-600" />}
            </div>
            <div className="mt-1 text-xs text-zinc-500 font-rajdhani">
              {topPlayer && myRank > 0 && (
                <>
                  <span className="text-amber-400 tabular-nums">
                    {topPlayer.tokens - (myPass?.tokens ?? 0)}
                  </span>{" "}
                  tokens derrière{" "}
                  <span className="text-zinc-300">{topPlayer.userName}</span>
                </>
              )}
              {myRank === 0 && (
                <span className="text-[#C3DC5C] uppercase tracking-widest">
                  // Leader d'escouade
                </span>
              )}
              {myRank === -1 && (
                <span className="text-zinc-600 uppercase tracking-widest">
                  // Crée ton pass pour entrer au classement
                </span>
              )}
            </div>
          </Panel>

          {/* Team avg */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "180ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Target size={12} /> Moyenne équipe
            </div>
            <div className="mt-2 font-rajdhani text-4xl font-bold text-white tabular-nums">
              {animTeamAvg}
            </div>
            <div className="mt-1 text-xs text-zinc-500 font-rajdhani flex items-center gap-1.5">
              sur <span className="text-zinc-300 tabular-nums">{teamTokens}</span>{" "}
              tokens cumulés
              {(myPass?.tokens ?? 0) > teamAvg ? (
                <span className="ml-auto flex items-center gap-1 text-emerald-400">
                  <TrendingUp size={11} /> +{(myPass?.tokens ?? 0) - teamAvg}
                </span>
              ) : (myPass?.tokens ?? 0) < teamAvg ? (
                <span className="ml-auto flex items-center gap-1 text-amber-400">
                  <TrendingDown size={11} /> {(myPass?.tokens ?? 0) - teamAvg}
                </span>
              ) : null}
            </div>
          </Panel>

          {/* Reset */}
          <Panel
            className="p-5 eva-enter"
            style={{ animationDelay: "240ms" }}
            accent={urgencyColor}
          >
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Timer size={12} /> Reset dans
            </div>
            <div
              className="mt-2 font-rajdhani text-4xl font-bold tabular-nums"
              style={{
                color: urgencyColor,
                textShadow: `0 0 10px ${urgencyColor}66`,
              }}
            >
              {myDays === null
                ? "—"
                : myDays < 0
                  ? `${Math.abs(myDays)}j passés`
                  : myDays === 0
                    ? "Aujourd'hui"
                    : `${myDays}j`}
            </div>
            <div className="mt-1 text-xs text-zinc-500 font-rajdhani flex items-center gap-1.5">
              <CalIcon size={10} />
              {formatDate(myPass?.resetDate)}
              {myDays !== null && myDays <= 3 && myDays >= 0 && (
                <span className="ml-auto flex items-center gap-1 text-amber-400 animate-pulse">
                  <AlertTriangle size={11} /> urgent
                </span>
              )}
            </div>
          </Panel>
        </div>

        {/* ============================================================
            COUNTDOWN + PODIUM
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COUNTDOWN */}
          {myPass?.resetDate && countdown && (
            <Panel
              className="p-5 md:p-6 lg:col-span-2 eva-enter"
              style={{ animationDelay: "300ms" }}
              glow
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
                  <Flame
                    size={12}
                    className={countdown.past ? "text-red-400" : "text-[#C3DC5C]"}
                  />
                  {countdown.past ? "Reset déjà passé" : "Compte à rebours reset"}
                </div>
                <div className="flex-1" />
                <div
                  className="text-[10px] font-rajdhani uppercase tracking-[0.3em]"
                  style={{ color: urgencyColor }}
                >
                  {countdown.past
                    ? `— T+${countdown.days}j ${countdown.hours}h`
                    : `— T-${countdown.days}j ${countdown.hours}h`}
                </div>
              </div>

              <div className="mt-5 flex items-end gap-2 md:gap-3 flex-wrap">
                <FlipDigit
                  value={countdown.days}
                  label="Jours"
                  urgent={!countdown.past && countdown.days <= 1}
                />
                <span className="pb-6 font-rajdhani text-2xl text-zinc-700">:</span>
                <FlipDigit
                  value={countdown.hours}
                  label="Heures"
                  urgent={!countdown.past && countdown.days === 0}
                />
                <span className="pb-6 font-rajdhani text-2xl text-zinc-700">:</span>
                <FlipDigit
                  value={countdown.minutes}
                  label="Minutes"
                  urgent={!countdown.past && countdown.days === 0 && countdown.hours === 0}
                />
                <span className="pb-6 font-rajdhani text-2xl text-zinc-700">:</span>
                <FlipDigit
                  value={countdown.seconds}
                  label="Secondes"
                  urgent={
                    !countdown.past &&
                    countdown.days === 0 &&
                    countdown.hours === 0 &&
                    countdown.minutes < 5
                  }
                />
                <div className="flex-1" />
                <div
                  className="hidden md:flex w-24 h-24 border border-[#27272A] relative overflow-hidden items-center justify-center"
                  style={{ animation: "evaPulse 2.4s ease-in-out infinite" }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at center, rgba(195,220,92,0.35) 0%, transparent 70%)",
                    }}
                  />
                  <Zap
                    size={30}
                    className="relative text-[#C3DC5C] drop-shadow-[0_0_10px_#C3DC5C]"
                  />
                </div>
              </div>

              {/* Progress bar for reset cycle (assumed 14-day cycle if no reference) */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[9px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-1.5">
                  <span>Progression cycle</span>
                  <span>
                    {countdown.past
                      ? "terminé"
                      : `${Math.max(0, 100 - Math.min(100, (countdown.days / 14) * 100)).toFixed(0)}%`}
                  </span>
                </div>
                <div className="h-2 bg-[#1B221B] relative overflow-hidden">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: countdown.past
                        ? "100%"
                        : `${Math.max(0, 100 - Math.min(100, (countdown.days / 14) * 100))}%`,
                      background: `linear-gradient(90deg,#7A8B42,${urgencyColor})`,
                      boxShadow: `0 0 12px ${urgencyColor}66`,
                    }}
                  />
                  {[25, 50, 75].map((m) => (
                    <span
                      key={m}
                      className="absolute top-0 bottom-0 w-px bg-black/50"
                      style={{ left: `${m}%` }}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          )}

          {/* PODIUM */}
          <Panel
            className="p-5 md:p-6 eva-enter"
            style={{ animationDelay: "360ms" }}
          >
            <div className="flex items-center gap-2 pb-3 border-b border-[#27272A]">
              <Award size={14} className="text-[#C3DC5C]" />
              <div className="font-rajdhani font-semibold uppercase tracking-wider text-white text-sm">
                Top escouade
              </div>
              <span className="ml-auto text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
                Podium
              </span>
            </div>

            {podium.length === 0 ? (
              <div className="py-10 text-center text-zinc-600 text-xs font-rajdhani uppercase tracking-widest">
                // Aucun opérateur classé
              </div>
            ) : (
              <div className="mt-4 flex items-end justify-around gap-2">
                {[1, 0, 2]
                  .filter((i) => podium[i])
                  .map((i) => {
                    const p = podium[i];
                    const heights = { 0: 96, 1: 68, 2: 54 };
                    const accents = {
                      0: "#C3DC5C",
                      1: "#D4D4D8",
                      2: "#B45309",
                    };
                    const icons = { 0: Crown, 1: Medal, 2: Medal };
                    const Icon = icons[i];
                    const isMe = p.userId === user.uid;
                    return (
                      <div
                        key={p.userId}
                        className="flex flex-col items-center flex-1 max-w-[110px]"
                      >
                        {p.userPhoto ? (
                          <img
                            src={p.userPhoto}
                            alt=""
                            className="h-10 w-10 rounded-full ring-2"
                            style={{
                              boxShadow: `0 0 12px ${accents[i]}88`,
                              borderColor: accents[i],
                            }}
                          />
                        ) : (
                          <div
                            className="h-10 w-10 rounded-full bg-[#1B221B] border flex items-center justify-center text-sm font-rajdhani font-bold"
                            style={{
                              borderColor: accents[i],
                              boxShadow: `0 0 10px ${accents[i]}66`,
                            }}
                          >
                            {p.userName?.[0] || "?"}
                          </div>
                        )}
                        <div className="mt-1.5 text-[10px] font-rajdhani uppercase tracking-wider text-center text-zinc-300 truncate max-w-full">
                          {p.userName}
                          {isMe && (
                            <span className="ml-1 text-[#7A8B42]">(moi)</span>
                          )}
                        </div>
                        <div
                          className="mt-2 w-full border relative flex flex-col items-center justify-start pt-2"
                          style={{
                            height: heights[i],
                            borderColor: accents[i] + "66",
                            background: `linear-gradient(180deg, ${accents[i]}22, transparent)`,
                          }}
                        >
                          <Icon
                            size={16}
                            style={{
                              color: accents[i],
                              filter: `drop-shadow(0 0 4px ${accents[i]})`,
                            }}
                          />
                          <div
                            className="mt-1 font-rajdhani font-bold tabular-nums text-lg"
                            style={{ color: accents[i] }}
                          >
                            {p.tokens ?? 0}
                          </div>
                          <div
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-rajdhani uppercase tracking-widest"
                            style={{ color: accents[i] }}
                          >
                            #{i + 1}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </div>

        {/* ============================================================
            INTEL STRIP — Burn rate · Goal · Achievements
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Burn rate */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "420ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Gauge size={12} /> Burn rate · 7 jours
            </div>
            {burn ? (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-rajdhani font-bold text-4xl text-white tabular-nums">
                    {burn.perDay}
                  </span>
                  <span className="text-xs text-zinc-500 font-rajdhani uppercase tracking-widest">
                    tokens / jour
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-rajdhani">
                  {burn.daysToZero !== null ? (
                    <>
                      Projection zéro :{" "}
                      <span
                        className={
                          burn.daysToZero < (myDays ?? Infinity)
                            ? "text-red-400"
                            : "text-[#C3DC5C]"
                        }
                      >
                        {burn.daysToZero}j
                      </span>
                      {myDays !== null && myDays >= 0 && (
                        <>
                          {" · reset dans "}
                          <span className="text-zinc-300">{myDays}j</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-[#C3DC5C]">// Accumulation nette 🔥</span>
                  )}
                </div>
              </>
            ) : (
              <div className="py-4 text-zinc-600 text-xs font-rajdhani uppercase tracking-widest">
                // Pas assez de données · enregistre quelques updates
              </div>
            )}
          </Panel>

          {/* Goal ring */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "480ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Crosshair size={12} /> Objectif avant reset
            </div>
            {goalAnalysis && goalAnalysis.target > 0 ? (
              <div className="mt-3 flex items-center gap-4">
                <RingProgress
                  value={goalAnalysis.progress}
                  size={96}
                  stroke={7}
                  label={`${Math.round(goalAnalysis.progress)}%`}
                  sub="atteint"
                />
                <div className="flex-1">
                  <div className="font-rajdhani text-2xl text-white font-bold tabular-nums">
                    {myPass?.tokens ?? 0}
                    <span className="text-zinc-600 text-sm"> / {goalAnalysis.target}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500 font-rajdhani">
                    {goalAnalysis.delta > 0 ? (
                      <>
                        Encore{" "}
                        <span className="text-[#C3DC5C]">
                          {goalAnalysis.delta}
                        </span>{" "}
                        tokens · ~
                        <span className="text-[#C3DC5C]">
                          {goalAnalysis.perDayNeeded}
                        </span>
                        /j
                      </>
                    ) : (
                      <span className="text-emerald-400 uppercase tracking-widest">
                        // Objectif atteint ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-zinc-600 text-xs font-rajdhani uppercase tracking-widest">
                // Définis un objectif dans le formulaire ↓
              </div>
            )}
          </Panel>

          {/* Achievements */}
          <Panel className="p-5 eva-enter" style={{ animationDelay: "540ms" }}>
            <div className="flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
              <Sparkles size={12} /> Badges
              <span className="ml-auto text-zinc-600">
                {achievements.length}/5
              </span>
            </div>
            {achievements.length === 0 ? (
              <div className="mt-4 py-4 text-zinc-600 text-xs font-rajdhani uppercase tracking-widest">
                // Aucun badge débloqué
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {achievements.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-rajdhani uppercase tracking-widest"
                      style={{
                        borderColor: a.color + "55",
                        color: a.color,
                        background: a.color + "14",
                        boxShadow: `0 0 10px ${a.color}22`,
                      }}
                    >
                      <Icon size={12} />
                      {a.label}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ============================================================
            FORM + HISTORY
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FORM */}
          <Panel
            className="p-5 md:p-6 lg:col-span-2 eva-enter"
            style={{ animationDelay: "600ms" }}
            glow
          >
            <form ref={formRef} onSubmit={handleSave} data-testid="evapass-form">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-[#C3DC5C]" />
                  <div className="font-rajdhani font-semibold uppercase tracking-wider text-white">
                    {myPass ? "Modifier mon Eva Pass" : "Créer mon Eva Pass"}
                  </div>
                </div>
                {myPass && (
                  <div className="text-[10px] font-rajdhani uppercase tracking-widest text-zinc-500">
                    Actuel :{" "}
                    <span className="text-[#C3DC5C]">{myPass.tokens ?? 0}</span>{" "}
                    tokens · reset {formatDate(myPass.resetDate)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {/* Tokens input */}
                <div>
                  <label className="block text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-2">
                    Tokens restants
                  </label>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => quickAdjust(-1)}
                      data-testid="evapass-tokens-decrement"
                      className="px-3 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_10px_rgba(122,139,66,0.3)] transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      ref={tokensInputRef}
                      type="number"
                      min="0"
                      value={tokens}
                      onChange={(e) => setTokens(e.target.value)}
                      data-testid="evapass-tokens-input"
                      className="flex-1 bg-[#0A0D0A] border-y border-[#27272A] px-3 py-2 text-white font-rajdhani text-lg text-center focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none tabular-nums"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => quickAdjust(1)}
                      data-testid="evapass-tokens-increment"
                      className="px-3 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] hover:shadow-[0_0_10px_rgba(122,139,66,0.3)] transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {/* Quick-add presets */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[-10, -5, +5, +10, +25].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => quickAdjust(d)}
                        data-testid={`evapass-quick-${d}`}
                        className={`px-2 py-1 border text-[10px] font-rajdhani uppercase tracking-widest transition-all ${
                          d > 0
                            ? "border-[#27272A] text-zinc-400 hover:border-[#C3DC5C] hover:text-[#C3DC5C]"
                            : "border-[#27272A] text-zinc-400 hover:border-amber-500/60 hover:text-amber-300"
                        }`}
                      >
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset date */}
                <div>
                  <label className="block text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-2">
                    Date de réinitialisation
                  </label>
                  <input
                    type="date"
                    value={resetDate}
                    onChange={(e) => setResetDate(e.target.value)}
                    data-testid="evapass-date-input"
                    className="w-full bg-[#0A0D0A] border border-[#27272A] px-3 py-2 text-white font-rajdhani focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { d: 7, l: "+7j" },
                      { d: 14, l: "+14j" },
                      { d: 30, l: "+30j" },
                    ].map((p) => (
                      <button
                        key={p.d}
                        type="button"
                        onClick={() => setResetPreset(p.d)}
                        data-testid={`evapass-date-preset-${p.d}`}
                        className="px-2 py-1 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] text-[10px] font-rajdhani uppercase tracking-widest transition-all"
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Goal (new feature) */}
              <div className="mt-4">
                <label className="block text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-2">
                  Objectif tokens <span className="text-zinc-700">· optionnel</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    data-testid="evapass-goal-input"
                    placeholder="ex. 150"
                    className="w-32 bg-[#0A0D0A] border border-[#27272A] px-3 py-2 text-white font-rajdhani focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none tabular-nums"
                  />
                  <div className="flex-1 text-[10px] font-rajdhani uppercase tracking-widest text-zinc-600">
                    // définis un palier à atteindre avant ton reset
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-4 border-t border-[#27272A]">
                <div className="text-xs font-rajdhani uppercase tracking-widest">
                  {savedFlash ? (
                    <span className="text-[#C3DC5C] flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Enregistré
                    </span>
                  ) : hasChanges ? (
                    <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle size={13} /> Modifications non sauvegardées
                    </span>
                  ) : myPass ? (
                    <span className="text-zinc-600">// À jour</span>
                  ) : (
                    <span className="text-zinc-600">// Nouveau pass</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && myPass && (
                    <button
                      type="button"
                      onClick={resetForm}
                      data-testid="evapass-reset-button"
                      className="inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-500 font-rajdhani uppercase tracking-widest text-xs transition-all"
                    >
                      <X size={14} /> Annuler
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || !hasChanges}
                    data-testid="evapass-save-button"
                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#7A8B42]/25 hover:bg-[#7A8B42]/40 border border-[#C3DC5C] text-[#C3DC5C] font-rajdhani uppercase tracking-widest text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(122,139,66,0.25)] hover:shadow-[0_0_22px_rgba(195,220,92,0.45)]"
                  >
                    <Save size={16} />
                    {saving
                      ? "Enregistrement…"
                      : myPass
                        ? "Mettre à jour"
                        : "Créer"}
                  </button>
                </div>
              </div>
            </form>
          </Panel>

          {/* HISTORY */}
          <Panel
            className="p-5 md:p-6 eva-enter"
            style={{ animationDelay: "660ms" }}
          >
            <div className="flex items-center gap-2 pb-3 border-b border-[#27272A]">
              <HistoryIcon size={14} className="text-[#C3DC5C]" />
              <div className="font-rajdhani font-semibold uppercase tracking-wider text-white text-sm">
                Historique récent
              </div>
              <span className="ml-auto text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500">
                {myHistory.length} évén.
              </span>
            </div>

            {/* Inline sparkline of evolution */}
            {sparkSeries.length >= 2 && (
              <div className="mt-3 px-1 py-2 border border-[#1B221B] bg-[#0A0D0A]/60">
                <div className="flex items-center justify-between text-[9px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 px-1 mb-1">
                  <span>Évolution tokens</span>
                  <span className="text-zinc-300 tabular-nums">
                    min {Math.min(...sparkSeries)} · max {Math.max(...sparkSeries)}
                  </span>
                </div>
                <Sparkline values={sparkSeries} width={280} height={44} />
              </div>
            )}

            {myHistory.length === 0 ? (
              <div className="py-10 text-center text-zinc-600 text-xs font-rajdhani uppercase tracking-widest">
                // Aucune utilisation enregistrée
              </div>
            ) : (
              <ul
                className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1"
                data-testid="evapass-history"
              >
                {myHistory.map((h, i) => {
                  const positive = h.delta > 0;
                  return (
                    <li
                      key={`${h.at}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 border border-[#1B221B] bg-[#0A0D0A]/60 hover:border-[#27272A] hover:bg-[#0F1510]/80 transition-all group"
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center border transition-all ${
                          positive
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-900/20 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                            : "border-red-500/40 text-red-400 bg-red-900/20 group-hover:shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                        }`}
                      >
                        {positive ? (
                          <TrendingUp size={13} />
                        ) : (
                          <TrendingDown size={13} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-rajdhani text-sm text-white tracking-wider tabular-nums">
                          <span
                            className={
                              positive ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {positive ? "+" : ""}
                            {h.delta}
                          </span>{" "}
                          tokens
                          <span className="text-zinc-600 mx-1">→</span>
                          <span className="text-[#C3DC5C]">{h.tokens}</span>
                        </div>
                        <div className="text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-1">
                          <Clock size={9} />
                          {formatRelative(h.at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ============================================================
            TEAM TABLE
            ============================================================ */}
        <Panel
          className="overflow-hidden eva-enter"
          style={{ animationDelay: "720ms" }}
          data-testid="evapass-table"
        >
          <div className="px-4 md:px-5 py-3 border-b border-[#27272A] bg-[#0B0F0B]/70 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-[#C3DC5C]" />
              <div className="font-rajdhani font-semibold uppercase tracking-wider text-white text-sm">
                Escouade · {passes.length} membre{passes.length > 1 ? "s" : ""}
              </div>
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer joueur…"
                data-testid="evapass-search"
                className="bg-[#0A0D0A] border border-[#27272A] pl-7 pr-3 py-1.5 text-[11px] font-rajdhani uppercase tracking-wider text-white focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none placeholder:text-zinc-600 w-36"
              />
            </div>

            {/* Sort controls */}
            <div className="flex items-center border border-[#27272A] divide-x divide-[#27272A]">
              {[
                { k: "tokens", l: "Tokens" },
                { k: "reset", l: "Reset" },
                { k: "name", l: "Nom" },
              ].map((s) => (
                <button
                  key={s.k}
                  type="button"
                  onClick={() => setSortMode(s.k)}
                  data-testid={`evapass-sort-${s.k}`}
                  className={`px-2.5 py-1.5 text-[10px] font-rajdhani uppercase tracking-widest transition-all ${
                    sortMode === s.k
                      ? "bg-[#7A8B42]/25 text-[#C3DC5C]"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {["Rang", "Joueur", "Tokens", "Reset", "Dans", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className={`border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px] px-4 py-3 ${
                          i === 0 || i === 1 ? "text-left" : "text-right"
                        } ${i === 3 ? "hidden sm:table-cell" : ""}`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredSorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-zinc-600 text-xs font-rajdhani uppercase tracking-widest"
                    >
                      {search
                        ? "// Aucun joueur ne correspond au filtre"
                        : "// Aucun pass enregistré"}
                    </td>
                  </tr>
                )}
                {filteredSorted.map((p, idx) => {
                  const rankIdx = rankSorted.findIndex(
                    (r) => r.userId === p.userId
                  );
                  const days = daysUntil(p.resetDate);
                  const isMe = p.userId === user.uid;
                  const isTop = rankIdx === 0 && (p.tokens || 0) > 0;
                  const maxTokens = Math.max(1, topPlayer?.tokens || 1);
                  const ratio = Math.min(1, (p.tokens || 0) / maxTokens);
                  return (
                    <tr
                      key={p.userId}
                      className={`border-b border-[#1B221B] transition-all group ${
                        isMe
                          ? "bg-[#7A8B42]/10 hover:bg-[#7A8B42]/15"
                          : "hover:bg-[#1B221B]/60"
                      }`}
                      data-testid={`evapass-row-${p.userId}`}
                    >
                      <td className="px-4 py-3 font-rajdhani font-bold tabular-nums">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isTop
                                ? "text-[#C3DC5C] text-base"
                                : rankIdx < 3
                                  ? "text-white"
                                  : "text-zinc-400"
                            }
                          >
                            #{rankIdx + 1}
                          </span>
                          {isTop && (
                            <Crown
                              size={13}
                              className="text-[#C3DC5C] drop-shadow-[0_0_4px_#C3DC5C]"
                            />
                          )}
                          {rankIdx === 1 && (p.tokens || 0) > 0 && (
                            <Medal size={13} className="text-zinc-300" />
                          )}
                          {rankIdx === 2 && (p.tokens || 0) > 0 && (
                            <Medal size={13} className="text-amber-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.userPhoto ? (
                            <img
                              src={p.userPhoto}
                              alt=""
                              className="h-9 w-9 rounded-full ring-1 ring-[#7A8B42]/40 transition-all group-hover:ring-[#C3DC5C] group-hover:shadow-[0_0_10px_rgba(195,220,92,0.35)]"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-xs font-rajdhani">
                              {p.userName?.[0] || "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-rajdhani uppercase tracking-wider text-white text-sm">
                              {p.userName}
                              {isMe && (
                                <span className="ml-2 text-[9px] text-[#7A8B42] uppercase tracking-widest">
                                  (moi)
                                </span>
                              )}
                            </div>
                            <div className="mt-1 h-1 w-36 bg-[#1B221B] overflow-hidden relative">
                              <div
                                className="h-full transition-all duration-700"
                                style={{
                                  width: `${ratio * 100}%`,
                                  background:
                                    "linear-gradient(90deg,#7A8B42,#C3DC5C)",
                                  boxShadow:
                                    "0 0 8px rgba(195,220,92,0.45)",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-rajdhani text-[#C3DC5C] text-xl font-bold tabular-nums drop-shadow-[0_0_6px_rgba(195,220,92,0.35)]">
                          {p.tokens ?? 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <div className="inline-flex items-center gap-2 text-zinc-300 font-rajdhani text-xs tracking-wider">
                          <CalIcon size={12} className="text-zinc-500" />
                          {formatDate(p.resetDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {days === null ? (
                          <span className="text-zinc-700 text-xs font-rajdhani">
                            —
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 border text-[10px] font-rajdhani uppercase tracking-[0.25em] transition-all ${
                              days < 0
                                ? "border-red-500/40 text-red-400 bg-red-900/20"
                                : days <= 3
                                  ? "border-amber-500/40 text-amber-300 bg-amber-900/20 animate-pulse"
                                  : "border-[#7A8B42]/40 text-[#C3DC5C] bg-[#7A8B42]/10"
                            }`}
                          >
                            {days <= 3 && days >= 0 && (
                              <AlertTriangle size={9} />
                            )}
                            {days < 0
                              ? `${Math.abs(days)}j passés`
                              : days === 0
                                ? "Aujourd'hui"
                                : `${days}j`}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {isMe && (
                          <button
                            type="button"
                            onClick={focusEdit}
                            data-testid="evapass-edit-mine"
                            title="Modifier mes infos"
                            className="p-2 border border-[#7A8B42]/40 text-[#C3DC5C] hover:bg-[#7A8B42]/20 hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ============================================================
            FOOTER — Shortcuts ticker
            ============================================================ */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-600 font-rajdhani uppercase tracking-[0.25em] pt-2">
          <div className="flex items-center gap-2">
            <Activity size={12} />
            <span>Sync Firestore en temps réel</span>
          </div>
          <span className="text-zinc-700">//</span>
          <span>Historique limité aux 20 derniers changements</span>
          <span className="text-zinc-700">//</span>
          <span>
            Raccourcis{" "}
            <kbd className="px-1 border border-[#27272A] text-[#C3DC5C] font-mono">
              +
            </kbd>{" "}
            <kbd className="px-1 border border-[#27272A] text-[#C3DC5C] font-mono">
              −
            </kbd>{" "}
            <kbd className="px-1 border border-[#27272A] text-[#C3DC5C] font-mono">
              E
            </kbd>{" "}
            <kbd className="px-1 border border-[#27272A] text-[#C3DC5C] font-mono">
              Ctrl+S
            </kbd>
          </span>
        </div>
      </div>
    </div>
  );
}