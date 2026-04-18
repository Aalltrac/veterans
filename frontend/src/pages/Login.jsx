import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LOGO_VETERANS =
  "https://customer-assets.emergentagent.com/job_183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/artifacts/44shq5ox_595A0255-6E8F-4C93-A583-363C23377EF4.jpg";
const LOGO_EVA =
  "https://customer-assets.emergentagent.com/job_183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/artifacts/ap2rfdh2_evagg_logo.jpg";
const BG_IMG =
  "https://static.prod-images.emergentagent.com/jobs/183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/images/72a6bf0651078a9eb959316a07d3571561780276525b7d91d6c531ec2cec0683.png";

export default function Login() {
  const { user, loginWithGoogle, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 font-chivo text-white"
      style={{
        backgroundImage: `url(${BG_IMG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="login-page"
    >
      <div className="absolute inset-0 bg-black/75" />
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className={`relative w-full max-w-md transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="bg-[#0A0D0A]/90 border border-[#27272A] backdrop-blur-xl shadow-[0_0_60px_rgba(122,139,66,0.12)]">
          <div className="px-8 pt-8 pb-6 border-b border-[#27272A]">
            <div className="flex items-center justify-center gap-4 mb-6">
              <img
                src={LOGO_VETERANS}
                alt="Les Vétérans"
                className="h-20 w-20 rounded-sm object-cover border border-[#7A8B42]/40"
              />
              <div className="h-16 w-px bg-[#27272A]" />
              <img
                src={LOGO_EVA}
                alt="Eva Esports"
                className="h-16 w-16 rounded-sm object-cover border border-[#27272A]"
              />
            </div>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains mb-2">
                // Authorized Personnel Only
              </div>
              <h1 className="font-rajdhani font-bold uppercase tracking-widest text-3xl text-white">
                Les Vétérans
              </h1>
              <p className="text-zinc-500 text-sm mt-1 font-jetbrains uppercase tracking-wider">
                EVA · Virtual Arenas · Command Center
              </p>
            </div>
          </div>

          <div className="px-8 py-8 space-y-5">
            <div className="text-center text-sm text-zinc-400 leading-relaxed">
              Connectez-vous avec votre compte Google pour accéder au planning,
              aux disponibilités et à vos Eva Pass.
            </div>

            <button
              onClick={handleLogin}
              disabled={busy}
              data-testid="google-login-button"
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-[#0A0D0A] font-rajdhani font-semibold uppercase tracking-widest text-sm hover:bg-[#C3DC5C] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(195,220,92,0.25)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {busy ? "Connexion…" : "Se connecter avec Google"}
            </button>

            {error && (
              <div
                className="text-xs text-red-400 border border-red-500/30 bg-red-900/20 p-3 font-jetbrains"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <div className="text-[10px] text-center text-zinc-600 font-jetbrains uppercase tracking-widest pt-4 border-t border-[#27272A]">
              // Secure connection · Firebase Auth
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
