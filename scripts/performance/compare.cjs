const fs = require("node:fs");
function regression(before, after) {
  return after - before > 20 && after > before * 1.2;
}
function compare(before, after) {
  if (
    before.cpu !== after.cpu ||
    before.browser !== after.browser ||
    before.node !== after.node
  )
    throw Error(
      "Use the same CPU, browser and Node versions for relative comparison.",
    );
  const metrics = [
    ["popup first", before.popupMs.first, after.popupMs.first],
    ["popup warm p50", before.popupMs.warmP50, after.popupMs.warmP50],
    ["popup warm p95", before.popupMs.warmP95, after.popupMs.warmP95],
    ...[500, 1000].map((n) => [
      `${n} synthetic tabs p95`,
      before.mockCopyLinksMs[n].p95,
      after.mockCopyLinksMs[n].p95,
    ]),
  ];
  return metrics.map(([name, old, current]) => ({
    name,
    before: old,
    after: current,
    delta: current - old,
    review: regression(old, current),
  }));
}
module.exports = { regression, compare };
if (require.main === module) {
  try {
    const [old, current] = process.argv.slice(2);
    if (!old || !current)
      throw Error(
        "Usage: npm run performance:compare -- baseline.json current.json",
      );
    const result = compare(
      JSON.parse(fs.readFileSync(old)),
      JSON.parse(fs.readFileSync(current)),
    );
    console.table(result);
    if (result.some((r) => r.review)) {
      console.error(
        "Repeat flagged measurements under controlled conditions before accepting the change.",
      );
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
