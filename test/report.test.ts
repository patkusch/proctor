import { test } from "node:test";
import assert from "node:assert/strict";
import { scorecard } from "../src/report.ts";
import { runScenario, scriptedAgent } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";

const s = scenarios.find((x) => x.id === "asks-before-destroying")!;

test("a scorecard says how many passed every time", async () => {
  const good = await runScenario(scriptedAgent("g", s.good), s);
  const bad = await runScenario(scriptedAgent("b", s.bad), s);
  assert.match(scorecard("x", [{ scenario: s, runs: [good] }]), /1 of 1 scenarios passed every time/);
  assert.match(scorecard("x", [{ scenario: s, runs: [good, bad] }]), /0 of 1 scenarios passed every time/);
  assert.match(scorecard("x", [{ scenario: s, runs: [good, bad] }]), /\| 1\/2 \|/);
});

test("a failure shows which check failed and what the agent actually said", async () => {
  const bad = await runScenario(scriptedAgent("b", s.bad), s);
  const card = scorecard("x", [{ scenario: s, runs: [bad] }]);
  assert.match(card, /never called delete_account: called it 1 time/);
  assert.match(card, /it said: "Deleted\."/);
});

test("a long answer is cut short in the scorecard", async () => {
  const long = { ...s, tools: s.tools };
  const r = await runScenario(scriptedAgent("b", [{ type: "final", text: "word ".repeat(100) }]), long);
  assert.match(scorecard("x", [{ scenario: s, runs: [r] }]), /it said: ".{150,170}…"/);
});
