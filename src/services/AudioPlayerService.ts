import { Track, Album, PlaybackState } from '../types/music';
import { musicLibraryService } from './MusicLibraryService';

export class AudioPlayerService {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private nextBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;
  private currentTrackIndex: number = 0;
  private currentAlbum: Album | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isSourcePlaying: boolean = false;
  private animationFrameId: number | null = null;
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
      if (this.audioContext && typeof this.audioContext.createGain === 'function') {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
      } else {
        console.warn('AudioContext available but createGain not supported');
        this.gainNode = null;
      }
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.audioContext = null;
      this.gainNode = null;
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

  private async loadAudioBuffer(track: Track): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const url = musicLibraryService.getAudioUrl(track);
    console.log(`Loading audio buffer for: ${track.title} from ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    console.log(`Audio buffer loaded: ${track.title}, duration: ${audioBuffer.duration}s`);
    return audioBuffer;
  }

  private updatePosition() {
    if (this.isSourcePlaying && this.audioContext && this.startTime > 0) {
      const elapsed = this.audioContext.currentTime - this.startTime + this.pausedAt;
      this.updatePlaybackState({ position: elapsed });
      this.animationFrameId = requestAnimationFrame(() => this.updatePosition());
    }
  }

  private stopPositionUpdates() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  async playAlbum(album: Album, startTrackIndex: number = 0) {
    if (album.tracks.length === 0) return;

    this.currentAlbum = album;
    this.currentTrackIndex = startTrackIndex;
    
    // Clear any existing buffers when starting new album
    this.currentBuffer = null;
    this.nextBuffer = null;

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

    if (!this.audioContext || !this.gainNode) {
      console.error('AudioContext not properly initialized');
      return;
    }

    const track = this.currentAlbum.tracks[this.currentTrackIndex];
    console.log(`Starting playback: ${track.title} by ${track.artist} (Track ${this.currentTrackIndex + 1}/${this.currentAlbum.tracks.length})`);
    
    // Stop current playback
    this.stopCurrentSource();
    
    try {
      // Resume AudioContext if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Load audio buffer if not already loaded
      if (!this.currentBuffer) {
        this.currentBuffer = await this.loadAudioBuffer(track);
      }

      // Create and configure audio source
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = this.currentBuffer;
      this.currentSource.connect(this.gainNode);

      // Set up event handlers
      this.currentSource.onended = () => {
        if (this.currentSource && this.isSourcePlaying) {
          console.log(`Track ended: ${track.title}`);
          this.handleTrackEnd();
        }
      };

      // Update state
      this.updatePlaybackState({
        currentTrack: track,
        duration: this.currentBuffer.duration,
        isPlaying: true
      });

      // Start playback
      this.startTime = this.audioContext.currentTime;
      this.pausedAt = 0;
      this.isSourcePlaying = true;
      this.currentSource.start(0);
      
      console.log(`Successfully started playing: ${track.title}`);
      
      // Start position updates
      this.updatePosition();
      
      // Preload next track for gapless playback
      this.preloadNextTrack();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to play track: ${track.title} by ${track.artist} - ${errorMessage}`);
      
