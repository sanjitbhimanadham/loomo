/**
 * Task Progress Component
 * Visual feedback for task status in the main UI
 */

import React from 'react';

export function TaskProgress({ taskState, onRetry, onCancel }) {
  const { 
    isActive, 
    taskGoal, 
    currentStep, 
    stepIndex, 
    isProcessing, 
    isComplete, 
    error 
  } = taskState;

  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'white',
      border: '1px solid #D0D0D0',
      borderRadius: '16px',
      boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
      padding: '16px 24px',
      maxWidth: '500px',
      width: 'calc(100% - 40px)',
      zIndex: 1000,
      fontFamily: 'AscenderSansW01-Regular, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    }}>
      {/* Task Goal Header */}
      <div style={{
        fontSize: '12px',
        color: '#8F8F8F',
        marginBottom: '8px',
        textTransform: 'uppercase',
        fontWeight: '500',
        letterSpacing: '0.5px'
      }}>
        Task in Progress
      </div>

      {/* Task Goal */}
      <div style={{
        fontSize: '14px',
        color: '#1a1a1a',
        marginBottom: '12px',
        fontWeight: '500'
      }}>
        {taskGoal}
      </div>

      {/* Current Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #E0E0E0'
      }}>
        {/* Status Icon */}
        <div style={{
          fontSize: '20px',
          animation: isProcessing ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
        }}>
          {error ? '⚠️' : isComplete ? '✅' : isProcessing ? '⏳' : '👁️'}
        </div>

        {/* Status Text */}
        <div style={{ flex: 1 }}>
          {error ? (
            <div>
              <div style={{ fontSize: '13px', color: '#d32f2f', fontWeight: '500' }}>
                Error occurred
              </div>
              <div style={{ fontSize: '12px', color: '#8F8F8F', marginTop: '2px' }}>
                {error}
              </div>
            </div>
          ) : isComplete ? (
            <div style={{ fontSize: '13px', color: '#2e7d32', fontWeight: '500' }}>
              Task completed! 🎉
            </div>
          ) : isProcessing ? (
            <div style={{ fontSize: '13px', color: '#8F8F8F' }}>
              Analyzing...
            </div>
          ) : currentStep ? (
            <div>
              <div style={{ fontSize: '12px', color: '#8F8F8F', marginBottom: '2px' }}>
                Step {stepIndex}
              </div>
              <div style={{ fontSize: '13px', color: '#1a1a1a' }}>
                Watching for changes
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#8F8F8F' }}>
              Getting started...
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {error && onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '6px 12px',
                background: '#1a1a1a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Retry
            </button>
          )}
          {onCancel && !isComplete && (
            <button
              onClick={onCancel}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: '#8F8F8F',
                border: '1px solid #D0D0D0',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {!error && !isComplete && currentStep && (
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#8F8F8F',
          textAlign: 'center'
        }}>
          Follow instructions in the bottom-right window
        </div>
      )}
    </div>
  );
}
