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
    
    // Store the old audio reference for later cleanup
    const oldAudio = this.currentAudio;
    
    // Stop current audio gently without immediate cleanup
    if (oldAudio) {
      console.log('Pausing previous track');
      try {
        oldAudio.pause();
      } catch (error) {
        // Ignore pause errors
      }
    }

    // Create new audio element
    const newAudio = new Audio();
    console.log(`Loading audio URL: ${musicLibraryService.getAudioUrl(track)}`);
    newAudio.src = musicLibraryService.getAudioUrl(track);
    newAudio.preload = 'auto';
    
    // Replace current audio reference immediately
    this.currentAudio = newAudio;
    
    // Set up event listeners for new audio
    this.setupAudioEventListeners(newAudio, track);

    // Update state immediately
    this.updatePlaybackState({
      currentTrack: track,
      duration: track.duration,
      isPlaying: false // Will be set to true when play succeeds
    });

    // Wait for the new audio to be ready before attempting to play
    try {
      console.log(`Attempting to play: ${track.title}`);
      
      // Try to play the new audio
      await newAudio.play();
      console.log(`Successfully started playing: ${track.title}`);
      this.updatePlaybackState({ isPlaying: true });
      
      // Now that the new track is playing successfully, clean up the old audio
      if (oldAudio && oldAudio !== newAudio) {
        setTimeout(() => {
          try {
            // Remove event listeners from old audio
            oldAudio.onloadedmetadata = null;
            oldAudio.ontimeupdate = null;
            oldAudio.onended = null;
            oldAudio.onerror = null;
            oldAudio.src = '';
            oldAudio.load();
          } catch (error) {
            // Ignore cleanup errors
          }
        }, 1000); // Increased delay for safer cleanup
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't log errors for expected interruptions during cleanup
      const isInterruptedError = error instanceof Error && 
        (error.message.includes('interrupted') || 
         error.message.includes('removed from the document') ||
         error.name === 'AbortError');
      
      if (!isInterruptedError) {
        console.error(`Failed to play track: ${track.title} by ${track.artist} - ${errorMessage}`);
      }
      
      // Only auto-skip on certain types of errors and if we're not at the end
      if (this.currentAudio === newAudio && 
          this.currentAlbum && 
          this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
        
        // Check if this is a recoverable error
        if (error instanceof Error && error.name === 'AbortError') {
          // Don't auto-skip on abort errors, just stop
          console.log('Play was aborted, not auto-skipping');
          this.updatePlaybackState({ isPlaying: false });
          return;
        }
        
        console.log('Attempting to skip to next track due to playback error');
        this.currentTrackIndex++;
        // Add delay before trying next track
        setTimeout(() => {
          if (this.currentAudio === newAudio) {
            this.playCurrentTrack();
          }
        }, 3000); // Increased delay to prevent rapid failures
      } else {
        console.log('Cannot skip track or reached end of album');
        this.updatePlaybackState({ isPlaying: false });
      }
    }
  }

  private setupAudioEventListeners(audio: HTMLAudioElement, track: Track) {
    console.log(`Setting up event listeners for: ${track.title}`);
    
    // Use a flag to track if this audio element is still valid
    let isCurrentAudio = () => audio === this.currentAudio;
    
    audio.addEventListener('loadedmetadata', () => {
      if (isCurrentAudio()) {
        console.log(`Metadata loaded for: ${track.title}, duration: ${audio.duration}s`);
        this.updatePlaybackState({ duration: audio.duration });
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (isCurrentAudio()) {
        this.updatePlaybackState({ position: audio.currentTime });
      }
    });

    audio.addEventListener('ended', () => {
      if (isCurrentAudio()) {
        console.log(`Track ended: ${track.title}`);
        this.handleTrackEnd();
      }
    });

    audio.addEventListener('error', (event) => {
      // Only handle errors for the current audio to avoid spam from old elements
      if (isCurrentAudio()) {
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
              if (isCurrentAudio()) {
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
      if (isCurrentAudio()) {
        console.log(`Track ready to play: ${track.title}`);
        // Start preloading next track as soon as current track is ready
        // This provides more buffer time for gapless playback
        this.preloadNextTrack();
      }
    });

    audio.addEventListener('waiting', () => {
      if (isCurrentAudio()) {
        console.log(`Track buffering: ${track.title}`);
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
      // Use preloaded next track for gapless playback if available
      if (this.nextAudio) {
        const oldAudio = this.currentAudio;
        const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex];
        
        // Update state immediately to reduce perceived gap
        this.updatePlaybackState({
          currentTrack: nextTrack,
          duration: nextTrack.duration
        });
        
        this.currentAudio = this.nextAudio;
        this.nextAudio = null;
        
        // Set up event listeners before playing
        this.setupAudioEventListeners(this.currentAudio, nextTrack);
        
        // Check if the preloaded audio is ready, otherwise wait briefly
        const playWhenReady = () => {
          this.currentAudio!.play().then(() => {
            console.log(`Gapless transition to: ${nextTrack.title}`);
            this.preloadNextTrack();
          }).catch(error => {
            console.error('Error playing next track:', error);
            // Fallback to regular loading if preloaded track fails
            this.playCurrentTrack();
          });
        };

        if (this.currentAudio.readyState >= 3) { // HAVE_FUTURE_DATA or better
          playWhenReady();
        } else {
          // Wait for the audio to be ready
          const onCanPlay = () => {
            this.currentAudio!.removeEventListener('canplay', onCanPlay);
            playWhenReady();
          };
          this.currentAudio.addEventListener('canplay', onCanPlay);
          
          // Fallback timeout in case canplay never fires
          setTimeout(() => {
            this.currentAudio!.removeEventListener('canplay', onCanPlay);
            playWhenReady();
          }, 100);
        }
        
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
    console.log('Stopping audio playback');
    
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

    // Handle current audio cleanup with more careful timing
    if (this.currentAudio) {
      const audioToCleanup = this.currentAudio;
      this.currentAudio = null; // Clear reference immediately to prevent further use
      
      try {
        audioToCleanup.pause();
        audioToCleanup.currentTime = 0;
      } catch (error) {
        // Ignore pause/seek errors during cleanup
      }
      
      // Remove event listeners to prevent callbacks during cleanup
      setTimeout(() => {
        try {
          audioToCleanup.onloadedmetadata = null;
          audioToCleanup.ontimeupdate = null;
          audioToCleanup.onended = null;
          audioToCleanup.onerror = null;
        } catch (error) {
          // Ignore errors
        }
      }, 100);
      
      // Clear src after longer delay to avoid AbortError
      setTimeout(() => {
        try {
          audioToCleanup.src = '';
          audioToCleanup.load();
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 1000); // Increased delay
    }
    
    // Handle next audio cleanup
    if (this.nextAudio) {
      const nextAudioToCleanup = this.nextAudio;
      this.nextAudio = null; // Clear reference immediately
      
      setTimeout(() => {
        try {
          nextAudioToCleanup.src = '';
          nextAudioToCleanup.load();
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 1000); // Increased delay
    }
  }

  getCurrentState(): PlaybackState {
    return { ...this.playbackState };
  }

  // Deliberately no seek or skip methods to maintain vinyl experience
}

export const audioPlayerService = new AudioPlayerService();