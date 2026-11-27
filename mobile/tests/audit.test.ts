import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { fetchJson } from "../src/lib/transport";
import {
  displayDate,
  formatMoneyInput,
  parseDateInput,
} from "../src/lib/formats";
import { demoSnapshot, initialDemo } from "../src/lib/demo";

test("Brazilian date and money fields preserve cents and reject calendar rollover", () => {
  assert.equal(displayDate("2026-12-05"), "05/12/2026");
  assert.equal(displayDate("2026-12-01", true), "12/2026");
  assert.equal(parseDateInput("12/2026", true), "2026-12-01");
  assert.equal(parseDateInput("29/02/2028"), "2028-02-29");
  assert.equal(parseDateInput("31/02/2027"), "31/02/2027");
  assert.equal(formatMoneyInput("1234.56"), "1.234,56");
  assert.equal(formatMoneyInput("1.234,56"), "1.234,56");
  assert.equal(formatMoneyInput("12,345"), "12,345");
});

test("demo future commitments include skipped months without mutating stored state", () => {
  const state = initialDemo();
  const before = JSON.stringify(state);
  const direct = demoSnapshot(state, "2027-04");
  assert.equal(direct.summary.unpaid, "1040.00"); // 200 opening + Jan (140 + 70) + Feb–Apr 3 x (140 + 70)
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(demoSnapshot(state, "2027-04"), direct);
});

test("request timeout also covers a response body stalled after headers", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.flushHeaders();
    res.write('{"data":');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    await assert.rejects(
      fetchJson(`http://127.0.0.1:${address.port}`, {}, 100),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("empty logout and invalid successful responses are handled explicitly", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/logout") {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(200);
      res.end("not-json");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  try {
    assert.equal(
      (await fetchJson(`http://127.0.0.1:${port}/logout`)).data,
      null,
    );
    await assert.rejects(fetchJson(`http://127.0.0.1:${port}`), /incompleta/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
