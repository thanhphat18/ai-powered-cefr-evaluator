# Student Test Flow Redesign Design

## Goal

Replace the current student test flow with a level-first experience that lets students choose a test level from `B1`, `B2`, `C1`, or `C2`, then take a `30`-question, `30`-minute vocabulary test built from the database across exactly three categories: `meaning`, `collocation`, and `wordform`.

This redesign also removes the current `ml-service` implementation completely and replaces the result guidance with backend-local logic only.

## Approved Product Rules

### Student flow

1. Student opens the dashboard.
2. Student clicks `Start Test`.
3. Student is taken to a level-picker page instead of starting a test immediately.
4. Student chooses one level from `B1`, `B2`, `C1`, or `C2`.
5. Backend creates a test session for that chosen level.
6. Student enters the live test workspace.
7. Student answers `30` questions in `30` minutes.
8. On submit or timeout, the result is saved to the dashboard/profile history with category breakdown.

### Test composition

- Each generated test always contains:
  - `10 meaning`
  - `10 collocation`
  - `10 wordform`
- The system first tries to pull all questions from the exact chosen level.
- If the chosen level does not have enough active questions in a category, the system fills the shortage from nearby levels for demonstration purposes.
- This fallback exists to support the demo version only. The user plans to replace the database later.

### Fallback priority

- `B1` -> `B2` -> `C1` -> `C2`
- `B2` -> `C1` -> `B1` -> `C2`
- `C1` -> `C2` -> `B2` -> `B1`
- `C2` -> `C1` -> `B2` -> `B1`

### Result persistence

- Completed tests must be saved to `user.summary.testLibrary`.
- Saved results must include category-level breakdown.
- Dashboard and profile must surface the saved result from the redesigned flow.

### Demo data

- The system must include a one-time seed script for sample questions.
- Sample questions should support a working demo immediately.
- Seeded questions must be safe to replace later when the real database is ready.

## Current System Problems

- `Start Test` currently jumps straight into a session without level selection.
- The current system is built around fixed A2/B1/B2 composition instead of exact-level B1-C2 tests.
- The question schema still supports old levels and an old category vocabulary including `context` and `word-form`.
- `ml-service` adds deployment and maintenance complexity that the user wants removed.
- The dashboard currently mixes score-based CEFR inference with the old diagnostic design.

## Target Architecture

### Frontend responsibilities

#### Dashboard

- Keep `Start Test` as the main entry point.
- Change its navigation target from direct live test entry to a dedicated level-picker page.

#### Level-picker page

- New student page that explains:
  - `30 questions`
  - `30 minutes`
  - `3 categories: meaning, collocation, wordform`
  - demo-mode backfilling when the chosen level is incomplete
- Show one choice card per level: `B1`, `B2`, `C1`, `C2`.
- If a student already has an unfinished active test, show a resume path instead of creating a second session.
- Selecting a level calls the backend session-creation endpoint and then navigates to the live test page.

#### Live test page

- Keep the existing test workspace concept, but simplify its role so it only renders an already-created active session.
- Do not auto-create sessions on page load.
- Continue to support:
  - question navigation
  - saved answers in local storage
  - timer countdown
  - auto-submit on timeout
  - resumed sessions through the server session

#### Result view

- Continue rendering the result inside the test experience after submission.
- Remove all ML-specific language.
- Show:
  - selected level
  - score
  - completed time
  - strongest skill
  - weakest skill
  - category breakdown
  - local study recommendation

#### Dashboard/Profile integration

- Continue using the existing saved result library.
- Update display copy so it reflects the chosen test level and saved summary instead of the old fixed diagnostic framing.

### Backend responsibilities

#### Session lifecycle

- `POST /api/tests/session`
  - Creates a new active session from `{ level }`.
  - Valid levels: `B1`, `B2`, `C1`, `C2`.
  - Refuses to create a second session if one is already active and not expired.
  - Returns the created session payload.

- `GET /api/tests/session`
  - Returns the current active session if present.
  - Returns no active session when none exists.
  - Supports resume after refresh/navigation.

- `POST /api/tests/submit`
  - Submits the current active session.
  - Scores the answers.
  - Builds result summary and category breakdown.
  - Saves the result to the authenticated user.
  - Clears the active session.

#### Session payload

The active session payload should include:

- `title`
- `selectedLevel`
- `startedAt`
- `durationSeconds` set to `1800`
- `requestedQuestionCount`
- `categoryTargets`
- `questions`
- `mode`
- `compositionSummary`
- `fallbackUsage`

