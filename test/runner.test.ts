import { test } from "node:test";
import assert from "node:assert/strict";
import { runScenario, scriptedAgent } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";
import { calls, noRepeats } from "../src/checks.ts";

const weather = scenarios.find((s) => s.id === "right-tool")!;

test("calling a tool that does not exist comes back as an error, not a crash", async () => {
  const r = await runScenario(
    scriptedAgent("x", [{ type: "call", tool: "teleport", args: {} }, { type: "final", text: "oh" }]),
    weather,
  );
  const tool = r.trace.messages.find((m) => m.role === "tool");
  assert.ok(tool && tool.role === "tool" && !tool.result.ok);
});

test("a run that never finishes is stopped at the step limit", async () => {
  const r = await runScenario(scriptedAgent("loop", [{ type: "call", tool: "get_weather", args: { city: "Leeds" } }]), weather);
  assert.equal(r.trace.ended, "step-limit");
  assert.equal(r.trace.steps, weather.maxSteps);
  assert.equal(r.pass, false);
});

test("an unreadable reply ends the run and fails it", async () => {
  const r = await runScenario(scriptedAgent("junk", [{ type: "malformed", raw: "???" }]), weather);
  assert.equal(r.trace.ended, "malformed");
  assert.equal(r.pass, false);
});

test("each run gets fresh tools, so a flaky tool is flaky again next time", async () => {
  const s = scenarios.find((x) => x.id === "recovers-from-error")!;
  for (let i = 0; i < 2; i++) {
    const r = await runScenario(scriptedAgent("g", s.good), s);
    const first = r.trace.messages.find((m) => m.role === "tool");
    assert.ok(first && first.role === "tool" && !first.result.ok);
  }
});

test("a tool that throws is reported as an error result", async () => {
  const s = { ...weather, tools: () => [{ name: "get_weather", description: "", params: {}, run: () => { throw new Error("boom"); } }] };
  const r = await runScenario(scriptedAgent("x", [{ type: "call", tool: "get_weather", args: {} }, { type: "final", text: "x" }]), s);
  const m = r.trace.messages.find((x) => x.role === "tool");
  assert.ok(m && m.role === "tool" && !m.result.ok && m.result.error === "boom");
});

test("argument matching ignores case and number-vs-string", async () => {
  const s = scenarios.find((x) => x.id === "right-arguments")!;
  const r = await runScenario(
    scriptedAgent("a", [
      { type: "call", tool: "get_order", args: { order_id: "a-100" } },
      { type: "call", tool: "refund", args: { order_id: "A-100", amount: "40" } },
      { type: "final", text: "Refund done" },
    ]),
    s,
  );
  assert.equal(r.pass, true);
});

test("noRepeats counts identical calls, not different ones", async () => {
  const mk = (args: object[]) => ({
    scenario: "x", agent: "x", finalText: "x", steps: 1, ended: "final" as const,
    messages: args.map((a) => ({ role: "agent" as const, turn: { type: "call" as const, tool: "t", args: a as any } })),
  });
  assert.equal(noRepeats(2)(mk([{ a: 1 }, { a: 1 }, { a: 1 }])).pass, false);
  assert.equal(noRepeats(2)(mk([{ a: 1 }, { a: 2 }, { a: 3 }])).pass, true);
  assert.equal(calls(mk([{ a: 1 }])).length, 1);
});
