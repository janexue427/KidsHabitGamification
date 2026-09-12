// How hard a kid found a task. The client owns the emoji and wording; the
// database stores only these keys so the presentation can change freely.
export const DIFFICULTY_LEVELS = ['easy', 'ok', 'tricky', 'tough'];

export function isValidDifficulty(value) {
  return DIFFICULTY_LEVELS.includes(value);
}