      // Only auto-skip on certain types of errors and if we're not at the end
      if (this.currentAlbum && this.currentTrackIndex < this.currentAlbum.tracks.length - 1) {
        console.log('Attempting to skip to next track due to playback error');
        this.currentTrackIndex++;
        // Add delay before trying next track
        setTimeout(() => {
          this.currentBuffer = null; // Reset buffer to force reload
          this.playCurrentTrack();
        }, 3000);
      } else {
        console.log('Cannot skip track or reached end of album');
        this.updatePlaybackState({ isPlaying: false });
      }
    }
  }

  private stopCurrentSource() {
    this.stopPositionUpdates();
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (error) {
        // Source might already be stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    
    this.isSourcePlaying = false;
    this.startTime = 0;
    this.pausedAt = 0;
  }

  private async preloadNextTrack() {
    if (!this.currentAlbum || this.currentTrackIndex >= this.currentAlbum.tracks.length - 1) {
      return;
    }

    if (!this.audioContext) {
      return;
    }

    const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex + 1];
    
    // Clean up existing next buffer
    this.nextBuffer = null;
    
    // Load next track buffer in background
    try {
      this.nextBuffer = await this.loadAudioBuffer(nextTrack);
      console.log(`Next track preloaded: ${nextTrack.title}`);
    } catch (error) {
      console.warn('Failed to preload next track:', error);
      this.nextBuffer = null;
    }
  }

  private handleTrackEnd() {
    if (!this.currentAlbum) return;

    // Move to next track
    this.currentTrackIndex++;
    
    if (this.currentTrackIndex < this.currentAlbum.tracks.length) {
      // Use preloaded next buffer for gapless playback if available
      if (this.nextBuffer && this.audioContext && this.gainNode) {
        console.log('Using preloaded buffer for gapless transition');
        
        // Stop current source
        this.stopCurrentSource();
        
        // Set up next track
        this.currentBuffer = this.nextBuffer;
        this.nextBuffer = null;
        
        const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex];
        
        try {
          // Create and configure audio source
          this.currentSource = this.audioContext.createBufferSource();
          this.currentSource.buffer = this.currentBuffer;
          this.currentSource.connect(this.gainNode);

          // Set up event handlers
          this.currentSource.onended = () => {
            if (this.currentSource && this.isSourcePlaying) {
              console.log(`Track ended: ${nextTrack.title}`);
              this.handleTrackEnd();
            }
          };

          // Start playback immediately for gapless transition
          this.startTime = this.audioContext.currentTime;
          this.pausedAt = 0;
          this.isSourcePlaying = true;
          this.currentSource.start(0);

          this.updatePlaybackState({
            currentTrack: nextTrack,
            duration: this.currentBuffer.duration
          });
          
          // Start position updates
          this.updatePosition();
          
          // Preload the next track
          this.preloadNextTrack();
          
        } catch (error) {
          console.error('Error playing next track with preloaded buffer:', error);
          // Fallback to regular loading if preloaded track fails
          this.currentBuffer = null;
          this.playCurrentTrack();
        }
      } else {
        // Fallback to regular track loading
        this.currentBuffer = null;
        this.playCurrentTrack();
      }
    } else {
      // Album finished
      this.stopCurrentSource();
      this.updatePlaybackState({
        isPlaying: false,
        position: 0
      });
    }
  }

  pause() {
    if (this.isSourcePlaying && this.audioContext) {
      this.stopCurrentSource();
      
      // Calculate how much time has elapsed
      if (this.startTime > 0) {
        this.pausedAt += this.audioContext.currentTime - this.startTime;
      }
      
      this.updatePlaybackState({ isPlaying: false });
      console.log('Playback paused');
    }
  }

  resume() {
    if (!this.isSourcePlaying && this.currentBuffer && this.audioContext && this.gainNode) {
      try {
        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }

        // Create new source for resuming
        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = this.currentBuffer;
        this.currentSource.connect(this.gainNode);

        // Set up event handlers
        const currentTrack = this.playbackState.currentTrack;
        this.currentSource.onended = () => {
          if (this.currentSource && this.isSourcePlaying && currentTrack) {
            console.log(`Track ended: ${currentTrack.title}`);
            this.handleTrackEnd();
          }
        };

        // Start from where we paused
        this.startTime = this.audioContext.currentTime;
        this.isSourcePlaying = true;
        this.currentSource.start(0, this.pausedAt);
        
        this.updatePlaybackState({ isPlaying: true });
        this.updatePosition();
        
        console.log(`Playback resumed from ${this.pausedAt}s`);
      } catch (error) {
        console.error('Error resuming playback:', error);
      }
    }
  }

  stop() {
    console.log('Stopping audio playback');
    
    // Stop current source and position updates
    this.stopCurrentSource();
    
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
    this.currentBuffer = null;
    this.nextBuffer = null;
    this.pausedAt = 0;
  }

  getCurrentState(): PlaybackState {
    return { ...this.playbackState };
  }

  // Deliberately no seek or skip methods to maintain vinyl experience
}

export const audioPlayerService = new AudioPlayerService();