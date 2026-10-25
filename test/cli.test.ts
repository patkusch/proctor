import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "../src/scenarios.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["src/cli.ts", ...args], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });

test("the careful scripted agent passes every scenario and exits 0", () => {
  const r = run("--agent", "scripted-good");
  assert.equal(r.status, 0);
  const lines = r.stdout.split("\n").filter((l) => /^(PASS|FAIL) /.test(l));
  assert.equal(lines.length, scenarios.length);
  assert.ok(lines.every((l) => l.startsWith("PASS 1/1")));
});

test("the careless scripted agent fails every scenario and exits 1", () => {
  const r = run("--agent", "scripted-bad");
  assert.equal(r.status, 1);
  const lines = r.stdout.split("\n").filter((l) => /^(PASS|FAIL) /.test(l));
  assert.equal(lines.length, scenarios.length);
  assert.ok(lines.every((l) => l.startsWith("FAIL 0/1")));
});

test("--only runs one scenario", () => {
  const id = scenarios[0].id;
  const r = run("--agent", "scripted-good", "--only", id);
  assert.equal(r.status, 0);
  const lines = r.stdout.split("\n").filter((l) => /^(PASS|FAIL) /.test(l));
  assert.deepEqual(lines.map((l) => l.split(/\s+/).pop()), [id]);
});

test("--repeat runs each scenario that many times", () => {
  const r = run("--agent", "scripted-good", "--only", scenarios[0].id, "--repeat", "3");
  assert.match(r.stdout, /PASS 3\/3/);
});

test("an unknown scenario name exits 2 and lists the choices", () => {
  const r = run("--only", "no-such-scenario");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no scenario called no-such-scenario/);
  assert.ok(r.stderr.includes(scenarios[0].id));
});

test("an unknown agent exits 2 and lists the choices", () => {
  const r = run("--agent", "telepathy");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown agent telepathy/);
  assert.match(r.stderr, /scripted-good, scripted-bad, ollama or claude/);
});

test("--out saves a scorecard and the traces under the agent's name", () => {
  const out = mkdtempSync(join(tmpdir(), "proctor-cli-"));
  const r = run("--agent", "scripted-good", "--out", out);
  assert.equal(r.status, 0);
  const [dir] = readdirSync(out);
  assert.equal(dir, "scripted-good");
  assert.ok(existsSync(join(out, dir, "scorecard.md")));
  const traces = JSON.parse(readFileSync(join(out, dir, "traces.json"), "utf8"));
  assert.equal(traces.length, scenarios.length);
});
