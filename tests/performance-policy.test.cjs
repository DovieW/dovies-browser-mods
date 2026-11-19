const { test } = require("node:test");
const assert = require("node:assert/strict");
const { regression } = require("../scripts/performance/compare.cjs");
test("performance review requires both meaningful absolute and relative regression", () => {
  assert.equal(regression(100, 121), true);
  assert.equal(regression(5, 20), false);
  assert.equal(regression(1000, 1100), false);
  assert.equal(regression(100, 120), false);
});
