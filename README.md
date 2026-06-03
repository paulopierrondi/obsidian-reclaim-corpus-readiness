# RECLAIM Corpus Readiness

Score your Obsidian vault for AI/RAG readiness — before you pay for embeddings and vector DBs.

## What it does

RECLAIM audits your vault and tells you how "retrieval-ready" it is for AI assistants (Claude, ChatGPT, custom RAG pipelines). It runs entirely on your device; no notes are uploaded anywhere.

### Readiness Score

A 0-100 score based on five dimensions:

| Dimension | Weight | What hurts it |
|---|---|---|
| **Uniqueness** | 30% | Exact-duplicate files wasting context window |
| **Structure** | 25% | Missing YAML frontmatter (title, tags, dates) |
| **Density** | 20% | Empty or very short notes that carry no signal |
| **Title Quality** | 15% | Generic names like "Untitled" or "New Note" |
| **Freshness** | 10% | Stale notes untouched for >1 year |

### Live Dashboard

- **Status bar** — live score with color coding (green ≥80, yellow ≥65, red <65)
- **Readiness panel** — detailed breakdown, duplicate groups, conflict list
- **Auto-scan** — re-scans automatically when you edit notes (5-second debounce)

## Installation

### Manual (today)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder in your vault: `.obsidian/plugins/reclaim-corpus-readiness/`
3. Copy the three files into that folder.
4. Restart Obsidian.
5. Go to **Settings → Community Plugins** and enable **RECLAIM Corpus Readiness**.

### Community Plugins (pending review)

Once approved, install directly from Obsidian:

**Settings → Community Plugins → Browse → RECLAIM Corpus Readiness**

## Usage

### Commands (Ctrl/Cmd + P)

- **Scan vault readiness** — force an immediate scan
- **Open readiness panel** — open the detailed sidebar view

### Settings

- **Auto-scan on open** — scan automatically when Obsidian starts
- **Show status bar** — display the live score in the status bar

## Privacy

- **100% on-device.** No network calls. No telemetry.
- Your notes never leave your Mac.
- If you also use the RECLAIM macOS app, the plugin shares the same scoring logic.

## Roadmap

- [ ] Near-duplicate detection (MinHash / LSH)
- [ ] Semantic similarity pass (on-device embeddings)
- [ ] Export Markdown audit report
- [ ] Reversible cleanup (quarantine duplicates)
- [ ] Vault ↔ Linear project mapping

## Support

- Author: [Paulo Pierrondi](https://pierrondi.dev)
- Issues: [GitHub Issues](https://github.com/pierrondi/reclaim/issues)
- Companion app: [RECLAIM for macOS](https://github.com/pierrondi/reclaim)

## License

MIT
