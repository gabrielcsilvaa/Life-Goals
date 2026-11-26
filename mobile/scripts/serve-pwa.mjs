import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
const dist = resolve(import.meta.dirname, "../dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".css": "text/css",
};
let testVersion = 0;
createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (
    url.pathname === "/__test/update" &&
    process.env.PWA_TEST_HARNESS === "1" &&
    req.method === "POST"
  ) {
    testVersion++;
    res.writeHead(204);
    res.end();
    return;
  }
  if (/^\/(api|oauth|mcp)(\/|$)/.test(url.pathname)) {
    res.writeHead(503, { "Cache-Control": "no-store" });
    res.end();
    return;
  }
  let path = resolve(dist, "." + decodeURIComponent(url.pathname));
  if (
    !path.startsWith(dist + "/") &&
    !path.startsWith(dist + "\\") &&
    path !== dist
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (!existsSync(path) || statSync(path).isDirectory())
    path = resolve(dist, "index.html");
  const headers = {
    ...JSON.parse(
      readFileSync(resolve(dist, "../../.vercel/output/config.json"), "utf8"),
    ).routes[0].headers,
    "Content-Type": types[extname(path)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  res.writeHead(200, headers);
  const body = readFileSync(path);
  res.end(
    url.pathname === "/sw.js" && testVersion
      ? Buffer.concat([body, Buffer.from(`\n// test update ${testVersion}\n`)])
      : body,
  );
}).listen(Number(process.env.PORT || 8091), "127.0.0.1", () =>
  console.log("Isolated PWA test server ready"),
);
