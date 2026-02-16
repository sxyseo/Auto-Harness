# Opus 4.6 Features in Auto Claude

This document describes the Opus 4.6-specific features implemented in Auto Claude.

## Overview

Auto Claude leverages Claude Opus 4.6's advanced capabilities to provide faster, smarter GitHub issue investigations. These features are designed to balance speed, quality, and cost for different use cases.

## Fast Mode

Opus 4.6 Fast Mode delivers **2.5x faster output generation** at premium pricing by optimizing token generation speed.

### When to Use Fast Mode

- **Quick investigations:** When you need results fast and cost is secondary
- **Development/testing:** When iterating on investigation prompts or workflows
- **Time-sensitive issues:** Production incidents requiring rapid analysis
- **Batch processing:** When investigating multiple issues in parallel

### When to Use Standard Mode

- **Cost-sensitive projects:** When API budget is a concern
- **Complex investigations:** When maximum thinking time is beneficial
- **Non-urgent issues:** When speed is not critical

### How to Enable Fast Mode

1. Open Auto Claude desktop app
2. Navigate to **Settings > GitHub > AI Investigation**
3. Toggle **"Fast mode investigations"** to ON
4. Future investigations will use Fast Mode

**Note:** Fast Mode is **opt-in** (defaults to OFF) to avoid unexpected costs.

### Pricing Impact

Fast Mode costs approximately **2.5x more per token** than standard Opus 4.6. For example:

- Standard investigation (5 issues): ~$0.50
- Fast mode investigation (5 issues): ~$1.25

*Estimates vary based on issue complexity and repository size.*

### Technical Details

Fast Mode is implemented by setting the `CLAUDE_CODE_FAST_MODE=true` environment variable when creating the Claude SDK client. This is handled automatically by the investigation pipeline when the setting is enabled.

```python
# From core/client.py
if fast_mode:
    sdk_env["CLAUDE_CODE_FAST_MODE"] = "true"
```

## 128K Output Tokens

Root cause analyzer now uses **128K max output tokens** (up from 64K) for complex investigations, enabling deeper analysis of large codebases.

### Benefits

- **Deeper code path tracing:** Follow execution through more files and functions
- **More comprehensive analysis:** Cover edge cases and complex interactions
- **Better for large monorepos:** Analyze sprawling codebases without running out of output space
- **Richer explanations:** More detailed root cause narratives and fix recommendations

### Per-Specialist Token Limits

Different investigation specialists have different output token limits based on their needs:

| Specialist | Max Tokens | API Max | Rationale |
|------------|------------|---------|-----------|
| **Root Cause** | 127,999 | 128,000 | Most complex specialist; needs to trace through multiple files, understand intricate dependencies, and provide comprehensive explanations |
| **Impact** | 63,999 | 64,000 | Standard component mapping and affected file analysis |
| **Fix Advisor** | 63,999 | 64,000 | Standard fix approaches and code suggestions |
| **Reproducer** | 63,999 | 64,000 | Standard test coverage and reproduction steps |

**Note:** Values are 1 token lower than API maximums to reserve space for the message separator that the SDK requires between thinking and output.

### Technical Implementation

The per-specialist limits are configured in `apps/backend/runners/github/services/issue_investigation_orchestrator.py`:

```python
# Per-specialist max_tokens configuration (Opus 4.6 supports up to 128K)
# Note: Values are 1 token lower than API max to reserve space for message separator
SPECIALIST_MAX_TOKENS = {
    "root_cause": 127999,   # Maximum for complex multi-file tracing (API max: 128000)
    "impact": 63999,         # Standard for component mapping (API max: 64000)
    "fix_advisor": 63999,    # Standard for fix approaches (API max: 64000)
    "reproducer": 63999,     # Standard for test coverage analysis (API max: 64000)
}
```

These limits are passed to the agent creation calls as both `max_tokens` and `thinking_budget` parameters.

## Adaptive Thinking

All investigations use **adaptive thinking** with `effort_level="high"` for best quality results.

### What This Means for Users

- **Claude decides when to think:** The model automatically determines when and how much thinking is needed
- **Interleaved thinking enabled:** Thinking tokens are generated alongside output for more coherent analysis
- **High effort by default:** Investigations use maximum effort for the most thorough analysis possible

### Technical Details

Adaptive thinking is configured automatically by the investigation pipeline. The `effort_level="high"` parameter ensures Claude uses its full reasoning capabilities during investigations.

This is distinct from Fast Mode—adaptive thinking controls **how thoroughly** Claude thinks, while Fast Mode controls **how fast** tokens are generated. You can use them independently:

- **Fast Mode + Adaptive Thinking:** Fast, thorough analysis (premium cost)
- **Standard Mode + Adaptive Thinking:** Standard speed, thorough analysis (default)
- **Standard Mode only:** Standard speed, variable thinking (not recommended for investigations)

## API Migration: output_config.format

Auto Claude has migrated from the deprecated `output_format` parameter to the new `output_config.format` API pattern.

### What Changed

**Old pattern (deprecated):**
```python
response = client.messages.create(
    model=model,
    max_tokens=8192,
    output_format={"type": "json_schema", "schema": schema},
    messages=[...]
)
```

**New pattern (current):**
```python
response = client.messages.create(
    model=model,
    max_tokens=8192,
    output_config={"format": {"type": "json_schema", "schema": schema}},
    messages=[...]
)
```

### Why This Matters

- The old `output_format` parameter is deprecated and will be removed in future SDK versions
- The new `output_config.format` pattern is more extensible for future output options
- Auto Claude's `create_client()` function handles the conversion automatically

This migration is internal—users don't need to change anything. Auto Claude forwards the new pattern to the Claude SDK.

## Future Enhancements

Potential future improvements to Opus 4.6 integration:

- [ ] **Cost estimation:** Show estimated Fast Mode cost before running investigations
- [ ] **Per-specialist effort levels:** Allow configuring effort level per specialist
- [ ] **Compaction API:** Enable for very long investigations to reduce token usage
- [ ] **1M context window:** Add option for massive projects with extensive context
- [ ] **Fast mode per specialist:** Allow Fast Mode for specific specialists only

## Related Documentation

- [Anthropic: What's new in Claude 4.6](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-6)
- [Anthropic: Fast Mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode)
- [Anthropic: Adaptive Thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- [Anthropic: Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [ARCHITECTURE.md](../shared_docs/ARCHITECTURE.md) - Auto Claude architecture overview
