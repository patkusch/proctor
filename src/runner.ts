import { finishes } from "./checks.ts";
import type { Agent, AgentTurn, Message, Scenario, ScenarioRun, ToolResult } from "./types.ts";

export async function runScenario(agent: Agent, scenario: Scenario): Promise<ScenarioRun> {
  const tools = scenario.tools();
  const messages: Message[] = [{ role: "user", text: scenario.task }];
  let finalText: string | null = null;
  let ended: "final" | "step-limit" | "malformed" = "step-limit";
  let steps = 0;

  while (steps < scenario.maxSteps) {
    steps++;
    const turn = await agent.step(scenario.policy, messages, tools);
    messages.push({ role: "agent", turn });
    if (turn.type === "final") {
      finalText = turn.text;
      ended = "final";
      break;
    }
    if (turn.type === "malformed") {
      ended = "malformed";
      break;
    }
    const tool = tools.find((t) => t.name === turn.tool);
    let result: ToolResult;
    if (!tool) result = { ok: false, error: `no such tool: ${turn.tool}` };
    else {
      try {
        result = tool.run(turn.args);
      } catch (e) {
        result = { ok: false, error: String(e instanceof Error ? e.message : e) };
      }
    }
    messages.push({ role: "tool", tool: turn.tool, result });
  }

  const trace = { scenario: scenario.id, agent: agent.name, messages, finalText, steps, ended };
  const results = [finishes, ...scenario.checks].map((c) => c(trace));
  return { trace, results, pass: results.every((r) => r.pass) };
}

// Plays a fixed list of turns, ignoring what the tools say. Used to prove the
// checks themselves work: a good script must pass, a bad one must fail.
export function scriptedAgent(name: string, turns: AgentTurn[]): Agent {
  let i = 0;
  return {
    name,
    step: async () => turns[Math.min(i++, turns.length - 1)] ?? { type: "final", text: "" },
  };
}
