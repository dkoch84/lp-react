# LP - Vinyl Experience Music Player

A React-based music player that recreates the vinyl record listening experience. Select albums, not songs, and enjoy uninterrupted playback from start to finish.

## Features

- **Vinyl Experience**: Select and play entire albums, no track skipping
- **FLAC Support**: High-quality, lossless audio playback with metadata parsing
- **Gapless Playback**: Seamless transitions between tracks
- **Album Art Display**: Prominent album artwork with metadata
- **Artist/Album Library**: Organized music collection by artist and album
- **Current Track Display**: Shows playing track info and progress

## Key Principles

- **No Skipping**: True to vinyl experience - no seek or skip controls
- **Album-Focused**: Play albums front to back as the artist intended
- **High Quality**: Support for FLAC and other lossless formats
- **Metadata Rich**: Extracts and displays artist, album, track, and artwork info

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Add Music**: Upload FLAC, MP3, WAV, OGG, or M4A files using drag-and-drop or file selection
2. **Browse Library**: View your music organized by artist and album
3. **Play Albums**: Click on an album to start playing from the first track
4. **Enjoy**: Sit back and listen to the entire album as intended

## Supported Formats

- FLAC (preferred for lossless quality)
- MP3
- WAV
- OGG
- M4A

## Technical Notes

- Uses Web Audio API for playback
- Metadata parsing via music-metadata library
- React with TypeScript
- Responsive design for desktop and mobile

## Inspired By

This project is inspired by the [dkoch84/lp](https://github.com/dkoch84/lp) prototype, bringing the vinyl record experience to the web.

## Available Scripts

### `npm start`

Runs the app in the development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

---

*"Just play the damn record. Use those hands for something else."*