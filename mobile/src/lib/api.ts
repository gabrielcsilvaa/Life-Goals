import { canReuseAccess, restoredServerBase } from "./sessionPolicy";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Connection, Entry, Payload, Snapshot } from "./types";
import { fetchJson } from "./transport";

let access = "";
let refresh = "";
let base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
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
  if (Platform.OS === "web") return false;
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
  if (auth && !access) await renew();
  let response: Response;
  let data: any;
  const generation = sessionGeneration;
  try {
    ({ response, data } = await fetchJson(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${access}` } : {}),
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
  if (response.status === 401 && auth && allowRefresh) {
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
  const generation = ++sessionGeneration;
  access = "";
  refresh = "";
  base = url.replace(/\/$/, "");
  const data = await request(
    `/api/v1/auth/${displayName ? "register" : "token"}/`,
    {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        ...(displayName ? { display_name: displayName, email } : {}),
      }),
    },
    false,
  );
  if (generation !== sessionGeneration)
    throw new ApiError("A sessão foi alterada.", 409);
  access = data.access;
  refresh = data.refresh;
  await saveSession();
}
export async function logout() {
  sessionGeneration++;
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
