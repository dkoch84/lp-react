# LP React Backend

Backend server for the LP React music player that serves music files from a local music library.

## Environment Variables

- `MUSIC_LIBRARY_PATH`: Path to your local music library directory (default: `./music`)
- `PORT`: Server port (default: 3001)

## API Endpoints

- `GET /api/library` - Get organized music library with artists and albums
- `GET /api/audio/:path` - Stream audio files with range request support
- `GET /api/albumart/:path` - Get album artwork from audio file metadata
- `GET /api/health` - Health check endpoint

## Setup

1. Install dependencies: `npm install`
2. Set music library path: `export MUSIC_LIBRARY_PATH=/path/to/your/music`
3. Start server: `npm start` or `npm run dev` for development

## Supported Audio Formats

- FLAC
- MP3
- WAV
- OGG
- M4A