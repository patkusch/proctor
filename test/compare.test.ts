import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compare } from "../src/compare.ts";
import { scenarios } from "../src/scenarios.ts";

function save(root: string, name: string, outcomes: Record<string, boolean[]>) {
  mkdirSync(join(root, name), { recursive: true });
  const body = Object.entries(outcomes).map(([scenario, runs]) => ({ scenario, runs: runs.map((pass) => ({ pass })) }));
  writeFileSync(join(root, name, "traces.json"), JSON.stringify(body));
}

test("one column per saved run, with pass, fail, mixed and not-run told apart", () => {
  const root = mkdtempSync(join(tmpdir(), "proctor-cmp-"));
  save(root, "a", { [scenarios[0]!.id]: [true, true, true], [scenarios[1]!.id]: [false, false], [scenarios[2]!.id]: [true, false, true] });
  save(root, "b", { [scenarios[0]!.id]: [false] });
  const t = compare(root);
  const rows = t.split("\n");
  assert.match(rows[0]!, /\| a \| b \|/);
  assert.match(rows.find((r) => r.includes(scenarios[0]!.title))!, /\| pass \| fail \|/);
  assert.match(rows.find((r) => r.includes(scenarios[1]!.title))!, /\| fail \| not run \|/);
  assert.match(rows.find((r) => r.includes(scenarios[2]!.title))!, /\| 2\/3 \| not run \|/);
  assert.match(rows.at(-2)!, new RegExp(`\\*\\*1 of ${scenarios.length}\\*\\* \\| \\*\\*0 of ${scenarios.length}\\*\\*`));
});

test("a folder with no saved runs says so", () => {
  assert.match(compare(mkdtempSync(join(tmpdir(), "proctor-empty-"))), /No saved runs/);
});
