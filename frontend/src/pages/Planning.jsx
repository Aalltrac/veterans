import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
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

export default function Planning() {
  const { isAdmin } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [slots, setSlots] = useState({});
  const [editingCell, setEditingCell] = useState(null); // {day, index}
  const [saving, setSaving] = useState(false);

  const weekId = useMemo(() => getWeekId(monday), [monday]);

  useEffect(() => {
    const ref = doc(db, "plannings", weekId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSlots(snap.data().slots || {});
      else setSlots({});
    });
    return unsub;
  }, [weekId]);

  const handleSetSession = async (dayKey, slotIndex, sessionKey) => {
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
  };

  const getSession = (key) => SESSION_TYPES.find((s) => s.key === key);

  return (
    <div className="space-y-6" data-testid="planning-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains mb-1">
            // Weekly Operation Plan
          </div>
          <h1 className="font-rajdhani font-bold uppercase tracking-widest text-3xl sm:text-4xl text-white">
            Planning
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {isAdmin
              ? "Cliquez sur un créneau pour attribuer une session."
              : "Consultation uniquement — Admin requis pour modifier."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonday(addDays(monday, -7))}
            data-testid="planning-prev-week"
            className="p-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-[#7A8B42]/60 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="px-4 py-2 border border-[#27272A] bg-[#141A14] min-w-[220px] text-center">
            <div className="font-jetbrains text-xs text-zinc-500 uppercase tracking-widest" data-testid="week-id">
              {weekId}
            </div>
            <div className="font-rajdhani uppercase tracking-wider text-[#C3DC5C]">
              {formatWeekRange(monday)}
            </div>
          </div>
          <button
            onClick={() => setMonday(addDays(monday, 7))}
            data-testid="planning-next-week"
            className="p-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-[#7A8B42]/60 transition-all"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setMonday(getMonday(new Date()))}
            data-testid="planning-today"
            className="hidden sm:inline-block px-3 py-2 border border-[#7A8B42]/40 text-[#C3DC5C] font-rajdhani uppercase tracking-wider text-xs hover:bg-[#7A8B42]/10 transition-all"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2" data-testid="session-legend">
        {SESSION_TYPES.map((s) => (
          <span
            key={s.key}
            className={`px-2 py-1 border text-[11px] font-jetbrains uppercase tracking-widest ${s.classes}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-amber-400 border border-amber-500/30 bg-amber-900/10 px-3 py-2 font-jetbrains uppercase tracking-wider">
          <Lock size={14} /> Mode lecture seule
        </div>
      )}

      {/* Grid */}
      <div className="border border-[#27272A] bg-[#0A0D0A] overflow-auto max-h-[calc(100vh-280px)]" data-testid="planning-grid">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-[#141A14] border-r border-b border-[#27272A] w-20 px-2 py-2 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500">
                UTC
              </th>
              {DAYS.map((d, i) => {
                const date = addDays(monday, i);
                return (
                  <th
                    key={d.key}
                    className="sticky top-0 z-20 bg-[#141A14] border-r border-b border-[#27272A] px-2 py-2 min-w-[120px]"
                  >
                    <div className="font-rajdhani font-semibold uppercase tracking-wider text-white text-sm">
                      {d.label}
                    </div>
                    <div className="text-[10px] font-jetbrains text-zinc-500">
                      {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot.index}>
                <td className="sticky left-0 z-10 bg-[#141A14] border-r border-b border-[#27272A] px-2 py-1 text-center font-jetbrains text-xs text-zinc-400">
                  {slot.label}
                </td>
                {DAYS.map((d) => {
                  const key = getCellKey(d.key, slot.index);
                  const sessionKey = slots[key];
                  const session = getSession(sessionKey);
                  return (
                    <td
                      key={key}
                      className="border-r border-b border-[#1F2937] p-0.5"
                      data-testid={`planning-cell-${d.key}-${slot.index}`}
                    >
                      <button
                        onClick={() => isAdmin && setEditingCell({ day: d.key, index: slot.index })}
                        disabled={!isAdmin}
                        className={`w-full min-h-[36px] px-2 py-1 text-left transition-all ${
                          session
                            ? `${session.classes} border`
                            : "bg-transparent hover:bg-[#1B221B] border border-transparent"
                        } ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {session ? (
                          <span className="text-[10px] font-jetbrains uppercase tracking-wider">
                            {session.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-700">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCell && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingCell(null)}
          data-testid="planning-edit-modal"
        >
          <div
            className="bg-[#0A0D0A] border border-[#7A8B42]/40 shadow-[0_0_40px_rgba(122,139,66,0.25)] max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A]">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#7A8B42] font-jetbrains">
                  // Attribuer session
                </div>
                <div className="font-rajdhani font-bold uppercase tracking-wider text-white text-lg">
                  {DAYS.find((d) => d.key === editingCell.day)?.label} · {TIME_SLOTS[editingCell.index].label}
                </div>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                data-testid="close-edit-modal"
                className="text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {SESSION_TYPES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleSetSession(editingCell.day, editingCell.index, s.key)}
                  disabled={saving}
                  data-testid={`session-option-${s.key}`}
                  className={`w-full px-4 py-3 border text-left font-rajdhani uppercase tracking-wider hover:brightness-125 transition-all ${s.classes}`}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => handleSetSession(editingCell.day, editingCell.index, null)}
                disabled={saving}
                data-testid="session-option-clear"
                className="w-full px-4 py-3 border border-[#27272A] text-zinc-400 hover:text-red-400 hover:border-red-500/40 font-rajdhani uppercase tracking-wider transition-all"
              >
                Vider le créneau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
