import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openRecording } from "./record.ts";
import { ollamaAgent } from "./ollama.ts";
import { scorecard, type Scored } from "./report.ts";
import { runScenario, scriptedAgent } from "./runner.ts";
import { scenarios } from "./scenarios.ts";
import type { Agent } from "./types.ts";

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const kind = flag("agent", "scripted-good")!;
const model = flag("model", "gemma3")!;
const repeat = Number(flag("repeat", "1"));
const temperature = Number(flag("temperature", "0"));
const only = flag("only");
const outDir = flag("out");
const recordDir = flag("record");
const actaDir = flag("acta", process.env.ACTA_DIR ?? "../acta")!;
const recording = recordDir ? await openRecording(actaDir, recordDir) : undefined;

const chosen = only ? scenarios.filter((s) => s.id === only) : scenarios;
if (chosen.length === 0) {
  console.error(`no scenario called ${only}. Choices: ${scenarios.map((s) => s.id).join(", ")}`);
  process.exit(2);
}

const label = kind === "ollama" ? ollamaAgent(model, undefined, { temperature }).name : kind;
const scored: Scored[] = [];
for (const scenario of chosen) {
  const runs = [];
  for (let i = 0; i < repeat; i++) {
    let agent: Agent;
    if (kind === "ollama") agent = ollamaAgent(model, undefined, { temperature, seed: 7 + i });
    else if (kind === "scripted-good") agent = scriptedAgent(kind, scenario.good);
    else if (kind === "scripted-bad") agent = scriptedAgent(kind, scenario.bad);
    else {
      console.error(`unknown agent ${kind}. Use scripted-good, scripted-bad or ollama.`);
      process.exit(2);
    }
    const session = recording?.session(label, scenario.id, i + 1);
    try {
      runs.push(await runScenario(agent, scenario, session));
    } finally {
      session?.close();
    }
  }
  scored.push({ scenario, runs });
  const p = runs.filter((r) => r.pass).length;
  console.log(`${p === runs.length ? "PASS" : "FAIL"} ${p}/${runs.length}  ${scenario.id}`);
}

if (recording) {
  console.log(`\nrecorded to ${recording.root}`);
  console.log(`check one with: acta verify ${recording.root}/${label.replace(/[^a-z0-9.-]+/gi, "-")}/<scenario>-1 --key ${recording.publicKey} --anchors ${recording.anchors}`);
}

const card = scorecard(label, scored);
console.log("\n" + card);

if (outDir) {
  const dir = join(outDir, label.replace(/[^a-z0-9.-]+/gi, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "scorecard.md"), card);
  writeFileSync(
    join(dir, "traces.json"),
    JSON.stringify(scored.map((s) => ({ scenario: s.scenario.id, runs: s.runs })), null, 2) + "\n",
  );
  console.log(`saved to ${dir}`);
}
process.exit(scored.every((s) => s.runs.every((r) => r.pass)) ? 0 : 1);
