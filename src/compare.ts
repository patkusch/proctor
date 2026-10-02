import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scenarios } from "./scenarios.ts";

type Saved = { scenario: string; runs: { pass: boolean }[] }[];

const cell = (runs: { pass: boolean }[] | undefined) => {
  if (!runs || runs.length === 0) return "not run";
  const p = runs.filter((r) => r.pass).length;
  return p === runs.length ? "pass" : p === 0 ? "fail" : `${p}/${runs.length}`;
};

// One table, one column per saved run folder, built from what was saved.
export function compare(runsDir: string): string {
  const names = readdirSync(runsDir)
    .filter((n) => existsSync(join(runsDir, n, "traces.json")))
    .sort();
  if (names.length === 0) return "No saved runs found.\n";
  const saved = new Map<string, Saved>(names.map((n) => [n, JSON.parse(readFileSync(join(runsDir, n, "traces.json"), "utf8"))]));
  const lines = [`| Scenario | ${names.join(" | ")} |`, `| --- | ${names.map(() => "---").join(" | ")} |`];
  const totals = new Map(names.map((n) => [n, 0]));
  for (const s of scenarios) {
    const cells = names.map((n) => {
      const runs = saved.get(n)!.find((x) => x.scenario === s.id)?.runs;
      if (runs && runs.length && runs.every((r) => r.pass)) totals.set(n, totals.get(n)! + 1);
      return cell(runs);
    });
    lines.push(`| ${s.title} | ${cells.join(" | ")} |`);
  }
  lines.push(`| **Passed every time** | ${names.map((n) => `**${totals.get(n)} of ${scenarios.length}**`).join(" | ")} |`);
  return lines.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("compare.ts")) {
  console.log(compare(process.argv[2] ?? "docs/runs"));
}
