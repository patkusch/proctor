# proctor. Node 24+ runs the TypeScript directly; there is nothing to install.
.PHONY: demo bad test run record

## demo: a perfect scripted agent against every scenario. No network, no model.
demo:
	node src/cli.ts --agent scripted-good

## bad: a careless scripted agent. Shows every scenario can fail.
bad:
	node src/cli.ts --agent scripted-bad

## test: the checks, the scenarios, the runner and the Ollama adapter.
test:
	node --test test/*.test.ts

## run: a local model via Ollama. make run MODEL=gemma3:12b REPEAT=5 TEMP=0.7
## TEMP above 0 makes the model vary, so repeats show how steady it is.
run:
	node src/cli.ts --agent ollama --model "$(or $(MODEL),gemma3)" --repeat "$(or $(REPEAT),1)" --temperature "$(or $(TEMP),0)" --out docs/runs

## record: like run, but every step goes into a signed Acta ledger under recordings/. Needs an Acta checkout: ACTA_DIR=../acta
record:
	node src/cli.ts --agent ollama --model "$(or $(MODEL),gemma3)" --record recordings --acta "$(or $(ACTA_DIR),../acta)"
