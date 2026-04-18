import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, Lock, AlertTriangle, ArrowRight, Radio, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LOGO_VETERANS =
  "https://customer-assets.emergentagent.com/job_183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/artifacts/44shq5ox_595A0255-6E8F-4C93-A583-363C23377EF4.jpg";
const LOGO_EVA =
  "https://customer-assets.emergentagent.com/job_183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/artifacts/ap2rfdh2_evagg_logo.jpg";
const BG_IMG =
  "https://static.prod-images.emergentagent.com/jobs/183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/images/72a6bf0651078a9eb959316a07d3571561780276525b7d91d6c531ec2cec0683.png";

/* ============================================================
   Tactical HUD primitives — harmonisés avec Availability/EvaPass
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
      aria-hidden
      className={`absolute pointer-events-none ${map[pos]}`}
      style={{ width: size, height: size, borderColor: color }}
    />
  );
};

const Panel = ({ children, className = "", glow = false }) => (
  <div
    className={`relative border border-[#27272A] bg-[#0A0D0A]/90 backdrop-blur-xl ${
      glow ? "shadow-[0_0_60px_rgba(122,139,66,0.18)]" : ""
    } ${className}`}
  >
    <Bracket pos="tl" />
    <Bracket pos="tr" />
    <Bracket pos="bl" />
    <Bracket pos="br" />
    {children}
  </div>
);

/* ============================================================
   Main component
   ============================================================ */
