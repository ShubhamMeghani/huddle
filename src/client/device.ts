/* A random per-browser id so a signed-in user's seat can follow them between devices. Not a secret. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('huddle-device');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('huddle-device', id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}
