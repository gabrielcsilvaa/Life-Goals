import { spawnSync } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const demo = process.env.EXPO_PUBLIC_DEMO_ONLY === "true";
const env = {
  ...process.env,
  EXPO_NO_DOTENV: "1",
  NODE_ENV: "production",
  EXPO_PUBLIC_API_URL: "",
};
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/expo/bin/cli"), "export", "--platform", "web"],
  { cwd: root, env, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);
const dist = resolve(root, "dist");
let html = readFileSync(resolve(dist, "index.html"), "utf8");
html = html
  .replace(/<html[^>]*>/, '<html lang="pt-BR">')
  .replace(
    "</head>",
    '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#344A35"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"></head>',
  );
writeFileSync(resolve(dist, "index.html"), html);
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
const paths = files(dist)
  .map((p) => "/" + relative(dist, p).split(sep).join("/"))
  .filter(
    (p) =>
      p.startsWith("/assets/") ||
      p.startsWith("/_expo/") ||
      p.startsWith("/icons/") ||
      p === "/offline.html",
  );
const version = createHash("sha256")
  .update(
    paths
      .map((p) => readFileSync(resolve(dist, p.slice(1))))
      .reduce((hash, data) => hash.update(data), createHash("sha256"))
      .digest("hex") + html,
  )
  .digest("hex")
  .slice(0, 16);
writeFileSync(
  resolve(dist, "version.json"),
  JSON.stringify({
    version,
    demoOnly: demo,
    commit: process.env.APP_COMMIT || "local",
  }),
);
writeFileSync(
  resolve(dist, "sw.js"),
  `"use strict";
const CACHE = "lifegoals-static-${version}";
const ALLOWED = new Set(${JSON.stringify(paths)});
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/offline.html", "/icons/icon-192.png"].map(p=>new Request(p,{credentials:"omit",cache:"reload"}))))));
self.addEventListener("message", e => {if(e.data?.type === "SKIP_WAITING") self.skipWaiting();});
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("lifegoals-static-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch", e => {
 const url = new URL(e.request.url);
 if(url.origin!==self.location.origin || e.request.method!=="GET") return;
 if(/^\\/(api|oauth|mcp)(\\/|$)/.test(url.pathname)) {e.respondWith(fetch(e.request,{cache:"no-store"}));return;}
 if(e.request.mode==="navigate") {e.respondWith(fetch(e.request,{cache:"no-store"}).catch(()=>caches.match("/offline.html")));return;}
 if(ALLOWED.has(url.pathname)&&!url.search) e.respondWith(caches.open(CACHE).then(async c=>{
  const cached=await c.match(url.pathname);if(cached)return cached;
  const response=await fetch(new Request(url.href,{credentials:"omit"}));
  if(response.ok&&response.type==="basic") await c.put(url.pathname,response.clone());return response;
 }));
});`,
);

// Portable dist remains provider-independent; this adapter is only a deployment artifact.
const output = resolve(root, "../.vercel/output");
mkdirSync(output, { recursive: true });
cpSync(dist, resolve(output, "static"), { recursive: true });
const backend = process.env.BACKEND_ORIGIN;
if (
  !demo &&
  (!backend ||
    !/^https:\/\/[^/]+$/.test(backend) ||
    /localhost|127\.0\.0\.1|192\.168\.|10\./.test(backend))
)
  throw new Error(
    "A produção exige BACKEND_ORIGIN HTTPS público; use DEMO_ONLY para preview sem backend.",
  );
const security = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
const routes = [
  { src: "/.*", headers: security, continue: true },
  {
    src: "/(sw\\.js|index\\.html|version\\.json|manifest\\.webmanifest)",
    headers: { "Cache-Control": "no-store" },
    continue: true,
  },
];
routes.push(
  demo
    ? {
        src: "/api(?:/.*)?",
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    : {
        src: "/api/(.*)",
        dest: backend + "/api/$1",
        headers: { "Cache-Control": "private, no-store" },
      },
);
routes.push(
  { handle: "filesystem" },
  {
    src: "/(.*)",
    dest: "/index.html",
    headers: { "Cache-Control": "no-store" },
  },
);
writeFileSync(
  resolve(output, "config.json"),
  JSON.stringify({ version: 3, routes }, null, 2),
);
console.log(
  `PWA ${version}: ${demo ? "isolated demo" : "same-origin cookie authentication"}`,
);
