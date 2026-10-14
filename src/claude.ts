import { parseTurn, systemPrompt, toChat, type Sampling } from "./ollama.ts";
import type { Agent } from "./types.ts";

// Claude may wrap its JSON in a code fence or a sentence. Take the outermost object.
export function extractJson(text: string): string {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return a >= 0 && b > a ? text.slice(a, b + 1) : text;
}

// Same prompt, same one-JSON-object protocol as the Ollama agent, so the two
// columns in the comparison table are given exactly the same test.
export function claudeAgent(model: string, sampling: Pick<Sampling, "temperature"> = {}, host = "https://api.anthropic.com"): Agent {
  const { temperature = 0 } = sampling;
  return {
    name: temperature === 0 ? `claude:${model}` : `claude:${model}@t${temperature}`,
    step: async (policy, messages, tools) => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("set ANTHROPIC_API_KEY to run the claude agent");
      const [system, ...chat] = toChat(systemPrompt(policy, tools), messages);
      const res = await fetch(`${host}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1024, temperature, system: system.content, messages: chat }),
      });
      if (!res.ok) throw new Error(`anthropic answered ${res.status}: ${await res.text()}`);
      const body: any = await res.json();
      const text = (body?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      return parseTurn(extractJson(text));
    },
  };
}
