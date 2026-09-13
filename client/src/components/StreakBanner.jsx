const BONUS_EVERY = 7;

/**
 * The streak, and how close the next bonus is.
 *
 * The run of pips is the point: seven boxes, filled as the days land, so what
 * is being asked for is visible at a glance rather than described in a number.
 */
export default function StreakBanner({ streak = 0, daysToBonus = BONUS_EVERY, bonusXp = 100 }) {
  const intoCycle = streak % BONUS_EVERY;
  const filled = streak > 0 && intoCycle === 0 ? BONUS_EVERY : intoCycle;

  return (
    <div className="bg-gradient-to-r from-kid-orange to-kid-pink text-white rounded-2xl p-4 shadow">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-3xl" aria-hidden="true">{streak > 0 ? '🔥' : '🌱'}</span>
          <div className="min-w-0">
            <p className="font-fun text-xl font-extrabold leading-tight">
              {streak === 0 ? 'Start a streak!' : `${streak} day${streak === 1 ? '' : 's'} in a row`}
            </p>
            <p className="text-xs text-white/90">
              {streak === 0
                ? `Finish a quest today to begin. ${BONUS_EVERY} days in a row earns +${bonusXp} XP.`
                : daysToBonus === 1
                  ? `One more day for +${bonusXp} XP!`
                  : `${daysToBonus} more days for +${bonusXp} XP`}
            </p>
          </div>
        </div>
      </div>

      <div
        className="flex gap-1.5 mt-3"
        role="img"
        aria-label={`${filled} of ${BONUS_EVERY} days towards the next bonus`}
      >
        {Array.from({ length: BONUS_EVERY }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i < filled ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}
