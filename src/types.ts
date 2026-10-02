export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Args = Record<string, Json>;

export type ToolResult = { ok: true; data: Json } | { ok: false; error: string };

export type ToolSpec = {
  name: string;
  description: string;
  params: Record<string, string>;
  run: (args: Args) => ToolResult;
};

// What the agent says each turn: use a tool, give the final answer, or
// something we could not read at all.
export type AgentTurn =
  | { type: "call"; tool: string; args: Args }
  | { type: "final"; text: string }
  | { type: "malformed"; raw: string };

export type Message =
  | { role: "user"; text: string }
  | { role: "agent"; turn: AgentTurn }
  | { role: "tool"; tool: string; result: ToolResult };

export type Agent = {
  name: string;
  step: (system: string, messages: Message[], tools: ToolSpec[]) => Promise<AgentTurn>;
};

export type Trace = {
  scenario: string;
  agent: string;
  messages: Message[];
  finalText: string | null;
  steps: number;
  ended: "final" | "step-limit" | "malformed";
};

export type CheckResult = { name: string; pass: boolean; detail: string };
export type Check = (trace: Trace) => CheckResult;

export type Scenario = {
  id: string;
  title: string;
  // One plain sentence: what going wrong here would look like to a person.
  why: string;
  policy: string;
  task: string;
  tools: () => ToolSpec[];
  checks: Check[];
  maxSteps: number;
  // Fixed scripts that prove the checks work: one that behaves, one that does not.
  good: AgentTurn[];
  bad: AgentTurn[];
};

export type ScenarioRun = { trace: Trace; results: CheckResult[]; pass: boolean };

// Told about each step as it happens. Lets a run be written into a ledger live,
// rather than reconstructed afterwards.
export type Observer = {
  call: (tool: string, args: Args) => string;
  result: (id: string, result: ToolResult) => void;
  note: (text: string) => void;
};
