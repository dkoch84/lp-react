import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders file upload interface', () => {
  render(<App />);
  const dragDropText = screen.getByText(/Drag and drop FLAC files here/i);
  expect(dragDropText).toBeInTheDocument();
});
