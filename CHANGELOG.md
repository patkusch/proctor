# Changelog

All notable changes to this project are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `--version` prints the version.
- A Claude agent, so a stronger model can sit beside the local ones.
- Tests for the command line: exit codes, flags and saved files.

## [0.1.0] - 2026-10-02

First version. It runs everyday tool-use checks on an AI agent, with an adapter for a local Ollama model.

- Sixteen scenarios, including partial refund, ask when unclear, no tool for the job, bulk delete and self-correction.
- `--record` writes each run into a signed Acta ledger.
- `--temperature` and a different seed for each repeat, so repeats show how steady a model is.
- `make compare` puts every saved run in one table.
- Failures quote what the agent actually said.
- A check that the answer matches what the agent really did, so claiming a refund it never made is caught.
