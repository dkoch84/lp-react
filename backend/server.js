const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const musicMetadata = require('music-metadata');

const app = express();
const PORT = process.env.PORT || 3001;

// Get music library path from environment variable or use default
const MUSIC_LIBRARY_PATH = process.env.MUSIC_LIBRARY_PATH || path.join(__dirname, 'music');

// Middleware
app.use(cors());
app.use(express.json());

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.flac', '.mp3', '.wav', '.ogg', '.m4a'];

// Utility function to check if file is audio
function isAudioFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

// Recursively scan directory for audio files
async function scanMusicDirectory(dirPath, progressCallback = null) {
  const tracks = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (progressCallback) {
          progressCallback({
            type: 'directory',
            path: fullPath,
            relativePath: path.relative(MUSIC_LIBRARY_PATH, fullPath)
          });
        }
        // Recursively scan subdirectories
        const subTracks = await scanMusicDirectory(fullPath, progressCallback);
        tracks.push(...subTracks);
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        if (progressCallback) {
          progressCallback({
            type: 'file',
            path: fullPath,
            filename: entry.name,
            relativePath: path.relative(MUSIC_LIBRARY_PATH, fullPath)
          });
        }
        
        try {
          // Parse metadata for audio files
          const metadata = await musicMetadata.parseFile(fullPath);
          
          const track = {
            id: `${fullPath}-${entry.name}`,
            title: metadata.common.title || path.basename(entry.name, path.extname(entry.name)),
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || 'Unknown Album',
            trackNumber: metadata.common.track?.no || 0,
            duration: metadata.format.duration || 0,
            filePath: fullPath,
            relativePath: path.relative(MUSIC_LIBRARY_PATH, fullPath)
          };
          
          if (progressCallback) {
            progressCallback({
              type: 'track',
              track: track,
              artist: track.artist,
              album: track.album,
              title: track.title
            });
          }
          
          tracks.push(track);
        } catch (error) {
          console.error(`Error parsing ${fullPath}:`, error.message);
          if (progressCallback) {
            progressCallback({
              type: 'error',
              path: fullPath,
              error: error.message
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
    if (progressCallback) {
      progressCallback({
        type: 'error',
        path: dirPath,
        error: error.message
      });
    }
  }
  
  return tracks;
}

// Organize tracks into artists and albums
function organizeTracksIntoLibrary(tracks) {
  const artistMap = new Map();

  tracks.forEach(track => {
    const artistName = track.artist;
    const albumTitle = track.album;

    if (!artistMap.has(artistName)) {
      artistMap.set(artistName, {
        id: artistName.toLowerCase().replace(/\s+/g, '-'),
        name: artistName,
        albums: []
      });
    }

    const artist = artistMap.get(artistName);
    let album = artist.albums.find(a => a.title === albumTitle);

    if (!album) {
      album = {
        id: `${artistName}-${albumTitle}`.toLowerCase().replace(/\s+/g, '-'),
        title: albumTitle,
        artist: artistName,
        tracks: []
      };
      artist.albums.push(album);
    }

    album.tracks.push(track);
  });

  // Sort tracks within albums by track number
  artistMap.forEach(artist => {
    artist.albums.forEach(album => {
      album.tracks.sort((a, b) => a.trackNumber - b.trackNumber);
    });
    artist.albums.sort((a, b) => a.title.localeCompare(b.title));
  });

  return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// API Routes

// Server-Sent Events endpoint for library scanning with progress
app.get('/api/library/scan', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`Starting SSE scan of music library at: ${MUSIC_LIBRARY_PATH}`);
    
    // Check if music library directory exists
    try {
      await fs.access(MUSIC_LIBRARY_PATH);
    } catch (error) {
      sendEvent('error', { 
        message: 'Music library directory not found',
        path: MUSIC_LIBRARY_PATH 
      });
      res.end();
      return;
    }
    
    sendEvent('start', { message: 'Starting music library scan', path: MUSIC_LIBRARY_PATH });
    
    let totalFiles = 0;
    let processedFiles = 0;
    const artists = new Set();
    const albums = new Set();
    
    const progressCallback = (progress) => {
      if (progress.type === 'file') {
        totalFiles++;
        sendEvent('progress', {
          type: 'scanning',
          message: `Scanning: ${progress.filename}`,
          file: progress.filename,
          path: progress.relativePath,
          totalFiles,
          processedFiles
        });
      } else if (progress.type === 'track') {
        processedFiles++;
        artists.add(progress.artist);
        albums.add(`${progress.artist} - ${progress.album}`);
        
        sendEvent('progress', {
          type: 'processed',
          message: `Processed: ${progress.title} by ${progress.artist}`,
          title: progress.title,
          artist: progress.artist,
          album: progress.album,
          totalFiles,
          processedFiles,
          artistCount: artists.size,
          albumCount: albums.size
        });
      } else if (progress.type === 'directory') {
        sendEvent('progress', {
          type: 'directory',
          message: `Scanning directory: ${progress.relativePath || progress.path}`,
          path: progress.relativePath || progress.path
        });
      } else if (progress.type === 'error') {
        sendEvent('progress', {
          type: 'error',
          message: `Error processing: ${progress.path}`,
          error: progress.error
        });
      }
    };
    
    const tracks = await scanMusicDirectory(MUSIC_LIBRARY_PATH, progressCallback);
    const organizedArtists = organizeTracksIntoLibrary(tracks);
    
    sendEvent('complete', { 
      message: `Scan complete! Found ${tracks.length} tracks from ${artists.size} artists`,
      artists: organizedArtists, 
      totalTracks: tracks.length,
      artistCount: artists.size,
      albumCount: albums.size
    });
    
  } catch (error) {
    console.error('Error during SSE library scan:', error);
    sendEvent('error', { 
      message: 'Failed to scan music library',
      error: error.message 
    });
  }
  
  res.end();
});

// Get music library
app.get('/api/library', async (req, res) => {
  try {
    console.log(`Scanning music library at: ${MUSIC_LIBRARY_PATH}`);
    
    // Check if music library directory exists
    try {
      await fs.access(MUSIC_LIBRARY_PATH);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Music library directory not found',
        path: MUSIC_LIBRARY_PATH 
      });
    }
    
    const tracks = await scanMusicDirectory(MUSIC_LIBRARY_PATH);
    const artists = organizeTracksIntoLibrary(tracks);
    
    res.json({ artists, totalTracks: tracks.length });
  } catch (error) {
    console.error('Error scanning library:', error);
    res.status(500).json({ error: 'Failed to scan music library' });
  }
});