export default function Login() {
  const { user, loginWithGoogle, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [capsLock, setCapsLock] = useState(false);

  // Mount animation
  useEffect(() => setMounted(true), []);

  // Live system clock (UTC) — HUD feel
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Global Enter-to-login shortcut + Caps Lock detection
  useEffect(() => {
    const onKey = (e) => {
      if (typeof e.getModifierState === "function") {
        setCapsLock(e.getModifierState("CapsLock"));
      }
      if (e.key === "Enter" && !busy && !user) {
        e.preventDefault();
        handleLogin();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, user]);

  if (!loading && user) return <Navigate to="/planning" replace />;

  const handleLogin = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      setError(e.message || "Erreur de connexion");
    } finally {
      setBusy(false);
    }
  };

  const utcTime = clock.toISOString().slice(11, 19);
  const utcDate = clock.toISOString().slice(0, 10);

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 font-chivo text-white overflow-hidden"
      style={{
        backgroundImage: `url(${BG_IMG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="login-page"
    >
      {/* Dark veil */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-black/90" />

      {/* Grain overlay — same signature as Availability */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, #C3DC5C 2px, #C3DC5C 3px)",
        }}
      />

      {/* Ambient olive glows */}
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-[#7A8B42]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[32rem] h-[32rem] rounded-full bg-[#C3DC5C]/5 blur-3xl pointer-events-none" />

      {/* ---------- TOP STATUS BAR (HUD) ---------- */}
      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-3 border-b border-[#27272A]/60 bg-[#0A0D0A]/70 backdrop-blur-md flex items-center justify-between font-jetbrains text-[10px] uppercase tracking-[0.25em] text-zinc-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-[#C3DC5C]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#C3DC5C] animate-ping opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C3DC5C]" />
            </span>
            System Online
          </span>
          <span className="hidden sm:inline text-zinc-600">//</span>
          <span className="hidden sm:inline">Node: EVA-CMD-01</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">UTC {utcDate}</span>
          <span className="text-[#7A8B42]" data-testid="login-clock">
            {utcTime}
          </span>
        </div>
      </div>

      {/* ---------- MAIN CARD ---------- */}
      <div
        className={`relative w-full max-w-md transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Floating label above card */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#7A8B42]/60 to-transparent" />
          <span className="text-[10px] font-jetbrains uppercase tracking-[0.4em] text-[#7A8B42] flex items-center gap-2">
            <Radio size={10} /> Secure Channel
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#7A8B42]/60 to-transparent" />
        </div>

        <Panel glow className="overflow-hidden">
          {/* Diagonal accent stripe */}
          <div
            className="absolute top-0 right-0 h-1 w-24 bg-[#C3DC5C]"
            style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)" }}
          />

          {/* ---------- HEADER ---------- */}
          <div className="px-8 pt-10 pb-6 border-b border-[#27272A] relative">
            <div className="flex items-center justify-center gap-5 mb-6">
              <div className="relative">
                <img
                  src={LOGO_VETERANS}
                  alt="Les Vétérans"
                  className="h-20 w-20 rounded-sm object-cover border border-[#7A8B42]/60 shadow-[0_0_25px_rgba(122,139,66,0.35)]"
                />
                <span className="absolute -bottom-1 -right-1 bg-[#C3DC5C] text-[#0A0D0A] text-[8px] font-rajdhani font-bold uppercase tracking-wider px-1.5 py-0.5">
                  HQ
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="h-px w-8 bg-[#7A8B42]/60" />
                <span className="text-[9px] font-jetbrains text-[#7A8B42] uppercase tracking-[0.3em]">
                  X
                </span>
                <div className="h-px w-8 bg-[#7A8B42]/60" />
              </div>

              <img
                src={LOGO_EVA}
                alt="Eva Esports"
                className="h-16 w-16 rounded-sm object-cover border border-[#27272A]"
              />
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains mb-3">
                <Lock size={10} />
                <span>// Authorized Personnel Only</span>
              </div>
              <h1 className="font-rajdhani font-bold uppercase tracking-[0.2em] text-4xl text-white leading-none">
                Les Vétérans
              </h1>
              <p className="text-zinc-500 text-xs mt-3 font-jetbrains uppercase tracking-[0.25em]">
                EVA · Virtual Arenas · Command Center
              </p>

              {/* Section badges */}
              <div className="flex items-center justify-center gap-2 mt-5">
                {["Planning", "Dispos", "Eva Pass"].map((t) => (
                  <span
                    key={t}
                    className="text-[9px] font-rajdhani uppercase tracking-widest px-2 py-1 border border-[#27272A] text-zinc-400 bg-[#1B221B]/40"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- BODY ---------- */}
          <div className="px-8 py-8 space-y-6">
            <div className="flex items-start gap-3 text-sm text-zinc-400 leading-relaxed bg-[#1B221B]/40 border-l-2 border-[#7A8B42] px-4 py-3">
              <Terminal size={16} className="text-[#7A8B42] mt-0.5 flex-shrink-0" />
              <span>
                Authentifiez-vous via votre compte{" "}
                <span className="text-white font-medium">Google</span> pour
                accéder au planning, aux disponibilités et à vos Eva Pass.
              </span>
            </div>

            {/* Caps Lock warning */}
            {capsLock && (
              <div
                className="flex items-center gap-2 text-[11px] text-[#E6B955] border border-[#E6B955]/40 bg-[#E6B955]/10 px-3 py-2 font-jetbrains uppercase tracking-widest"
                data-testid="login-caps-warning"
              >
                <AlertTriangle size={12} /> Caps Lock activé
              </div>
            )}

            {/* Google button — HUD styled */}
            <button
              onClick={handleLogin}
              disabled={busy}
              data-testid="google-login-button"
              className={`group relative w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-[#0A0D0A] font-rajdhani font-bold uppercase tracking-[0.2em] text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-wait shadow-[0_0_25px_rgba(195,220,92,0.25)] hover:shadow-[0_0_40px_rgba(195,220,92,0.55)] hover:bg-[#C3DC5C] ${
                busy ? "animate-pulse" : ""
              }`}
            >
              <Bracket pos="tl" color="#0A0D0A" size={10} />
              <Bracket pos="tr" color="#0A0D0A" size={10} />
              <Bracket pos="bl" color="#0A0D0A" size={10} />
              <Bracket pos="br" color="#0A0D0A" size={10} />

              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>

              <span>{busy ? "Connexion…" : "Se connecter avec Google"}</span>

              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>

            {/* Hint: Enter shortcut */}
            <div className="text-center text-[10px] font-jetbrains uppercase tracking-[0.3em] text-zinc-600">
              Appuyez sur{" "}
              <kbd className="px-1.5 py-0.5 border border-[#27272A] text-zinc-400 bg-[#1B221B]">
                Enter
              </kbd>{" "}
              pour lancer l'auth
            </div>

            {error && (
              <div
                className="relative text-xs text-red-300 border border-red-500/40 bg-red-950/30 px-3 py-2.5 font-jetbrains flex items-start gap-2"
                data-testid="login-error"
              >
                <Bracket pos="tl" color="#f87171" size={8} />
                <Bracket pos="br" color="#f87171" size={8} />
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="uppercase tracking-widest text-red-400 text-[10px] mb-0.5">
                    // Auth Error
                  </div>
                  {error}
                </div>
              </div>
            )}

            {/* Footer security strip */}
            <div className="pt-4 border-t border-[#27272A] flex items-center justify-between text-[10px] font-jetbrains uppercase tracking-[0.25em] text-zinc-600">
              <span className="flex items-center gap-1.5">
                <Shield size={10} className="text-[#7A8B42]" />
                Firebase Auth
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C3DC5C] animate-pulse" />
                TLS 1.3
              </span>
              <span>v2.0.1</span>
            </div>
          </div>
        </Panel>

        {/* Mission brief under the card */}
        <div className="mt-4 text-center text-[10px] font-jetbrains uppercase tracking-[0.35em] text-zinc-600">
          // Unauthorized access is strictly prohibited
        </div>
      </div>
    </div>
  );
}