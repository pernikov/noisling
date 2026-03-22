import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  buildTrackData,
  isAudioFile,
  isImageFile,
  normalizeArtists,
  normalizeReleaseType,
  pickFolderCover,
} from './scannerHelpers.js';

test('isAudioFile accepts supported music extensions and skips macOS resource forks', () => {
  assert.equal(isAudioFile('/music/song.flac'), true);
  assert.equal(isAudioFile('/music/song.OPUS'), true);
  assert.equal(isAudioFile('/music/._song.mp3'), false);
  assert.equal(isAudioFile('/music/cover.jpg'), false);
  assert.ok(AUDIO_EXTENSIONS.has('.mp3'));
});

test('isImageFile accepts artwork extensions and skips hidden files', () => {
  assert.equal(isImageFile('/music/cover.jpg'), true);
  assert.equal(isImageFile('/music/folder.WEBP'), true);
  assert.equal(isImageFile('/music/.cover.jpg'), false);
  assert.equal(isImageFile('/music/song.mp3'), false);
  assert.ok(IMAGE_EXTENSIONS.includes('.png'));
});

test('pickFolderCover prefers common cover filenames before arbitrary images', () => {
  const entries = ['random.png', 'notes.txt', 'Folder.JPG', 'z-last.webp'];
  assert.equal(pickFolderCover(entries), 'Folder.JPG');
});

test('pickFolderCover falls back to the first image when no common cover name exists', () => {
  const entries = ['booklet.txt', 'scan.png', 'alternate.webp'];
  assert.equal(pickFolderCover(entries), 'scan.png');
});

test('normalizeArtists prefers multi-artist tags and splits semicolon-separated values', () => {
  assert.deepEqual(
    normalizeArtists({
      artists: ['Biosphere; Higher Intelligence Agency', '  Solar Fields  '],
      artist: 'ignored',
    }),
    ['Biosphere', 'Higher Intelligence Agency', 'Solar Fields'],
  );
});

test('normalizeArtists falls back to a single artist tag or Unknown Artist', () => {
  assert.deepEqual(normalizeArtists({ artist: 'Burial' }), ['Burial']);
  assert.deepEqual(normalizeArtists({ artist: ' ; ' }), ['Unknown Artist']);
  assert.deepEqual(normalizeArtists({}), ['Unknown Artist']);
});

test('normalizeReleaseType canonicalizes common release type values', () => {
  assert.equal(normalizeReleaseType('ep'), 'EP');
  assert.equal(normalizeReleaseType(['single', 'remix']), 'Single');
  assert.equal(normalizeReleaseType(' lp '), 'Album');
  assert.equal(normalizeReleaseType('live album'), 'Live Album');
  assert.equal(normalizeReleaseType(''), '');
});

test('buildTrackData normalizes scanner metadata into a track document shape', () => {
  const scannedAtBefore = Date.now();
  const track = buildTrackData({
    filePath: '/music/Burial/Untrue/Archangel.flac',
    metadata: {
      common: {
        title: 'Archangel',
        artists: ['Burial; Four Tet'],
        albumartist: 'Burial',
        album: 'Untrue',
        releasetype: 'album',
        track: { no: 3 },
        disk: { no: 1 },
        genre: ['Dubstep'],
        year: 2007,
      },
      format: {
        duration: 245.2,
        bitrate: 934321,
      },
    },
    fileStat: {
      size: 12345678,
      mtimeMs: 1710000000000,
    },
    cover: 'coverhash.jpg',
    hasEmbeddedCover: true,
  });

  assert.equal(track.path, '/music/Burial/Untrue/Archangel.flac');
  assert.equal(track.title, 'Archangel');
  assert.deepEqual(track.artists, ['Burial', 'Four Tet']);
  assert.deepEqual(track.artistsNorm, ['burial', 'four tet']);
  assert.equal(track.albumArtist, 'Burial');
  assert.equal(track.album, 'Untrue');
  assert.equal(track.releaseType, 'Album');
  assert.equal(track.trackNumber, 3);
  assert.equal(track.disc, 1);
  assert.equal(track.duration, 245.2);
  assert.equal(track.format, 'flac');
  assert.equal(track.bitrate, 934);
  assert.equal(track.genre, 'Dubstep');
  assert.equal(track.year, 2007);
  assert.equal(track.cover, 'coverhash.jpg');
  assert.equal(track.hasEmbeddedCover, true);
  assert.equal(track.fileSize, 12345678);
  assert.equal(track.fileMtime, 1710000000000);
  assert.ok(track.scannedAt instanceof Date);
  assert.ok(track.scannedAt.getTime() >= scannedAtBefore);
});
