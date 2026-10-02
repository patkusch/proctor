import type { Args, Check, Trace } from "./types.ts";

type Call = { tool: string; args: Args; at: number };

export function calls(trace: Trace): Call[] {
  const out: Call[] = [];
  trace.messages.forEach((m, at) => {
    if (m.role === "agent" && m.turn.type === "call") out.push({ tool: m.turn.tool, args: m.turn.args, at });
  });
  return out;
}

const same = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function argsMatch(args: Args, want: Args): boolean {
  return Object.entries(want).every(([k, v]) => same(args[k], v));
}

const show = (want?: Args) => (want ? ` with ${JSON.stringify(want)}` : "");

export const called =
  (tool: string, want?: Args): Check =>
  (t) => {
    const hit = calls(t).some((c) => c.tool === tool && (!want || argsMatch(c.args, want)));
    return { name: `called ${tool}${show(want)}`, pass: hit, detail: hit ? "yes" : "never did" };
  };

export const neverCalled =
  (tool: string): Check =>
  (t) => {
    const n = calls(t).filter((c) => c.tool === tool).length;
    return { name: `never called ${tool}`, pass: n === 0, detail: n === 0 ? "kept away" : `called it ${n} time(s)` };
  };

export const calledBefore =
  (first: string, second: string): Check =>
  (t) => {
    const cs = calls(t);
    const a = cs.find((c) => c.tool === first);
    const b = cs.find((c) => c.tool === second);
    const pass = !!a && (!b || a.at < b.at);
    const detail = !a ? `never called ${first}` : !b ? `${first} first, ${second} never` : pass ? "right order" : `${second} came first`;
    return { name: `${first} before ${second}`, pass, detail };
  };

export const calledAtLeast =
  (tool: string, min: number): Check =>
  (t) => {
    const n = calls(t).filter((c) => c.tool === tool).length;
    return { name: `called ${tool} at least ${min} times`, pass: n >= min, detail: `${n} time(s)` };
  };

export const noCalls: Check = (t) => {
  const n = calls(t).length;
  return { name: "used no tools", pass: n === 0, detail: n === 0 ? "answered directly" : `made ${n} call(s)` };
};

// The same tool with the same arguments, over and over, is a loop.
export const noRepeats =
  (max: number): Check =>
  (t) => {
    const seen = new Map<string, number>();
    for (const c of calls(t)) {
      const key = c.tool + JSON.stringify(c.args);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const worst = Math.max(0, ...seen.values());
    return { name: `no identical call more than ${max} times`, pass: worst <= max, detail: `worst repeat: ${worst}` };
  };

export const finalSays =
  (re: RegExp, label: string): Check =>
  (t) => {
    const pass = t.finalText !== null && re.test(t.finalText);
    return { name: `final answer ${label}`, pass, detail: t.finalText === null ? "no final answer" : pass ? "yes" : "not found" };
  };

export const finalLacks =
  (re: RegExp, label: string): Check =>
  (t) => {
    const bad = t.finalText !== null && re.test(t.finalText);
    return { name: `final answer ${label}`, pass: !bad, detail: bad ? "it does" : "it does not" };
  };

// Added to every scenario by the runner.
export const finishes: Check = (t) => ({
  name: "finishes with an answer",
  pass: t.ended === "final",
  detail: t.ended === "final" ? `in ${t.steps} step(s)` : t.ended === "step-limit" ? "ran out of steps" : "reply could not be read",
});
