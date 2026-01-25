import React, { useRef, useState } from 'react';
import '../styles/chat.css';
import { openPipWindow } from '../utils/pip';
import { useTaskState } from '../hooks/useTaskState';
import { startTaskFlow, retryCurrentStep } from '../services/taskOrchestrator';
import { captureScreenshotHidingPip } from '../utils/screenshot';
import { useScreenShare } from '../utils/screenshare';

function isScreenShareSupported() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getDisplayMedia
  );
}

const Chat = () => {
  const textareaRef = useRef(null);
  const [hasText, setHasText] = useState(false);
  const [showInstructionPage, setShowInstructionPage] = useState(false);
  
  const taskState = useTaskState();
  const pipWindowRef = useRef(null);
  
  const { requestScreenShare: requestScreenShareFromStore, startSharing } = useScreenShare();

  const handleInput = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    setHasText(textarea.value.trim().length > 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const text = textareaRef.current?.value.trim();
    
    if (!text) return;
    
    if (!isScreenShareSupported()) {
      alert('Screen sharing is not supported in this browser');
      return;
    }
    
    try {
      const success = await requestScreenShareFromStore();
      
      if (!success) {
        return;
      }
      
      const stream = useScreenShare.getState().stream;
      
      setShowInstructionPage(true);
      
      const pipWindow = await openPipWindow(text);
      pipWindowRef.current = pipWindow;
      
      // Wait for screen sharing popup to disappear before capturing
      console.log('⏳ Waiting for screen sharing popup to disappear...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Capture initial screenshot (hiding PiP)
      console.log('📸 Capturing initial screenshot...');
      const initialScreenshot = await captureScreenshotHidingPip(stream, pipWindow);
      
      taskState.startTask(text, initialScreenshot, stream, pipWindow);
      
      await startTaskFlow(text, initialScreenshot, stream, pipWindow, taskState);
      
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
        setHasText(false);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      taskState.setError(error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleExampleClick = (exampleText) => {
    if (textareaRef.current) {
      textareaRef.current.value = exampleText;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      setHasText(true);
    }
  };

  const handleCancel = () => {
    taskState.reset();
    setShowInstructionPage(false);
  };

  return (
    <>
      {showInstructionPage ? (
        <div className="instruction-page">
          <div className="version-label">Loomo v1.0</div>
          
          <div className="instruction-content">
            <p className="instruction-text">
              Follow the steps at the bottom right of your screen.
            </p>
          </div>
        </div>
      ) : (
        <div className="chat-page">
          <div className="version-label">Loomo v1.0</div>
          
          <div className="content-container">
            <div className="upper-content">
              <h1 className="tagline">Guiding you through every click</h1>
              
              <div className="examples-container">
                <div className="button-row">
                  <button
                    className="example-button"
                    onClick={() => handleExampleClick('Update macOS')}
                  >
                    Update macOS
                  </button>
                  <button
                    className="example-button"
                    onClick={() => handleExampleClick('Enable Mac "Dark Mode"')}
                  >
                    Enable Mac "Dark Mode"
                  </button>
                </div>
                <button
                  className="example-button"
                  onClick={() => handleExampleClick('Export a PowerPoint presentation as a PDF')}
                >
                  Export a PowerPoint presentation as a PDF
                </button>
              </div>
            </div>
            
            <div className="prompt-container">
              <div className="prompt-wrapper">
                <textarea
                  ref={textareaRef}
                  className="prompt-input"
                  placeholder="Where should we start?"
                  rows="1"
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className={`send-button ${hasText ? 'has-text' : ''}`}
                  onClick={handleSubmit}
                  aria-label="Send"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 3L8 13M8 3L4 7M8 3L12 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chat;
