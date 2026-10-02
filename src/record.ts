import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Observer, ToolResult } from "./types.ts";

// Writes each run into an Acta ledger: one signed, hash-chained session per
// scenario run, all under one key. Acta is loaded from a checkout on demand so
// proctor itself still installs nothing.
export type Recording = {
  root: string;
  publicKey: string;
  anchors: string;
  session: (agent: string, scenario: string, n: number) => Observer & { close: () => void; dir: string };
};

export async function openRecording(actaDir: string, root: string): Promise<Recording> {
  const acta = resolve(actaDir);
  const recorderPath = join(acta, "src", "recorder.ts");
  const ledgerPath = join(acta, "src", "ledger.ts");
  if (!existsSync(recorderPath) || !existsSync(ledgerPath)) {
    throw new Error(`no Acta checkout at ${acta}. Pass --acta <path> or set ACTA_DIR.`);
  }
  const { Recorder } = await import(pathToFileURL(recorderPath).href);
  const { loadOrCreateKeys, PUB_FILE } = await import(pathToFileURL(ledgerPath).href);
  const absRoot = resolve(root);
  const keys = loadOrCreateKeys(absRoot);

  return {
    root: absRoot,
    publicKey: join(absRoot, PUB_FILE),
    anchors: join(absRoot, "anchors.jsonl"),
    session(agent, scenario, n) {
      const dir = join(absRoot, agent.replace(/[^a-z0-9.-]+/gi, "-"), `${scenario}-${n}`);
      const rec = Recorder.open(dir, { keys, actor: agent, session: `${agent}/${scenario}/${n}` });
      return {
        dir,
        call: (tool, args) => rec.call(tool, args),
        result: (id: string, r: ToolResult) => (r.ok ? rec.result(id, r.data) : rec.result(id, { error: r.error }, { ok: false })),
        note: (text) => rec.note(text),
        close: () => {
          rec.close();
          rec.anchor(join(absRoot, "anchors.jsonl"));
        },
      };
    },
  };
}
