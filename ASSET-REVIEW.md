# Dynamic visual asset review

The former bundled `images/` directory and its committed image pool were removed. Each bot run now queries Openverse and downloads a fresh set of four images into the ignored `.runtime/images/` directory. The downloaded files are not reused as a local pool.

## Source and license filter

The downloader uses the Openverse image API with `license=cc0`, `image_type=photo`, and dead-link filtering. It accepts only candidates whose reported license is exactly `cc0`, requires a source landing page and usable dimensions, then records the provider, source page, download URL, creator field, license URL, and SHA-256 hash in `.runtime/current-assets.json`. It rejects non-image files, small files, and titles containing obvious people/portrait/private-scene terms.

Openverse documents anonymous API access for typical usage but also rate-limits API users and prohibits scraping. The downloader makes a small sequential search for each curated query, uses a meaningful User-Agent, applies backoff on temporary errors, and does not paginate exhaustively. It stops if it cannot obtain enough fresh verified candidates; it does not silently reuse old images or fetch an unverified fallback.

## Non-reuse history

Openverse result IDs are stored in `state/image-history.json`. The GitHub Actions workflow restores and saves this state through the Actions cache so a later run avoids previously used result IDs. The selection also prefers different creators within one video when enough candidates are available.

## Rights limitations

CC0 addresses copyright licensing, but it is not a universal legal clearance. Before publishing, the channel owner should still inspect the final image and source page for privacy, publicity/personality rights, trademarks, logos, private locations, misleading endorsement, and any local-law issue. The downloader excludes obvious identifiable-person candidates, but automated title filtering cannot prove that a person or protected object is absent.

Background music is currently disabled because no music source has a verified dynamic license workflow. The video uses narration-only audio until a separately verified music source is configured.

## Sources

- [Openverse API](https://api.openverse.org/)
- [Openverse](https://openverse.org/)
- [Wikimedia Commons API/MediaWiki](https://commons.wikimedia.org/wiki/Commons:API/MediaWiki)
- [MediaWiki API: Etiquette](https://www.mediawiki.org/wiki/API:Etiquette)
- [Wikimedia Commons Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing)
- [Wikimedia Commons Simple media reuse guide](https://commons.wikimedia.org/wiki/Commons:Simple_media_reuse_guide)
- [Wikimedia Commons Photographs of identifiable people](https://commons.wikimedia.org/wiki/Commons:Photographs_of_identifiable_people)
- [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
