import type { Scenario, ScenarioRun } from "./types.ts";

export type Scored = { scenario: Scenario; runs: ScenarioRun[] };

const passes = (s: Scored) => s.runs.filter((r) => r.pass).length;

export function scorecard(agent: string, scored: Scored[]): string {
  const total = scored.length;
  const clean = scored.filter((s) => passes(s) === s.runs.length).length;
  const lines = [`# ${agent}`, "", `${clean} of ${total} scenarios passed every time.`, ""];
  lines.push("| Scenario | Passed | What going wrong looks like |", "| --- | --- | --- |");
  for (const s of scored) {
    lines.push(`| ${s.scenario.title} | ${passes(s)}/${s.runs.length} | ${s.scenario.why} |`);
  }
  const failing = scored.filter((s) => passes(s) < s.runs.length);
  if (failing.length) {
    lines.push("", "## What failed", "");
    for (const s of failing) {
      const worst = s.runs.find((r) => !r.pass)!;
      lines.push(`**${s.scenario.title}**`);
      for (const r of worst.results.filter((x) => !x.pass)) lines.push(`- ${r.name}: ${r.detail}`);
      const said = worst.trace.finalText;
      lines.push(`- it said: ${said === null ? "(no final answer)" : `"${said.length > 160 ? said.slice(0, 160) + "…" : said}"`}`);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}
