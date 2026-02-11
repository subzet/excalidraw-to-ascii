import { useState, useRef, useCallback } from 'react';
import { renderASCII, validateFile } from './utils/asciiRenderer';
import './App.css';

function App() {
  const [error, setError] = useState(null);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState('');
  const [hasData, setHasData] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy to clipboard');
  
  // Options state
  const [showText, setShowText] = useState(true);
  const [doubleLines, setDoubleLines] = useState(false);
  const [scale, setScale] = useState(1);
  
  const fileInputRef = useRef(null);
  const currentDataRef = useRef(null);

  const processData = useCallback((data) => {
    currentDataRef.current = data;
    const result = renderASCII(data, { showText, doubleLines, scale });
    setOutput(result.ascii);
    setStats(result.stats);
    setHasData(true);
  }, [showText, doubleLines, scale]);

  const processFile = useCallback((file) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setHasData(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        processData(data);
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setHasData(false);
      }
    };
    reader.readAsText(file);
  }, [processData]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => {
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback('Copy to clipboard'), 1500);
    });
  }, [output]);

  // Re-render when options change
  const handleOptionChange = useCallback(() => {
    if (currentDataRef.current) {
      const result = renderASCII(currentDataRef.current, { showText, doubleLines, scale });
      setOutput(result.ascii);
      setStats(result.stats);
    }
  }, [showText, doubleLines, scale]);

  return (
    <div className="container">
      <h1>🎨 Excalidraw → ASCII</h1>
      <p className="subtitle">Convert your wireframes to ASCII art for AI prompts</p>

      {error && <div className="error">{error}</div>}

      <div 
        className={`dropzone ${isDragOver ? 'dragover' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="dropzone-icon">📁</div>
        <div className="dropzone-text">
          <strong>Drop your .excalidraw file here</strong><br />
          or click to browse
        </div>
      </div>
      
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".excalidraw,.json"
        onChange={handleFileChange}
      />

      {hasData && (
        <div className="output-section">
          <div className="options">
            <div className="option">
              <input 
                type="checkbox" 
                id="showText" 
                checked={showText}
                onChange={(e) => {
                  setShowText(e.target.checked);
                  handleOptionChange();
                }}
              />
              <label htmlFor="showText">Include text labels</label>
            </div>
            <div className="option">
              <input 
                type="checkbox" 
                id="doubleLines"
                checked={doubleLines}
                onChange={(e) => {
                  setDoubleLines(e.target.checked);
                  handleOptionChange();
                }}
              />
              <label htmlFor="doubleLines">Double-line borders</label>
            </div>
            <div className="option">
              <label htmlFor="scale">Scale:</label>
              <input 
                type="number" 
                id="scale"
                value={scale}
                min={0.1}
                max={3}
                step={0.1}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 1;
                  setScale(value);
                }}
                onBlur={handleOptionChange}
              />
            </div>
          </div>

          <div className="section-header">
            <span className="section-title">ASCII Output</span>
            <button className="btn btn-primary" onClick={handleCopy}>
              {copyFeedback}
            </button>
          </div>
          
          <div className="output-container">
            <pre>{output}</pre>
          </div>
          
          <div className="stats">{stats}</div>
        </div>
      )}
    </div>
  );
}

export default App