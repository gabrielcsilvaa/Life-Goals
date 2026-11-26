import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeAccount } from "../src/lib/resumeAccount";

test("saved but invalid account cannot replace the available demonstration", async () => {
  let mode = "demo";
  await resumeAccount(
    async () => true,
    async () => {
      throw new Error("invalid session");
    },
    () => true,
    () => {
      mode = "live";
    },
  );
  assert.equal(mode, "demo");
});
test("a stalled server leaves the demo available and cannot overwrite later interactions", async () => {
  let resolve!: (value: { user: string }) => void;
  const network = new Promise<{ user: string }>((r) => {
    resolve = r;
  });
  let current = true,
    mode = "demo";
  const pending = resumeAccount(
    async () => true,
    () => network,
    () => current,
    () => {
      mode = "live";
    },
  );
  await Promise.resolve();
  assert.equal(mode, "demo");
  current = false;
  resolve({ user: "saved-account" });
  await pending;
  assert.equal(mode, "demo");
});
test("only a confirmed snapshot enables connected mode", async () => {
  let mode = "demo";
  await resumeAccount(
    async () => true,
    async () => ({ user: "valid" }),
    () => true,
    (s) => {
      assert.equal(s.user, "valid");
      mode = "live";
    },
  );
  assert.equal(mode, "live");
});
test("no saved account requires no API calls", async () => {
  let requests = 0;
  await resumeAccount(
    async () => false,
    async () => {
      requests++;
      return {};
    },
    () => true,
    () => {},
  );
  assert.equal(requests, 0);
});
