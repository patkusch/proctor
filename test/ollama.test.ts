import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ollamaAgent, parseTurn } from "../src/ollama.ts";
import { runScenario } from "../src/runner.ts";
import { scenarios } from "../src/scenarios.ts";

test("parseTurn reads a tool call and reads the arguments", () => {
  const t = parseTurn('{"action":"call","tool":"get_weather","args":{"city":"Leeds"}}');
  assert.deepEqual(t, { type: "call", tool: "get_weather", args: { city: "Leeds" } });
});

test("parseTurn reads a final answer", () => {
  assert.deepEqual(parseTurn('{"action":"final","answer":"hi"}'), { type: "final", text: "hi" });
});

test("parseTurn flags anything it cannot read", () => {
  for (const raw of ["not json", "{}", '{"action":"call"}', '{"action":"call","tool":"x","args":[1]}', '{"action":"call","tool":"x","args":"nope"}', '{"action":"final"}']) {
    assert.equal(parseTurn(raw).type, "malformed", raw);
  }
});

test("a call with no arguments is a call with empty arguments", () => {
  assert.deepEqual(parseTurn('{"action":"call","tool":"x"}'), { type: "call", tool: "x", args: {} });
});

test("the reply format only allows the tools and argument names on offer", async () => {
  let sent: any;
  const server = createServer((req, res) => {
    let b = "";
    req.on("data", (d) => (b += d)).on("end", () => {
      sent = JSON.parse(b);
      res.end(JSON.stringify({ message: { content: '{"action":"final","answer":"x"}' } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await runScenario(ollamaAgent("fake", `http://127.0.0.1:${(server.address() as any).port}`), scenarios.find((x) => x.id === "right-arguments")!);
    assert.deepEqual(sent.format.properties.tool.enum, ["get_order", "refund"]);
    assert.deepEqual(Object.keys(sent.format.properties.args.properties).sort(), ["amount", "order_id"]);
  } finally {
    server.close();
  }
});

test("the adapter drives a whole scenario against a fake Ollama and sends the tools and policy", async () => {
  const seen: any[] = [];
  const replies = [
    '{"action":"call","tool":"get_weather","args":{"city":"Leeds"}}',
    '{"action":"final","answer":"It is 12 degrees in Leeds."}',
  ];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d)).on("end", () => {
      seen.push(JSON.parse(body));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: { content: replies[seen.length - 1] } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  try {
    const s = scenarios.find((x) => x.id === "right-tool")!;
    const r = await runScenario(ollamaAgent("fake", `http://127.0.0.1:${port}`), s);
    assert.equal(r.pass, true);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].options.temperature, 0);
    assert.match(seen[0].messages[0].content, /get_weather\(city: city name\)/);
    assert.match(seen[1].messages.at(-1).content, /Tool result from get_weather: .*"temp_c":12/);
  } finally {
    server.close();
  }
});

test("an Ollama error is thrown, not swallowed as a bad score", async () => {
  const server = createServer((_q, res) => { res.statusCode = 500; res.end("down"); });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  try {
    await assert.rejects(runScenario(ollamaAgent("fake", `http://127.0.0.1:${port}`), scenarios[0]!), /500/);
  } finally {
    server.close();
  }
});

test("temperature and seed are passed through, and a warm model gets a different name so its results are kept apart", async () => {
  let sent: any;
  const server = createServer((req, res) => {
    let b = "";
    req.on("data", (d) => (b += d)).on("end", () => {
      sent = JSON.parse(b);
      res.end(JSON.stringify({ message: { content: '{"action":"final","answer":"x"}' } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const agent = ollamaAgent("fake", `http://127.0.0.1:${(server.address() as any).port}`, { temperature: 0.7, seed: 9 });
    assert.equal(agent.name, "ollama:fake@t0.7");
    await agent.step("p", [{ role: "user", text: "hi" }], []);
    assert.equal(sent.options.temperature, 0.7);
    assert.equal(sent.options.seed, 9);
    assert.equal(ollamaAgent("fake").name, "ollama:fake");
  } finally {
    server.close();
  }
});
