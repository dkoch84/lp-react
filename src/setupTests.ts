// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock AudioContext for testing
const mockGainNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  gain: {
    value: 1
  }
};

const mockBufferSourceNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  buffer: null,
  onended: null
};

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createOscillator: jest.fn(),
    createGain: jest.fn(() => mockGainNode),
    createBufferSource: jest.fn(() => ({ ...mockBufferSourceNode })),
    decodeAudioData: jest.fn(() => Promise.resolve({
      duration: 180,
      length: 8192,
      numberOfChannels: 2,
      sampleRate: 44100
    })),
    destination: {},
    resume: jest.fn(() => Promise.resolve()),
    currentTime: 0,
    state: 'running'
  }))
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: window.AudioContext
});

// Mock fetch for audio loading
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8192))
  })
) as jest.Mock;

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();
