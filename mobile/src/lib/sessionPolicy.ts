/** Decoding only avoids unnecessary refreshes; the server validates every JWT. */
export function canReuseAccess(
  token: unknown,
  now = Date.now(),
): token is string {
  if (typeof token !== "string") return false;
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Do not depend on a browser atob global: this also runs in Hermes.
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bits = 0,
      accumulator = 0,
      decoded = "";
    for (const char of normalized.replace(/=+$/, "")) {
      const value = alphabet.indexOf(char);
      if (value < 0) return false;
      accumulator = (accumulator << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded += String.fromCharCode((accumulator >>> bits) & 255);
        accumulator &= (1 << bits) - 1;
      }
    }
    const claims = JSON.parse(decoded);
    return typeof claims.exp === "number" && claims.exp * 1000 > now + 30000;
  } catch {
    return false;
  }
}

/** Expo LAN addresses change when the developer switches Wi-Fi networks. */
export function restoredServerBase(
  saved: string,
  configured: string | undefined,
  development: boolean,
): string {
  if (!development || !configured) return saved;
  try {
    const oldUrl = new URL(saved),
      current = new URL(configured);
    const local = (host: string) =>
      /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
        host,
      );
    if (
      oldUrl.protocol === "http:" &&
      current.protocol === "http:" &&
      local(oldUrl.hostname) &&
      local(current.hostname) &&
      oldUrl.port === current.port &&
      oldUrl.pathname === current.pathname
    )
      return configured.replace(/\/$/, "");
  } catch {
    /* Preserve explicitly saved remote connections. */
  }
  return saved;
}
