import ReactDOM from "react-dom/client";

export async function openPipWindow(initialTask) {
  try {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pipWidth = 420;
    const pipHeight = 500;
    const padding = 20;
    
    const left = screenWidth - pipWidth - padding;
    const top = screenHeight - pipHeight - padding - 100;

    if (!('documentPictureInPicture' in window)) {
      console.warn('Document Picture-in-Picture API not supported, falling back to regular window');
      return openFallbackWindow(initialTask, left, top, pipWidth, pipHeight);
    }

    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: pipWidth,
      height: pipHeight,
    });

    setupPipWindow(pipWindow, initialTask);

    return pipWindow;
  } catch (error) {
    console.error('Error opening PiP window:', error);
    return openFallbackWindow(initialTask);
  }
}

function openFallbackWindow(initialTask, left, top, width, height) {
  const fallbackWindow = window.open(
    '',
    'Loomo_Instructions',
    `width=${width || 420},height=${height || 500},left=${left || 100},top=${top || 100},resizable=yes,scrollbars=no,alwaysRaised=yes`
  );

  if (fallbackWindow) {
    setupPipWindow(fallbackWindow, initialTask);
    
    setInterval(() => {
      if (fallbackWindow && !fallbackWindow.closed && !fallbackWindow.document.hidden) {
        fallbackWindow.focus();
      }
    }, 500);
  }

  return fallbackWindow;
}

function setupPipWindow(pipWindow, initialTask) {
  const doc = pipWindow.document;

  const style = doc.createElement('style');
  style.textContent = `
    :root {
      --foreground: 0 0% 10%;
      --background: 0 0% 100%;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'AscenderSansW01-Regular', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background: white;
      padding: 0;
      overflow-y: auto;
      height: 100vh;
      line-height: 1.5;
      color: hsl(var(--foreground));
    }
    
    .pip-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }
    
    .pip-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      display: flex;
      flex-direction: column;
    }
    
    .pip-content::-webkit-scrollbar {
      width: 8px;
    }
    
    .pip-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .pip-content::-webkit-scrollbar-thumb {
      background: hsl(var(--foreground) / 0.2);
      border-radius: 4px;
    }
    
    .pip-content::-webkit-scrollbar-thumb:hover {
      background: hsl(var(--foreground) / 0.3);
    }
    
    .text-foreground\\/60 {
      color: hsl(var(--foreground) / 0.6);
    }
    
    .text-foreground\\/70 {
      color: hsl(var(--foreground) / 0.7);
    }
    
    .text-foreground\\/85 {
      color: hsl(var(--foreground) / 0.85);
    }
    
    .border-foreground\\/10 {
      border-color: hsl(var(--foreground) / 0.1);
    }
    
    .border-foreground\\/20 {
      border-color: hsl(var(--foreground) / 0.2);
    }
    
    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fade-in-pulse {
      0%, 100% {
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
    }
    
    @keyframes fade-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
    
    @keyframes border-spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    
    @keyframes confetti-fall {
      0% {
        top: -50px;
        transform: translateX(0) rotate(0deg);
        opacity: 0.7;
      }
      100% {
        top: 100%;
        transform: translateX(100px) rotate(720deg);
        opacity: 0;
      }
    }
    
    @keyframes task-completed-checkmark {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    @keyframes task-completed-collapse-pip {
      to {
        max-height: 0;
        opacity: 0;
        padding: 0;
        margin: 0;
        border: 0;
      }
    }
    
    @keyframes step-minimize {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(0.95);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    @keyframes slide-down {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes new-step-appear {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    .animate-fade-in-up {
      animation: fade-in-up 0.3s ease-out forwards;
    }
    
    .animate-fade-in-pulse {
      animation: fade-in-pulse 2s ease-in-out infinite;
    }
    
    .animate-fade-out {
      animation: fade-out 0.3s ease-out forwards;
    }
    
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .animate-task-completed-checkmark {
      animation: task-completed-checkmark 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .animate-task-completed-collapse-pip {
      animation: task-completed-collapse-pip 0.3s ease-out forwards;
      animation-delay: 1s;
    }
    
    .animate-step-minimize {
      animation: step-minimize 0.3s ease-out forwards;
    }
    
    .animate-slide-down {
      animation: slide-down 0.3s ease-out forwards;
    }
    
    .animate-new-step {
      animation: new-step-appear 0.4s ease-out forwards;
    }
    
    /* Markdown styles */
    .markdown {
      line-height: 1.6;
    }
    
    .markdown strong {
      font-weight: 600;
    }
  `;
  doc.head.appendChild(style);

  const root = doc.createElement('div');
  root.id = 'pip-root';
  doc.body.appendChild(root);

  const reactRoot = ReactDOM.createRoot(root);

  const PipContent = () => (
    <div className="pip-container">
      <div className="pip-content">
      </div>
    </div>
  );

  reactRoot.render(<PipContent />);

  pipWindow.__reactRoot = reactRoot;
}

