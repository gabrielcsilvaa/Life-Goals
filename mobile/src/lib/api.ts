import { canReuseAccess, restoredServerBase } from "./sessionPolicy";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Connection, Entry, Payload, Snapshot } from "./types";
import { fetchJson } from "./transport";

let access = "";
let refresh = "";
export const demoOnly = process.env.EXPO_PUBLIC_DEMO_ONLY === "true";
const web = Platform.OS === "web";
let base =
  web && typeof window !== "undefined"
    ? __DEV__
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : window.location.origin
    : process.env.EXPO_PUBLIC_API_URL ||
      (__DEV__ ? "http://localhost:8000" : "");
let csrf = "";
let csrfPending: Promise<string> | null = null;
let refreshing: Promise<void> | null = null;
let sessionGeneration = 0;

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
function details(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(details).join(" ");
  if (value && typeof value === "object")
    return (
      Object.entries(value)
        .map(([key, v]) => `${key}: ${details(v)}`)
        .join(" · ") || "Não foi possível concluir a operação."
    );
  return "Não foi possível concluir a operação.";
}
async function saveSession() {
  if (Platform.OS !== "web") {
    await SecureStore.setItemAsync(
      "lifegoals-session",
      JSON.stringify({ access, refresh, base }),
    );
  }
}
export async function restoreSession() {
  if (demoOnly) return false;
  if (web) {
    // This boolean is only a UX hint. The HttpOnly session must still be verified.
    try {
      if (window.localStorage.getItem("lifegoals-web-session-present") !== "1")
        return false;
    } catch {
      /* Cookie verification remains authoritative. */
    }
    try {
      if (__DEV__) {
        try {
          const saved = window.localStorage.getItem("lifegoals-web-server");
          if (saved && ["http:", "https:"].includes(new URL(saved).protocol))
            base = saved;
        } catch {
          /* Keep configured origin. */
        }
      }
      await request("/api/v1/web/session/");
      return true;
    } catch {
      return false;
    }
  }
  const generation = sessionGeneration;
  const raw = await SecureStore.getItemAsync("lifegoals-session");
  if (generation !== sessionGeneration) return false;
  if (!raw) return false;
  const saved = JSON.parse(raw);
  if (
    !saved ||
    typeof saved.refresh !== "string" ||
    !saved.refresh ||
    typeof saved.base !== "string"
  )
    return false;
  refresh = saved.refresh;
  base = restoredServerBase(
    saved.base,
    process.env.EXPO_PUBLIC_API_URL,
    __DEV__,
  );
  // Restore only local identity here. Network renewal belongs to the real-data request.
  access = canReuseAccess(saved.access) ? saved.access : "";
  return true;
}
async function renew() {
  if (!refresh) throw new ApiError("Entre na sua conta novamente.", 401);
  if (refreshing) return refreshing;
  const generation = sessionGeneration;
  refreshing = (async () => {
    const data = await request(
      "/api/v1/auth/refresh/",
      { method: "POST", body: JSON.stringify({ refresh }) },
      false,
    );
    if (generation !== sessionGeneration)
      throw new ApiError("A sessão foi alterada.", 409);
    access = data.access;
    refresh = data.refresh || refresh;
    await saveSession();
  })();
  try {
    await refreshing;
  } finally {
    refreshing = null;
  }
}
async function request(
  path: string,
  init: RequestInit = {},
  auth = true,
  allowRefresh = true,
): Promise<any> {
  if (demoOnly)
    throw new ApiError("Este preview usa somente dados de demonstração.");
  if (auth && !web && !access) await renew();
  if (
    web &&
    !["GET", "HEAD", "OPTIONS"].includes(init.method || "GET") &&
    !csrf
  ) {
    csrfPending ||= fetchJson(`${base}/api/v1/web/csrf/`, {
      credentials: "include",
    })
      .then(({ response, data }) => {
        if (!response.ok || typeof data?.csrfToken !== "string")
          throw new ApiError("Não foi possível preparar a sessão segura.");
        csrf = data.csrfToken;
        return csrf;
      })
      .finally(() => {
        csrfPending = null;
      });
    await csrfPending;
  }
  let response: Response;
  let data: any;
  const generation = sessionGeneration;
  try {
    ({ response, data } = await fetchJson(`${base}${path}`, {
      ...init,
      ...(web ? { credentials: "include" as const } : {}),
      headers: {
        "Content-Type": "application/json",
        ...(auth && !web ? { Authorization: `Bearer ${access}` } : {}),
        ...(web && csrf ? { "X-CSRFToken": csrf } : {}),
        ...init.headers,
      },
    }));
  } catch {
    throw new ApiError(
      "Sem resposta do servidor. Confira a conexão. Uma tentativa repetida manterá a mesma identificação.",
    );
  }
  if (auth && generation !== sessionGeneration)
    throw new ApiError("A sessão foi alterada.", 409);
  if (response.status === 401 && auth && !web && allowRefresh) {
    await renew();
    return request(path, init, true, false);
  }
  if (response.status === 204) return null;
  if (!response.ok)
    throw new ApiError(details(data.error?.details || data), response.status);
  return data;
}
export async function login(
  url: string,
  username: string,
  password: string,
  displayName?: string,
  email?: string,
) {
  const parsed = new URL(url);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    (!__DEV__ && parsed.protocol !== "https:")
  )
    throw new ApiError("Use uma URL HTTPS válida para o servidor.");
  if (web && !__DEV__ && parsed.origin !== window.location.origin)
    throw new ApiError(
      "A conexão web precisa usar a origem configurada para este aplicativo.",
    );
  const generation = ++sessionGeneration;
  access = "";
  refresh = "";
  base = url.replace(/\/$/, "");
  csrf = "";
  const data = await request(
    web
      ? `/api/v1/web/${displayName ? "register" : "login"}/`
      : `/api/v1/auth/${displayName ? "register" : "token"}/`,
    {
      method: "POST",
      body: JSON.stringify({
        password,
        ...(displayName
          ? { display_name: displayName, email }
          : {
              ...(username.includes("@") ? { email: username } : { username }),
            }),
      }),
    },
    false,
  );
  if (generation !== sessionGeneration)
    throw new ApiError("A sessão foi alterada.", 409);
  if (data.verification_required) throw new ApiError(data.message, 202);
  if (web) {
    csrf = "";
    try {
      window.localStorage.setItem("lifegoals-web-session-present", "1");
      if (__DEV__) window.localStorage.setItem("lifegoals-web-server", base);
    } catch {
      /* Optional non-sensitive hint. */
    }
    return;
  }
  access = data.access;
  refresh = data.refresh;
  await saveSession();
}
export async function logout() {
  sessionGeneration++;
  if (web) {
    await request("/api/v1/web/logout/", { method: "POST", body: "{}" });
    csrf = "";
    try {
      window.localStorage.removeItem("lifegoals-web-session-present");
    } catch {
      /* The server session was invalidated. */
    }
    return;
  }
  try {
    if (access && refresh)
      await request("/api/v1/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh }),
      });
  } finally {
    access = "";
    refresh = "";
    if (Platform.OS !== "web")
      await SecureStore.deleteItemAsync("lifegoals-session");
  }
}
export const getSnapshot = (month: string): Promise<Snapshot> =>
  request(`/api/v1/snapshot/?month=${month}`);
