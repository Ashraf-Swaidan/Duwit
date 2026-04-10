# Plan Execution Workspace

## Why This Module Stands Out

The plan view is built as an operational workspace, not a static checklist. Users can track completion, open guided task coaching inline, navigate across tasks, and see progress signals without leaving context.

## High-Impact Capabilities

- Phase/task rendering with instant progress calculations.
- Task completion updates that automatically recompute goal status.
- Goal completion celebration and completion-state UX.
- Side-by-side plan and task-coach layout on larger screens.
- Safe deletion workflow with subcollection cleanup.

## Workflow Depth And Operational Strengths

`PlanView` coordinates multiple execution concerns in one surface:

- Maintains active task-chat indices instead of stale object snapshots, so refetches stay accurate.
- Supports reading focus mode for deep guidance sessions.
- Invalidates goal and goals queries after state changes to keep all surfaces synchronized.
- Tracks transitions between roadmap browsing and active task coaching smoothly on desktop and mobile.

This gives users a stable execution cockpit where progress is visible and the next action is always clear.

## Security, Permissions, Governance

- Operations require authenticated user context.
- Completion and deletion writes target user-owned document paths only.
- Goal deletion removes nested `taskChats` in chunked batches to stay within Firestore write limits safely.

## Business Value And Outcomes

- Reduces abandonment between planning and doing.
- Increases completion likelihood by embedding guidance directly into execution flow.
- Keeps progress emotionally reinforcing through visible momentum and end-of-journey closure.

## Key Implementation Areas

- `src/pages/PlanView.tsx`
- `src/components/PhaseCard.tsx`
- `src/services/goals.ts`
- `src/services/goalState.ts`
