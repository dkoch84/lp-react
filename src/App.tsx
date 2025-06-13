import React, { useState, useEffect } from 'react';
import { Artist, Album, ScanProgress } from './types/music';
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
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanStats, setScanStats] = useState({ 
    totalFiles: 0, 
    processedFiles: 0, 
    artistCount: 0, 
    albumCount: 0 
  });

  useEffect(() => {
    loadMusicLibrary();
  }, []);

  const loadMusicLibrary = async () => {
    setCurrentView(AppView.LOADING);
    setError(null);
    setScanProgress(null);
    setScanStats({ totalFiles: 0, processedFiles: 0, artistCount: 0, albumCount: 0 });
    
    try {
      // Use the progress streaming version
      const libraryArtists = await musicLibraryService.fetchMusicLibraryWithProgress(
        (progress: ScanProgress) => {
          setScanProgress(progress);
          if (progress.totalFiles !== undefined || progress.processedFiles !== undefined ||
              progress.artistCount !== undefined || progress.albumCount !== undefined) {
            setScanStats(prev => ({
              totalFiles: progress.totalFiles ?? prev.totalFiles,
              processedFiles: progress.processedFiles ?? prev.processedFiles,
              artistCount: progress.artistCount ?? prev.artistCount,
              albumCount: progress.albumCount ?? prev.albumCount
            }));
          }
        }
      );
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
            {scanProgress ? (
              <div className="scan-progress">
                <div className="progress-info">
                  <p className="progress-message">{scanProgress.message}</p>
                  {scanProgress.type === 'processed' && scanProgress.artist && (
                    <div className="current-track">
                      <strong>{scanProgress.artist}</strong>
                      {scanProgress.album && <span> - {scanProgress.album}</span>}
                      {scanProgress.title && <div className="track-title">{scanProgress.title}</div>}
                    </div>
                  )}
                </div>
                
                <div className="progress-stats">
                  <div className="stats-row">
                    <span>Files: {scanStats.processedFiles} / {scanStats.totalFiles}</span>
                    <span>Artists: {scanStats.artistCount}</span>
                    <span>Albums: {scanStats.albumCount}</span>
                  </div>
                  
                  {scanStats.totalFiles > 0 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(scanStats.processedFiles / scanStats.totalFiles) * 100}%` 
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p>Initializing scan...</p>
            )}
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
