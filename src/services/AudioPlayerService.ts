import { Track, Album, PlaybackState } from '../types/music';
import { musicLibraryService } from './MusicLibraryService';

export class AudioPlayerService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private currentAlbum: Album | null = null;
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentTrack: null,
    currentAlbum: null,
    position: 0,
    duration: 0
  };
  private listeners: ((state: PlaybackState) => void)[] = [];

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  addStateListener(listener: (state: PlaybackState) => void) {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(this.playbackState);
  }

  removeStateListener(listener: (state: PlaybackState) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyStateChange() {
    this.listeners.forEach(listener => listener({ ...this.playbackState }));
  }

  private updatePlaybackState(updates: Partial<PlaybackState>) {
    this.playbackState = { ...this.playbackState, ...updates };
    this.notifyStateChange();
  }

  async playAlbum(album: Album, startTrackIndex: number = 0) {
    if (album.tracks.length === 0) return;

    this.currentAlbum = album;
    this.currentTrackIndex = startTrackIndex;

    this.updatePlaybackState({
      currentAlbum: album,
      currentTrack: album.tracks[startTrackIndex]
    });

    await this.playCurrentTrack();
  }

  private async playCurrentTrack() {
    if (!this.currentAlbum || this.currentTrackIndex >= this.currentAlbum.tracks.length) {
      return;
    }

    const track = this.currentAlbum.tracks[this.currentTrackIndex];
    
    // Stop and cleanup current audio completely before starting new one
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = '';
      this.currentAudio = null;
    }

    // Wait a moment to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create new audio element
    this.currentAudio = new Audio();
    this.currentAudio.src = musicLibraryService.getAudioUrl(track);
    
    // Set up event listeners
    this.setupAudioEventListeners(this.currentAudio, track);

    // Preload next track for gapless playback
    this.preloadNextTrack();

    try {
      await this.currentAudio.play();
      this.updatePlaybackState({
        isPlaying: true,
        currentTrack: track,
        duration: track.duration
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error playing track:', track.title, 'by', track.artist, '-', errorMessage);
      // Skip to next track if current one fails to play, but add delay to prevent rapid cascading
      if (this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
        this.currentTrackIndex++;
        // Add delay before trying next track to prevent rapid cascade of failures
        setTimeout(() => this.playCurrentTrack(), 500);
      } else {
        this.updatePlaybackState({ isPlaying: false });
      }
    }
  }

  private setupAudioEventListeners(audio: HTMLAudioElement, track: Track) {
    audio.addEventListener('loadedmetadata', () => {
      this.updatePlaybackState({ duration: audio.duration });
    });

    audio.addEventListener('timeupdate', () => {
      this.updatePlaybackState({ position: audio.currentTime });
    });

    audio.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    audio.addEventListener('error', (error) => {
      // Only log if this is still the current audio to avoid spam from old elements
      if (audio === this.currentAudio) {
        console.error('Audio playback error for track:', track.title, 'by', track.artist);
        // Skip to next track if current one has an error, with delay to prevent cascading
        if (this.currentAlbum && this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
          this.currentTrackIndex++;
          setTimeout(() => this.playCurrentTrack(), 500);
        } else {
          this.updatePlaybackState({ isPlaying: false });
        }
      }
    });
  }

  private preloadNextTrack() {
    if (!this.currentAlbum || this.currentTrackIndex >= this.currentAlbum.tracks.length - 1) {
      return;
    }

    const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex + 1];
    
    // Clean up existing next audio
    if (this.nextAudio) {
      try {
        this.nextAudio.src = '';
      } catch (error) {
        // Ignore cleanup errors
      }
      this.nextAudio = null;
    }

    // Create new preloaded audio with minimal setup
    try {
      this.nextAudio = new Audio();
      this.nextAudio.src = musicLibraryService.getAudioUrl(nextTrack);
      this.nextAudio.preload = 'auto';
    } catch (error) {
      console.warn('Failed to preload next track:', error);
      this.nextAudio = null;
    }
  }

  private handleTrackEnd() {
    if (!this.currentAlbum) return;

    // Move to next track
    this.currentTrackIndex++;
    
    if (this.currentTrackIndex < this.currentAlbum.tracks.length) {
      // Use preloaded next track for gapless playback
      if (this.nextAudio) {
        this.currentAudio = this.nextAudio;
        this.nextAudio = null;
        
        const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex];
        this.setupAudioEventListeners(this.currentAudio, nextTrack);
        
        this.currentAudio.play().then(() => {
          this.updatePlaybackState({
            currentTrack: nextTrack,
            duration: nextTrack.duration
          });
          this.preloadNextTrack();
        }).catch(error => {
          console.error('Error playing next track:', error);
        });
      } else {
        // Fallback to regular track loading
        this.playCurrentTrack();
      }
    } else {
      // Album finished
      this.updatePlaybackState({
        isPlaying: false,
        position: 0
      });
    }
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.updatePlaybackState({ isPlaying: false });
    }
  }

  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().then(() => {
        this.updatePlaybackState({ isPlaying: true });
      }).catch(error => {
        console.error('Error resuming playback:', error);
      });
    }
  }

  stop() {
    // Immediately update state to prevent new operations
    this.updatePlaybackState({
      isPlaying: false,
      currentTrack: null,
      currentAlbum: null,
      position: 0,
      duration: 0
    });

    this.currentAlbum = null;
    this.currentTrackIndex = 0;

    // Handle current audio cleanup
    if (this.currentAudio) {
      const audioToCleanup = this.currentAudio;
      this.currentAudio = null; // Clear reference immediately
      
      try {
        audioToCleanup.pause();
        audioToCleanup.currentTime = 0;
      } catch (error) {
        // Ignore pause/seek errors during cleanup
      }
      
      // Clear src after longer delay to avoid AbortError
      setTimeout(() => {
        try {
          audioToCleanup.src = '';
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 200);
    }
    
    // Handle next audio cleanup
    if (this.nextAudio) {
      const nextAudioToCleanup = this.nextAudio;
      this.nextAudio = null; // Clear reference immediately
      
      setTimeout(() => {
        try {
          nextAudioToCleanup.src = '';
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 200);
    }
  }

  getCurrentState(): PlaybackState {
    return { ...this.playbackState };
  }

  // Deliberately no seek or skip methods to maintain vinyl experience
}

export const audioPlayerService = new AudioPlayerService();