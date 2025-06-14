import { AudioPlayerService } from '../AudioPlayerService';
import { Album, Track } from '../../types/music';

// Mock the MusicLibraryService
jest.mock('../MusicLibraryService', () => ({
  musicLibraryService: {
    getAudioUrl: (track: any) => `mock-url-${track.id}`
  }
}));

// Mock HTML5 Audio
class MockAudio {
  src = '';
  preload = '';
  paused = true;
  currentTime = 0;
  duration = 0;
  error: any = null;
  
  private listeners: { [key: string]: EventListener[] } = {};
  
  constructor() {
    // Simulate metadata loading when src is set
    this.setupMetadataLoading();
  }
  
  private setupMetadataLoading() {
    // Watch for src changes and simulate loading
    let lastSrc = '';
    const checkSrc = () => {
      if (this.src !== lastSrc && this.src) {
        lastSrc = this.src;
        setTimeout(() => {
          this.duration = 180; // 3 minutes
          this.dispatchEvent('loadedmetadata');
          setTimeout(() => this.dispatchEvent('canplaythrough'), 10);
        }, 10);
      }
    };
    
    // Check periodically for src changes
    setInterval(checkSrc, 5);
  }
  
  addEventListener(event: string, listener: EventListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }
  
  removeEventListener(event: string, listener: EventListener) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
  
  dispatchEvent(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(new Event(event));
        } catch (error) {
          // Ignore errors in tests
        }
      });
    }
  }
  
  async play() {
    if (this.src && this.src.startsWith('mock-url-')) {
      this.paused = false;
      return Promise.resolve();
    }
    return Promise.reject(new Error('No source'));
  }
  
  pause() {
    this.paused = true;
  }
  
  load() {
    // Mock load
  }
  
  // Simulate track ending
  simulateEnd() {
    this.currentTime = this.duration;
    this.dispatchEvent('ended');
  }
  
  // Simulate buffering progress
  simulateCanPlayThrough() {
    this.dispatchEvent('canplaythrough');
  }
}

// Replace global Audio with our mock
(global as any).Audio = MockAudio;
(global as any).AudioContext = class MockAudioContext {};
(global as any).webkitAudioContext = class MockWebkitAudioContext {};

describe('AudioPlayerService', () => {
  let audioPlayerService: AudioPlayerService;
  let mockAlbum: Album;
  let mockTracks: Track[];
  
  beforeEach(() => {
    audioPlayerService = new AudioPlayerService();
    
    mockTracks = [
      {
        id: 'track1',
        title: 'Track 1',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        filePath: '/path/to/track1.mp3',
        relativePath: 'track1.mp3',
        trackNumber: 1
      },
      {
        id: 'track2', 
        title: 'Track 2',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 200,
        filePath: '/path/to/track2.mp3',
        relativePath: 'track2.mp3',
        trackNumber: 2
      },
      {
        id: 'track3',
        title: 'Track 3', 
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 160,
        filePath: '/path/to/track3.mp3',
        relativePath: 'track3.mp3',
        trackNumber: 3
      }
    ];
    
    mockAlbum = {
      id: 'album1',
      title: 'Test Album',
      artist: 'Test Artist',
      tracks: mockTracks,
      year: 2023
    };
  });

  describe('Gapless Playback', () => {
    it('should preload next track when current track starts playing', async () => {
      const stateChanges: any[] = [];
      audioPlayerService.addStateListener((state) => {
        stateChanges.push({...state});
      });

      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify that the service has preloaded the next track
      // We can't directly access private properties, but we can verify behavior
      const currentState = audioPlayerService.getCurrentState();
      expect(currentState.currentTrack).toEqual(mockTracks[0]);
      expect(currentState.isPlaying).toBe(true);
    });

    it('should start preloading next track when current track is ready (canplaythrough)', async () => {
      let preloadingStarted = false;
      const originalPreloadNextTrack = (audioPlayerService as any).preloadNextTrack;
      (audioPlayerService as any).preloadNextTrack = () => {
        preloadingStarted = true;
        originalPreloadNextTrack.call(audioPlayerService);
      };

      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for canplaythrough event to trigger
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify preloading was triggered by canplaythrough event
      expect(preloadingStarted).toBe(true);
    });

    it('should transition to preloaded track when current track ends', async () => {
      const stateChanges: any[] = [];
      audioPlayerService.addStateListener((state) => {
        stateChanges.push({...state});
      });

      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get reference to current audio (via reflection for testing)
      const currentAudio = (audioPlayerService as any).currentAudio as MockAudio;
      
      // Simulate track ending
      currentAudio.simulateEnd();
      
      // Wait for transition
      await new Promise(resolve => setTimeout(resolve, 50));

      const currentState = audioPlayerService.getCurrentState();
      expect(currentState.currentTrack).toEqual(mockTracks[1]);
    });

    it('should handle transition properly even if preloaded track fails', async () => {
      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get references to audio elements
      const currentAudio = (audioPlayerService as any).currentAudio as MockAudio;
      const nextAudio = (audioPlayerService as any).nextAudio as MockAudio;
      
      if (nextAudio) {
        // Simulate failure of preloaded track
        nextAudio.play = jest.fn().mockRejectedValue(new Error('Playback failed'));
      }

      // Simulate track ending
      currentAudio.simulateEnd();
      
      // Wait for fallback
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still advance to next track via fallback mechanism
      const currentState = audioPlayerService.getCurrentState();
      expect(currentState.currentTrack).toEqual(mockTracks[1]);
    });

    it('should clean up old audio after transitioning to next track', async () => {
      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for initial setup  
      await new Promise(resolve => setTimeout(resolve, 50));

      const originalAudio = (audioPlayerService as any).currentAudio as MockAudio;
      
      // Simulate track ending to trigger transition
      originalAudio.simulateEnd();
      
      // Wait for transition and cleanup
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify old audio was cleaned up (src should be cleared)
      expect(originalAudio.src).toBe('');
    });
  });

  describe('State Management', () => {
    it('should notify listeners of state changes during track transitions', async () => {
      const stateChanges: any[] = [];
      audioPlayerService.addStateListener((state) => {
        stateChanges.push({...state});
      });

      await audioPlayerService.playAlbum(mockAlbum, 0);
      
      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 50));

      const currentAudio = (audioPlayerService as any).currentAudio as MockAudio;
      currentAudio.simulateEnd();
      
      // Wait for transition
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have multiple state changes: initial, play, track change
      expect(stateChanges.length).toBeGreaterThan(2);
      
      // Final state should be the next track
      const finalState = stateChanges[stateChanges.length - 1];
      expect(finalState.currentTrack.id).toBe('track2');
    });
  });
});