// Serve audio files
app.get('/api/audio/:*', async (req, res) => {
  try {
    const relativePath = req.params[0];
    const filePath = path.join(MUSIC_LIBRARY_PATH, relativePath);
    
    // Security check: ensure the file is within the music library
    const resolvedPath = path.resolve(filePath);
    const resolvedLibraryPath = path.resolve(MUSIC_LIBRARY_PATH);
    
    if (!resolvedPath.startsWith(resolvedLibraryPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists and is an audio file
    try {
      await fs.access(filePath);
      if (!isAudioFile(filePath)) {
        return res.status(400).json({ error: 'Not an audio file' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate headers
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    let mimeType = 'audio/mpeg';
    switch (ext) {
      case '.flac':
        mimeType = 'audio/flac';
        break;
      case '.wav':
        mimeType = 'audio/wav';
        break;
      case '.ogg':
        mimeType = 'audio/ogg';
        break;
      case '.m4a':
        mimeType = 'audio/mp4';
        break;
    }
    
    res.set({
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes'
    });
    
    // Handle range requests for audio seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunksize
      });
      
      const stream = require('fs').createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      const stream = require('fs').createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(500).json({ error: 'Failed to serve audio file' });
  }
});

// Get album art
app.get('/api/albumart/:*', async (req, res) => {
  try {
    const relativePath = req.params[0];
    const filePath = path.join(MUSIC_LIBRARY_PATH, relativePath);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedLibraryPath = path.resolve(MUSIC_LIBRARY_PATH);
    
    if (!resolvedPath.startsWith(resolvedLibraryPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const metadata = await musicMetadata.parseFile(filePath);
    const picture = metadata.common.picture?.[0];
    
    if (picture) {
      res.set({
        'Content-Type': picture.format,
        'Content-Length': picture.data.length
      });
      res.send(picture.data);
    } else {
      res.status(404).json({ error: 'No album art found' });
    }
  } catch (error) {
    console.error('Error serving album art:', error);
    res.status(500).json({ error: 'Failed to serve album art' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    musicLibraryPath: MUSIC_LIBRARY_PATH,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`LP React Backend Server running on port ${PORT}`);
  console.log(`Music library path: ${MUSIC_LIBRARY_PATH}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
});