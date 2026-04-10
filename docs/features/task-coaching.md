# Task Coaching Engine

## Why This Module Stands Out

Most AI chats are broad and forgetful. Duwit's task coaching narrows AI behavior to one checklist task at a time, enforces learning progression, and validates mastery with adaptive quizzes before users move on.

## High-Impact Capabilities

- Task-scoped prompt construction with sibling-task guardrails.
- Streaming AI responses with optional web grounding metadata.
- Teaching-state machine (`teaching -> quiz -> recap`) persisted across sessions.
- Adaptive quiz generation and scoring with weak-area tracking.
- Task-complete suggestions triggered by model markers.
- Voice call panel and TTS playback for multimodal learning.
- Widget-aware responses (checklists, charts, code, mermaid, tables, timelines, video references).

## Workflow Depth And Operational Strengths

`TaskChat` combines persistence, guidance, and interaction controls:

- Hydrates saved chat and teaching snapshot on load.
- Preserves lesson/quiz state through `TaskTeachingPersistV1`.
- Writes compact progress signals into goal-level memory after key milestones.
- Supports keyboard-first input, mobile overlays, and desktop split workflows.
- Handles image command intents, web-grounded responses, and rich media in one thread.

The result is not just "chat help"; it is a structured coaching runtime that adapts by learning stage.

## Security, Permissions, Governance

- Task chat data is user-scoped and saved under goal/task coordinates.
- Persistence parsing validates schema version before usage.
- Prompt construction includes anti-drift constraints to keep AI output within current task boundaries.

## Business Value And Outcomes

- Improves learning quality with explicit progression and assessment.
- Prevents context loss between sessions, reducing relearning overhead.
- Increases confidence and completion rates by proving understanding before task closure.

## Key Implementation Areas

- `src/components/TaskChat.tsx`
- `src/hooks/useTaskTeaching.ts`
- `src/services/taskTeaching.ts`
- `src/services/prompts.ts`
- `src/services/ai.ts`
- `src/components/TaskVoiceCallPanel.tsx`
