# Noisling

A small, self-hosted music streaming server with a web UI. Point it at a directory of audio files and browse your library by artists, albums, tracks, playlists, and recently played music.

There is no authentication — this is meant to run on a trusted local network for a single user. Settings are fetched once on startup and saved immediately on each change; there is no polling or per-route sync because concurrent multi-user access is out of scope.

## Metadata

Noisling reads tags embedded in your audio files (ID3, Vorbis, MP4, etc.) to populate artist, album, title, cover art, and other metadata.

It works best with libraries that are already mostly well tagged. Noisling does not try to infer missing artist or album structure from folder names. If needed, you can make small local metadata or artwork overrides inside Noisling, but those tools are meant for quick fixes rather than full library curation.

In rare cases, Noisling may start reading a new metadata field that older scans did not import yet. For those one-off backfills, open `http://localhost:1994/settings?tab=library&rewriteTags=true`. That triggers a forced metadata refresh for all files once, then removes the query flag from the URL. Existing last-played timestamps, likes, and local overrides are preserved.

Untagged files still appear in the library, but only with limited fallback metadata:

- the filename is used as the title
- artist falls back to "Unknown Artist"
- album falls back to "Unknown Album"

If a large part of your library is missing tags, browsing by artist and album will be much less useful because many tracks will be grouped under those fallback values.

**Supported formats:** `.mp3` `.flac` `.ogg` `.m4a` `.aac` `.wav` `.aiff` `.wma` `.opus`

### Cover art

Cover art is resolved in the following order:

1. **Embedded artwork** — extracted directly from the audio file's metadata tags
2. **Folder images** — if no embedded art is found, the scanner looks for image files in the same directory as the track. It checks common names first (`cover`, `folder`, `front`, `album`, `art`, `artwork`, `thumb`, `thumbnail`) and falls back to any image file in the folder
3. **Live updates** — a file watcher detects when you add or change a cover image in an album folder and automatically updates all tracks in that folder that don't have embedded art

**Supported image formats:** `.jpg` `.jpeg` `.png` `.webp` `.gif` `.bmp` `.tiff` `.avif`

## Running with Docker

```bash
cp .env.example .env
# edit .env — at minimum set MUSIC_DIR to your music folder

docker compose up -d --build  # --build forces a rebuild of the image; -d runs in the background
```

The app will be available at `http://localhost:1994`.

```bash
docker compose logs -f        # follow live logs from all containers
docker compose logs -f app    # follow logs from the app container only
docker compose down           # stop and remove containers
```

### One-click updates

When a new version is released, an **Update available** button appears in the top navigation bar. Clicking it opens a dialog that runs `git pull` and `docker compose up -d --build` directly from the UI, streaming live output as the image builds. The page automatically reloads once the container is back online.

This requires two things in `docker-compose.yml` (already included by default):

- **Docker socket mount** — gives the container access to the host Docker daemon so it can trigger a rebuild of itself
- **Repo mount** — mounts the cloned repository at `/repo` inside the container so `git pull` has somewhere to write

```yaml
volumes:
  - .:/repo                                    # repo root mounted at /repo
  - /var/run/docker.sock:/var/run/docker.sock  # Docker socket
```

The server automatically looks for a git repository at `/repo`. No extra configuration is needed as long as `docker compose` is run from the cloned repo directory, which is the standard setup.

## Running locally

Requires Node.js 24+.

```bash
pnpm install
pnpm dev
```

Client dev server runs on `http://localhost:5173`, API on port 1994.

## Running tests

Run the full test suite from the repo root:

```bash
pnpm test
```

Run client tests only:

```bash
pnpm --filter client test
```

Run server tests only:

```bash
pnpm --filter server test
```

## Recently played

Noisling stores a last-played timestamp on each track so the app can show Recently Played. A track is marked as played only after it has been listened to for a while, which keeps quick skips and accidental clicks out of your recent history.

If a file is removed from the library or moved to a different path, that recent-play timestamp is lost. This is intentional — Noisling is a player, not a scrobbler or listening analytics tool. If you need durable listening history, use something like Last.fm alongside it.

## Known issues

- **iOS lock-screen playback (transcoded formats)** — on iOS Safari/PWA, lock-screen `pause` then `play` for transcoded tracks (for example FLAC/OGG) can stall or fail to resume reliably in background.
- **iOS lock-screen next/previous** — `next`/`previous` actions are generally more reliable than `pause`/`play` for transcoded tracks.
- **Natural queue advance** — when a track ends naturally, advancing to the next track is typically reliable, even in background.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MUSIC_DIR` | — | Path to your music directory (required) |
| `DATABASE_PATH` | `server/data/noisling.sqlite` | SQLite database path |
| `PORT` | `1994` | Server port |
| `REPO_DIR` | `/repo` | Path to the git repository inside the container (override if mounting at a different path) |
