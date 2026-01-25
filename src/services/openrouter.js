const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export const MODELS = {
  GPT: 'openai/gpt-5.2',
  GEMINI: 'google/gemini-3-flash-preview',
  QWEN: 'qwen/qwen3-vl-30b-a3b-instruct'
};

async function callOpenRouter(model, messages, temperature = 0.7, maxTokens = 500) {
  if (!API_KEY) {
    throw new Error('VITE_OPENROUTER_API_KEY is not configured. Please add it to your .env file.');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Loomo'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildActionPrompt(goal, osName, completedSteps = []) {
  let stepsSection = "";
  if (completedSteps && completedSteps.length > 0) {
    const stepsList = completedSteps
      .map((step, i) => `${i + 1}. ${step}`)
      .join("\n");
    stepsSection = `
# Steps Completed So Far (toward achieving: "${goal}")
${stepsList}`;
  }

  return `You are a UI navigation assistant that gives ONE instruction at a time to help the user achieve their goal.

# User's Operating System
${osName || "Unknown"}

# Goal
${goal}
${stepsSection}

# What You See
A screenshot of the user's current screen state.

# CRITICAL RULES
- The GOAL above is what the user wants to achieve. NEVER ask them what they want to do.
- NEVER ask questions. NEVER ask for clarification. Just give the next instruction.
- Your job is to guide step-by-step toward the GOAL, not to have a conversation.

# How to Decide the Next Action
1. The GOAL tells you exactly what the user wants - use it.
2. Analyze the SCREENSHOT to see the current screen state.
3. Give the next logical instruction to progress toward the GOAL.
4. If the screen shows something unexpected (error, popup), give an instruction to handle it.

# Response Rules
- Give ONE specific action that advances toward the goal
- Be precise AND include location: "Click 'Save' in the bottom right" not "Click Save"
- For navigation: Return only the URL (e.g. "https://google.com")
- If something is loading: "Wait"
- If content is off-screen: "Scroll Up" or "Scroll Down"
- If the goal is complete: "Done"
- If the screen shows an unexpected state (error, wrong page), provide an instruction to recover

# Output Format
Single instruction only (no explanations, no numbering, no bolding, no questions). If the goal is achieved, return "Done"`;
}

function buildCheckPrompt(instruction) {
  return `You are a strict task completion judge. Compare two screenshots to determine if a goal has been achieved.

Goal:
${instruction}

IMPORTANT: Both screenshots contain a small floating PIP (Picture-in-Picture) window overlay that displays task instructions. COMPLETELY IGNORE this PIP window in your comparison. Focus ONLY on the main screen content behind the PIP overlay.

Process:
1. Analyze the "before" screenshot (first image) for the initial state (ignoring the PIP window).
2. Analyze the "after" screenshot (second image) for the current state (ignoring the PIP window).
3. Determine if the goal has been completed based on the transition in the main content.

Rules:
- Return "Yes" ONLY if extremely confident the goal is completely finished and the after screenshot clearly shows the expected end state.
- Return "No" if there is ANY doubt, partial completion, no meaningful change, or a pre-action state (hover, focus, loading).

Format your response as a very concise reasoning (under 10 words), followed by "Yes" or "No" on the last line.`;
}

function buildBoundingBoxPrompt(instruction) {
  return `You are a UI element detector. Given an instruction, identify and locate the target UI element the user needs to interact with.

Instruction: "${instruction}"

Analyze the screenshot and find the element mentioned in the instruction (button, link, menu item, icon, etc.).

IMPORTANT: Ignore any floating PIP (Picture-in-Picture) overlay window - focus only on the main application content.

Return a JSON object with:
- "label": The text or description of the found element (or "none" if not found)
- "bounding_box": An object with x, y, width, height in pixels (coordinates from top-left of image)

Example response:
{"label": "Settings", "bounding_box": {"x": 150, "y": 200, "width": 80, "height": 30}}

If the element cannot be found, return:
{"label": "none", "bounding_box": null}

Return ONLY the JSON object, no other text.`;
}

function getOSName() {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'macOS';
  if (platform.includes('win')) return 'Windows';
  if (platform.includes('linux')) return 'Linux';
  return navigator.platform;
}

export async function generateInstruction(taskGoal, screenshotDataUrl, history = []) {
  const osName = getOSName();
  const systemPrompt = buildActionPrompt(taskGoal, osName, history);

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: screenshotDataUrl,
            detail: 'high'
          }
        }
      ]
    }
  ];

  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callOpenRouter(MODELS.GPT, messages, 0.3, 500);
      let instruction = response.trim();

      instruction = instruction.replace(/^\*\*(.+)\*\*$/, '$1');
      instruction = instruction.replace(/^["'](.+)["']$/, '$1');

      return instruction;
    } catch (error) {
      lastError = error;
      console.error(`Error generating instruction (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

export async function verifyStepCompletion(instruction, beforeScreenshot, afterScreenshot) {
  const systemPrompt = buildCheckPrompt(instruction);
  
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Before:'
        },
        {
          type: 'image_url',
          image_url: {
            url: beforeScreenshot,
            detail: 'high'
          }
        },
        {
          type: 'text',
          text: 'After:'
        },
        {
          type: 'image_url',
          image_url: {
            url: afterScreenshot,
            detail: 'high'
          }
        }
      ]
    }
  ];

  const maxRetries = 2;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callOpenRouter(MODELS.GEMINI, messages, 0.2, 100);
      
      const normalizedResponse = response.trim().toLowerCase();
      
      const lines = normalizedResponse.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      
      return lastLine === 'yes';
    } catch (error) {
      lastError = error;
      console.error(`Error verifying step (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  
  return false;
}

export async function checkTaskCompletion(taskGoal, screenshotDataUrl, completedSteps) {
  if (completedSteps.length < 1) {
    return false;
  }

  const stepsText = completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a task completion checker. Determine if the user's goal has been achieved.

IMPORTANT: The screenshot contains a small floating PIP window overlay. COMPLETELY IGNORE this PIP window - focus ONLY on the main screen content.

Guidelines:
- Return YES if the goal is achieved based on the screenshot AND completed steps
- For settings tasks (like "enable dark mode"): Return YES if the visual change is applied (dark theme visible)
- For configuration tasks: Return YES once the setting change is visible, don't require exiting settings
- Trust the completed steps - if they logically achieve the goal and you see visual confirmation, return YES
- Return NO only if clearly not done (e.g., still on step 1 of a multi-step process)
- Be reasonable, not overly strict`
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `TASK GOAL: ${taskGoal}

Steps completed (${completedSteps.length}):
${stepsText || 'None yet'}

Looking at the screen, has the goal "${taskGoal}" been achieved? Consider both the visual state AND the logical completion from the steps.

Respond with only: YES or NO`
        },
        {
          type: 'image_url',
          image_url: {
            url: screenshotDataUrl
          }
        }
      ]
    }
  ];

  const response = await callOpenRouter(MODELS.GPT, messages, 0.3, 50);
  return response.trim().toUpperCase() === 'YES';
}

export async function detectElementBoundingBox(screenshotDataUrl, instruction) {
  const promptText = buildBoundingBoxPrompt(instruction);
  
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: promptText
        },
        {
          type: 'image_url',
          image_url: {
            url: screenshotDataUrl,
            detail: 'high'
          }
        }
      ]
    }
  ];

  try {
    const response = await callOpenRouter(MODELS.QWEN, messages, 0.1, 200);
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in Qwen response');
      return null;
    }

    let jsonStr = jsonMatch[0];
    
    jsonStr = jsonStr.replace(
      /"x"\s*:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*}/g,
      '"x": $1, "y": $2, "width": $3, "height": $4}'
    );
    
    jsonStr = jsonStr.replace(/"x"\s*:\s*(\d+)\s*,\s*(\d+)\s*,\s*"width"/g, '"x": $1, "y": $2, "width"');
    
    const data = JSON.parse(jsonStr);
    
    if (!data.bounding_box || data.label === 'none') {
      return null;
    }

    const bbox = data.bounding_box;
    
    if (typeof bbox.x !== 'number' || typeof bbox.y !== 'number' ||
        typeof bbox.width !== 'number' || typeof bbox.height !== 'number') {
      console.warn('Invalid bounding box format:', bbox);
      return null;
    }

    return {
      label: data.label,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height
    };
  } catch (error) {
    console.error('Error detecting bounding box:', error);
    return null;
  }
}