`fallbackUsage` should explain whether demo-mode borrowing occurred so the UI can surface it clearly.

#### Question selection algorithm

For each category:

1. Pull active questions from the exact selected level.
2. Randomly select up to the target count from that exact-level pool.
3. If the exact-level pool is short, fill the remainder using the approved nearby-level priority order.
4. Combine the three category selections.
5. Shuffle the final `30`-question set.

The backend owns all selection and fallback logic. The frontend should never decide question composition.

## Data Model Changes

### Test question model

Redesign `TestQuestion` around the new system:

- `level` enum becomes: `B1`, `B2`, `C1`, `C2`
- `type` enum becomes: `meaning`, `collocation`, `wordform`

Keep the rest of the question structure aligned with the current test-bank model:

- `prompt`
- `options`
- `correctOptionId`
- `explanation`
- `isActive`

Add optional metadata to support demo seeding safely:

- `source`: `demo` or `manual`
- `seedTag`: string identifier such as `student-flow-v1`

These fields let the demo seed script update only its own records without wiping future real data.

### Saved result model

Keep using the existing `user.summary.testLibrary` collection, but extend stored entries with:

- `selectedLevel`
- `score`
- `summary`
- `strongestSkill`
- `weakestSkill`
- `breakdown.types`
- `breakdown.levels` as an array, populated when fallback levels were used and empty otherwise
- `recommendation`
- `completedAt`

`breakdown.levels` remains useful in the demo because fallback questions may come from nearby levels.

## Recommendation Logic

- Remove `ml-service` completely.
- Remove backend calls to the external recommendation service.
- Keep recommendation generation inside the backend only.
- Recommendation content should be rule-based and derived from:
  - selected level
  - score
  - strongest category
  - weakest category
  - category accuracies

The recommendation remains a study summary, not a machine-learning result.

## Seed Script Design

Add a one-time script:

- `backend/scripts/seed-demo-test-bank.js`

Add an npm command:

- `npm run seed:demo-test-bank`

### Seed requirements

- Insert demo questions for `B1`, `B2`, `C1`, and `C2`
- Provide enough questions to satisfy exact-level generation by default:
  - `10 meaning`
  - `10 collocation`
  - `10 wordform`
  - for each of the four levels

This means the seed should generate at least `120` active demo questions.

### Seed behavior

- Idempotent for demo records
- Safe to rerun
- Replaces or refreshes only questions tagged with the demo seed metadata
- Must not delete user-authored or future production data

## Failure States

### No active session

- If a student visits the live test page without an active session, redirect to the level-picker page.

### Existing unfinished session

- If a student already has an unfinished session, the system should resume it instead of creating a new one.
- The level-picker page should offer a clear `Resume current test` path.

### Insufficient question coverage

- If a session still cannot be built after fallback filling, the backend returns a clear unavailable response.
- The frontend should show:
  - chosen level
  - missing category
  - available question counts
  - a recovery action

### Timeout

- When time reaches zero, the test auto-submits the currently saved answers.
- The result should indicate that the submission was automatic.

## Deployment and Cleanup

Remove the old Python service from the project:

- delete the `ml-service/` directory
- remove Render deployment config for the ML service
- remove environment variables that existed only for ML recommendation calls
- remove frontend copy that references ML-guided recommendations

After the redesign, the application should run as a simpler frontend + Node backend system only.

## Testing and Verification Strategy

### Backend verification

- Verify session creation for each supported selected level.
- Verify exact-level selection when enough questions exist.
- Verify fallback filling when a category is short.
- Verify resume behavior for an active session.
- Verify submit behavior saves the result with category breakdown.
- Verify the seed script can populate a usable demo bank.

### Frontend verification

- Verify dashboard navigation now opens the level-picker page.
- Verify selecting a level creates a session and opens the live test view.
- Verify refresh resumes the same active session.
- Verify timer auto-submit still works.
- Verify result display no longer references ML.
- Verify saved results appear in dashboard/profile with category breakdown.

### Manual acceptance criteria

- A student can choose `B1`, `B2`, `C1`, or `C2`.
- The system creates a `30`-question test with `10` questions per category.
- The system prefers the selected level and only borrows nearby-level questions when necessary.
- The test lasts `30` minutes.
- The completed result is saved and visible from dashboard/profile.
- The project no longer contains a working `ml-service` dependency.

## Out of Scope

- Anti-cheating controls beyond the current timer/session behavior
- Advanced analytics or adaptive testing
- Production-quality question import for the user's future real database
- Redesigning admin workflow beyond the minimum schema changes needed to support the new system
