# Memory And Personalization

## Why This Module Stands Out

Duwit treats memory as a product capability, not an afterthought. It combines user preferences, per-goal profile memory, and rolling execution outcomes so coaching quality improves over time rather than repeating baseline advice.

## High-Impact Capabilities

- Global user preference capture (style, pace, tone, accessibility).
- Per-goal profile extraction from discovery chat.
- Rolling `goalState` summaries built from task outcomes and quiz performance.
- Home greeting and suggestions that adapt to active goals and recent activity.
- Persistent task chats and teaching snapshots that survive app restarts.

## Workflow Depth And Operational Strengths

Memory is layered intentionally:

- **Profile layer:** broad personalization that applies across goals.
- **Goal profile layer:** why this specific goal matters and how success is defined.
- **Goal state layer:** actionable progress memory (what was done, what was weak, what changed).

This architecture avoids prompt bloat from raw transcript replay while still preserving meaningful continuity.

## Security, Permissions, Governance

- All memory artifacts are saved under authenticated user scope.
- Home chat memory is managed with freshness windows and stale-state clearing.
- Task teaching persistence uses versioned schema and defensive parsing.

## Business Value And Outcomes

- Makes the product feel consistent and coach-like rather than session-based.
- Reduces repeated onboarding friction inside each new task.
- Enables higher-quality personalization, improving trust and user stickiness.

## Key Implementation Areas

- `src/services/goalState.ts`
- `src/services/userContext.ts`
- `src/services/homeChatStore.ts`
- `src/services/user.ts`
- `src/contexts/ProfileDialogContext.tsx`
- `src/routes/app.tsx`
