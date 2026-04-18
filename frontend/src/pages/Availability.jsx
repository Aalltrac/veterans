import { useEffect, useMemo, useState } from \"react\";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from \"firebase/firestore\";
import { ChevronLeft, ChevronRight, Users, User as UserIcon } from \"lucide-react\";
import { db } from \"../lib/firebase\";
import { useAuth } from \"../context/AuthContext\";
import {
  DAYS,
  TIME_SLOTS,
  AVAILABILITY_STATES,
  getCellKey,
  getMonday,
  getWeekId,
  addDays,
  formatWeekRange,
} from \"../lib/timeSlots\";

const TEAM_VIEW = \"__team__\";

export default function Availability() {
  const { user } = useAuth();
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [allDocs, setAllDocs] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(TEAM_VIEW);
  const [saving, setSaving] = useState(false);

  const weekId = useMemo(() => getWeekId(monday), [monday]);

  // listen to all availabilities for the current week
  useEffect(() => {
    const q = query(collection(db, \"availabilities\"), where(\"weekId\", \"==\", weekId));
    const unsub = onSnapshot(q, (snap) => {
      const docs = [];
      snap.forEach((d) => docs.push(d.data()));
      setAllDocs(docs);
    });
    return unsub;
  }, [weekId]);

  // Ensure my own doc exists so I appear in the selector
  useEffect(() => {
    const myId = `${user.uid}_${weekId}`;
    setDoc(
      doc(db, \"availabilities\", myId),
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

  // Team aggregate per slot: { \"mon-0\": { disponible: n, indisponible: n, incertain: n } }
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

  const cycleState = async (dayKey, slotIndex) => {
    const key = getCellKey(dayKey, slotIndex);
    const current = myDoc.slots?.[key]; // undefined | \"disponible\" | \"indisponible\" | \"incertain\"
    const order = [undefined, \"disponible\", \"indisponible\", \"incertain\"];
    const idx = order.indexOf(current);
    const next = order[(idx === -1 ? 0 : idx + 1) % order.length];

    setSaving(true);
    const ref = doc(db, \"availabilities\", `${user.uid}_${weekId}`);
    try {
      // ensure the doc exists (idempotent)
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
      if (next === undefined) {
        await updateDoc(ref, { [`slots.${key}`]: deleteField() });
      } else {
        await updateDoc(ref, { [`slots.${key}`]: next });
      }
    } finally {
      setSaving(false);
    }
  };

  const getState = (k) => AVAILABILITY_STATES.find((s) => s.key === k);

  const isTeamView = selectedUserId === TEAM_VIEW;
  const isOwnView = selectedUserId === user.uid;

  // Sorted list of users for tabs (me first)
  const userList = useMemo(() => {
    const others = allDocs.filter((d) => d.userId !== user.uid);
    return [myDoc, ...others];
  }, [allDocs, myDoc, user.uid]);

  return (
    <div className=\"space-y-6\" data-testid=\"availability-page\">
      <div className=\"flex flex-wrap items-end justify-between gap-4\">
        <div>
          <div className=\"text-[10px] tracking-[0.4em] uppercase text-[#7A8B42] font-jetbrains mb-1\">
            // Squad Availability
          </div>
          <h1 className=\"font-rajdhani font-bold uppercase tracking-widest text-3xl sm:text-4xl text-white\">
            Disponibilités
          </h1>
          <p className=\"text-zinc-500 text-sm mt-1\">
            Cliquez sur votre grille pour cycler : Disponible → Indisponible → Incertain → Vide
          </p>
        </div>

        <div className=\"flex items-center gap-2\">
          <button
            onClick={() => setMonday(addDays(monday, -7))}
            data-testid=\"availability-prev-week\"
            className=\"p-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-[#7A8B42]/60 transition-all\"
          >
            <ChevronLeft size={18} />
          </button>
          <div className=\"px-4 py-2 border border-[#27272A] bg-[#141A14] min-w-[220px] text-center\">
            <div className=\"font-jetbrains text-xs text-zinc-500 uppercase tracking-widest\">
              {weekId}
            </div>
            <div className=\"font-rajdhani uppercase tracking-wider text-[#C3DC5C]\">
              {formatWeekRange(monday)}
            </div>
          </div>
          <button
            onClick={() => setMonday(addDays(monday, 7))}
            data-testid=\"availability-next-week\"
            className=\"p-2 border border-[#27272A] text-zinc-400 hover:text-white hover:border-[#7A8B42]/60 transition-all\"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* View selector */}
      <div className=\"flex flex-wrap gap-2\" data-testid=\"user-selector\">
        <button
          onClick={() => setSelectedUserId(TEAM_VIEW)}
          data-testid=\"view-team\"
          className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all ${
            isTeamView
              ? \"bg-[#7A8B42]/20 border-[#7A8B42]/70 text-[#C3DC5C] shadow-[0_0_15px_rgba(122,139,66,0.25)]\"
              : \"border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]\"
          }`}
        >
          <Users size={14} /> Vue équipe ({allDocs.length})
        </button>
        <button
          onClick={() => setSelectedUserId(user.uid)}
          data-testid=\"view-me\"
          className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all ${
            isOwnView
              ? \"bg-[#7A8B42]/20 border-[#7A8B42]/70 text-[#C3DC5C] shadow-[0_0_15px_rgba(122,139,66,0.25)]\"
              : \"border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]\"
          }`}
        >
          <UserIcon size={14} /> Mes dispos
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
                className={`flex items-center gap-2 px-3 py-2 border font-rajdhani uppercase tracking-wider text-xs transition-all ${
                  active
                    ? \"bg-[#7A8B42]/20 border-[#7A8B42]/70 text-[#C3DC5C] shadow-[0_0_15px_rgba(122,139,66,0.25)]\"
                    : \"border-[#27272A] text-zinc-400 hover:text-white hover:border-[#52525B]\"
                }`}
              >
                {d.userPhoto ? (
                  <img src={d.userPhoto} alt=\"\" className=\"h-5 w-5 rounded-full\" />
                ) : (
                  <div className=\"h-5 w-5 rounded-full bg-[#1B221B] border border-[#27272A] flex items-center justify-center text-[10px]\">
                    {d.userName?.[0] || \"?\"}
                  </div>
                )}
                <span className=\"max-w-[120px] truncate\">{d.userName}</span>
              </button>
            );
          })}
      </div>

      {/* Legend */}
      <div className=\"flex flex-wrap gap-2\">
        {AVAILABILITY_STATES.map((s) => (
          <span
            key={s.key}
            className={`px-2 py-1 border text-[11px] font-jetbrains uppercase tracking-widest ${s.classes}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {isTeamView && (
        <div className=\"text-xs text-zinc-400 border border-[#27272A] bg-[#141A14] px-3 py-2 font-jetbrains uppercase tracking-wider\">
          Vue agrégée — survolez une case pour voir les joueurs
        </div>
      )}
      {!isTeamView && !isOwnView && selectedDoc && (
        <div className=\"text-xs text-zinc-400 border border-[#27272A] bg-[#141A14] px-3 py-2 font-jetbrains uppercase tracking-wider\">
          Consultation — {selectedDoc.userName}
        </div>
      )}
      {isOwnView && (
        <div className=\"text-xs text-[#C3DC5C] border border-[#7A8B42]/40 bg-[#7A8B42]/10 px-3 py-2 font-jetbrains uppercase tracking-wider\">
          Mode édition — cliquez sur les cases pour modifier vos dispos
        </div>
      )}

      <div
        className=\"border border-[#27272A] bg-[#0A0D0A] overflow-auto max-h-[calc(100vh-380px)]\"
        data-testid=\"availability-grid\"
      >
        <table className=\"w-full border-collapse\">
          <thead>
            <tr>
              <th className=\"sticky top-0 left-0 z-30 bg-[#141A14] border-r border-b border-[#27272A] w-20 px-2 py-2 text-[10px] font-jetbrains uppercase tracking-widest text-zinc-500\">
                UTC
              </th>
              {DAYS.map((d, i) => {
                const date = addDays(monday, i);
                return (
                  <th
                    key={d.key}
                    className=\"sticky top-0 z-20 bg-[#141A14] border-r border-b border-[#27272A] px-2 py-2 min-w-[110px]\"
                  >
                    <div className=\"font-rajdhani font-semibold uppercase tracking-wider text-white text-sm\">
                      {d.label}
                    </div>
                    <div className=\"text-[10px] font-jetbrains text-zinc-500\">
                      {date.toLocaleDateString(\"fr-FR\", { day: \"2-digit\", month: \"2-digit\" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot.index}>
                <td className=\"sticky left-0 z-10 bg-[#141A14] border-r border-b border-[#27272A] px-2 py-1 text-center font-jetbrains text-xs text-zinc-400\">
                  {slot.label}
                </td>
                {DAYS.map((d) => {
                  const key = getCellKey(d.key, slot.index);

                  if (isTeamView) {
                    const agg = teamAgg[key];
                    const tooltip = agg?.users
                      .map((u) => `${u.name}: ${u.state}`)
                      .join(\"
\");
                    return (
                      <td
                        key={key}
                        className=\"border-r border-b border-[#1F2937] p-0.5\"
                        data-testid={`team-cell-${d.key}-${slot.index}`}
                      >
                        <div
                          title={tooltip || \"Aucune donnée\"}
                          className=\"w-full min-h-[36px] flex items-center justify-center gap-1 text-[10px] font-jetbrains\"
                        >
                          {agg ? (
                            <>
                              {agg.disponible > 0 && (
                                <span className=\"px-1 border border-[#7A8B42]/60 bg-[#7A8B42]/20 text-[#C3DC5C]\">
                                  ✓{agg.disponible}
                                </span>
                              )}
                              {agg.incertain > 0 && (
                                <span className=\"px-1 border border-amber-500/60 bg-amber-900/30 text-amber-300\">
                                  ?{agg.incertain}
                                </span>
                              )}
                              {agg.indisponible > 0 && (
                                <span className=\"px-1 border border-red-500/60 bg-red-900/30 text-red-300\">
                                  ✕{agg.indisponible}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className=\"text-zinc-700\">—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  const doc = isOwnView ? myDoc : selectedDoc;
                  const stateKey = doc?.slots?.[key];
                  const state = getState(stateKey);
                  return (
                    <td
                      key={key}
                      className=\"border-r border-b border-[#1F2937] p-0.5\"
                      data-testid={`availability-cell-${d.key}-${slot.index}`}
                    >
                      <button
                        onClick={() => isOwnView && cycleState(d.key, slot.index)}
                        disabled={!isOwnView || saving}
                        className={`w-full min-h-[36px] px-2 py-1 text-center transition-all ${
                          state ? `${state.classes} border` : \"bg-transparent hover:bg-[#1B221B] border border-transparent\"
                        } ${isOwnView ? \"cursor-pointer\" : \"cursor-default\"}`}
                      >
                        {state ? (
                          <span className=\"text-[10px] font-jetbrains uppercase tracking-wider\">
                            {state.short}
                          </span>
                        ) : (
                          <span className=\"text-[10px] text-zinc-700\">—</span>
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
    </div>
  );
}
