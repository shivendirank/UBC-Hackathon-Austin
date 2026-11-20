import assert from "node:assert/strict";
import { test } from "node:test";
import { findWake, rollWakeText } from "./wake-word.ts";

test("hey then gemini across two results matches on the second chunk", () => {
  let heard = rollWakeText("", "hey");
  assert.equal(findWake(heard).matched, false);
  heard = rollWakeText(heard, "gemini");
  const hit = findWake(heard);
  assert.equal(hit.matched, true);
  assert.equal(hit.rest, "");
});

test("the phrase matches inside the first interim that contains it", () => {
  const hit = findWake("hey gemini what is the grade");
  assert.equal(hit.matched, true);
  assert.equal(hit.rest, "what is the grade");
});

test("nearby words are not a wake", () => {
  assert.equal(findWake("hey there what is the grade").matched, false);
});
