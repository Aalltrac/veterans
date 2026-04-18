import { NavLink, Outlet } from "react-router-dom";
import { LogOut, CalendarDays, UserCheck, Ticket, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/planning", label: "Planning", icon: CalendarDays, testid: "nav-planning" },
  { to: "/disponibilite", label: "Disponibilité", icon: UserCheck, testid: "nav-availability" },
  { to: "/eva-pass", label: "Eva Pass", icon: Ticket, testid: "nav-evapass" },
];

const LOGO_VETERANS =
  "https://customer-assets.emergentagent.com/job_183fbcf6-2b8d-4bff-857a-0cf7cfa0f90b/artifacts/44shq5ox_595A0255-6E8F-4C93-A583-363C23377EF4.jpg";

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-[#0A0D0A] text-white font-chivo">
      <header
        className="sticky top-0 z-40 backdrop-blur-md bg-[#0A0D0A]/85 border-b border-[#27272A]"
        data-testid="app-header"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_VETERANS}
              alt="Les Vétérans"
              className="h-10 w-10 rounded-sm object-cover border border-[#7A8B42]/40"
            />
            <div className="leading-tight">
              <div className="font-rajdhani font-bold uppercase tracking-widest text-[#C3DC5C] text-lg">
                Les Vétérans
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-jetbrains">
                EVA · Command Center
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1" data-testid="main-nav">
            {NAV.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={testid}
                className={({ isActive }) =>
                  `px-4 py-2 flex items-center gap-2 font-rajdhani uppercase tracking-wider text-sm border transition-all ${
                    isActive
                      ? "bg-[#7A8B42]/15 text-[#C3DC5C] border-[#7A8B42]/60 shadow-[0_0_15px_rgba(122,139,66,0.2)]"
                      : "text-zinc-400 border-transparent hover:text-white hover:border-[#27272A]"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 border border-[#7A8B42]/60 text-[#C3DC5C] text-[10px] font-jetbrains uppercase tracking-widest"
                data-testid="admin-badge"
              >
                <Shield size={12} /> Admin
              </span>
            )}
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="h-8 w-8 rounded-full border border-[#27272A]"
                data-testid="user-avatar"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-xs font-rajdhani">
                {user?.displayName?.[0] || "?"}
              </div>
            )}
            <div className="hidden sm:block text-xs">
              <div className="font-rajdhani uppercase tracking-wider text-white" data-testid="user-name">
                {user?.displayName || user?.email}
              </div>
              <div className="text-zinc-500 text-[10px] font-jetbrains truncate max-w-[160px]">
                {user?.email}
              </div>
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              className="p-2 text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-500/40 transition-all"
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="md:hidden flex border-t border-[#27272A]">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`${testid}-mobile`}
              className={({ isActive }) =>
                `flex-1 py-2 flex items-center justify-center gap-1 font-rajdhani uppercase tracking-wider text-xs ${
                  isActive ? "text-[#C3DC5C] bg-[#7A8B42]/10" : "text-zinc-500"
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}