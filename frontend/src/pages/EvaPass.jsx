import { useEffect, useMemo, useRef, useState } from \"react\";
import { collection, doc, onSnapshot, setDoc } from \"firebase/firestore\";
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
} from \"lucide-react\";
import { db } from \"../lib/firebase\";
import { useAuth } from \"../context/AuthContext\";

/* ============================================================
   Tactical HUD primitives — aligned with Availability.jsx
   ============================================================ */
const Bracket = ({ pos, color = \"#7A8B42\" }) => {
  const base = \"absolute w-3 h-3 pointer-events-none\";
  const map = {
    tl: \"top-0 left-0 border-t border-l\",
    tr: \"top-0 right-0 border-t border-r\",
    bl: \"bottom-0 left-0 border-b border-l\",
    br: \"bottom-0 right-0 border-b border-r\",
  };
  return <span className={`${base} ${map[pos]}`} style={{ borderColor: color }} />;
};

const Panel = ({ children, className = \"\", glow = false }) => (
  <div
    className={`relative bg-[#0B0F0B]/70 backdrop-blur-xl border border-[#27272A] ${
      glow ? \"shadow-[0_0_40px_-10px_rgba(122,139,66,0.4)]\" : \"\"
    } ${className}`}
    style={{
      backgroundImage:
        \"radial-gradient(circle at 20% 0%, rgba(122,139,66,0.08) 0%, transparent 50%)\",
    }}
  >
    <Bracket pos=\"tl\" />
    <Bracket pos=\"tr\" />
    <Bracket pos=\"bl\" />
    <Bracket pos=\"br\" />
    {children}
  </div>
);

/* ============================================================
   Helpers
   ============================================================ */
const formatDate = (s) => {
  if (!s) return \"—\";
  try {
    return new Date(s).toLocaleDateString(\"fr-FR\", {
      day: \"2-digit\",
      month: \"short\",
      year: \"numeric\",
    });
  } catch {
    return s;
  }
};

const formatRelative = (iso) => {
  if (!iso) return \"—\";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return \"à l'instant\";
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
   Countdown — animated (days / hours / min / sec)
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

const Digit = ({ value, label }) => (
  <div className=\"flex flex-col items-center\">
    <div
      key={value}
      className=\"relative px-3 py-2 min-w-[54px] text-center border border-[#27272A] bg-[#0A0D0A]/80 overflow-hidden\"
      style={{ animation: \"evaFlip 600ms ease-out\" }}
    >
      <span className=\"font-rajdhani font-bold text-3xl text-[#C3DC5C] tabular-nums drop-shadow-[0_0_8px_rgba(195,220,92,0.4)]\">
        {String(value).padStart(2, \"0\")}
      </span>
      <span className=\"pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#27272A]/70\" />
    </div>
    <div className=\"mt-1 text-[9px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
      {label}
    </div>
  </div>
);

/* ============================================================
   Main component
   ============================================================ */
export default function EvaPass() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [tokens, setTokens] = useState(\"\");
  const [resetDate, setResetDate] = useState(\"\");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const initializedRef = useRef(false);
  const formRef = useRef(null);
  const tokensInputRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, \"evapass\"), (snap) => {
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
      setTokens(myPass.tokens?.toString() ?? \"\");
      setResetDate(myPass.resetDate ?? \"\");
      initializedRef.current = true;
    }
  }, [myPass]);

  const hasChanges =
    (myPass?.tokens?.toString() ?? \"\") !== tokens ||
    (myPass?.resetDate ?? \"\") !== resetDate;

  /* ---------- Save + append usage history ---------- */
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const newTokens = tokens === \"\" ? 0 : Number(tokens);
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
        doc(db, \"evapass\", user.uid),
        {
          userId: user.uid,
          userName: user.displayName || user.email,
          userPhoto: user.photoURL || null,
          tokens: newTokens,
          resetDate: resetDate || null,
          updatedAt: new Date().toISOString(),
          history: trimmed,
        },
        { merge: true }
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      console.error(\"EvaPass save error\", err);
      alert(\"Erreur lors de l'enregistrement: \" + err.message);
    } finally {
      setSaving(false);
    }
  };

  const quickAdjust = (delta) => {
    const current = tokens === \"\" ? 0 : Number(tokens);
    const next = Math.max(0, current + delta);
    setTokens(String(next));
  };

  const focusEdit = () => {
    formRef.current?.scrollIntoView({ behavior: \"smooth\", block: \"start\" });
    setTimeout(() => tokensInputRef.current?.focus(), 400);
  };

  const resetForm = () => {
    setTokens(myPass?.tokens?.toString() ?? \"\");
    setResetDate(myPass?.resetDate ?? \"\");
  };

  /* ---------- Derived stats ---------- */
  const sorted = [...passes].sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
  const teamTokens = passes.reduce((s, p) => s + (p.tokens || 0), 0);
  const teamAvg = passes.length ? Math.round(teamTokens / passes.length) : 0;
  const topPlayer = sorted[0];
  const myRank = sorted.findIndex((p) => p.userId === user.uid);

  const countdown = useCountdown(myPass?.resetDate);
  const myDays = daysUntil(myPass?.resetDate);

  const urgencyColor =
    myDays === null
      ? \"#7A8B42\"
      : myDays < 0
        ? \"#ef4444\"
        : myDays <= 3
          ? \"#E6B955\"
          : \"#C3DC5C\";

  const myHistory = Array.isArray(myPass?.history) ? myPass.history : [];

  /* ============================================================
     Render
     ============================================================ */
  return (
    <div
      className=\"relative min-h-screen p-4 md:p-8 text-zinc-200 select-none\"
      style={{
        background:
          \"radial-gradient(ellipse at top, #0F1510 0%, #070908 55%, #050605 100%)\",
      }}
      data-testid=\"evapass-page\"
    >
      {/* Keyframes for countdown flip + pulse */}
      <style>{`
        @keyframes evaFlip {
          0% { transform: translateY(-6px); opacity: 0.4; filter: blur(1px); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes evaPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(195,220,92,0.35); }
          50%    { box-shadow: 0 0 24px 6px rgba(195,220,92,0.15); }
        }
      `}</style>

      {/* Grain overlay */}
      <div
        className=\"pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay\"
        style={{
          backgroundImage:
            \"url(\\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\\")\",
        }}
      />
      {/* Scan-lines */}
      <div className=\"pointer-events-none fixed inset-0 opacity-[0.06] bg-[repeating-linear-gradient(0deg,transparent_0_2px,#C3DC5C_2px_3px)]\" />

      <div className=\"relative max-w-[1400px] mx-auto space-y-6\">
        {/* ---------- HERO ---------- */}
        <Panel className=\"p-6 md:p-8\" glow>
          <div className=\"flex items-center gap-3 text-[#C3DC5C] font-rajdhani uppercase tracking-[0.4em] text-xs\">
            <Activity size={14} className=\"animate-pulse\" />
            <span>Battle Pass Tracker</span>
            <span className=\"ml-auto text-[10px] text-zinc-500\">
              // LIVE · {passes.length} OPÉRATEURS
            </span>
          </div>
          <h1
            className=\"mt-2 font-rajdhani font-bold uppercase tracking-wider text-4xl md:text-5xl bg-clip-text text-transparent\"
            style={{
              backgroundImage:
                \"linear-gradient(135deg,#F4F8E8 0%,#C3DC5C 60%,#7A8B42 100%)\",
            }}
          >
            Eva Pass
          </h1>
          <p className=\"mt-2 text-sm text-zinc-500 max-w-2xl\">
            Mets à jour tes <span className=\"text-[#C3DC5C]\">tokens</span> et ta date de{\" \"}
            <span className=\"text-[#C3DC5C]\">reset</span> à tout moment. Visible par
            toute l'équipe. Historique des 20 dernières modifications conservé
            automatiquement.
          </p>
        </Panel>

        {/* ---------- STATS BAR ---------- */}
        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
          <Panel className=\"p-5\">
            <div className=\"flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
              <Ticket size={12} /> Mes tokens
            </div>
            <div className=\"mt-2 flex items-baseline gap-2\">
              <span
                className=\"font-rajdhani font-bold text-4xl text-[#C3DC5C]\"
                data-testid=\"stat-my-tokens\"
              >
                {myPass?.tokens ?? 0}
              </span>
              <span className=\"text-xs text-zinc-500\">restants</span>
            </div>
            <div className=\"mt-3 h-1.5 bg-[#1B221B] overflow-hidden\">
              <div
                className=\"h-full transition-all duration-700\"
                style={{
                  width: `${Math.min(100, ((myPass?.tokens ?? 0) / Math.max(1, topPlayer?.tokens || 1)) * 100)}%`,
                  background: \"linear-gradient(90deg,#7A8B42,#C3DC5C)\",
                  boxShadow: \"0 0 12px rgba(195,220,92,0.6)\",
                }}
              />
            </div>
          </Panel>

          <Panel className=\"p-5\">
            <div className=\"flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
              <Trophy size={12} /> Classement
            </div>
            <div className=\"mt-2 font-rajdhani text-4xl font-bold text-white\">
              {myRank >= 0 ? `#${myRank + 1}` : \"—\"}
              <span className=\"text-sm text-zinc-500 ml-2\">/ {passes.length}</span>
            </div>
            <div className=\"mt-1 text-xs text-zinc-500\">
              {topPlayer && myRank > 0 && (
                <>
                  <span className=\"text-amber-400\">
                    {topPlayer.tokens - (myPass?.tokens ?? 0)}
                  </span>{\" \"}
                  tokens derrière <span className=\"text-zinc-400\">{topPlayer.userName}</span>
                </>
              )}
              {myRank === 0 && (
                <span className=\"text-[#C3DC5C]\">Tu mènes l'escouade</span>
              )}
            </div>
          </Panel>

          <Panel className=\"p-5\">
            <div className=\"flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
              <Target size={12} /> Moyenne équipe
            </div>
            <div className=\"mt-2 font-rajdhani text-4xl font-bold text-white\">
              {teamAvg}
            </div>
            <div className=\"mt-1 text-xs text-zinc-500\">
              sur {teamTokens} tokens cumulés
            </div>
          </Panel>

          <Panel className=\"p-5\">
            <div className=\"flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
              <Timer size={12} /> Reset dans
            </div>
            <div
              className=\"mt-2 font-rajdhani text-4xl font-bold\"
              style={{ color: urgencyColor }}
            >
              {myDays === null
                ? \"—\"
                : myDays < 0
                  ? `${Math.abs(myDays)}j passés`
                  : myDays === 0
                    ? \"Aujourd'hui\"
                    : `${myDays}j`}
            </div>
            <div className=\"mt-1 text-xs text-zinc-500\">
              {formatDate(myPass?.resetDate)}
            </div>
          </Panel>
        </div>

        {/* ---------- COUNTDOWN ---------- */}
        {myPass?.resetDate && countdown && (
          <Panel className=\"p-5 md:p-6\">
            <div className=\"flex flex-wrap items-center gap-4\">
              <div className=\"flex items-center gap-2 text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
                <Flame
                  size={12}
                  className={countdown.past ? \"text-red-400\" : \"text-[#C3DC5C]\"}
                />
                {countdown.past ? \"Reset déjà passé\" : \"Compte à rebours reset\"}
              </div>
              <div className=\"flex-1\" />
              <div
                className=\"text-[10px] font-rajdhani uppercase tracking-[0.3em]\"
                style={{ color: urgencyColor }}
              >
                {countdown.past
                  ? `— T+${countdown.days}j ${countdown.hours}h`
                  : `— T-${countdown.days}j ${countdown.hours}h`}
              </div>
            </div>

            <div className=\"mt-4 flex items-end gap-3 flex-wrap\">
              <Digit value={countdown.days} label=\"Jours\" />
              <span className=\"pb-6 font-rajdhani text-2xl text-zinc-700\">:</span>
              <Digit value={countdown.hours} label=\"Heures\" />
              <span className=\"pb-6 font-rajdhani text-2xl text-zinc-700\">:</span>
              <Digit value={countdown.minutes} label=\"Minutes\" />
              <span className=\"pb-6 font-rajdhani text-2xl text-zinc-700\">:</span>
              <Digit value={countdown.seconds} label=\"Secondes\" />
              <div className=\"flex-1\" />
              <div
                className=\"hidden md:block w-32 h-20 border border-[#27272A] relative overflow-hidden\"
                style={{ animation: \"evaPulse 2.4s ease-in-out infinite\" }}
              >
                <div
                  className=\"absolute inset-0\"
                  style={{
                    background:
                      \"radial-gradient(circle at center, rgba(195,220,92,0.35) 0%, transparent 70%)\",
                  }}
                />
                <Zap
                  size={28}
                  className=\"absolute inset-0 m-auto text-[#C3DC5C] drop-shadow-[0_0_8px_#C3DC5C]\"
                />
              </div>
            </div>
          </Panel>
        )}

        {/* ---------- FORM + HISTORY ---------- */}
        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
          {/* FORM */}
          <Panel className=\"p-5 md:p-6 lg:col-span-2\" glow>
            <form ref={formRef} onSubmit={handleSave} data-testid=\"evapass-form\">
              <div className=\"flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#27272A]\">
                <div className=\"flex items-center gap-2\">
                  <Pencil size={14} className=\"text-[#C3DC5C]\" />
                  <div className=\"font-rajdhani font-semibold uppercase tracking-wider text-white\">
                    {myPass ? \"Modifier mon Eva Pass\" : \"Créer mon Eva Pass\"}
                  </div>
                </div>
                {myPass && (
                  <div className=\"text-[10px] font-rajdhani uppercase tracking-widest text-zinc-500\">
                    Actuel :{\" \"}
                    <span className=\"text-[#C3DC5C]\">{myPass.tokens ?? 0}</span>{\" \"}
                    tokens · reset {formatDate(myPass.resetDate)}
                  </div>
                )}
              </div>

              <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4\">
                <div>
                  <label className=\"block text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-2\">
                    Tokens restants
                  </label>
                  <div className=\"flex items-stretch\">
                    <button
                      type=\"button\"
                      onClick={() => quickAdjust(-1)}
                      data-testid=\"evapass-tokens-decrement\"
                      className=\"px-3 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] transition-all\"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      ref={tokensInputRef}
                      type=\"number\"
                      min=\"0\"
                      value={tokens}
                      onChange={(e) => setTokens(e.target.value)}
                      data-testid=\"evapass-tokens-input\"
                      className=\"flex-1 bg-[#0A0D0A] border-y border-[#27272A] px-3 py-2 text-white font-rajdhani text-lg text-center focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none\"
                      placeholder=\"0\"
                    />
                    <button
                      type=\"button\"
                      onClick={() => quickAdjust(1)}
                      data-testid=\"evapass-tokens-increment\"
                      className=\"px-3 border border-[#27272A] text-zinc-400 hover:text-[#C3DC5C] hover:border-[#7A8B42] transition-all\"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className=\"block text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 mb-2\">
                    Date de réinitialisation
                  </label>
                  <input
                    type=\"date\"
                    value={resetDate}
                    onChange={(e) => setResetDate(e.target.value)}
                    data-testid=\"evapass-date-input\"
                    className=\"w-full bg-[#0A0D0A] border border-[#27272A] px-3 py-2 text-white font-rajdhani focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none\"
                  />
                </div>
              </div>

              <div className=\"flex flex-wrap items-center justify-between gap-3 pt-4\">
                <div className=\"text-xs font-rajdhani uppercase tracking-widest\">
                  {savedFlash ? (
                    <span className=\"text-[#C3DC5C]\">// Enregistré ✓</span>
                  ) : hasChanges ? (
                    <span className=\"text-amber-400\">// Modifications non sauvegardées</span>
                  ) : myPass ? (
                    <span className=\"text-zinc-600\">// À jour</span>
                  ) : (
                    <span className=\"text-zinc-600\">// Nouveau pass</span>
                  )}
                </div>
                <div className=\"flex items-center gap-2\">
                  {hasChanges && myPass && (
                    <button
                      type=\"button\"
                      onClick={resetForm}
                      data-testid=\"evapass-reset-button\"
                      className=\"inline-flex items-center gap-2 px-3 py-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-500 font-rajdhani uppercase tracking-widest text-xs transition-all\"
                    >
                      <X size={14} /> Annuler
                    </button>
                  )}
                  <button
                    type=\"submit\"
                    disabled={saving || !hasChanges}
                    data-testid=\"evapass-save-button\"
                    className=\"inline-flex items-center gap-2 px-5 py-2 bg-[#7A8B42]/25 hover:bg-[#7A8B42]/40 border border-[#C3DC5C] text-[#C3DC5C] font-rajdhani uppercase tracking-widest text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(122,139,66,0.25)]\"
                  >
                    <Save size={16} />
                    {saving ? \"Enregistrement…\" : myPass ? \"Mettre à jour\" : \"Créer\"}
                  </button>
                </div>
              </div>
            </form>
          </Panel>

          {/* HISTORY */}
          <Panel className=\"p-5 md:p-6\">
            <div className=\"flex items-center gap-2 pb-3 border-b border-[#27272A]\">
              <HistoryIcon size={14} className=\"text-[#C3DC5C]\" />
              <div className=\"font-rajdhani font-semibold uppercase tracking-wider text-white text-sm\">
                Historique récent
              </div>
              <span className=\"ml-auto text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
                {myHistory.length} évén.
              </span>
            </div>

            {myHistory.length === 0 ? (
              <div className=\"py-10 text-center text-zinc-600 text-xs font-rajdhani uppercase tracking-widest\">
                // Aucune utilisation enregistrée
              </div>
            ) : (
              <ul
                className=\"mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1\"
                data-testid=\"evapass-history\"
              >
                {myHistory.map((h, i) => {
                  const positive = h.delta > 0;
                  return (
                    <li
                      key={`${h.at}-${i}`}
                      className=\"flex items-center gap-3 px-3 py-2 border border-[#1B221B] bg-[#0A0D0A]/60 hover:border-[#27272A] transition-all\"
                    >
                      <div
                        className={`w-7 h-7 flex items-center justify-center border ${
                          positive
                            ? \"border-emerald-500/40 text-emerald-400 bg-emerald-900/20\"
                            : \"border-red-500/40 text-red-400 bg-red-900/20\"
                        }`}
                      >
                        {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      </div>
                      <div className=\"flex-1 min-w-0\">
                        <div className=\"font-rajdhani text-sm text-white tracking-wider\">
                          <span className={positive ? \"text-emerald-400\" : \"text-red-400\"}>
                            {positive ? \"+\" : \"\"}
                            {h.delta}
                          </span>{\" \"}
                          tokens
                          <span className=\"text-zinc-600 mx-1\">→</span>
                          <span className=\"text-[#C3DC5C]\">{h.tokens}</span>
                        </div>
                        <div className=\"text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-1\">
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

        {/* ---------- TEAM TABLE ---------- */}
        <Panel className=\"overflow-hidden\" data-testid=\"evapass-table\">
          <div className=\"px-4 md:px-5 py-3 border-b border-[#27272A] bg-[#0B0F0B]/70 flex items-center justify-between\">
            <div className=\"flex items-center gap-2\">
              <Ticket size={14} className=\"text-[#C3DC5C]\" />
              <div className=\"font-rajdhani font-semibold uppercase tracking-wider text-white text-sm\">
                Escouade · {passes.length} membre{passes.length > 1 ? \"s\" : \"\"}
              </div>
            </div>
            <div className=\"text-[10px] font-rajdhani uppercase tracking-[0.3em] text-zinc-500\">
              Trié par tokens
            </div>
          </div>

          <div className=\"overflow-x-auto\">
            <table className=\"w-full border-collapse text-xs\">
              <thead>
                <tr>
                  <th className=\"text-left px-4 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]\">
                    Rang
                  </th>
                  <th className=\"text-left px-4 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]\">
                    Joueur
                  </th>
                  <th className=\"text-right px-4 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]\">
                    Tokens
                  </th>
                  <th className=\"text-right px-4 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px] hidden sm:table-cell\">
                    Reset
                  </th>
                  <th className=\"text-right px-4 py-3 border-b border-[#27272A] text-zinc-500 font-rajdhani uppercase tracking-[0.3em] text-[10px]\">
                    Dans
                  </th>
                  <th className=\"w-10 border-b border-[#27272A]\" />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className=\"px-4 py-10 text-center text-zinc-600 text-xs font-rajdhani uppercase tracking-widest\"
                    >
                      // Aucun pass enregistré
                    </td>
                  </tr>
                )}
                {sorted.map((p, idx) => {
                  const days = daysUntil(p.resetDate);
                  const isMe = p.userId === user.uid;
                  const isTop = idx === 0 && (p.tokens || 0) > 0;
                  const maxTokens = Math.max(1, topPlayer?.tokens || 1);
                  const ratio = Math.min(1, (p.tokens || 0) / maxTokens);
                  return (
                    <tr
                      key={p.userId}
                      className={`border-b border-[#1B221B] transition-all ${
                        isMe
                          ? \"bg-[#7A8B42]/10 hover:bg-[#7A8B42]/15\"
                          : \"hover:bg-[#1B221B]/60\"
                      }`}
                      data-testid={`evapass-row-${p.userId}`}
                    >
                      <td className=\"px-4 py-3 font-rajdhani font-bold text-zinc-400 tabular-nums\">
                        <div className=\"flex items-center gap-2\">
                          <span
                            className={
                              isTop ? \"text-[#C3DC5C]\" : idx < 3 ? \"text-white\" : \"\"
                            }
                          >
                            #{idx + 1}
                          </span>
                          {isTop && (
                            <Trophy size={12} className=\"text-[#C3DC5C] drop-shadow-[0_0_4px_#C3DC5C]\" />
                          )}
                        </div>
                      </td>
                      <td className=\"px-4 py-3\">
                        <div className=\"flex items-center gap-3\">
                          {p.userPhoto ? (
                            <img
                              src={p.userPhoto}
                              alt=\"\"
                              className=\"h-8 w-8 rounded-full ring-1 ring-[#7A8B42]/40\"
                            />
                          ) : (
                            <div className=\"h-8 w-8 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-xs font-rajdhani\">
                              {p.userName?.[0] || \"?\"}
                            </div>
                          )}
                          <div>
                            <div className=\"font-rajdhani uppercase tracking-wider text-white text-sm\">
                              {p.userName}
                              {isMe && (
                                <span className=\"ml-2 text-[9px] text-[#7A8B42]\">
                                  (moi)
                                </span>
                              )}
                            </div>
                            <div className=\"mt-1 h-1 w-32 bg-[#1B221B] overflow-hidden\">
                              <div
                                className=\"h-full transition-all duration-700\"
                                style={{
                                  width: `${ratio * 100}%`,
                                  background: \"linear-gradient(90deg,#7A8B42,#C3DC5C)\",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className=\"px-4 py-3 text-right\">
                        <div className=\"font-rajdhani text-[#C3DC5C] text-xl font-bold tabular-nums\">
                          {p.tokens ?? 0}
                        </div>
                      </td>
                      <td className=\"px-4 py-3 text-right hidden sm:table-cell\">
                        <div className=\"inline-flex items-center gap-2 text-zinc-300 font-rajdhani text-xs tracking-wider\">
                          <CalIcon size={12} className=\"text-zinc-500\" />
                          {formatDate(p.resetDate)}
                        </div>
                      </td>
                      <td className=\"px-4 py-3 text-right\">
                        {days === null ? (
                          <span className=\"text-zinc-700 text-xs font-rajdhani\">—</span>
                        ) : (
                          <span
                            className={`px-2 py-1 border text-[10px] font-rajdhani uppercase tracking-[0.25em] ${
                              days < 0
                                ? \"border-red-500/40 text-red-400 bg-red-900/20\"
                                : days <= 3
                                  ? \"border-amber-500/40 text-amber-300 bg-amber-900/20\"
                                  : \"border-[#7A8B42]/40 text-[#C3DC5C] bg-[#7A8B42]/10\"
                            }`}
                          >
                            {days < 0
                              ? `${Math.abs(days)}j passés`
                              : days === 0
                                ? \"Aujourd'hui\"
                                : `${days}j`}
                          </span>
                        )}
                      </td>
                      <td className=\"px-2 py-3 text-right\">
                        {isMe && (
                          <button
                            type=\"button\"
                            onClick={focusEdit}
                            data-testid=\"evapass-edit-mine\"
                            title=\"Modifier mes infos\"
                            className=\"p-2 border border-[#7A8B42]/40 text-[#C3DC5C] hover:bg-[#7A8B42]/20 hover:shadow-[0_0_15px_rgba(122,139,66,0.35)] transition-all\"
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

        {/* ---------- FOOTER ---------- */}
        <div className=\"flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-600 font-rajdhani uppercase tracking-[0.25em] pt-2\">
          <div className=\"flex items-center gap-2\">
            <Activity size={12} />
            <span>Sync Firestore en temps réel</span>
          </div>
          <span className=\"text-zinc-700\">//</span>
          <span>Historique limité aux 20 derniers changements</span>
          <span className=\"text-zinc-700\">//</span>
          <span>Raccourcis +/- pour ajuster rapidement tes tokens</span>
        </div>
      </div>
    </div>
  );
}