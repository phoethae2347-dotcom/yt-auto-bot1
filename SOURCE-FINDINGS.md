# Dynamic image source findings

The runtime uses the Openverse image API as its primary source for per-run downloads. Openverse describes itself as a search engine for openly licensed media and exposes anonymous read access to its API. Its image search supports a `license=cc0` filter and returns fields including the file URL, creator, license, license URL, source/provider, and a landing page URL.

The downloader therefore accepts only results whose license is exactly `cc0`, requires a source landing page, rejects obvious portrait/person/private-scene title signals, and records the source page, creator, license, and SHA-256 hash for the current run. It downloads one fresh set per run and stores only Wikimedia/Openverse page IDs in `state/image-history.json` for non-reuse.

Openverse states that API users are rate-limited, that anonymous requests are sufficient for most users, and that its Terms of Service prohibit scraping. The implementation makes a small, sequential search for each curated query, uses a descriptive User-Agent, applies backoff on temporary errors, and does not paginate exhaustively or scrape the catalog.

CC0 is used because it is the most permissive filter selected for this workflow. CC0 reduces copyright licensing restrictions but does not automatically clear privacy, publicity/personality rights, trademarks, logos, or other local-law restrictions. The channel owner remains responsible for reviewing the final asset and source page before commercial publication.

## Official sources

- [Openverse API](https://api.openverse.org/)
- [Openverse](https://openverse.org/)
- [Wikimedia Commons Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing)
- [MediaWiki API Etiquette](https://www.mediawiki.org/wiki/API:Etiquette)
- [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
