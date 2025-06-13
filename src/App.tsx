import React, { useState, useEffect } from 'react';
import { Artist, Album } from './types/music';
import { musicLibraryService } from './services/MusicLibraryService';
import ArtistLibrary from './components/ArtistLibrary';
import AlbumPlayer from './components/AlbumPlayer';
import './App.css';

enum AppView {
  LOADING,
  LIBRARY,
  PLAYER,
  ERROR
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOADING);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMusicLibrary();
  }, []);

  const loadMusicLibrary = async () => {
    setCurrentView(AppView.LOADING);
    setError(null);
    
    try {
      const libraryArtists = await musicLibraryService.fetchMusicLibrary();
      setArtists(libraryArtists);
      setCurrentView(AppView.LIBRARY);
    } catch (error) {
      console.error('Error loading music library:', error);
      setError('Failed to load music library. Please make sure the backend server is running and your music library is accessible.');
      setCurrentView(AppView.ERROR);
    }
  };

  const handleAlbumSelect = (album: Album) => {
    setSelectedAlbum(album);
    setCurrentView(AppView.PLAYER);
  };

  const handleBackToLibrary = () => {
    setCurrentView(AppView.LIBRARY);
    setSelectedAlbum(null);
  };

  const handleRefreshLibrary = () => {
    loadMusicLibrary();
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.LOADING:
        return (
          <div className="loading-container">
            <div className="vinyl-icon">♪</div>
            <h2>Loading Music Library...</h2>
            <p>Scanning your music collection...</p>
          </div>
        );
      
      case AppView.ERROR:
        return (
          <div className="error-container">
            <div className="vinyl-icon">⚠</div>
            <h2>Error Loading Music Library</h2>
            <p>{error}</p>
            <button 
              className="retry-btn"
              onClick={handleRefreshLibrary}
            >
              Retry
            </button>
          </div>
        );
      
      case AppView.LIBRARY:
        return (
          <div>
            <div className="app-header">
              <h1>LP - Vinyl Experience Music Player</h1>
              <button 
                className="header-btn"
                onClick={handleRefreshLibrary}
              >
                Refresh Library
              </button>
            </div>
            <ArtistLibrary 
              artists={artists}
              onAlbumSelect={handleAlbumSelect}
            />
          </div>
        );
      
      case AppView.PLAYER:
        return (
          <AlbumPlayer 
            album={selectedAlbum}
            onBack={handleBackToLibrary}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}

export default App;
