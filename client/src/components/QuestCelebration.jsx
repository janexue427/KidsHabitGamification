import { useEffect, useMemo, useRef, useState } from 'react';
import { DIFFICULTIES } from '../constants/difficulty.js';

const CONFETTI_COLORS = ['#7c3aed', '#ec4899', '#facc15', '#14b8a6', '#fb923c', '#38bdf8'];
const CONFETTI_COUNT = 34;

// Fixed seed positions per mount so a re-render never re-randomises mid-flight.
function useConfetti(active) {
  return useMemo(() => {
    if (!active) return [];
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      drift: `${(Math.random() - 0.5) * 160}px`,
      spin: `${360 + Math.random() * 720}deg`,
      delay: `${Math.random() * 0.5}s`,
      duration: `${1.9 + Math.random() * 1.3}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    }));
  }, [active]);
}

/**
 * Full-screen reward moment for finishing a quest: confetti, an XP badge that
 * counts up, any milestones that just landed, and the "how hard was it?" picker.
 *
 * It stays open until the kid answers or closes it — the XP is already banked,
 * so there is no rush and no way to lose it by tapping the wrong thing.
 */
export default function QuestCelebration({ celebration, onRate, onClose }) {
  const { xp, milestones = [], taskTitle, difficulty, streakBonus, aheadOfTime } = celebration;
  const confetti = useConfetti(true);
  const [shownXp, setShownXp] = useState(0);
  const [picked, setPicked] = useState(difficulty ?? null);
  const closeRef = useRef(null);

  // Count the XP up rather than snapping to it — the number is the payoff.
  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownXp(Math.round(xp * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [xp]);

  // Escape closes, and focus starts on the dialog so screen readers announce it.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function choose(key) {
    setPicked(key);
    onRate(key);
    // Let the selection register visually before the sheet disappears.
    setTimeout(onClose, 700);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Quest complete. You earned ${xp} XP.`}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 qf-fade-in"
    >
      <div className="absolute inset-0 bg-purple-950/45 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="qf-confetti"
            style={{
              left: `${c.left}%`,
              background: c.color,
              borderRadius: c.round ? '50%' : '2px',
              '--qf-drift': c.drift,
              '--qf-spin': c.spin,
              '--qf-delay': c.delay,
              '--qf-duration': c.duration,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center qf-pop-in max-h-[90dvh] overflow-y-auto">
        <div className="relative flex items-center justify-center mb-2" aria-hidden="true">
          <span className="absolute w-24 h-24 rounded-full border-4 border-kid-yellow qf-ring" />
          <span className="text-6xl qf-badge-pop">🎉</span>
        </div>

        <p className="font-fun text-4xl font-extrabold text-kid-purple">+{shownXp} XP</p>
        {taskTitle && <p className="text-sm text-gray-500 mt-1 break-words">{taskTitle}</p>}
        {aheadOfTime && (
          <p className="text-xs font-semibold text-kid-orange mt-1">Finished early — nice planning! ⚡</p>
        )}

        {streakBonus && (
          <div className="mt-4 bg-kid-orange/15 border border-kid-orange rounded-2xl px-3 py-2 qf-slide-up">
            <p className="font-fun font-bold text-orange-900 text-sm">🔥 {streakBonus.streak}-day streak!</p>
            <p className="text-xs text-orange-800">Bonus +{streakBonus.xp} XP</p>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="mt-4 space-y-2">
            {milestones.map((m, i) => (
              <div
                key={m.milestoneId}
                className="bg-kid-yellow/25 border border-kid-yellow rounded-2xl px-3 py-2 qf-slide-up"
                style={{ animationDelay: `${0.35 + i * 0.12}s` }}
              >
                <p className="font-fun font-bold text-purple-900 text-sm">🏆 Milestone unlocked!</p>
                <p className="text-xs text-purple-800 break-words">
                  {m.title} — bonus +{m.bonusXp} XP
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 qf-slide-up" style={{ animationDelay: '0.3s' }}>
          <p className="font-fun font-bold text-gray-700 mb-3">How hard was it?</p>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                onClick={() => choose(d.key)}
                aria-pressed={picked === d.key}
                aria-label={d.label}
                className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 min-h-[76px] justify-center transition ${
                  picked === d.key
                    ? 'bg-kid-purple/15 ring-2 ring-kid-purple scale-105'
                    : 'bg-gray-50 hover:bg-gray-100 active:scale-95'
                }`}
              >
                <span className="text-3xl leading-none">{d.emoji}</span>
                <span className="text-[10px] font-semibold text-gray-500 leading-tight">{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          ref={closeRef}
          onClick={onClose}
          className="mt-5 w-full min-h-[48px] rounded-xl bg-kid-purple text-white font-fun font-bold text-lg"
        >
          {picked ? 'Nice!' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
