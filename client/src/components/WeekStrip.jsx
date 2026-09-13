/**
 * The seven days ahead. Today is selected by default; tapping a later day shows
 * what is coming so it can be finished early.
 */
export default function WeekStrip({ days, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
      {days.map((day) => {
        const total = day.tasks.length;
        const done = day.tasks.filter((t) => t.completed).length;
        const allDone = total > 0 && done === total;
        const isSelected = selected === day.date;

        return (
          <button
            key={day.date}
            onClick={() => onSelect(day.date)}
            aria-pressed={isSelected}
            className={`shrink-0 w-[4.5rem] rounded-2xl px-2 py-2 min-h-[76px] flex flex-col items-center justify-center gap-0.5 transition ${
              isSelected ? 'bg-kid-purple text-white shadow' : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              {day.offset === 0 ? 'Today' : day.offset === 1 ? 'Tmrw' : day.weekday.slice(0, 3)}
            </span>
            <span className="font-fun text-lg font-bold leading-none">{Number(day.date.slice(8))}</span>
            <span className="text-[10px] leading-none">
              {total === 0 ? '—' : allDone ? '✅' : `${done}/${total}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
