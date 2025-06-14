const mysql = require('mysql2/promise');

// Database configuration from environment variables
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lp_music',
  charset: 'utf8mb4'
};

let pool = null;

// Initialize database connection pool
function initializeDatabase() {
  if (!pool) {
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

// Create database if it doesn't exist
async function createDatabase() {
  const configWithoutDb = { ...DB_CONFIG };
  delete configWithoutDb.database;
  
  const connection = await mysql.createConnection(configWithoutDb);
  
  try {
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ${DB_CONFIG.database} created or already exists`);
  } finally {
    await connection.end();
  }
}

// Create tables if they don't exist
async function createTables() {
  const connection = await getConnection();
  
  try {
    // Artists table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS artists (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Albums table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS albums (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        artist_id VARCHAR(255) NOT NULL,
        artist_name VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        INDEX idx_artist_id (artist_id),
        INDEX idx_title (title)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Tracks table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tracks (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        artist_id VARCHAR(255) NOT NULL,
        album_id VARCHAR(255) NOT NULL,
        artist_name VARCHAR(500) NOT NULL,
        album_title VARCHAR(500) NOT NULL,
        track_number INT DEFAULT 0,
        duration FLOAT DEFAULT 0,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
        INDEX idx_artist_id (artist_id),
        INDEX idx_album_id (album_id),
        INDEX idx_file_path (file_path(500))
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Scan metadata table to track last scan times and directory changes
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scan_metadata (
        id INT PRIMARY KEY AUTO_INCREMENT,
        library_path VARCHAR(1000) NOT NULL,
        last_scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_tracks INT DEFAULT 0,
        total_artists INT DEFAULT 0,
        total_albums INT DEFAULT 0,
        INDEX idx_library_path (library_path(500))
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('Database tables created successfully');
  } finally {
    connection.release();
  }
}

// Get database connection from pool
async function getConnection() {
  if (!pool) {
    initializeDatabase();
  }
  return await pool.getConnection();
}

// Execute query with connection handling
async function executeQuery(query, params = []) {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(query, params);
    return results;
  } finally {
    connection.release();
  }
}

// Save artist to database
async function saveArtist(artist) {
  const query = `
    INSERT INTO artists (id, name) 
    VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE 
      name = VALUES(name),
      updated_at = CURRENT_TIMESTAMP
  `;
  await executeQuery(query, [artist.id, artist.name]);
}

// Save album to database
async function saveAlbum(album) {
  const query = `
    INSERT INTO albums (id, title, artist_id, artist_name) 
    VALUES (?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE 
      title = VALUES(title),
      artist_name = VALUES(artist_name),
      updated_at = CURRENT_TIMESTAMP
  `;
  await executeQuery(query, [album.id, album.title, album.artist_id, album.artist]);
}

// Save track to database
async function saveTrack(track) {
  const query = `
    INSERT INTO tracks (id, title, artist_id, album_id, artist_name, album_title, track_number, duration, file_path, relative_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      title = VALUES(title),
      artist_name = VALUES(artist_name),
      album_title = VALUES(album_title),
      track_number = VALUES(track_number),
      duration = VALUES(duration),
      file_path = VALUES(file_path),
      relative_path = VALUES(relative_path),
      updated_at = CURRENT_TIMESTAMP
  `;
  await executeQuery(query, [
    track.id, track.title, track.artist_id, track.album_id, 
    track.artist, track.album, track.trackNumber, track.duration, 
    track.filePath, track.relativePath
  ]);
}

// Get all artists with their albums and tracks
async function getLibraryFromDatabase() {
  const artistsQuery = 'SELECT * FROM artists ORDER BY name';
  const artists = await executeQuery(artistsQuery);

  for (const artist of artists) {
    // Get albums for this artist
    const albumsQuery = 'SELECT * FROM albums WHERE artist_id = ? ORDER BY title';
    artist.albums = await executeQuery(albumsQuery, [artist.id]);

    // Get tracks for each album
    for (const album of artist.albums) {
      const tracksQuery = 'SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number, title';
      album.tracks = await executeQuery(tracksQuery, [album.id]);
    }
  }

  return artists;
}

// Check if library has been scanned recently
async function getLastScanInfo(libraryPath) {
  const query = 'SELECT * FROM scan_metadata WHERE library_path = ? ORDER BY last_scan_time DESC LIMIT 1';
  const results = await executeQuery(query, [libraryPath]);
  return results.length > 0 ? results[0] : null;
}

// Update scan metadata
async function updateScanMetadata(libraryPath, totalTracks, totalArtists, totalAlbums) {
  const query = `
    INSERT INTO scan_metadata (library_path, total_tracks, total_artists, total_albums)
    VALUES (?, ?, ?, ?)
  `;
  await executeQuery(query, [libraryPath, totalTracks, totalArtists, totalAlbums]);
}

// Clear all music data (for re-scanning)
async function clearMusicData() {
  const connection = await getConnection();
  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE tracks');
    await connection.execute('TRUNCATE TABLE albums');
    await connection.execute('TRUNCATE TABLE artists');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Cleared all music data from database');
  } finally {
    connection.release();
  }
}

// Check if database exists and is accessible
async function testConnection() {
  try {
    const connection = await getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  initializeDatabase,
  createDatabase,
  createTables,
  getConnection,
  executeQuery,
  saveArtist,
  saveAlbum,
  saveTrack,
  getLibraryFromDatabase,
  getLastScanInfo,
  updateScanMetadata,
  clearMusicData,
  testConnection
};