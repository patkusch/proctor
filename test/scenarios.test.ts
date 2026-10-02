import { test } from "node:test";
import assert from "node:assert/strict";
import { runScenario, scriptedAgent } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";

test("there are at least ten scenarios with unique ids", () => {
  assert.ok(scenarios.length >= 10);
  assert.equal(new Set(scenarios.map((s) => s.id)).size, scenarios.length);
});

for (const s of scenarios) {
  test(`${s.id}: the good script passes every check`, async () => {
    const r = await runScenario(scriptedAgent("good", s.good), s);
    assert.deepEqual(r.results.filter((x) => !x.pass), []);
  });
  test(`${s.id}: the bad script fails at least one check`, async () => {
    const r = await runScenario(scriptedAgent("bad", s.bad), s);
    assert.equal(r.pass, false);
  });
  test(`${s.id}: a bare "ok" is not enough to pass`, async () => {
    const r = await runScenario(scriptedAgent("empty", [{ type: "final", text: "ok" }]), s);
    assert.equal(r.pass, false);
  });
}
