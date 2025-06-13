import React, { useState, useEffect } from 'react';
import { Album } from '../types/music';
import { musicLibraryService } from '../services/MusicLibraryService';
import './AlbumCard.css';

interface AlbumCardProps {
  album: Album;
  onSelect: () => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelect }) => {
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let currentAlbumArt: string | null = null;
    
    const loadAlbumArt = async () => {
      // Clean up previous album art
      if (albumArt) {
        URL.revokeObjectURL(albumArt);
        setAlbumArt(null);
      }
      
      if (album.tracks.length > 0) {
        try {
          const artUrl = await musicLibraryService.extractAlbumArt(album.tracks[0]);
          if (isMounted) {
            currentAlbumArt = artUrl;
            setAlbumArt(artUrl);
          } else if (artUrl) {
            URL.revokeObjectURL(artUrl);
          }
        } catch (error) {
          console.error('Error loading album art:', error);
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadAlbumArt();

    return () => {
      isMounted = false;
      if (currentAlbumArt) {
        URL.revokeObjectURL(currentAlbumArt);
      }
    };
  }, [album, albumArt]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = album.tracks.reduce((sum, track) => sum + track.duration, 0);

  return (
    <div className="album-card" onClick={onSelect}>
      <div className="album-cover">
        {isLoading ? (
          <div className="album-cover-placeholder loading">
            <div className="spinner-small"></div>
          </div>
        ) : albumArt ? (
          <img src={albumArt} alt={`${album.title} cover`} />
        ) : (
          <div className="album-cover-placeholder">
            <div className="vinyl-placeholder">♪</div>
          </div>
        )}
      </div>
      
      <div className="album-info">
        <h4 className="album-title">{album.title}</h4>
        <p className="album-artist">{album.artist}</p>
        {album.year && <p className="album-year">{album.year}</p>}
        <div className="album-stats">
          <span className="track-count">{album.tracks.length} track{album.tracks.length !== 1 ? 's' : ''}</span>
          <span className="album-duration">{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AlbumCard;