# Simulation Experience Audit and Experience Backlog

## Purpose

Preserve the verified product and technical findings that must shape a future redesign of how simulations are experienced. This document is planning material, not an implementation specification.

The target is a coherent simulation system with:

- a student experience that feels like an interactive professional case or modern visual novel;
- a professor experience optimized for authoring, testing, inspection, and grading;
- shared runtime behavior and UI foundations without forcing both roles into the same presentation.

## Current Role Experiences

### Student

The student runner presents scene artwork, persona portraits, objectives, dialogue, case-study resources, and grading. Visually it suggests a narrative experience, but the dominant interaction remains a conventional transcript and free-form chat composer.

### Professor

The professor test view is intentionally closer to a diagnostic chat interface. It exposes scene metadata, participants, raw history, turn state, and controls useful for validating a simulation.

### Unification principle

Unify the **engine and reusable foundations**, not the roles' purposes.

Shared foundations should include:

- runtime and API contracts;
- objective, persona, progress, resource, transcript, error, and grading components;
- loading, queued-job, retry, resume, and completion behavior;
- accessibility and responsive behavior.

Role-specific presentation should remain:

- **Student:** mission framing, cinematic staging, contextual actions, progressive disclosure, reflection, and outcome feedback.
- **Professor:** state inspection, raw transcript, scene/persona metadata, reset and testing controls, and grading diagnostics.

Making both screens visually identical would unify the wrong layer.

## Student Experience Audit

### Core diagnosis

The runner currently applies visual-novel styling to a chat interaction model rather than delivering a genuinely scene-driven experience.

The hierarchy emphasizes **who to message** more than **what the student must understand, decide, or accomplish**. Persona selectors, mentions, the transcript, and the composer dominate. The scene objective exists, but it is passive and does not explain the student's role, immediate problem, available evidence, stakes, or a useful next move.

Scene framing is also repeated across the progress header, sidebar card, objective strip, and generated system message. This creates content volume without improving orientation.

### Questions the runner does not answer clearly enough

The student should always be able to answer:

1. Who am I in this situation?
2. What just happened?
3. What do I need to learn or decide now?
4. Who can help, oppose, or clarify?
5. What evidence have I gathered?
6. Am I making meaningful progress, and why?

### Interaction problems

- `@mention` syntax makes the simulation feel like a chat tool rather than a professional encounter.
- “Ask anything” provides no contextual scaffolding.
- Raw turn count and “Submit for Grading” expose system mechanics instead of the student's professional purpose.
- Previous context is progressively hidden without an equally strong summary of what changed.
- The current layout duplicates scene introductions inside the transcript.
- Conversation, Case Study, and Grading are presented as equal navigation modes even when grading is not yet relevant.

### Accessibility and responsive risks

- Fixed-width sidebars and desktop-first full-screen layout do not provide a robust mobile model.
- Some contextual history depends on hover behavior.
- Persona help controls need explicit accessible names.
- Interactive controls need consistent keyboard focus behavior.
- The runner uses local colors and typography instead of consistently using project semantic tokens.

## Proposed Experience: Interactive Case Scene

### 1. Scene arrival

Open each scene with a focused establishing moment:

- scene artwork and location;
- “You are…” role reminder;
- what changed since the previous scene;
- the immediate mission and stakes;
- a single **Enter scene** action.

This replaces a long system message dumped into the transcript.

### 2. Mission briefing

Keep a compact mission card available throughout the scene:

- **Outcome:** what must ultimately be achieved;
- **Immediate task:** the decision or information needed now;
- **People present:** each persona's role and relationship to the situation;
- **Evidence:** documents, case data, code, or references available;
- **Why this matters:** learning objectives, progressively disclosed.

### 3. Diegetic interaction

Preserve free-form conversation, but remove chat mechanics from the foreground. The agreed first iteration is:

- select a character by choosing their portrait instead of typing an `@mention`;
- anchor dialogue visually to the active character;
- keep direct free-form input as the only conversation model;
- retain `@mention` as a secondary keyboard shortcut rather than the primary navigation;
- support single, multiple, and all-persona targeting;
- keep previous conversation available but collapsed by default;
- highlight the persona currently responding with accessible, reduced-motion-safe animation.

Do **not** add contextual prompt composers or intent buttons in this iteration. They would over-structure an experience whose authored interaction remains free-form.

### First UI iteration (implemented)

- Replaced the in-run Conversation / Case Study / Grading navigation with a persistent scene experience.
- Moved guidance into a left-side Briefing tab using only simulation role, learning objectives, scene description, objective, progress, and turn configuration.
- Added a free-form Notes tab persisted locally per simulation instance; this is device-local convenience state, not durable platform state.
- Staged the existing square `1024x1024` transparent persona art as large, bottom-aligned visual-novel characters.
- Made portrait selection the primary targeting control with multi-select and Select all.
- Kept free-form text, turns, collapsed previous conversation, and `@` shortcuts.
- Kept grading out of the active runtime navigation; it is shown only through the completion flow.

### 4. Scene journal

Provide an evolving view of:

- decisions made;
- important persona claims;
- unresolved questions;
- evidence and resources opened.

A basic version can derive from existing conversation history. Reliable structured facts and durable journal state require new backend contracts.

### 5. Meaningful progress

Replace turn count as the primary progress signal with mission state:

- **Investigating**
- **Forming a recommendation**
- **Ready to commit**
- **Decision submitted**

Remaining turns can stay visible as a secondary constraint. Existing hints can provide non-scoring nudges, but the UI must not claim that a specific sub-objective is complete unless the backend tracks it authoritatively.

### 6. Scene resolution

The final action should use the language of the scenario—such as **Commit recommendation** or **Present decision**—rather than “Submit for Grading.”

After submission, show:

- what changed in the case;
- what the student demonstrated;
- what remains unresolved;
- what carries into the next scene;
- grading and detailed feedback when available.

## Capability Boundary

### Supported by existing data and runtime

- Cinematic introductions using scene title, description, image, role, and objective
- Persona staging using existing images, roles, backgrounds, goals, and communication traits
- Free-form dialogue and persona targeting
- Contextual objective, hints, and turn feedback
- Resume and conversation history
- Case-study/resource access
- Code editor and sandbox resources for code-challenge scenes
- Ordered scene transitions and completion
- AI grading and scene-level feedback while the detailed result remains cached

### Requires new authoritative capabilities

- Structured sub-objectives with individually tracked completion
- Persona emotion, trust, stance, or relationship state
- Multiple poses, expressions, or layered scene art
- Clickable environmental objects
- Persistent evidence collection or inventory
- Authored branching decisions and consequences
- Real-time structured competency progress
- Durable journal/fact extraction
- Voice, lip synchronization, ambient audio, or timed events
- Persistent detailed grading beyond Redis

These behaviors must not be faked from generated prose. They need explicit domain contracts and durable server-side state.

## Reliability Backlog

These issues should be addressed before or alongside the new experience so that improved presentation does not hide unreliable behavior.

### Handle queued simulation jobs

The backend may return HTTP `202` for queued chat or grading work, while the student runner expects an immediate stream or grading payload. Add an explicit queued state, polling/retry contract, cancellation behavior, and user-facing recovery.

Relevant areas:

- `backend/modules/simulation/router.py`
- `frontend/app/student/run-simulation/[instanceId]/page.tsx`

### Remove the forbidden student grade update

The runner attempts to update `ai_grade` and `ai_feedback` through the student instance endpoint, but the backend correctly rejects those fields with `403`. Grading already persists server-side. Remove the misleading client write and rely on the authoritative grading contract.

Relevant areas:

- `frontend/app/student/run-simulation/[instanceId]/page.tsx`
- `backend/modules/student/routers/student_instances.py`
- `backend/modules/simulation/services/grading_service.py`

### Remove the hardcoded client `user_id`

The runner sends `user_id: 1`, while the backend correctly derives identity from the authenticated user and ignores the client identity. Remove this field from the client request contract to avoid future misuse and confusion.

### Fix synthetic message persistence

Scene introduction and completion message saves can omit the required `session_id`; errors are swallowed. Align the client request with the repository contract and surface persistence failures appropriately.

### Persist detailed grading durably

The database retains overall score and feedback, while detailed scene grading depends on Redis and can disappear after expiration or cache loss. Define a durable grading-breakdown model before making detailed longitudinal feedback central to the new experience.

## Recommended Order of Work

1. Repair the reliability contracts and establish observable error/queued states.
2. Reframe the student scene around role, situation, immediate mission, and action.
3. Replace visible chat mechanics with character selection, contextual composition, and staged dialogue.
4. Extract shared runtime primitives used by student and professor surfaces.
5. Introduce the scene journal and stronger progress feedback using only authoritative data.
6. Define new domain contracts before adding relationship meters, branching, evidence inventory, or richer media.

## Validation Criteria for Future Work

- A student can explain their role, immediate mission, stakes, and next action without reading the full transcript.
- Persona selection works without requiring mention syntax.
- Resume restores the same scene, history, active persona context, and mission state.
- Queued, failed, reconnecting, and completed states are explicit and recoverable.
- Student and professor surfaces share runtime behavior but preserve role-appropriate presentation.
- Keyboard, screen-reader, reduced-motion, mobile, and desktop experiences are verified.
- The UI never presents inferred progress or consequences as authoritative unless the backend persists them.
