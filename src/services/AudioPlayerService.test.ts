import { AudioPlayerService } from './AudioPlayerService';
import { Album, Track } from '../types/music';

// Mock the MusicLibraryService
jest.mock('./MusicLibraryService', () => ({
  musicLibraryService: {
    getAudioUrl: (track: Track) => `http://localhost:3001/api/audio/${track.relativePath}`,
  },
}));

describe('AudioPlayerService', () => {
  let audioPlayerService: AudioPlayerService;
  let mockTrack: Track;
  let mockAlbum: Album;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    audioPlayerService = new AudioPlayerService();

    mockTrack = {
      id: 'track-1',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      trackNumber: 1,
      duration: 180,
      filePath: '/path/to/track.flac',
      relativePath: 'Test Artist/Test Album/01 - Test Track.flac',
    };

    mockAlbum = {
      id: 'album-1',
      title: 'Test Album',
      artist: 'Test Artist',
      tracks: [mockTrack],
    };
  });

  afterEach(() => {
    // Clean up
    audioPlayerService.stop();
  });

  test('should initialize with correct default state', () => {
    const state = audioPlayerService.getCurrentState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTrack).toBeNull();
    expect(state.currentAlbum).toBeNull();
    expect(state.position).toBe(0);
    expect(state.duration).toBe(0);
  });

  test('should support adding and removing state listeners', () => {
    const listener = jest.fn();
    
    // Adding listener should trigger immediate notification
    audioPlayerService.addStateListener(listener);
    expect(listener).toHaveBeenCalledWith(audioPlayerService.getCurrentState());
    
    // Should be able to remove listener
    audioPlayerService.removeStateListener(listener);
    listener.mockClear();
    
    // Updating state should not trigger removed listener
    audioPlayerService.stop();
    expect(listener).not.toHaveBeenCalled();
  });

  test('should handle pause and resume', () => {
    // Test pause (should not throw even if no audio is playing)
    expect(() => audioPlayerService.pause()).not.toThrow();
    
    // Test resume (should not throw even if no audio to resume)
    expect(() => audioPlayerService.resume()).not.toThrow();
  });

  test('should handle stop gracefully', () => {
    expect(() => audioPlayerService.stop()).not.toThrow();
    
    const state = audioPlayerService.getCurrentState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTrack).toBeNull();
    expect(state.currentAlbum).toBeNull();
    expect(state.position).toBe(0);
    expect(state.duration).toBe(0);
  });

  test('should update state when album is set', async () => {
    const listener = jest.fn();
    audioPlayerService.addStateListener(listener);
    listener.mockClear(); // Clear the initial call
    
    // This will fail in the current environment because we can't actually play audio
    // But we can verify the initial state changes
    try {
      await audioPlayerService.playAlbum(mockAlbum);
    } catch (error) {
      // Expected to fail in test environment
    }
    
    // Should have been called at least once with album/track info
    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(lastCall.currentAlbum).toBe(mockAlbum);
    expect(lastCall.currentTrack).toBe(mockTrack);
  });
});