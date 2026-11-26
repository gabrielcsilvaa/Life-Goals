import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoSnapshot,
  demoCommand,
  initialDemo,
  materializeDemo,
} from "../src/lib/demo";
import { restoreAccountView } from "../src/lib/viewPreference";
test("reading months never mutates stored demo and recurring IDs survive reloads", () => {
  const original = initialDemo();
  const saved = JSON.stringify(original);
  const first = demoSnapshot(original, "2027-02");
  const second = demoSnapshot(JSON.parse(saved), "2027-02");
  assert.equal(JSON.stringify(original), saved);
  assert.deepEqual(
    first.entries.map((e) => e.id),
    second.entries.map((e) => e.id),
  );
  const materialized = materializeDemo(original, "2027-02");
  const tim = first.entries.find(
    (e) => e.recurring && e.description === "TIM",
  )!;
  const next = demoCommand(materialized, "delete_transaction", {
    entry_id: tim.id,
    version: tim.version,
    confirmed: true,
  });
  assert.equal(
    demoSnapshot(next, "2027-02").entries.find((e) => e.id === tim.id)?.status,
    "canceled",
  );
  assert(
    demoSnapshot(next, "2027-02").entries.some(
      (e) => e.description === "Academia" && e.status !== "canceled",
    ),
  );
  assert(
    demoSnapshot(next, "2027-01").entries.some((e) => e.kind === "income"),
  );
});
test("reload restores selected month for the same account without leaking another account preference", async () => {
  const view = {
    server: "http://local:8000",
    username: "Gabriel",
    month: "2026-12",
  };
  const requested: string[] = [];
  const load = async (month: string) => {
    requested.push(month);
    return { month, user: { username: "Gabriel" } };
  };
  assert.equal(
    (await restoreAccountView(view, view.server, "2026-11", load)).month,
    "2026-12",
  );
  assert.deepEqual(requested, ["2026-12"]);
  const other = await restoreAccountView(
    view,
    view.server,
    "2026-11",
    async (month) => ({ month, user: { username: "Outra pessoa" } }),
  );
  assert.equal(other.month, "2026-11");
});
