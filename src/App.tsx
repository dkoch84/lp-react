import React, { useState } from 'react';
import { Artist, Album } from './types/music';
import { musicLibraryService } from './services/MusicLibraryService';
import FileUploader from './components/FileUploader';
import ArtistLibrary from './components/ArtistLibrary';
import AlbumPlayer from './components/AlbumPlayer';
import './App.css';

enum AppView {
  UPLOADER,
  LIBRARY,
  PLAYER
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.UPLOADER);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilesSelected = async (files: FileList) => {
    setIsLoading(true);
    try {
      const tracks = await musicLibraryService.parseMultipleFiles(files);
      const organizedArtists = musicLibraryService.organizeTracksIntoLibrary(tracks);
      setArtists(organizedArtists);
      setCurrentView(AppView.LIBRARY);
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setIsLoading(false);
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

  const handleBackToUploader = () => {
    setCurrentView(AppView.UPLOADER);
    setArtists([]);
    setSelectedAlbum(null);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.UPLOADER:
        return (
          <FileUploader 
            onFilesSelected={handleFilesSelected}
            isLoading={isLoading}
          />
        );
      
      case AppView.LIBRARY:
        return (
          <div>
            <div className="app-header">
              <h1>LP - Vinyl Experience Music Player</h1>
              <button 
                className="header-btn"
                onClick={handleBackToUploader}
              >
                Add More Music
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
