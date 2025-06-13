// Mock for music-metadata module
export const parseBlob = jest.fn().mockResolvedValue({
  common: {
    title: 'Mock Title',
    artist: 'Mock Artist',
    album: 'Mock Album',
    track: { no: 1 },
    picture: null
  },
  format: {
    duration: 180
  }
});