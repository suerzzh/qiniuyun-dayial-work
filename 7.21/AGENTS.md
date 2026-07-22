# UniSpeaking IELTS Scoring MVP Instructions

## Scope

This directory contains the existing realtime English conversation and scoring demo.

The current task is to add an IELTS Speaking scoring MVP while preserving the existing free-chat scoring flow.

## Source-of-truth documents

Before changing code, read:

1. `docs/对话评分链路实现说明.md`
2. `docs/UniSpeaking_雅思口语专属评分机制设计文档.md`
3. `README.md`
4. Existing Java scoring services and tests
5. Existing IELTS question-bank and exam-state code in the repository

When implementation and documentation differ, report the difference before choosing an approach.

## Model constraints

- Use Alibaba Qwen models for all AI capabilities except pronunciation assessment.
- Use the existing Qwen Realtime model for examiner interaction, ASR and VAD.
- Use a configurable Qwen non-realtime model, initially `qwen-plus`, for language evidence, IELTS judging and report generation.
- Use iFlytek ISE only for pronunciation evidence.
- Do not introduce OpenAI, Anthropic, Google or other model providers.
- Do not hardcode model names or API credentials in application code.
- All provider settings must come from environment variables or application configuration.

## IELTS scoring rules

The four scoring dimensions are:

1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

All four dimensions have equal weight.

The final score must be calculated by deterministic Java code:

```
overall = (FC + LR + GRA + Pronunciation) / 4
```

Round the final result to the nearest 0.5 band.

Do not ask an LLM to calculate the final score.

Task completion, cue-card coverage and relevance may be included as training diagnostics, but must not be included as a fifth IELTS scoring dimension.

## Data rules

Always preserve:

- Original ASR transcript
- Pronunciation reference transcript
- Original question snapshot
- Part number
- Question ID
- Turn ID
- Audio segment metadata
- Provider result
- Prompt version
- Model version
- Data-quality status

Never replace the original transcript with a corrected expression.

Missing dimensions must remain `null` or unavailable. Never substitute a missing score with zero.

## Mock-exam behavior

During strict mock mode:

- Do not show per-turn scores.
- Do not show corrections.
- Do not show suggested expressions.
- Do not interrupt the user to provide feedback.
- Generate feedback only after the test has finished.

## Implementation approach

Reuse existing infrastructure where appropriate:

- Scoring WebSocket
- PCM audio stream
- Ring buffer
- Pre-roll and post-roll audio
- Turn ID alignment
- Qwen JSON client
- iFlytek authentication and result parsing
- Parallel provider execution
- Partial-result degradation

Do not rewrite the entire application or replace the existing realtime architecture.

## Testing requirements

Every implementation phase must include:

- Java compilation
- Unit tests for deterministic scoring logic
- Provider clients mocked in tests
- Tests for missing dimensions
- Tests for half-band rounding
- Tests for incomplete attempts
- Tests confirming strict mock mode hides interim feedback
- Existing free-chat tests must remain passing

## Completion requirements

At the end of each implementation phase:

1. Run the relevant tests.
2. Report all changed files.
3. Report test results.
4. Document remaining limitations.
5. Do not claim completion if the end-to-end flow has not been verified.