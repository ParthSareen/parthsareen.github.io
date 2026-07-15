---
name: rec-reading
description: Add or refresh a URL on Parth Sareen's public recommended-readings page, with a sourced homepage one-liner and fuller description. Use when the user invokes /rec-reading with a link, asks to save a reading, web article, or X Article, or supplies optional tags for one link.
---

# Recommended reading

Fetch and skim the target before writing. Create two factual descriptions of what it says—not personal reactions: a homepage one-liner (6–16 words, 180 characters maximum) and a fuller one- or two-sentence description (600 characters maximum) for the reading page. Pass both to the bundled helper, which extracts safe metadata, upserts by canonical URL using a local Supabase secret key, and reads the row back.

## Add an entry

Use the source copy in Parth's site repo. Let `REC_READING_REPO` override the default when the checkout lives elsewhere.

```bash
node /Users/parth/Documents/repos/parthsareen.github.io/skills/rec-reading/scripts/add-reading.mjs \
  'https://example.com/article' \
  --one-liner 'The article’s core claim in a compact, factual phrase.' \
  --summary 'A concise account of the article’s central claim and supporting evidence.' \
  --tags 'systems,agents'
```

Use the page’s actual content, not only its title or metadata, for both descriptions. Keep the one-liner useful on its own and distinctly shorter than the full description; name uncertainty where relevant and avoid promotional copy. Use `--one-liner`, `--summary` (or legacy `--note`), `--tags` (comma-separated), `--title`, `--author`, `--publication`, and `--published-at YYYY-MM-DD` as needed. Use `--dry-run` to print the proposed entry without writing it.

For an X Article, fetch the full article URL and summarize the article body. If X does not expose readable content, ask for the text or a reliable public copy; do not invent a blurb from a headline alone. The helper falls back to safe metadata descriptions only when a supplied summary is unavailable.

## Safety and configuration

Require an untracked `<repo>/.env` with `SUPABASE_URL` and either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Never print, add, or paste those values into source, logs, or chat.

If metadata cannot be fetched, keep going with the final URL and hostname as the title, and state that fallback. If configuration is missing or the insert/readback fails, stop without retrying blindly and report the actionable error.
