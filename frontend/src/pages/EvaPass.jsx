import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { Save, Ticket, Calendar as CalIcon, Pencil, X } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function EvaPass() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [tokens, setTokens] = useState("");
  const [resetDate, setResetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
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

  const myPass = useMemo(() => passes.find((p) => p.userId === user.uid), [passes, user.uid]);

  // Populate form once with existing values, then let the user edit freely
  useEffect(() => {
    if (myPass && !initializedRef.current) {
      setTokens(myPass.tokens?.toString() ?? "");
      setResetDate(myPass.resetDate ?? "");
      initializedRef.current = true;
    }
  }, [myPass]);

  const hasChanges =
    (myPass?.tokens?.toString() ?? "") !== tokens ||
    (myPass?.resetDate ?? "") !== resetDate;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(db, "evapass", user.uid),
        {
          userId: user.uid,
          userName: user.displayName || user.email,
          userPhoto: user.photoURL || null,
          tokens: tokens === "" ? 0 : Number(tokens),
          resetDate: resetDate || null,
          updatedAt: new Date().toISOString(),
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

  const focusEdit = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => tokensInputRef.current?.focus(), 400);
  };

  const resetForm = () => {
    setTokens(myPass?.tokens?.toString() ?? "");
    setResetDate(myPass?.resetDate ?? "");
  };

  const formatDate = (s) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return s;
    }
  };

  const daysUntil = (s) => {
    if (!s) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(s);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  };

  const sorted = [...passes].sort((a, b) => (b.tokens || 0) - (a.tokens || 0));

  return (
    <div className="space-y-8" data-testid="evapass-page">
      <div>
        <div className="text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains mb-1">
          // Battle Pass Tracker
        </div>
        <h1 className="font-rajdhani font-bold uppercase tracking-widest text-3xl sm:text-4xl text-white">
          Eva Pass
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Mets à jour tes tokens et la date de reset à tout moment. Visible par toute l'équipe.
        </p>
      </div>

      {/* My form - editable anytime */}
      <form
        ref={formRef}
        onSubmit={handleSave}
        className="bg-[#141A14] border border-[#7A8B42]/40 p-5 space-y-4 shadow-[0_0_30px_rgba(122,139,66,0.1)]"
        data-testid="evapass-form"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2">
            <Pencil size={14} className="text-[#C3DC5C]" />
            <div className="font-rajdhani font-semibold uppercase tracking-wider text-white">
              {myPass ? "Modifier mon Eva Pass" : "Créer mon Eva Pass"}
            </div>
          </div>
          {myPass && (
            <div className="text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
              Actuel : <span className="text-[#C3DC5C]">{myPass.tokens ?? 0}</span> tokens · reset {formatDate(myPass.resetDate)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500 mb-2">
              Tokens restants
            </label>
            <input
              ref={tokensInputRef}
              type="number"
              min="0"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              data-testid="evapass-tokens-input"
              className="w-full bg-[#0A0D0A] border border-[#27272A] px-3 py-2 text-white font-jetbrains focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500 mb-2">
              Date de réinitialisation
            </label>
            <input
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              data-testid="evapass-date-input"
              className="w-full bg-[#0A0D0A] border border-[#27272A] px-3 py-2 text-white font-jetbrains focus:border-[#7A8B42] focus:ring-1 focus:ring-[#7A8B42] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-xs font-jetbrains">
            {savedFlash ? (
              <span className="text-[#C3DC5C] uppercase tracking-widest">// Enregistré ✓</span>
            ) : hasChanges ? (
              <span className="text-amber-400 uppercase tracking-widest">// Modifications non sauvegardées</span>
            ) : myPass ? (
              <span className="text-zinc-600 uppercase tracking-widest">// À jour</span>
            ) : null}
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
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#7A8B42] hover:bg-[#8C9E4D] text-white font-rajdhani uppercase tracking-widest text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(122,139,66,0.25)]"
            >
              <Save size={16} />
              {saving ? "Enregistrement…" : myPass ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="border border-[#27272A]" data-testid="evapass-table">
        <div className="px-4 py-3 border-b border-[#27272A] bg-[#141A14] flex items-center justify-between">
          <div className="font-rajdhani font-semibold uppercase tracking-wider text-white text-sm">
            Équipe · {passes.length} membre{passes.length > 1 ? "s" : ""}
          </div>
          <div className="text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
            Trié par tokens
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[#0A0D0A] border-b border-[#27272A]">
              <th className="text-left px-4 py-3 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
                Joueur
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
                Tokens
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500 hidden sm:table-cell">
                Reset
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
                Dans
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">
                  Aucun pass enregistré pour le moment.
                </td>
              </tr>
            )}
            {sorted.map((p) => {
              const days = daysUntil(p.resetDate);
              const isMe = p.userId === user.uid;
              return (
                <tr
                  key={p.userId}
                  className={`border-b border-[#1F2937] transition-all ${
                    isMe ? "bg-[#7A8B42]/5 hover:bg-[#7A8B42]/10" : "hover:bg-[#1B221B]"
                  }`}
                  data-testid={`evapass-row-${p.userId}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.userPhoto ? (
                        <img src={p.userPhoto} alt="" className="h-8 w-8 rounded-full border border-[#27272A]" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-xs font-rajdhani">
                          {p.userName?.[0] || "?"}
                        </div>
                      )}
                      <div>
                        <div className="font-rajdhani uppercase tracking-wider text-white text-sm">
                          {p.userName}
                          {isMe && <span className="ml-2 text-[9px] text-[#7A8B42]">(moi)</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-jetbrains text-[#C3DC5C] text-lg font-bold">{p.tokens ?? 0}</div>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <div className="inline-flex items-center gap-2 text-zinc-300 font-jetbrains text-xs">
                      <CalIcon size={12} className="text-zinc-500" />
                      {formatDate(p.resetDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {days === null ? (
                      <span className="text-zinc-600 text-xs font-jetbrains">—</span>
                    ) : (
                      <span
                        className={`px-2 py-1 border text-[10px] font-jetbrains uppercase tracking-widest ${
                          days < 0
                            ? "border-red-500/40 text-red-400 bg-red-900/20"
                            : days <= 3
                              ? "border-amber-500/40 text-amber-300 bg-amber-900/20"
                              : "border-[#7A8B42]/40 text-[#C3DC5C] bg-[#7A8B42]/10"
                        }`}
                      >
                        {days < 0 ? `${Math.abs(days)}j passés` : days === 0 ? "Aujourd'hui" : `${days}j`}
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
                        className="p-2 border border-[#7A8B42]/40 text-[#C3DC5C] hover:bg-[#7A8B42]/20 transition-all"
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
    </div>
  );
}
