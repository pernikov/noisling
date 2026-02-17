# Noisling

A minimal, self-hosted music streaming server with a web UI. Point it at a directory of audio files and browse your library by artist, album, or song.

There is no authentication — this is meant to run on a trusted local network.

## Metadata

Noisling reads tags embedded in your audio files (ID3, Vorbis, MP4, etc.) to populate artist, album, title, cover art, and other metadata. If your files aren't tagged, the library will be mostly blank.

**Supported formats:** `.mp3` `.flac` `.ogg` `.m4a` `.aac` `.wav` `.aiff` `.wma` `.opus`

### Cover art

Cover art is resolved in the following order:

1. **Embedded artwork** — extracted directly from the audio file's metadata tags
2. **Folder images** — if no embedded art is found, the scanner looks for image files in the same directory as the track. It checks common names first (`cover`, `folder`, `front`, `album`, `art`, `artwork`, `thumb`, `thumbnail`) and falls back to any image file in the folder

**Supported image formats:** `.jpg` `.jpeg` `.png` `.webp` `.gif` `.bmp` `.tiff` `.avif`

## Running with Docker

```bash
cp .env.example .env
# edit .env — at minimum set MUSIC_DIR to your music folder

docker compose up
```

The app will be available at `http://localhost:3000`.

## Running locally

Requires Node.js 20+ and a running MongoDB instance.

```bash
pnpm install
pnpm dev
```

Client dev server runs on `http://localhost:5173`, API on port 3000.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MUSIC_DIR` | — | Path to your music directory (required) |
| `MONGODB_URI` | `mongodb://localhost:27017/noisling` | MongoDB connection string |
| `PORT` | `3000` | Server port |
