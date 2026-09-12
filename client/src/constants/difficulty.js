// The emoji scale kids use to say how a task felt. Keys match the server's
// DIFFICULTY_LEVELS; everything a person sees is defined here.
export const DIFFICULTIES = [
  { key: 'easy', emoji: '😎', label: 'Easy peasy' },
  { key: 'ok', emoji: '🙂', label: 'No problem' },
  { key: 'tricky', emoji: '😅', label: 'A bit tricky' },
  { key: 'tough', emoji: '🥵', label: 'Really hard' },
];

const byKey = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, d]));

export function difficultyFor(key) {
  return key ? byKey[key] ?? null : null;
}
