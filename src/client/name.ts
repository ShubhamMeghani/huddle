/* The player's name, remembered on this device (R98) so joining another room is one tap. Storage can be
 * missing or blocked (private mode): then nothing is remembered and nothing breaks. */
const KEY = 'huddle-name';

export function rememberedName(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(KEY, name.trim());
  } catch {}
}