export function updatePipWithStep(pipWindow, instruction, stepNumber, totalSteps, screenshotDataUrl = null, onDone = null, completedSteps = [], isNewStep = true, elementPosition = null) {
  if (!pipWindow || pipWindow.closed || !pipWindow.__reactRoot) {
    return false;
  }

  try {
    const deduplicatedSteps = completedSteps ? completedSteps.filter((step, index) => {
      if (index === 0) return true;
      return step !== completedSteps[index - 1];
    }) : [];
    
    const reversedCompletedSteps = [...deduplicatedSteps].reverse();

    const validScreenshot = screenshotDataUrl &&
                            screenshotDataUrl.length > 100 &&
                            screenshotDataUrl.startsWith('data:image');

    const PipContent = () => {
      return (
        <div className="pip-container">
          <div className="pip-content">
            <div style={{
              padding: '12px',
              paddingBottom: '8px',
              minHeight: 'min-content'
            }}>
              <div className={isNewStep ? 'animate-new-step' : ''} style={{
                background: 'white',
                border: '1px solid #D0D0D0',
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '8px',
                flexShrink: 0
              }}>
                <div style={{ padding: '16px', paddingBottom: '12px' }}>
                  <p style={{
                    fontSize: '16px',
                    fontFamily: 'AscenderSansW01-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    color: 'black',
                    lineHeight: '1.5',
                    margin: 0,
                    fontWeight: '400'
                  }}>
                    {instruction || 'Loading instruction...'}
                  </p>
                </div>

                {validScreenshot && (
                  <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    maxHeight: '150px',
                    cursor: 'zoom-in',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f8f8f8',
                    borderTop: '1px solid #e8e8e8'
                  }}
                  onMouseEnter={(e) => {
                    const img = e.currentTarget.querySelector('img');
                    if (img) {
                      img.style.transform = 'scale(2)';
                      img.style.transition = 'transform 0.3s ease';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const img = e.currentTarget.querySelector('img');
                    if (img) {
                      img.style.transform = 'scale(1)';
                    }
                  }}
                  onMouseMove={(e) => {
                    const img = e.currentTarget.querySelector('img');
                    if (img) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      img.style.transformOrigin = `${x}% ${y}%`;
                    }
                  }}
                  >
                    <img
                      src={screenshotDataUrl}
                      alt="Current screen"
                      style={{
                        width: '100%',
                        height: '150px',
                        display: 'block',
                        objectFit: 'cover',
                        objectPosition: elementPosition
                          ? `${elementPosition.x}% ${elementPosition.y}%`
                          : 'center center',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </div>
                )}

                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {onDone && (
                    <button
                      onClick={() => {
                        if (onDone) onDone();
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#1a1a1a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontFamily: 'AscenderSansW01-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        transition: 'all 0.2s ease',
                        transform: 'translateY(0)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#000';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0px 3px 8px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#1a1a1a';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                      onMouseDown={(e) => {
                        e.target.style.transform = 'translateY(0) scale(0.97)';
                        e.target.style.backgroundColor = '#333';
                        e.target.style.boxShadow = '0px 1px 4px rgba(0, 0, 0, 0.1)';
                        e.target.style.transition = 'all 0.05s ease';
                      }}
                      onMouseUp={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.backgroundColor = '#000';
                        e.target.style.boxShadow = '0px 3px 8px rgba(0, 0, 0, 0.15)';
                        e.target.style.transition = 'all 0.2s ease';
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>✓</span>
                      <span>Done</span>
                    </button>
                  )}
                  {!onDone && <div />}
                  <span className="animate-pulse" style={{
                    fontSize: '16px',
                    color: 'hsl(var(--foreground) / 0.4)',
                    fontFamily: 'AscenderSansW01-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>
                    Detecting Changes
                  </span>
                </div>
              </div>

              {reversedCompletedSteps.length > 0 && reversedCompletedSteps.map((step, index) => {
                const displayStepNumber = reversedCompletedSteps.length - index;
                return (
                  <div
                    key={`step-${displayStepNumber}-${step.substring(0, 20)}`}
                    style={{
                      padding: '8px 12px',
                      background: 'white',
                      border: '1px solid #D0D0D0',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '16px',
                      fontFamily: 'AscenderSansW01-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      color: 'black',
                      lineHeight: '1.5',
                      marginBottom: '10px',
                      transition: 'transform 0.3s ease, opacity 0.3s ease'
                    }}
                  >
                    <span style={{
                      color: 'black',
                      fontSize: '16px',
                      flexShrink: 0,
                      fontWeight: '400'
                    }}>{displayStepNumber}.</span>
                    <span style={{ flex: 1, color: 'black' }}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    };

    pipWindow.__reactRoot.render(<PipContent />);
    return true;
  } catch (error) {
    console.error('Error updating PiP with step:', error);
    return false;
  }
}

export function showPipCompletion(pipWindow) {
  if (!pipWindow || pipWindow.closed || !pipWindow.__reactRoot) {
    return false;
  }

  try {
    const PipContent = () => (
      <div className="pip-container">
        <div className="pip-content">
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#4F7942',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              animation: 'task-completed-checkmark 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );

    pipWindow.__reactRoot.render(<PipContent />);
    return true;
  } catch (error) {
    console.error('Error showing PiP completion:', error);
    return false;
  }
}

export function showPipError(pipWindow, errorMessage) {
  if (!pipWindow || pipWindow.closed || !pipWindow.__reactRoot) {
    return false;
  }

  try {
    const PipContent = () => (
      <div className="pip-container">
        <div className="pip-content">
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div style={{ fontSize: '20px', flexShrink: 0 }}>
                ⚠️
              </div>
              <div>
                <h2 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'hsl(var(--foreground))',
                  marginBottom: '8px'
                }}>
                  Something went wrong
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: 'hsl(var(--foreground) / 0.7)',
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  {errorMessage || 'An unexpected error occurred. Please try again.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    pipWindow.__reactRoot.render(<PipContent />);
    return true;
  } catch (error) {
    console.error('Error showing PiP error:', error);
    return false;
  }
}

export function isPipSupported() {
  return 'documentPictureInPicture' in window;
}