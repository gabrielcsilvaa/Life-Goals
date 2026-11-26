import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestedCardDueDate } from "../src/lib/cardDates";
test("card due date follows closing, handles next-year and short months", () => {
  assert.equal(
    suggestedCardDueDate({ closing_day: 5, due_day: 12 }, "2026-11-26"),
    "2026-12-12",
  );
  assert.equal(
    suggestedCardDueDate({ closing_day: 25, due_day: 5 }, "2026-12-26"),
    "2027-02-05",
  );
  assert.equal(
    suggestedCardDueDate({ closing_day: 5, due_day: 31 }, "2027-02-01"),
    "2027-02-28",
  );
});
