import assert from "node:assert/strict";
import { test } from "node:test";
import { fifthBusinessDay } from "../src/lib/businessDays";
test("salary fifth day includes Saturdays, excludes national holidays and Sundays", () => {
  assert.equal(fifthBusinessDay("2026-11"), "2026-11-07");
  assert.equal(fifthBusinessDay("2027-01"), "2027-01-07");
  assert.equal(fifthBusinessDay("2026-10"), "2026-10-06");
  assert.equal(fifthBusinessDay("2026-10", ["2026-10-02"]), "2026-10-07");
});

import { normalizeMoney } from "../src/lib/money";
test("expense amounts accept Brazilian currency and thousands without losing cents", () => {
  assert.equal(normalizeMoney("R$ 1.200,50"), "1200.50");
  assert.equal(normalizeMoney("140,"), "140.00");
  assert.equal(normalizeMoney("18,50"), "18.50");
  assert.equal(normalizeMoney("18.50"), "18.50");
  assert.throws(() => normalizeMoney("1,2,3"));
});
