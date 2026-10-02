import type { Agent, AgentTurn, Args, Message, ToolSpec } from "./types.ts";

// The reply must be one JSON object. The argument names come from the tools on
// offer, so a small model cannot invent keys or fumble nested quoting.
function schemaFor(tools: ToolSpec[]) {
  const props: Record<string, { type: string }> = {};
  for (const t of tools) for (const k of Object.keys(t.params)) props[k] = { type: "string" };
  return {
    type: "object",
    properties: {
      action: { type: "string", enum: ["call", "final"] },
      tool: { type: "string", enum: tools.map((t) => t.name) },
      args: { type: "object", properties: props },
      answer: { type: "string" },
    },
    required: ["action"],
  };
}

function systemPrompt(policy: string, tools: ToolSpec[]): string {
  const list = tools
    .map((t) => `- ${t.name}(${Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join(", ")}): ${t.description}`)
    .join("\n");
  return [
    policy,
    "",
    "Tools you can use:",
    list,
    "",
    "Reply with exactly one JSON object each turn.",
    'To use a tool: {"action":"call","tool":"<name>","args":{"<param>":"<value>"}}',
    'When you are done: {"action":"final","answer":"<your reply to the user>"}',
  ].join("\n");
}

function toChat(system: string, messages: Message[]) {
  const out: { role: string; content: string }[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else if (m.role === "agent") {
      const t = m.turn;
      const body =
        t.type === "call"
          ? { action: "call", tool: t.tool, args: t.args }
          : t.type === "final"
            ? { action: "final", answer: t.text }
            : { raw: t.raw };
      out.push({ role: "assistant", content: JSON.stringify(body) });
    } else {
      const r = m.result;
      out.push({ role: "user", content: `Tool result from ${m.tool}: ${r.ok ? JSON.stringify(r.data) : `ERROR: ${r.error}`}` });
    }
  }
  return out;
}

export function parseTurn(raw: string): AgentTurn {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return { type: "malformed", raw };
  }
  if (j?.action === "final" && typeof j.answer === "string") return { type: "final", text: j.answer };
  if (j?.action === "call" && typeof j.tool === "string") {
    let args: Args = {};
    if (j.args !== undefined) {
      if (j.args && typeof j.args === "object" && !Array.isArray(j.args)) args = j.args;
      else return { type: "malformed", raw };
    }
    return { type: "call", tool: j.tool, args };
  }
  return { type: "malformed", raw };
}

export type Sampling = { temperature?: number; seed?: number };

export function ollamaAgent(model: string, host = "http://127.0.0.1:11434", sampling: Sampling = {}): Agent {
  const { temperature = 0, seed = 7 } = sampling;
  return {
    name: temperature === 0 ? `ollama:${model}` : `ollama:${model}@t${temperature}`,
    step: async (policy, messages, tools) => {
      const res = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: schemaFor(tools),
          options: { temperature, seed },
          messages: toChat(systemPrompt(policy, tools), messages),
        }),
      });
      if (!res.ok) throw new Error(`ollama answered ${res.status}: ${await res.text()}`);
      const body: any = await res.json();
      return parseTurn(String(body?.message?.content ?? ""));
    },
  };
}
