# LP - Vinyl Experience Music Player

A React-based music player that recreates the vinyl record listening experience. Select albums, not songs, and enjoy uninterrupted playback from start to finish.

## Features

- **Vinyl Experience**: Select and play entire albums, no track skipping
- **FLAC Support**: High-quality, lossless audio playback with metadata parsing
- **Gapless Playback**: Seamless transitions between tracks
- **Album Art Display**: Prominent album artwork with metadata
- **Artist/Album Library**: Organized music collection by artist and album
- **Current Track Display**: Shows playing track info and progress
- **Backend Server**: Serves music from local file system, no uploads needed

## Key Principles

- **No Skipping**: True to vinyl experience - no seek or skip controls
- **Album-Focused**: Play albums front to back as the artist intended
- **High Quality**: Support for FLAC and other lossless formats
- **Metadata Rich**: Extracts and displays artist, album, track, and artwork info

## Getting Started

### Prerequisites
- Node.js 14 or higher
- Your music collection organized in folders

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lp-react
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your music library**
   - Place your music files in the `backend/music` directory
   - Or set the `MUSIC_LIBRARY_PATH` environment variable to point to your existing music collection
   ```bash
   export MUSIC_LIBRARY_PATH=/path/to/your/music/library
   ```

4. **Start the application**
   ```bash
   npm run dev  # Starts both backend and frontend
   ```
   Or run them separately:
   ```bash
   npm run backend  # Backend only
   npm start        # Frontend only
   ```

5. **Open your browser**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:3001/api](http://localhost:3001/api)

## Music Library Setup

### Recommended Directory Structure
```
music/
├── Artist Name/
│   ├── Album Name/
│   │   ├── 01 - Track Name.flac
│   │   ├── 02 - Another Track.flac
│   │   └── ...
│   └── Another Album/
│       └── ...
└── Another Artist/
    └── ...
```

### Environment Variables
- `MUSIC_LIBRARY_PATH`: Path to your music library (default: `./backend/music`)
- `PORT`: Backend server port (default: 3001)
- `REACT_APP_API_URL`: Frontend API URL (default: http://localhost:3001/api)

## Usage

1. **Organize Your Music**: Place your music files in the configured music library directory
2. **Refresh Library**: The app will automatically scan your music collection on startup
3. **Browse Library**: View your music organized by artist and album
4. **Play Albums**: Click on an album to start playing from the first track
5. **Enjoy**: Sit back and listen to the entire album as intended

## Supported Formats

- FLAC (preferred for lossless quality)
- MP3
- WAV
- OGG
- M4A

## Architecture

### Frontend (React + TypeScript)
- **React 18** with modern hooks and TypeScript
- **Responsive design** for desktop and mobile
- **Component-based architecture** with proper state management
- **CSS Grid layouts** for responsive design

### Backend (Node.js + Express)
- **Express server** for serving music files and metadata
- **Music metadata parsing** using music-metadata library
- **Automatic library scanning** with recursive directory support
- **RESTful API** for library access and audio streaming
- **Security features** to prevent directory traversal attacks

### Key Services
- **AudioPlayerService**: Handles gapless playback with preloading
- **MusicLibraryService**: Manages API communication and metadata
- **Express API**: Serves audio files, album art, and library data

## API Endpoints

- `GET /api/library` - Fetch organized music library
- `GET /api/audio/*` - Stream audio files with range support
- `GET /api/albumart/*` - Serve album artwork
- `GET /api/health` - Health check and configuration info

## Development Scripts

### `npm run dev`
Runs both backend and frontend in development mode with hot reloading

### `npm run backend`
Runs only the backend server

### `npm run backend:dev`
Runs the backend with nodemon for development

### `npm start`
Runs only the frontend development server

### `npm test`
Launches the test runner

### `npm run build`
Builds the frontend for production

## Deployment

1. **Build the frontend**: `npm run build`
2. **Set environment variables** for production
3. **Start the backend**: `npm run backend`
4. **Serve the built frontend** from the `build` directory

## Inspired By

This project is inspired by the [dkoch84/lp](https://github.com/dkoch84/lp) prototype, bringing the vinyl record experience to the web.

---

*"Just play the damn record. Use those hands for something else."*