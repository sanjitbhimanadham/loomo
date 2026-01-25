import { generateInstruction, checkTaskCompletion, verifyStepCompletion, detectElementBoundingBox } from './openrouter.js';
import { captureScreenshotHidingPip, cropScreenshotWithBoundingBox } from '../utils/screenshot.js';
import { updatePipWithStep, showPipCompletion, showPipError } from '../utils/pip.jsx';
import { useScreenShare } from '../utils/screenshare.js';

async function getCroppedScreenshot(screenshotDataUrl, instruction) {
  try {
    const boundingBox = await detectElementBoundingBox(screenshotDataUrl, instruction);

    if (boundingBox) {
      const result = await cropScreenshotWithBoundingBox(
        screenshotDataUrl,
        boundingBox,
        65
      );
      return {
        dataUrl: result.dataUrl,
        elementPosition: result.elementPositionPercent
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function handleManualStepCompletion(stream, pipWindow, taskState, currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef) {
  try {
    taskState.setProcessing(true);

    // Capture current screenshot (hide PIP for accurate capture)
    const afterScreenshot = await captureScreenshotHidingPip(stream, pipWindow);
    const beforeScreenshot = stepScreenshotRef?.current || taskState.currentScreenshot || taskState.previousScreenshot;
    const currentInstruction = currentInstructionRef?.current || taskState.currentStep;

    if (currentInstruction.toLowerCase().trim() === 'done') {
      taskState.completeTask();
      showPipCompletion(pipWindow);

      if (taskState.changeDetector) {
        taskState.changeDetector.stop();
      }

      setTimeout(() => {
        if (pipWindow && !pipWindow.closed) {
          pipWindow.close();
        }
        taskState.reset();
      }, 5000);
      return;
    }

    // Run verification and task completion check in parallel for faster response
    // When user clicks "Done", they believe step is complete, so check both simultaneously
    const currentHistory = [...(historyRef?.current || taskState.history), currentInstruction];
    
    const [wasCompleted, isTaskComplete] = await Promise.all([
      verifyStepCompletion(currentInstruction, beforeScreenshot, afterScreenshot),
      checkTaskCompletion(taskGoalRef.current, afterScreenshot, currentHistory)
    ]);

    if (!wasCompleted) {
      taskState.setProcessing(false);
      return;
    }

    if (historyRef) {
      historyRef.current = currentHistory;
    }

    taskState.completeStep(afterScreenshot);

    if (isTaskComplete) {
      taskState.completeTask();
      showPipCompletion(pipWindow);

      const screenshareStore = useScreenShare.getState();
      screenshareStore.stopChangeDetection();
      if (taskState.changeDetector) {
        taskState.changeDetector.stop();
      }

      setTimeout(() => {
        if (pipWindow && !pipWindow.closed) {
          pipWindow.close();
        }
        taskState.reset();
      }, 5000);
    } else {
      let nextInstruction = await generateInstruction(
        taskGoalRef.current,
        afterScreenshot,
        currentHistory
      );

      if (nextInstruction.toLowerCase().trim() === 'done') {
        taskState.completeTask();
        showPipCompletion(pipWindow);
        
        const screenshareStore = useScreenShare.getState();
        screenshareStore.stopChangeDetection();
        if (taskState.changeDetector) {
          taskState.changeDetector.stop();
        }
        
        setTimeout(() => {
          if (pipWindow && !pipWindow.closed) {
            pipWindow.close();
          }
          taskState.reset();
        }, 5000);
        return;
      }

      // Update the refs with the new instruction and screenshot
      if (currentInstructionRef) {
        currentInstructionRef.current = nextInstruction;
      }
      if (stepScreenshotRef) {
        stepScreenshotRef.current = afterScreenshot;
      }

      const newStepNumber = currentHistory.length + 1;
      taskState.updateStep(nextInstruction, afterScreenshot);

      const cropResult = await getCroppedScreenshot(afterScreenshot, nextInstruction);
      updatePipWithStep(
        pipWindow,
        nextInstruction,
        newStepNumber,
        '?',
        cropResult?.dataUrl || null,
        () => handleManualStepCompletion(stream, pipWindow, taskState, currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef),
        currentHistory,
        true,
        cropResult?.elementPosition || null
      );
    }
  } catch (error) {
    console.error('Error in manual step completion:', error);
    taskState.setError(error);
    showPipError(pipWindow, error.message);
    taskState.setProcessing(false);
  }
}

export async function startTaskFlow(taskGoal, initialScreenshot, stream, pipWindow, taskState) {
  try {
    taskState.setProcessing(true);

    let firstInstruction = await generateInstruction(taskGoal, initialScreenshot, []);

    if (firstInstruction.toLowerCase().trim() === 'done') {
      firstInstruction = await generateInstruction(
        taskGoal,
        initialScreenshot,
        ['AI incorrectly said task was done before any steps were taken']
      );
    }

    taskState.updateStep(firstInstruction, initialScreenshot);

    const { currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef } = startProgressMonitoring(stream, pipWindow, taskState, firstInstruction, taskGoal);

    const cropResult = await getCroppedScreenshot(initialScreenshot, firstInstruction);
    updatePipWithStep(
      pipWindow,
      firstInstruction,
      1,
      '?',
      cropResult?.dataUrl || null,
      () => handleManualStepCompletion(stream, pipWindow, taskState, currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef),
      [],
      true,
      cropResult?.elementPosition || null
    );

  } catch (error) {
    console.error('Error starting task flow:', error);
    taskState.setError(error);
    showPipError(pipWindow, error.message);
  }
}

function startProgressMonitoring(stream, pipWindow, taskState, initialInstruction, taskGoal) {
  const currentInstructionRef = { current: initialInstruction };
  const historyRef = { current: [] };
  const taskGoalRef = { current: taskGoal };

  const screenshareStore = useScreenShare.getState();
  
  screenshareStore.setPipDetailsGetter(() => {
    if (!pipWindow || pipWindow.closed) return null;
    try {
      return {
        x: pipWindow.screenX,
        y: pipWindow.screenY,
        width: pipWindow.outerWidth,
        height: pipWindow.outerHeight,
        isActive: true,
        isVisible: true
      };
    } catch {
      return null;
    }
  });

  // Store the "before" screenshot for the current step - only update when moving to a new step
  // This prevents the screenshot from changing during verification failures
  const stepScreenshotRef = { current: taskState.currentScreenshot || taskState.previousScreenshot };

  screenshareStore.startChangeDetection(
    async (scaledImageDataUrl, nonScaledImageDataUrl) => {
      try {
        const afterScreenshot = scaledImageDataUrl;
        const beforeScreenshot = stepScreenshotRef.current;
        const currentHistory = [...historyRef.current, currentInstructionRef.current];

        // Run verification and task completion check in parallel for faster response
        const [wasCompleted, isTaskComplete] = await Promise.all([
          verifyStepCompletion(currentInstructionRef.current, beforeScreenshot, afterScreenshot),
          checkTaskCompletion(taskGoalRef.current, afterScreenshot, currentHistory)
        ]);

        if (!wasCompleted) {
          return;
        }

        historyRef.current = currentHistory;
        taskState.completeStep(afterScreenshot);

        if (isTaskComplete) {
          taskState.completeTask();
          showPipCompletion(pipWindow);
          screenshareStore.stopChangeDetection();

          // Auto-close after celebration
          setTimeout(() => {
            if (pipWindow && !pipWindow.closed) {
              pipWindow.close();
            }
            taskState.reset();
          }, 5000);
        } else {
          let nextInstruction = await generateInstruction(
            taskGoalRef.current,
            afterScreenshot,
            historyRef.current
          );

          if (nextInstruction.toLowerCase().trim() === 'done') {
            taskState.completeTask();
            showPipCompletion(pipWindow);
            screenshareStore.stopChangeDetection();
            setTimeout(() => {
              if (pipWindow && !pipWindow.closed) {
                pipWindow.close();
              }
              taskState.reset();
            }, 5000);
            return;
          }

          // Update the refs with the new instruction and screenshot
          currentInstructionRef.current = nextInstruction;
        stepScreenshotRef.current = afterScreenshot;

          const newStepNumber = historyRef.current.length + 1;
          taskState.updateStep(nextInstruction, afterScreenshot);

          const cropResult = await getCroppedScreenshot(afterScreenshot, nextInstruction);
          updatePipWithStep(
            pipWindow,
            nextInstruction,
            newStepNumber,
            '?',
            cropResult?.dataUrl || null,
            () => handleManualStepCompletion(stream, pipWindow, taskState, currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef),
            historyRef.current,
            true,
            cropResult?.elementPosition || null
          );
        }
      } catch (error) {
        console.error('Error in progress monitoring:', error);
        taskState.setError(error);
        showPipError(pipWindow, error.message);
        taskState.setProcessing(false);
      }
    },
    {
      threshold: 0.8,
      checkIntervalMs: 1500,
      scaleFactor: 0.2,
      captureDelayMs: 200
    }
  );

  const detector = {
    stop: () => screenshareStore.stopChangeDetection()
  };
  taskState.setChangeDetector(detector);

  return { currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef };
}

export async function retryCurrentStep(pipWindow, taskState) {
  if (!taskState.isActive) return;

  try {
    taskState.setProcessing(true);
    taskState.clearError();

    const screenshot = taskState.currentScreenshot || taskState.previousScreenshot;
    const instruction = await generateInstruction(
      taskState.taskGoal,
      screenshot,
      taskState.history
    );

    // Calculate step number before updating state
    const stepNumber = taskState.history.length + 1;
    taskState.updateStep(instruction, screenshot);
    const stream = taskState.stream;

    const currentInstructionRef = { current: instruction };
    const historyRef = { current: [...taskState.history] };
    const taskGoalRef = { current: taskState.taskGoal };
    const stepScreenshotRef = { current: screenshot };

    const cropResult = await getCroppedScreenshot(screenshot, instruction);
    updatePipWithStep(
      pipWindow,
      instruction,
      stepNumber,
      '?',
      cropResult?.dataUrl || null,
      () => handleManualStepCompletion(stream, pipWindow, taskState, currentInstructionRef, historyRef, taskGoalRef, stepScreenshotRef),
      taskState.history,
      true,
      cropResult?.elementPosition || null
    );

  } catch (error) {
    console.error('Error retrying step:', error);
    taskState.setError(error);
    showPipError(pipWindow, error.message);
  }
}
