import React, { useState, useEffect } from 'react';
import { PlaybackState, Album } from '../types/music';
import { audioPlayerService } from '../services/AudioPlayerService';
import { musicLibraryService } from '../services/MusicLibraryService';
import './AlbumPlayer.css';

interface AlbumPlayerProps {
  album: Album | null;
  onBack: () => void;
}

const AlbumPlayer: React.FC<AlbumPlayerProps> = ({ album, onBack }) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTrack: null,
    currentAlbum: null,
    position: 0,
    duration: 0
  });
  const [albumArt, setAlbumArt] = useState<string | null>(null);

  useEffect(() => {
    const handleStateChange = (state: PlaybackState) => {
      setPlaybackState(state);
    };

    audioPlayerService.addStateListener(handleStateChange);

    return () => {
      audioPlayerService.removeStateListener(handleStateChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let currentAlbumArt: string | null = null;
    
    const loadAlbumArt = async () => {
      // Clean up previous album art
      if (albumArt) {
        URL.revokeObjectURL(albumArt);
        setAlbumArt(null);
      }
      
      if (album && album.tracks.length > 0) {
        try {
          const artUrl = await musicLibraryService.extractAlbumArt(album.tracks[0].file);
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
    };

    loadAlbumArt();

    return () => {
      isMounted = false;
      if (currentAlbumArt) {
        URL.revokeObjectURL(currentAlbumArt);
      }
    };
  }, [album]);

  const handlePlay = () => {
    if (album) {
      audioPlayerService.playAlbum(album);
    }
  };

  const handlePause = () => {
    audioPlayerService.pause();
  };

  const handleResume = () => {
    audioPlayerService.resume();
  };

  const handleStop = () => {
    audioPlayerService.stop();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (playbackState.duration === 0) return 0;
    return (playbackState.position / playbackState.duration) * 100;
  };

  if (!album) {
    return (
      <div className="album-player empty">
        <div className="empty-player">
          <h3>No Album Selected</h3>
          <p>Select an album from your library to start playing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="album-player">
      <button className="back-button" onClick={onBack}>
        ← Back to Library
      </button>

      <div className="album-display">
        <div className="album-art-container">
          {albumArt ? (
            <img src={albumArt} alt={`${album.title} cover`} className="album-art" />
          ) : (
            <div className="album-art-placeholder">
              <div className="vinyl-icon-large">♪</div>
            </div>
          )}
        </div>

        <div className="album-info-panel">
          <h2 className="album-title">{album.title}</h2>
          <h3 className="album-artist">{album.artist}</h3>
          {album.year && <p className="album-year">{album.year}</p>}
          
          <div className="track-list">
            <h4>Tracks ({album.tracks.length})</h4>
            <div className="tracks">
              {album.tracks.map((track, index) => (
                <div 
                  key={track.id} 
                  className={`track-item ${
                    playbackState.currentTrack?.id === track.id ? 'current' : ''
                  }`}
                >
                  <span className="track-number">{track.trackNumber || index + 1}</span>
                  <span className="track-title">{track.title}</span>
                  <span className="track-duration">{formatTime(track.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="player-controls">
        {playbackState.currentTrack && (
          <div className="now-playing">
            <div className="track-info">
              <div className="current-track-title">{playbackState.currentTrack.title}</div>
              <div className="current-track-artist">{playbackState.currentTrack.artist}</div>
            </div>
            
            <div className="progress-container">
              <span className="time-current">{formatTime(playbackState.position)}</span>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
              <span className="time-total">{formatTime(playbackState.duration)}</span>
            </div>
          </div>
        )}

        <div className="control-buttons">
          {!playbackState.isPlaying ? (
            playbackState.currentTrack ? (
              <button className="control-btn play-btn" onClick={handleResume}>
                ▶ Resume
              </button>
            ) : (
              <button className="control-btn play-btn" onClick={handlePlay}>
                ▶ Play Album
              </button>
            )
          ) : (
            <button className="control-btn pause-btn" onClick={handlePause}>
              ⏸ Pause
            </button>
          )}
          
          {playbackState.currentTrack && (
            <button className="control-btn stop-btn" onClick={handleStop}>
              ⏹ Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlbumPlayer;