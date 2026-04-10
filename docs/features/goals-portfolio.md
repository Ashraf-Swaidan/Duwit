# Goals Portfolio Management

## Why This Module Stands Out

Duwit's goals list is designed as a portfolio of journeys, not a generic list view. It prioritizes active work, separates finished paths into a quiet vault, and emphasizes momentum without hiding historical effort.

## High-Impact Capabilities

- Active/completed partitioning based on computed completion state.
- Recency-aware ordering (`lastActivityAt` fallback to creation date).
- Expandable vault for completed journeys, keeping active focus clean.
- Progress signals at card level (percent, tasks done/total).
- Safe deletion flow tied into global query refresh and home-context updates.

## Workflow Depth And Operational Strengths

This module balances focus and history:

- Active goals stay immediately actionable.
- Completed goals remain accessible for reflection without clutter.
- Paging controls (`Show more`) keep large portfolios performant and readable.

It supports both productivity and narrative continuity: users can act now while still seeing what they have already achieved.

## Security, Permissions, Governance

- Read/write access depends on authenticated user.
- Deletes are confirmed, scoped, and propagate cache updates safely.
- Goal retrieval excludes archived status at query level for cleaner operational views.

## Business Value And Outcomes

- Reinforces behavioral momentum by surfacing in-progress work first.
- Reduces UI overload for users with many goals.
- Preserves completed outcomes as evidence of value and progress over time.

## Key Implementation Areas

- `src/routes/goals.tsx`
- `src/services/goals.ts`
- `src/services/userContext.ts`
- `src/components/DeleteGoalConfirm.tsx`
