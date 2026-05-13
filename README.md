# TI Tutor

A visual automata workbench for building, simulating, and testing DFA, NFA, PDA, and Turing Machines in the browser. Built as a focused tool for theoretical CS practice and as a portfolio artifact.

## Live demo

Deployed on Azure Static Web Apps: https://www.stateflow.top

## Highlights

- Interactive canvas editor for states and transitions
- Step-by-step simulation with trace view, PDA stack visualization, and TM tape window
- Batch test runner with expected accept/reject, plus TM output and head position checks
- Rule-based validator for structural mistakes and unreachable states
- Local persistence in browser storage
- Optional exercise mode for guided tasks

## Tech stack

- Vue 3 + TypeScript + Vite
- Tailwind CSS for UI styling
- Pinia + Vue Router for app state and routing
- Vitest for unit testing, ESLint and Prettier for code quality

## Architecture at a glance

```
UI (Vue components)
  -> Stores (project, tests, exercise state)
  -> Simulator + Validator (core logic)
  -> Results rendered in panels
```

Key modules:

- src/lib/automatonSimulator.ts: simulation engine for DFA, NFA, PDA, TM
- src/lib/automatonValidator.ts: rule checks and reachability analysis
- src/components/TestPanel.vue: test management and pass/fail summaries
- src/components/SimulationTreePanel.vue: step-by-step trace UI

## Getting started

Node version:

- Node ^20.19.0 or >=22.12.0

Install and run:

```sh
npm install
npm run dev
```

Other scripts:

```sh
npm run test:unit
npm run lint
npm run format
npm run build
npm run preview
```

## Portfolio notes

- Built an algorithmic simulation core with deterministic and nondeterministic models
- Designed clear visualizations for stack and tape based machines
- Implemented validation rules to catch structural errors early
- Wrote unit tests for the simulator and stores
