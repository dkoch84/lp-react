import React, { useRef } from 'react';
import './FileUploader.css';

interface FileUploaderProps {
  onFilesSelected: (files: FileList) => void;
  isLoading: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-uploader">
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".flac,.mp3,.wav,.ogg,.m4a"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processing audio files...</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="vinyl-icon">♪</div>
            <h3>Add Music to Your Collection</h3>
            <p>Drag and drop FLAC files here or click to browse</p>
            <p className="supported-formats">
              Supported formats: FLAC, MP3, WAV, OGG, M4A
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;