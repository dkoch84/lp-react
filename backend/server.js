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
          
          // Extract metadata with fallbacks based on file path structure
          const pathParts = path.relative(MUSIC_LIBRARY_PATH, fullPath).split(path.sep);
          let artist = metadata.common.artist;
          let album = metadata.common.album;
          
          // If metadata is missing, try to infer from folder structure
          if ((!artist || artist === 'Unknown Artist') && pathParts.length >= 3) {
            artist = pathParts[0]; // First folder is artist
          }
          if ((!album || album === 'Unknown Album') && pathParts.length >= 3) {
            album = pathParts[1]; // Second folder is album
          }
          
          const track = {
            id: `${fullPath}-${entry.name}`,
            title: metadata.common.title || path.basename(entry.name, path.extname(entry.name)),
            artist: artist || 'Unknown Artist',
            album: album || 'Unknown Album',
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

// Utility function to generate unique, safe IDs
function generateSafeId(text, fallbackPrefix = 'item') {
  if (!text || typeof text !== 'string') {
    return fallbackPrefix;
  }
  
  let safeId = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // If the result is empty or too short, use fallback with original text length
  if (!safeId || safeId.length < 2) {
    safeId = `${fallbackPrefix}-${text.length}-${Date.now() % 10000}`;
  }
  
  return safeId;
}

// Organize tracks into artists and albums
function organizeTracksIntoLibrary(tracks) {
  const artistMap = new Map();
  const usedArtistIds = new Set();
  const usedAlbumIds = new Set();

  tracks.forEach(track => {
    const artistName = track.artist;
    const albumTitle = track.album;

    if (!artistMap.has(artistName)) {
      let artistId = generateSafeId(artistName, 'artist');
      
      // Ensure unique artist ID with better collision detection
      let counter = 1;
      const originalArtistId = artistId;
      while (usedArtistIds.has(artistId)) {
        artistId = `${originalArtistId}-${counter}`;
        counter++;
        // Prevent infinite loops
        if (counter > 1000) {
          artistId = `artist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          break;
        }
      }
      usedArtistIds.add(artistId);

      artistMap.set(artistName, {
        id: artistId,
        name: artistName,
        albums: []
      });
    }

    const artist = artistMap.get(artistName);
    let album = artist.albums.find(a => a.title === albumTitle);

    if (!album) {
      let albumId = generateSafeId(`${artistName}-${albumTitle}`, 'album');
      
      // Ensure unique album ID with better collision detection
      let counter = 1;
      const originalAlbumId = albumId;
      while (usedAlbumIds.has(albumId)) {
        albumId = `${originalAlbumId}-${counter}`;
        counter++;
        // Prevent infinite loops
        if (counter > 1000) {
          albumId = `album-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          break;
        }
      }
      usedAlbumIds.add(albumId);

      album = {
        id: albumId,
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

// Global variables for scan state
let scanInProgress = false;
let currentScanPromise = null;
let cachedResults = null;
let cacheTimestamp = null;

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

  // If scan is already in progress, don't start a new one
  if (scanInProgress) {
    console.log('SSE scan already in progress, client will wait for completion');
    sendEvent('start', { message: 'Scan already in progress, waiting for completion...' });
    
    // Wait for the current scan to complete
    if (currentScanPromise) {
      try {
        const result = await currentScanPromise;
        sendEvent('complete', { 
          message: 'Scan complete (from existing scan)',
          artists: result.artists,
          totalTracks: result.totalTracks,
          artistCount: result.artistCount,
          albumCount: result.albumCount
        });
      } catch (error) {
        sendEvent('error', { 
          message: 'Failed to scan music library',
          error: error.message 
        });
      }
    }
    res.end();
    return;
  }

  // Set flag immediately to prevent race conditions
  scanInProgress = true;
  console.log(`Starting SSE scan of music library at: ${MUSIC_LIBRARY_PATH}`);
  try {
    currentScanPromise = (async () => {
      // Check if music library directory exists
      try {
        await fs.access(MUSIC_LIBRARY_PATH);
      } catch (error) {
        throw new Error('Music library directory not found');
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
      
      const result = {
        artists: organizedArtists,
        totalTracks: tracks.length,
        artistCount: artists.size,
        albumCount: albums.size
      };
      
      // Cache the results
      cachedResults = result;
      cacheTimestamp = Date.now();
      
      return result;
    })();
    
    const result = await currentScanPromise;
    
    sendEvent('complete', { 
      message: `Scan complete! Found ${result.totalTracks} tracks from ${result.artistCount} artists`,
      artists: result.artists, 
      totalTracks: result.totalTracks,
      artistCount: result.artistCount,
      albumCount: result.albumCount
    });
    
  } catch (error) {
    console.error('Error during SSE library scan:', error);
    sendEvent('error', { 
      message: 'Failed to scan music library',
      error: error.message 
    });
  } finally {
    scanInProgress = false;
    currentScanPromise = null;
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
app.get('/api/audio/*', async (req, res) => {
  try {
    const relativePath = req.params[0];
    const filePath = path.join(MUSIC_LIBRARY_PATH, relativePath);
    
    console.log(`Audio request: ${relativePath}`);
    console.log(`Resolved audio file path: ${filePath}`);
    
    // Security check: ensure the file is within the music library
    const resolvedPath = path.resolve(filePath);
    const resolvedLibraryPath = path.resolve(MUSIC_LIBRARY_PATH);
    
    if (!resolvedPath.startsWith(resolvedLibraryPath)) {
      console.log(`Audio access denied for path: ${resolvedPath}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists and is an audio file
    try {
      await fs.access(filePath);
      if (!isAudioFile(filePath)) {
        console.log(`Not an audio file: ${filePath}`);
        return res.status(400).json({ error: 'Not an audio file' });
      }
      console.log(`Audio file found: ${filePath}`);
    } catch (error) {
      console.log(`Audio file not found: ${filePath}`);
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
    
    console.log(`Serving audio file: ${path.basename(filePath)} (${mimeType}, ${stat.size} bytes)`);
    
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
      
      console.log(`Serving audio range: ${start}-${end}/${stat.size}`);
      
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

// Find album art files in directory (cover.jpg/png, folder.jpg/png - case insensitive)
async function findAlbumArtInDirectory(dirPath) {
  const artFileNames = [
    'cover.jpg', 'cover.jpeg', 'cover.png',
    'folder.jpg', 'folder.jpeg', 'folder.png'
  ];
  
  try {
    const entries = await fs.readdir(dirPath);
    
    for (const artFileName of artFileNames) {
      // Case-insensitive search
      const foundFile = entries.find(entry => 
        entry.toLowerCase() === artFileName.toLowerCase()
      );
      
      if (foundFile) {
        const artPath = path.join(dirPath, foundFile);
        try {
          await fs.access(artPath);
          return artPath;
        } catch (error) {
          continue;
        }
      }
    }
  } catch (error) {
    console.log(`Error reading directory ${dirPath}:`, error.message);
  }
  
  return null;
}

// Get album art
app.get('/api/albumart/*', async (req, res) => {
  try {
    const relativePath = req.params[0];
    const filePath = path.join(MUSIC_LIBRARY_PATH, relativePath);
    
    console.log(`Album art request: ${relativePath}`);
    console.log(`Resolved file path: ${filePath}`);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedLibraryPath = path.resolve(MUSIC_LIBRARY_PATH);
    
    if (!resolvedPath.startsWith(resolvedLibraryPath)) {
      console.log(`Access denied for path: ${resolvedPath}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // The file path should point to an audio file, we'll look for album art in its directory
    const albumDirectory = path.dirname(filePath);
    console.log(`Album directory: ${albumDirectory}`);
    
    try {
      await fs.access(albumDirectory);
      console.log(`Album directory exists: ${albumDirectory}`);
    } catch (error) {
      console.log(`Album directory not found: ${albumDirectory}`);
      return res.status(404).json({ error: 'Album directory not found' });
    }
    
    // Look for album art files in the album directory
    const albumArtPath = await findAlbumArtInDirectory(albumDirectory);
    
    if (albumArtPath) {
      console.log(`Album art found: ${albumArtPath}`);
      
      // Determine content type based on file extension
      const ext = path.extname(albumArtPath).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') {
        contentType = 'image/png';
      }
      
      // Stream the image file
      const imageStream = require('fs').createReadStream(albumArtPath);
      const stat = await fs.stat(albumArtPath);
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      
      imageStream.pipe(res);
    } else {
      console.log(`No album art found in directory: ${albumDirectory}`);
      res.status(404).json({ error: 'No album art found' });
    }
  } catch (error) {
    console.error('Error serving album art:', error);
    res.status(500).json({ error: 'Failed to serve album art' });
  }
});

// Get artist image (randomly selected from artist's album arts)
app.get('/api/artistart/:artistName', async (req, res) => {
  try {
    const artistName = decodeURIComponent(req.params.artistName);
    console.log(`Artist art request for: ${artistName}`);
    
    // Find all albums for this artist
    const artistDir = path.join(MUSIC_LIBRARY_PATH, artistName);
    
    // Security check
    const resolvedPath = path.resolve(artistDir);
    const resolvedLibraryPath = path.resolve(MUSIC_LIBRARY_PATH);
    
    if (!resolvedPath.startsWith(resolvedLibraryPath)) {
      console.log(`Access denied for artist path: ${resolvedPath}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      await fs.access(artistDir);
    } catch (error) {
      console.log(`Artist directory not found: ${artistDir}`);
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    // Get all album directories for this artist
    const entries = await fs.readdir(artistDir, { withFileTypes: true });
    const albumDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(artistDir, entry.name));
    
    // Collect all available album arts
    const availableAlbumArts = [];
    for (const albumDir of albumDirs) {
      const albumArtPath = await findAlbumArtInDirectory(albumDir);
      if (albumArtPath) {
        availableAlbumArts.push(albumArtPath);
      }
    }
    
    if (availableAlbumArts.length === 0) {
      console.log(`No album art found for artist: ${artistName}`);
      return res.status(404).json({ error: 'No artist image found' });
    }
    
    // Randomly select one of the available album arts
    const randomIndex = Math.floor(Math.random() * availableAlbumArts.length);
    const selectedArtPath = availableAlbumArts[randomIndex];
    
    console.log(`Selected random album art for artist ${artistName}: ${selectedArtPath}`);
    
    // Determine content type based on file extension
    const ext = path.extname(selectedArtPath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') {
      contentType = 'image/png';
    }
    
    // Stream the image file
    const imageStream = require('fs').createReadStream(selectedArtPath);
    const stat = await fs.stat(selectedArtPath);
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': stat.size
    });
    
    imageStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving artist art:', error);
    res.status(500).json({ error: 'Failed to serve artist art' });
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