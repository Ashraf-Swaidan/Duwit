# Goal Intake And Planning

## Why This Module Stands Out

Duwit's intake flow does not ask users to complete rigid forms before they can begin. It starts with natural conversation, extracts intent and constraints, and turns that into an execution-ready plan. This makes planning accessible for users who know what they want but do not know how to structure it.

## High-Impact Capabilities

- Conversational goal discovery with progressive clarification.
- Plan readiness detection before generation, so users can refine context instead of getting premature output.
- Structured roadmap generation (phases + tasks) from chat context.
- Per-goal profile extraction (`experienceLevel`, motivation, success definition) that persists as durable coaching memory.
- Curriculum expansion that enriches each task with lesson steps for downstream teaching.

## Workflow Depth And Operational Strengths

The flow in `GoalChat` separates discovery, planning, and expansion into distinct reliability stages:

1. Streamed coaching messages collect context with lower latency.
2. Structured generation creates a machine-safe roadmap payload.
3. Curriculum expansion adds micro-learning steps task-by-task.
4. Goal is persisted only after plan artifacts are coherent.

This staged approach reduces malformed plans and supports better failure messaging when generation fails mid-pipeline.

## Security, Permissions, Governance

- Goal creation is tied to authenticated user identity.
- Data writes are user-scoped (`users/{uid}/goals`), preventing cross-user leakage by path design.
- Structured outputs are parsed with fallback extraction logic to improve resilience against model formatting drift.

## Business Value And Outcomes

- Cuts time from intention to first executable plan.
- Converts "I have an idea" users into "I have a roadmap" users in one session.
- Creates stronger retention by making the first meaningful action immediate and personalized.

## Key Implementation Areas

- `src/pages/GoalChat.tsx`
- `src/services/prompts.ts`
- `src/services/ai.ts`
- `src/services/curriculumExpansion.ts`
- `src/services/goals.ts`
