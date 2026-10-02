import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openRecording } from "../src/record.ts";
import { runScenario, scriptedAgent } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";

const acta = resolve(process.env.ACTA_DIR ?? "../acta");
const have = existsSync(join(acta, "src", "recorder.ts")) && existsSync(join(acta, "node_modules"));
const opts = { skip: have ? false : `no Acta checkout with dependencies at ${acta}` };

function verify(dir: string, root: string) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", join(acta, "bin", "acta.mjs"), "verify", dir, "--key", join(root, "recorder.pub"), "--anchors", join(root, "anchors.jsonl")],
    { encoding: "utf8" },
  );
  return { code: r.status, out: r.stdout + r.stderr };
}

async function record(id: string) {
  const root = mkdtempSync(join(tmpdir(), "proctor-rec-"));
  const rec = await openRecording(acta, root);
  const s = scenarios.find((x) => x.id === id)!;
  const session = rec.session("scripted-good", id, 1);
  const run = await runScenario(scriptedAgent("scripted-good", s.good), s, session);
  session.close();
  return { root, dir: session.dir, run };
}

test("a recorded run verifies with Acta", opts, async () => {
  const { root, dir, run } = await record("right-arguments");
  assert.equal(run.pass, true);
  const v = verify(dir, root);
  assert.equal(v.code, 0, v.out);
  assert.match(v.out, /VERIFIED/);
});

test("the ledger holds the calls, the results, the final answer and the verdict", opts, async () => {
  const { dir } = await record("right-arguments");
  const text = readFileSync(join(dir, "ledger.jsonl"), "utf8");
  assert.match(text, /"tool":"refund"/);
  assert.match(text, /final answer: Refunded/);
  assert.match(text, /verdict: PASS/);
});

test("a failed tool call is recorded as a failure, not a success", opts, async () => {
  const { dir } = await record("recovers-from-error");
  const entries = readFileSync(join(dir, "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const results = entries.filter((e) => (e.body?.kind ?? e.kind) === "result");
  assert.ok(results.some((e) => (e.body?.ok ?? e.ok) === false), "no failed result found");
});

test("editing a recorded run afterwards is caught", opts, async () => {
  const { root, dir } = await record("right-arguments");
  const path = join(dir, "ledger.jsonl");
  const edited = readFileSync(path, "utf8").replace('"amount":40', '"amount":4');
  assert.notEqual(edited, readFileSync(path, "utf8"));
  writeFileSync(path, edited);
  const v = verify(dir, root);
  assert.notEqual(v.code, 0);
  assert.match(v.out, /TAMPERED/);
});

test("without an Acta checkout the error says what to do", async () => {
  await assert.rejects(openRecording("/nonexistent-acta", tmpdir()), /--acta/);
});
