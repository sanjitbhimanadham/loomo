/**
 * Task state management hook
 * Manages the state of an ongoing task including steps, screenshots, and progress
 */

import { useState, useCallback, useRef } from 'react';

export function useTaskState() {
  const [state, setState] = useState({
    isActive: false,
    taskGoal: null,
    currentStep: null,
    stepIndex: 0,
    previousScreenshot: null,
    currentScreenshot: null,
    isProcessing: false,
    isComplete: false,
    error: null,
    history: []
  });

  const streamRef = useRef(null);
  const pipWindowRef = useRef(null);
  const changeDetectorRef = useRef(null);

  /**
   * Start a new task
   */
  const startTask = useCallback((goal, initialScreenshot, stream, pipWindow) => {
    console.log('🎯 Starting task:', goal);
    
    streamRef.current = stream;
    pipWindowRef.current = pipWindow;
    
    setState({
      isActive: true,
      taskGoal: goal,
      currentStep: null,
      stepIndex: 0,
      previousScreenshot: initialScreenshot,
      currentScreenshot: initialScreenshot,
      isProcessing: true,
      isComplete: false,
      error: null,
      history: []
    });
  }, []);

  /**
   * Update to next step
   */
  const updateStep = useCallback((instruction, screenshot = null) => {
    setState(prev => {
      const newStepIndex = prev.currentStep === null ? 1 : prev.stepIndex + 1;
      return {
        ...prev,
        currentStep: instruction,
        stepIndex: newStepIndex,
        previousScreenshot: screenshot || prev.currentScreenshot,
        isProcessing: false
      };
    });
  }, []);

  /**
   * Mark current step as complete and add to history
   */
  const completeStep = useCallback((screenshot) => {
    setState(prev => ({
      ...prev,
      history: [...prev.history, prev.currentStep],
      previousScreenshot: screenshot,
      currentScreenshot: screenshot,
      isProcessing: true
    }));
  }, []);

  /**
   * Update screenshot
   */
  const updateScreenshot = useCallback((screenshot) => {
    setState(prev => ({
      ...prev,
      currentScreenshot: screenshot
    }));
  }, []);

  /**
   * Set processing state
   */
  const setProcessing = useCallback((isProcessing) => {
    setState(prev => ({
      ...prev,
      isProcessing
    }));
  }, []);

  /**
   * Mark task as complete
   */
  const completeTask = useCallback(() => {
    console.log('✅ Task complete!');
    
    setState(prev => ({
      ...prev,
      isComplete: true,
      isProcessing: false
    }));

    // Stop change detection if running
    if (changeDetectorRef.current) {
      changeDetectorRef.current.stop();
      changeDetectorRef.current = null;
    }
  }, []);

  /**
   * Set error state
   */
  const setError = useCallback((error) => {
    console.error('❌ Task error:', error);
    
    setState(prev => ({
      ...prev,
      error: error.message || String(error),
      isProcessing: false
    }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  /**
   * Reset task state
   */
  const reset = useCallback(() => {
    console.log('🔄 Resetting task state');
    
    // Stop change detection
    if (changeDetectorRef.current) {
      changeDetectorRef.current.stop();
      changeDetectorRef.current = null;
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close PiP window
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }

    setState({
      isActive: false,
      taskGoal: null,
      currentStep: null,
      stepIndex: 0,
      previousScreenshot: null,
      currentScreenshot: null,
      isProcessing: false,
      isComplete: false,
      error: null,
      history: []
    });
  }, []);

  /**
   * Store change detector reference
   */
  const setChangeDetector = useCallback((detector) => {
    changeDetectorRef.current = detector;
  }, []);

  return {
    // State
    ...state,
    
    // Refs
    stream: streamRef.current,
    pipWindow: pipWindowRef.current,
    changeDetector: changeDetectorRef.current,
    
    // Actions
    startTask,
    updateStep,
    completeStep,
    updateScreenshot,
    setProcessing,
    completeTask,
    setError,
    clearError,
    reset,
    setChangeDetector
  };
}
