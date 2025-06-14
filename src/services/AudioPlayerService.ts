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
    console.log(`Starting playback: ${track.title} by ${track.artist} (Track ${this.currentTrackIndex + 1}/${this.currentAlbum.tracks.length})`);
    
    // Stop and clean up current audio immediately but gently
    if (this.currentAudio) {
      console.log('Stopping previous track');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Remove event listeners to prevent interference
      this.currentAudio.onloadedmetadata = null;
      this.currentAudio.ontimeupdate = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
    }

    // Create new audio element
    const newAudio = new Audio();
    console.log(`Loading audio URL: ${musicLibraryService.getAudioUrl(track)}`);
    newAudio.src = musicLibraryService.getAudioUrl(track);
    newAudio.preload = 'auto';
    
    // Set up event listeners first
    this.setupAudioEventListeners(newAudio, track);

    // Replace current audio
    const oldAudio = this.currentAudio;
    this.currentAudio = newAudio;
    
    // Clean up old audio source after delay
    if (oldAudio) {
      setTimeout(() => {
        try {
          oldAudio.src = '';
          oldAudio.load(); // Ensure cleanup
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 500);
    }

    // Preload next track for gapless playback
    this.preloadNextTrack();

    // Update state first
    this.updatePlaybackState({
      currentTrack: track,
      duration: track.duration,
      isPlaying: false // Will be set to true when play succeeds
    });

    try {
      console.log(`Attempting to play: ${track.title}`);
      await this.currentAudio.play();
      console.log(`Successfully started playing: ${track.title}`);
      this.updatePlaybackState({ isPlaying: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to play track: ${track.title} by ${track.artist} - ${errorMessage}`);
      
      // Only skip if this is still the current track and not at the end of album
      if (this.currentAudio === newAudio && this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
        console.log('Attempting to skip to next track due to playback error');
        this.currentTrackIndex++;
        // Add significant delay before trying next track to prevent rapid cascade of failures
        setTimeout(() => {
          if (this.currentAudio === newAudio) { // Double-check we're still on the same audio element
            this.playCurrentTrack();
          }
        }, 2000);
      } else {
        console.log('Cannot skip track or reached end of album');
        this.updatePlaybackState({ isPlaying: false });
      }
    }
  }

  private setupAudioEventListeners(audio: HTMLAudioElement, track: Track) {
    console.log(`Setting up event listeners for: ${track.title}`);
    
    audio.addEventListener('loadedmetadata', () => {
      console.log(`Metadata loaded for: ${track.title}, duration: ${audio.duration}s`);
      this.updatePlaybackState({ duration: audio.duration });
    });

    audio.addEventListener('timeupdate', () => {
      this.updatePlaybackState({ position: audio.currentTime });
    });

    audio.addEventListener('ended', () => {
      console.log(`Track ended: ${track.title}`);
      this.handleTrackEnd();
    });

    audio.addEventListener('error', (event) => {
      // Only log and handle errors for the current audio to avoid spam from old elements
      if (audio === this.currentAudio) {
        const error = audio.error;
        const errorCode = error?.code || 'unknown';
        const errorMessage = error?.message || 'Unknown audio error';
        console.error(`Audio error for ${track.title} by ${track.artist}: Code ${errorCode} - ${errorMessage}`);
        
        // Be more conservative about auto-skipping on errors
        // Only skip for network errors or unsupported formats, not user interruptions
        if (error && (error.code === 2 || error.code === 3 || error.code === 4)) { // NETWORK_ERROR, DECODE_ERROR, SRC_NOT_SUPPORTED
          if (this.currentAlbum && this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
            console.log(`Skipping to next track due to error code ${error.code}`);
            setTimeout(() => {
              if (audio === this.currentAudio) {
                this.currentTrackIndex++;
                this.playCurrentTrack();
              }
            }, 3000);
          } else {
            console.log('Cannot skip - reached end of album or no album loaded');
            this.updatePlaybackState({ isPlaying: false });
          }
        } else {
          console.log('Error not suitable for auto-skip, stopping playback');
          this.updatePlaybackState({ isPlaying: false });
        }
      }
    });

    audio.addEventListener('canplaythrough', () => {
      console.log(`Track ready to play: ${track.title}`);
    });

    audio.addEventListener('waiting', () => {
      console.log(`Track buffering: ${track.title}`);
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
      // Use preloaded next track for gapless playback if available
      if (this.nextAudio) {
        const oldAudio = this.currentAudio;
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
          // Fallback to regular loading if preloaded track fails
          this.playCurrentTrack();
        });
        
        // Clean up old audio after delay
        if (oldAudio) {
          setTimeout(() => {
            try {
              oldAudio.src = '';
            } catch (error) {
              // Ignore cleanup errors
            }
          }, 100);
        }
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