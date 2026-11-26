import assert from "node:assert/strict";
import { test } from "node:test";
import { demoCommand, demoSnapshot, initialDemo } from "../src/lib/demo";
import { cents, decimal, normalizeMoney, shiftMonth } from "../src/lib/money";

test("decimal strings retain cents exactly", () => {
  assert.equal(cents("0.10") + cents("0.20"), 30);
  assert.equal(decimal(-3334), "-33.34");
  assert.equal(normalizeMoney("18,50"), "18.50");
  assert.throws(() => cents("1.001"));
  assert.throws(() => cents("Infinity"));
});
test("month navigation crosses year boundaries", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
});
test("example contains planning and zero invented savings", () => {
  const snapshot = demoSnapshot(initialDemo(), "2027-01");
  assert.equal(snapshot.summary.income_received, "0.00");
  assert.equal(snapshot.summary.reserved, "0.00");
  assert.equal(snapshot.summary.available, "-1617.00");
  assert.equal(snapshot.goals[0].accumulated, "0.00");
  assert.deepEqual(
    snapshot.goals[0].history?.map((h) => h.accumulated),
    Array(6).fill("0.00"),
  );
});

test("goal evolution carries earlier reserves forward and includes withdrawals, not plans", () => {
  const state = initialDemo();
  state.allocations = [
    {
      goal_id: "italy",
      account_id: "main",
      amount: "50.00",
      occurred_on: "2026-01-01",
    },
    {
      goal_id: "italy",
      account_id: "main",
      amount: "100.00",
      occurred_on: "2026-09-01",
    },
    {
      goal_id: "italy",
      account_id: "main",
      amount: "-30.00",
      occurred_on: "2026-10-01",
    },
    {
      goal_id: "italy",
      account_id: "main",
      amount: "999.00",
      occurred_on: "2099-01-01",
    },
    {
      goal_id: "emergency",
      account_id: "main",
      amount: "20.00",
      occurred_on: "2026-10-01",
    },
  ];
  const goal = demoSnapshot(state, "2026-10").goals.find(
    (g) => g.id === "italy",
  )!;
  assert.deepEqual(
    goal.history?.map((h) => h.accumulated),
    ["50.00", "50.00", "50.00", "50.00", "150.00", "120.00"],
  );
});
test("paid expenses move cash once and persist in demo state", () => {
  const state = demoCommand(initialDemo(), "create_transaction", {
    kind: "expense",
    description: "Uber",
    amount: "32.00",
    account_id: "main",
    category_id: "transport",
    due_date: "2026-11-01",
    paid_on: "2026-11-01",
  });
  const snapshot = demoSnapshot(JSON.parse(JSON.stringify(state)), "2026-11");
  assert.equal(snapshot.summary.balance, "-32.00");
  assert.equal(snapshot.summary.available, "-32.00");
  assert.equal(snapshot.summary.unpaid, "0.00");
});
test("reserving money and consuming the plan do not subtract twice", () => {
  let state = initialDemo();
  state.accounts[0].opening_balance = "2000.00";
  state = demoCommand(state, "set_goal_plan", {
    goal_id: "italy",
    month: "2026-11-01",
    amount: "600.00",
  });
  state = demoCommand(state, "allocate_goal_funds", {
    goal_id: "italy",
    account_id: "main",
    amount: "200.00",
    occurred_on: "2026-11-01",
  });
  const snapshot = demoSnapshot(state, "2026-11");
  assert.equal(snapshot.summary.balance, "2000.00");
  assert.equal(snapshot.summary.reserved, "200.00");
  assert.equal(snapshot.summary.available, "1400.00");
});
test("recurring expense generation does not duplicate", () => {
  const state = demoCommand(initialDemo(), "generate_recurring_expenses", {
    month: "2027-02-01",
  });
  const repeated = demoCommand(state, "generate_recurring_expenses", {
    month: "2027-02-01",
  });
  assert.equal(repeated.entries.length, state.entries.length);
  assert.equal(repeated.movements.length, 0);
});

test("withdrawing an older reserve does not invent a new monthly plan", () => {
  let state = initialDemo();
  state.accounts[0].opening_balance = "2000.00";
  state = demoCommand(state, "allocate_goal_funds", {
    goal_id: "italy",
    account_id: "main",
    amount: "1000.00",
    occurred_on: "2026-10-01",
  });
  state = demoCommand(state, "allocate_goal_funds", {
    goal_id: "italy",
    account_id: "main",
    amount: "100.00",
    occurred_on: "2026-11-01",
    direction: "withdraw",
  });
  const summary = demoSnapshot(state, "2026-11").summary;
  assert.equal(summary.goal_plan_remaining, "0.00");
  assert.equal(summary.available, "1100.00");
});