export const getTransactionPage = (
  month: string,
  offset: number,
): Promise<{ count: number; results: Entry[] }> =>
  request(`/api/v1/transactions/?month=${month}&limit=200&offset=${offset}`);
export const command = (operation: string, payload: Payload, key: string) =>
  request(`/api/v1/commands/${operation}/`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Idempotency-Key": key },
  });
export const getConnections = (): Promise<Connection[]> =>
  request("/api/v1/connections/");
export const createConnection = (name: string, write: boolean) =>
  request("/api/v1/connections/", {
    method: "POST",
    body: JSON.stringify({
      name,
      scopes: write ? ["finance:read", "finance:write"] : ["finance:read"],
      expires_in_days: 30,
    }),
  });
export const revokeConnection = (id: string) =>
  request(`/api/v1/connections/${id}/revoke/`, { method: "POST" });
export const serverUrl = () => base;
export const recoverAccount = (email: string) =>
  request(
    "/api/v1/web/recover/",
    { method: "POST", body: JSON.stringify({ email }) },
    false,
  );
export const confirmAccountLink = (
  kind: "verify" | "reset",
  payload: Payload,
) =>
  request(
    `/api/v1/web/${kind}/`,
    { method: "POST", body: JSON.stringify(payload) },
    false,
  );
export const bindEmail = (email: string, password: string) =>
  request("/api/v1/web/bind-email/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const updatePreferences = (hide_amounts: boolean) =>
  request("/api/v1/web/session/", {
    method: "PATCH",
    body: JSON.stringify({ hide_amounts }),
  });
