import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { canReuseAccess, restoredServerBase } from "../src/lib/sessionPolicy";

const token = (offset: number) =>
  `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + offset })).toString("base64url")}.signature`;
function client(
  saved: Record<string, string>,
  rejectFirstSnapshot = false,
  offline = false,
) {
  const requests: string[] = [];
  let stored = JSON.stringify(saved);
  let rejected = false;
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const environment: Record<string, any> = {
    exports,
    process: { env: {} },
    __DEV__: true,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (name: string) => {
      if (name === "react-native") return { Platform: { OS: "ios" } };
      if (name === "expo-secure-store")
        return {
          getItemAsync: async () => stored,
          setItemAsync: async (_key: string, value: string) => {
            stored = value;
          },
        };
      if (name === "./sessionPolicy")
        return { canReuseAccess, restoredServerBase };
      if (name === "./transport") {
        const module: Record<string, any> = {};
        const source = ts.transpileModule(
          readFileSync(
            new URL("../src/lib/transport.ts", import.meta.url),
            "utf8",
          ),
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText;
        vm.runInNewContext(source, { ...environment, exports: module });
        return module;
      }
      throw new Error(`Unexpected import ${name}`);
    },
    fetch: async (url: string) => {
      const path = new URL(url).pathname;
      requests.push(path);
      if (offline) throw new Error("Server unavailable");
      if (path.endsWith("refresh/"))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access: token(300),
            refresh: "rotated-refresh",
          }),
        };
      if (rejectFirstSnapshot && !rejected) {
        rejected = true;
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: "Expired" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ month: "2026-11" }),
      };
    },
  };
  vm.runInNewContext(code, environment);
  return { api: exports, requests, stored: () => JSON.parse(stored) };
}
test("valid saved iPhone session opens dashboard with one network request", async () => {
  const c = client({
    access: token(300),
    refresh: "refresh",
    base: "http://localhost:8000",
  });
  assert.equal(await c.api.restoreSession(), true);
  assert.equal(c.requests.length, 0);
  await c.api.getSnapshot("2026-11");
  assert.deepEqual(c.requests, ["/api/v1/snapshot/"]);
});
test("expired and legacy sessions renew and persist the access token securely", async () => {
  for (const access of [token(-10), ""]) {
    const c = client({
      access,
      refresh: "refresh",
      base: "http://localhost:8000",
    });
    await c.api.restoreSession();
    assert.deepEqual(c.requests, []);
    await c.api.getSnapshot("2026-11");
    assert.deepEqual(c.requests, [
      "/api/v1/auth/refresh/",
      "/api/v1/snapshot/",
    ]);
    assert.equal(canReuseAccess(c.stored().access), true);
  }
});
test("a server-rejected saved token still refreshes and retries normally", async () => {
  const c = client(
    { access: token(300), refresh: "refresh", base: "http://localhost:8000" },
    true,
  );
  await c.api.restoreSession();
  await c.api.getSnapshot("2026-11");
  assert.deepEqual(c.requests, [
    "/api/v1/snapshot/",
    "/api/v1/auth/refresh/",
    "/api/v1/snapshot/",
  ]);
});
test("malformed or almost expired access tokens are not reused", () => {
  assert.equal(canReuseAccess("broken"), false);
  assert.equal(canReuseAccess(token(10)), false);
  assert.equal(canReuseAccess(token(-20)), false);
});

test("identifying a saved account never waits for an unavailable server", async () => {
  const c = client(
    { access: token(-10), refresh: "refresh", base: "http://localhost:8000" },
    false,
    true,
  );
  assert.equal(await c.api.restoreSession(), true);
  assert.deepEqual(c.requests, []);
  await assert.rejects(c.api.getSnapshot("2026-11"));
});

test("Expo restores the current LAN address after a Wi-Fi change without replacing remote servers", () => {
  assert.equal(
    restoredServerBase(
      "http://192.168.0.7:8000",
      "http://192.168.25.3:8000",
      true,
    ),
    "http://192.168.25.3:8000",
  );
  assert.equal(
    restoredServerBase(
      "https://api.example.com",
      "http://192.168.25.3:8000",
      true,
    ),
    "https://api.example.com",
  );
  assert.equal(
    restoredServerBase(
      "http://192.168.0.7:8000",
      "http://192.168.25.3:8000",
      false,
    ),
    "http://192.168.0.7:8000",
  );
  assert.equal(
    restoredServerBase(
      "http://192.168.0.7:9000",
      "http://192.168.25.3:8000",
      true,
    ),
    "http://192.168.0.7:9000",
  );
});
