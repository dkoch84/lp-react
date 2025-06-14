const database = require('./database');

// Simple test to validate database operations
async function testDatabase() {
  console.log('Testing database functionality...');
  
  try {
    // Test connection
    console.log('1. Testing database connection...');
    await database.createDatabase();
    database.initializeDatabase();
    await database.createTables();
    
    const isConnected = await database.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✓ Database connection successful');
    
    // Test data operations
    console.log('2. Testing data operations...');
    
    // Clear any existing data
    await database.clearMusicData();
    
    // Create test data
    const testArtist = { id: 'test-artist-1', name: 'Test Artist' };
    const testAlbum = { 
      id: 'test-album-1', 
      title: 'Test Album', 
      artist_id: 'test-artist-1',
      artist: 'Test Artist'
    };
    const testTrack = {
      id: 'test-track-1',
      title: 'Test Track',
      artist_id: 'test-artist-1',
      album_id: 'test-album-1',
      artist: 'Test Artist',
      album: 'Test Album',
      trackNumber: 1,
      duration: 180.5,
      filePath: '/test/path/track.mp3',
      relativePath: 'Test Artist/Test Album/track.mp3'
    };
    
    // Save test data
    await database.saveArtist(testArtist);
    await database.saveAlbum(testAlbum);
    await database.saveTrack(testTrack);
    console.log('✓ Data save operations successful');
    
    // Retrieve and validate data
    const library = await database.getLibraryFromDatabase();
    if (library.length !== 1) {
      throw new Error(`Expected 1 artist, got ${library.length}`);
    }
    
    const artist = library[0];
    if (artist.name !== 'Test Artist' || artist.albums.length !== 1) {
      throw new Error('Artist data mismatch');
    }
    
    const album = artist.albums[0];
    if (album.title !== 'Test Album' || album.tracks.length !== 1) {
      throw new Error('Album data mismatch');
    }
    
    const track = album.tracks[0];
    if (track.title !== 'Test Track' || track.duration !== 180.5) {
      throw new Error('Track data mismatch');
    }
    
    console.log('✓ Data retrieval and validation successful');
    
    // Test scan metadata
    await database.updateScanMetadata('/test/path', 1, 1, 1);
    const scanInfo = await database.getLastScanInfo('/test/path');
    if (!scanInfo || scanInfo.total_tracks !== 1) {
      throw new Error('Scan metadata test failed');
    }
    console.log('✓ Scan metadata operations successful');
    
    // Clean up test data
    await database.clearMusicData();
    console.log('✓ Cleanup successful');
    
    console.log('\n🎉 All database tests passed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDatabase().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testDatabase };