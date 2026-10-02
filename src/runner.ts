import { finishes } from "./checks.ts";
import type { Agent, AgentTurn, Message, Observer, Scenario, ScenarioRun, ToolResult } from "./types.ts";

export async function runScenario(agent: Agent, scenario: Scenario, observer?: Observer): Promise<ScenarioRun> {
  const tools = scenario.tools();
  const messages: Message[] = [{ role: "user", text: scenario.task }];
  let finalText: string | null = null;
  let ended: "final" | "step-limit" | "malformed" = "step-limit";
  let steps = 0;
  observer?.note(`scenario ${scenario.id}: ${scenario.task}`);

  while (steps < scenario.maxSteps) {
    steps++;
    const turn = await agent.step(scenario.policy, messages, tools);
    messages.push({ role: "agent", turn });
    if (turn.type === "final") {
      observer?.note(`final answer: ${turn.text}`);
      finalText = turn.text;
      ended = "final";
      break;
    }
    if (turn.type === "malformed") {
      observer?.note(`unreadable reply: ${turn.raw}`);
      ended = "malformed";
      break;
    }
    const callId = observer?.call(turn.tool, turn.args);
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
    if (observer && callId) observer.result(callId, result);
    messages.push({ role: "tool", tool: turn.tool, result });
  }

  const trace = { scenario: scenario.id, agent: agent.name, messages, finalText, steps, ended };
  if (ended === "step-limit") observer?.note(`stopped at the step limit (${scenario.maxSteps})`);
  const results = [finishes, ...scenario.checks].map((c) => c(trace));
  observer?.note(`verdict: ${results.every((r) => r.pass) ? "PASS" : "FAIL"}; ${results.map((r) => `${r.pass ? "ok" : "failed"}: ${r.name}`).join("; ")}`);
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
