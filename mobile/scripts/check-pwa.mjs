import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const dist = resolve(import.meta.dirname, "../dist");
const fail = (m) => {
  throw new Error(m);
};
const manifest = JSON.parse(
  readFileSync(resolve(dist, "manifest.webmanifest"), "utf8"),
);
if (
  manifest.name !== "Life Goals" ||
  manifest.display !== "standalone" ||
  manifest.scope !== "/"
)
  fail("Invalid manifest");
for (const size of [192, 512]) {
  const icon = manifest.icons.find(
    (i) => i.sizes === `${size}x${size}` && i.purpose === "any",
  );
  if (!icon) fail("Missing install icon");
  const png = readFileSync(resolve(dist, icon.src.slice(1)));
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size)
    fail("Wrong icon dimensions");
}
if (!manifest.icons.some((i) => i.purpose === "maskable"))
  fail("Missing maskable icon");
const html = readFileSync(resolve(dist, "index.html"), "utf8");
if (!html.includes('rel="manifest"') || !html.includes("apple-touch-icon"))
  fail("Missing install metadata");
const worker = readFileSync(resolve(dist, "sw.js"), "utf8");
if (
  !worker.includes("SKIP_WAITING") ||
  !worker.includes('credentials:"omit"') ||
  !worker.includes("api|oauth|mcp")
)
  fail("Unsafe worker");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
const secrets = Object.entries(process.env).filter(
  ([k, v]) =>
    /PASSWORD|SECRET_KEY|PRIVATE_KEY|VERCEL_TOKEN|DATABASE_URL/.test(k) &&
    v &&
    v.length >= 12,
);
for (const file of files(dist).filter((p) =>
  /\.(js|json|html|webmanifest)$/.test(p),
)) {
  const data = readFileSync(file, "utf8");
  if (
    /(?:postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY|github_pat_[A-Za-z0-9_]{40}|ghp_[A-Za-z0-9]{30}|https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.))/i.test(
      data,
    )
  )
    fail("Sensitive value or local endpoint in build");
  for (const [, value] of secrets)
    if (data.includes(value)) fail("Environment secret found in build");
}
console.log(
  "PWA manifest, icons, static-only worker, routing artifacts and bundle checks passed.",
);
