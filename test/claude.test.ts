import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { claudeAgent, extractJson } from "../src/claude.ts";
import { runScenario } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";

test("extractJson pulls the object out of a fence or a sentence", () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJson('Sure! {"a":{"b":2}} done'), '{"a":{"b":2}}');
  assert.equal(extractJson("no json"), "no json");
});

test("the claude agent sends the key, the system prompt and reads a fenced reply", async () => {
  let sent: any, headers: any;
  const server = createServer((req, res) => {
    let b = "";
    req.on("data", (d) => (b += d)).on("end", () => {
      sent = JSON.parse(b);
      headers = req.headers;
      res.end(JSON.stringify({ content: [{ type: "text", text: '```json\n{"action":"final","answer":"hello"}\n```' }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_API_KEY = "test-key";
  try {
    const run = await runScenario(claudeAgent("m", {}, `http://127.0.0.1:${(server.address() as any).port}`), scenarios[0]);
    assert.equal(run.trace.finalText, "hello");
    assert.equal(headers["x-api-key"], "test-key");
    assert.equal(sent.model, "m");
    assert.equal(sent.messages[0].role, "user");
    assert.match(sent.system, /Tools you can use/);
  } finally {
    server.close();
  }
});

test("a missing key is a clear error", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(() => claudeAgent("m").step("p", [{ role: "user", text: "x" }], []), /ANTHROPIC_API_KEY/);
});
