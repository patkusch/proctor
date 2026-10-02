# proctor. Node 24+ runs the TypeScript directly; there is nothing to install.
.PHONY: demo bad test run

## demo: a perfect scripted agent against every scenario. No network, no model.
demo:
	node src/cli.ts --agent scripted-good

## bad: a careless scripted agent. Shows every scenario can fail.
bad:
	node src/cli.ts --agent scripted-bad

## test: the checks, the scenarios, the runner and the Ollama adapter.
test:
	node --test test/*.test.ts

## run: a local model via Ollama. make run MODEL=gemma3:12b REPEAT=3
run:
	node src/cli.ts --agent ollama --model "$(or $(MODEL),gemma3)" --repeat "$(or $(REPEAT),1)" --out docs/runs
