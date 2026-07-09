# Simplification TODO

Notes for the next pass at stripping Noisling down.

## First cuts

- Remove visible listening stats: Stats tab, `/api/stats`, top tracks/artists/albums, total plays, file-type charts.
- Keep `lastPlayedAt` and Recently Played. Change play reporting to only update the last-played timestamp.
- Hide/remove play counts from track rows, album rows, playlists, and sorting.
- Replace Home's "Top Tracks" quick action with a simpler action, or remove it.
- Remove the "Top Albums" home album mode and keep only Recently Added / Random.

## Metadata and library cleanup

- Keep tag scanning, album grouping, cover art, and artwork overrides.
- Consider removing full track metadata editing, or shrink it to title, artists, album, and track number.
- Keep missing-cover checks if useful.
- Consider removing duplicate detection and inconsistent-album checks from Library health.

## Bigger optional cuts

- Consider removing in-app self-update and the Docker socket/repo mount requirement.
- Fix `.env.example`: remove the old `MONGODB_URI` entry now that Noisling uses SQLite.

## Principle

Favor a calm local music player: playback, queue, search, recent, loved, playlists, albums, artists, covers.
Avoid analytics/scrobbler/library-manager behavior unless it directly improves everyday listening.
