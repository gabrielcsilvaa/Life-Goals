import assert from "node:assert/strict";
import { test } from "node:test";
import { demoCommand, demoSnapshot, initialDemo } from "../src/lib/demo";

const opening = (due_date: string) => ({
  card_id: "nu",
  category_id: "other",
  amount: "660.00",
  due_date,
});

test("opening balance cannot recur in another month, including after payment", () => {
  for (const paid of [false, true]) {
    let state = initialDemo();
    state = demoCommand(
      state,
      "register_opening_invoice",
      opening("2026-11-12"),
    );
    if (paid) {
      state = demoCommand(state, "pay_card_invoice", {
        card_id: "nu",
        account_id: "main",
        month: "2026-11-01",
        amount: "660.00",
        paid_on: "2026-11-12",
      });
    }
    assert.throws(
      () =>
        demoCommand(state, "register_opening_invoice", opening("2026-12-12")),
      /inicial/,
    );
    assert.equal(state.entries.filter((e) => e.card_id === "nu").length, 1);
  }
});

test("canceling an incorrect opening allows replacement and keeps canceled debt out of totals", () => {
  let state = demoCommand(
    initialDemo(),
    "register_opening_invoice",
    opening("2026-12-12"),
  );
  const wrong = state.entries.find((e) => e.card_id === "nu")!;
  state = demoCommand(state, "cancel_transaction", {
    entry_id: wrong.id,
    version: wrong.version,
  });
  state = demoCommand(state, "register_opening_invoice", opening("2026-11-12"));
  state = demoCommand(state, "pay_card_invoice", {
    card_id: "nu",
    account_id: "main",
    month: "2026-11-01",
    amount: "660.00",
    paid_on: "2026-11-12",
  });
  const nov = demoSnapshot(state, "2026-11");
  const dec = demoSnapshot(state, "2026-12");
  assert.equal(nov.cards.find((c) => c.id === "nu")!.invoice_paid, "660.00");
  assert.equal(dec.cards.find((c) => c.id === "nu")!.invoice_total, "0.00");
  assert.equal(dec.summary.unpaid, "0.00");
  assert.equal(dec.summary.balance, nov.summary.balance);
});
