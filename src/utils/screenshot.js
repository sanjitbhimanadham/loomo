export async function captureScreenshot(stream, quality = 0.75) {
  return new Promise((resolve, reject) => {
    try {
      if (!stream || !stream.active) {
        reject(new Error('Stream is not active'));
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        reject(new Error('Video track is not live'));
        return;
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      const timeout = setTimeout(() => {
        video.srcObject = null;
        reject(new Error('Screenshot capture timed out'));
      }, 5000);

      const captureFrame = () => {
        try {
          clearTimeout(timeout);

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          if (canvas.width === 0 || canvas.height === 0) {
            video.srcObject = null;
            reject(new Error('Invalid video dimensions'));
            return;
          }

          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          let finalWidth = canvas.width;
          let finalHeight = canvas.height;

          if (canvas.width > 1920) {
            const scale = 1920 / canvas.width;
            finalWidth = 1920;
            finalHeight = Math.floor(canvas.height * scale);

            const resizedCanvas = document.createElement('canvas');
            resizedCanvas.width = finalWidth;
            resizedCanvas.height = finalHeight;
            const resizedCtx = resizedCanvas.getContext('2d');
            resizedCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight);

            const dataUrl = resizedCanvas.toDataURL('image/jpeg', quality);
            video.srcObject = null;
            resolve(dataUrl);
          } else {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            video.srcObject = null;
            resolve(dataUrl);
          }
        } catch (error) {
          clearTimeout(timeout);
          video.srcObject = null;
          reject(error);
        }
      };

      video.onloadeddata = () => {
        requestAnimationFrame(() => {
          setTimeout(captureFrame, 50);
        });
      };

      video.onerror = (error) => {
        clearTimeout(timeout);
        console.error('📸 Video error:', error);
        video.srcObject = null;
        reject(error);
      };

      // Start playing
      video.play().catch((error) => {
        clearTimeout(timeout);
        console.error('📸 Failed to play video:', error);
        video.srcObject = null;
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function captureScreenshotHidingPip(stream, pipWindow, quality = 0.75) {
  const wasVisible = pipWindow && !pipWindow.closed;
  let originalLeft, originalTop;
  
  if (wasVisible) {
    try {
      originalLeft = pipWindow.screenLeft || pipWindow.screenX;
      originalTop = pipWindow.screenTop || pipWindow.screenY;
      
      pipWindow.moveTo(-10000, -10000);
    } catch (error) {
      console.warn('Could not move PiP window:', error);
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const screenshot = await captureScreenshot(stream, quality);
    return screenshot;
  } finally {
    if (wasVisible && originalLeft !== undefined && originalTop !== undefined) {
      try {
        pipWindow.moveTo(originalLeft, originalTop);
      } catch (error) {
        console.warn('Could not restore PiP window position:', error);
      }
    }
  }
}

/**
 * Create a cropped version of screenshot focused on a specific area using bounding box
 * Uses wide aspect ratio to ensure element is always visible when displayed with objectFit:cover
 * @param {string} screenshotDataUrl - Base64 encoded screenshot
 * @param {Object} boundingBox - Bounding box with {x, y, width, height}
 * @param {number} minCropPercent - Minimum crop width as percentage of screen (default 60%)
 * @returns {Promise<{dataUrl: string, elementPositionPercent: {x: number, y: number}}>} - Cropped screenshot and element position
 */
export async function cropScreenshotWithBoundingBox(screenshotDataUrl, boundingBox, minCropPercent = 60) {
  return new Promise((resolve, reject) => {
    try {
      if (!boundingBox || typeof boundingBox.x !== 'number') {
        reject(new Error('Invalid bounding box'));
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Calculate element center point
          const elementCenterX = boundingBox.x + boundingBox.width / 2;
          const elementCenterY = boundingBox.y + boundingBox.height / 2;

          // Use wide aspect ratio (3:1) to match PIP display with objectFit:cover
          // This ensures the element stays visible when height is cropped
          const displayAspectRatio = 3; // width:height ratio

          // Calculate minimum crop width based on screen percentage (wider for better context)
          const minCropWidth = Math.floor(img.width * (minCropPercent / 100));

          // Add padding around the element
          const elementPadding = Math.max(boundingBox.width, boundingBox.height) * 3;
          const cropWidth = Math.max(minCropWidth, boundingBox.width + elementPadding);

          // Calculate height based on aspect ratio - this ensures element stays in frame
          // when displayed with objectFit:cover at 150px height
          const cropHeight = Math.floor(cropWidth / displayAspectRatio);

          // Center the crop on the element
          let cropX = Math.floor(elementCenterX - cropWidth / 2);
          let cropY = Math.floor(elementCenterY - cropHeight / 2);

          // Ensure crop stays within image bounds
          cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
          cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));

          // Adjust crop size if it would exceed image bounds
          const finalCropWidth = Math.min(cropWidth, img.width - cropX);
          const finalCropHeight = Math.min(cropHeight, img.height - cropY);

          // Calculate element's position within the cropped image (as percentage)
          // This is used for objectPosition in the PIP display
          const elementXInCrop = elementCenterX - cropX;
          const elementYInCrop = elementCenterY - cropY;
          const elementPositionPercent = {
            x: Math.round((elementXInCrop / finalCropWidth) * 100),
            y: Math.round((elementYInCrop / finalCropHeight) * 100)
          };

          // Set canvas to cropped size
          canvas.width = finalCropWidth;
          canvas.height = finalCropHeight;

          // Draw cropped image
          ctx.drawImage(
            img,
            cropX, cropY, finalCropWidth, finalCropHeight,  // Source rectangle
            0, 0, finalCropWidth, finalCropHeight            // Destination rectangle
          );

          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            elementPositionPercent
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = screenshotDataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw a red arrow on the screenshot pointing to a target location
 * @param {string} screenshotDataUrl - Base64 encoded screenshot
 * @param {Object} boundingBox - Bounding box with {x, y, width, height} of target element
 * @param {string} location - Location hint: 'top-left', 'top-right', 'center', etc.
 * @returns {Promise<string>} - Screenshot with arrow data URL
 */
export async function addArrowToScreenshot(screenshotDataUrl, boundingBox, location = 'center') {
  return new Promise((resolve, reject) => {
    try {
      if (!screenshotDataUrl) {
        reject(new Error('No screenshot provided'));
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;

          // Draw original image
          ctx.drawImage(img, 0, 0);

          // Calculate target point (center of bounding box or location-based)
          let targetX, targetY;

          if (boundingBox && typeof boundingBox.x === 'number') {
            targetX = boundingBox.x + boundingBox.width / 2;
            targetY = boundingBox.y + boundingBox.height / 2;
          } else {
            // Fallback to location-based positioning
            const margin = Math.min(img.width, img.height) * 0.1;
            switch (location) {
              case 'top-left':
                targetX = margin;
                targetY = margin;
                break;
              case 'top-right':
                targetX = img.width - margin;
                targetY = margin;
                break;
              case 'bottom-left':
                targetX = margin;
                targetY = img.height - margin;
                break;
              case 'bottom-right':
                targetX = img.width - margin;
                targetY = img.height - margin;
                break;
              case 'top':
                targetX = img.width / 2;
                targetY = margin;
                break;
              case 'bottom':
                targetX = img.width / 2;
                targetY = img.height - margin;
                break;
              case 'left':
                targetX = margin;
                targetY = img.height / 2;
                break;
              case 'right':
                targetX = img.width - margin;
                targetY = img.height / 2;
                break;
              default:
                targetX = img.width / 2;
                targetY = img.height / 2;
            }
          }

          // Calculate arrow start point (offset from target)
          const arrowLength = Math.min(img.width, img.height) * 0.12;
          const angle = Math.PI / 4; // 45 degrees - coming from top-right
          
          // Adjust angle based on target position to keep arrow visible
          let adjustedAngle = angle;
          if (targetX > img.width * 0.7) adjustedAngle = Math.PI * 0.75; // from top-left
          if (targetY > img.height * 0.7) adjustedAngle = -Math.PI / 4; // from bottom

          const startX = targetX + Math.cos(adjustedAngle) * arrowLength;
          const startY = targetY - Math.sin(adjustedAngle) * arrowLength;

          // Draw arrow line
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = Math.max(3, img.width / 200);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Draw arrowhead
          const headLength = arrowLength * 0.3;
          const headAngle = Math.PI / 6; // 30 degrees

          const lineAngle = Math.atan2(targetY - startY, targetX - startX);

          ctx.beginPath();
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(
            targetX - headLength * Math.cos(lineAngle - headAngle),
            targetY - headLength * Math.sin(lineAngle - headAngle)
          );
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(
            targetX - headLength * Math.cos(lineAngle + headAngle),
            targetY - headLength * Math.sin(lineAngle + headAngle)
          );
          ctx.stroke();

          // Add a small circle at target point
          ctx.fillStyle = '#FF0000';
          ctx.beginPath();
          ctx.arc(targetX, targetY, Math.max(4, img.width / 150), 0, Math.PI * 2);
          ctx.fill();

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = screenshotDataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a cropped version of screenshot focused on a specific area
 * This makes the PIP display more focused on where the user needs to interact
 * @param {string} screenshotDataUrl - Base64 encoded screenshot
 * @param {string} instruction - The instruction text (used to determine crop location)
 * @param {number} cropPercent - Size of crop area as percentage of screen (default 50%)
 * @returns {Promise<string|null>} - Cropped screenshot data URL, or null if location can't be determined
 */
export async function cropScreenshotCenter(screenshotDataUrl, instruction = '', cropPercent = 50) {
  return new Promise((resolve, reject) => {
    try {
      // Determine crop location from instruction
      const location = typeof instruction === 'string'
        ? extractLocationFromInstruction(instruction)
        : 'center';

      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Calculate crop dimensions (show cropPercent of the screen)
          const cropWidth = Math.floor(img.width * (cropPercent / 100));
          const cropHeight = Math.floor(img.height * (cropPercent / 100));

          // Calculate starting position based on location
          let cropX, cropY;

          switch (location) {
            case 'top-left':
              cropX = 0;
              cropY = 0;
              break;
            case 'top-right':
              cropX = img.width - cropWidth;
              cropY = 0;
              break;
            case 'bottom-left':
              cropX = 0;
              cropY = img.height - cropHeight;
              break;
            case 'bottom-right':
              cropX = img.width - cropWidth;
              cropY = img.height - cropHeight;
              break;
            case 'top':
              cropX = Math.floor((img.width - cropWidth) / 2);
              cropY = 0;
              break;
            case 'bottom':
              cropX = Math.floor((img.width - cropWidth) / 2);
              cropY = img.height - cropHeight;
              break;
            case 'left':
              cropX = 0;
              cropY = Math.floor((img.height - cropHeight) / 2);
              break;
            case 'right':
              cropX = img.width - cropWidth;
              cropY = Math.floor((img.height - cropHeight) / 2);
              break;
            default:
              resolve(null);
              return;
          }

          canvas.width = cropWidth;
          canvas.height = cropHeight;

          ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,  // Source rectangle
            0, 0, cropWidth, cropHeight            // Destination rectangle
          );

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = screenshotDataUrl;
    } catch (error) {
      reject(error);
    }
  });
}
