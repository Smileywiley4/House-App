# Anthropic prompt caching (PropertyPulse backend)

All Anthropic `messages.create` calls in `backend/app/llm.py` include **ephemeral prompt caching** when enabled:

```http
cache_control: {"type": "ephemeral"}
```

This matches the [Messages API](https://docs.anthropic.com/en/api/messages) and [Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) documentation.

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `ANTHROPIC_PROMPT_CACHE_EPHEMERAL` | `true` | Set to `false` to disable the request field (e.g. debugging with an older proxy). |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Override model id (e.g. Opus, Claude 3.5 Haiku). |

## Notes

- Caching requires **minimum token thresholds** (see Anthropic docs). Short prompts may not show cache hits.
- Response usage may include `cache_read_input_tokens` / `cache_creation_input_tokens` — inspect usage in logs or billing.
- **Automatic caching** places the breakpoint on the last cacheable block; for multi-turn chats you’d extend `messages` and optionally use explicit `cache_control` on content blocks (see Anthropic docs).

## Health

`GET /health` reports `anthropic_model` and `anthropic_prompt_cache_ephemeral` when an Anthropic key is set.
