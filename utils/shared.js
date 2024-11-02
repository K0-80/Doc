import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { marked } from "https://esm.run/marked";

/**
 * Returns a model instance.
 *
 * @param {GoogleGenerativeAI.ModelParams} params
 * @returns {GoogleGenerativeAI.GenerativeModel}
 */
export async function getGenerativeModel(params) {
  // Fetch API key from server
  const API_KEY = "AIzaSyDq2Rl6CQ-OQu12PQB0_RPKt_lyzY0Wz1s";

  // const API_KEY = await (await fetch("API_KEY")).text(); so hi if ur looking at this leave my api key alone ty <3 am too imcoptent to set up backend auith thing

  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const model = genAI.getGenerativeModel({
    ...params,
    systemInstruction: "You are an experienced educator tasked with evaluating student assignments according to a provided rubric. When assessing essays or extensive written work, your role is to:\n- Identify areas that require improvement\n- Provide specific examples of how to enhance each section\n- Present your feedback in a structured table format\n\nPlease use the following table structure for your assessment:\nRubric Criterion: (Relevant rubric item)\nArea for Improvement: (Quote from assignment)\nSuggested Enhancement: (Explanation of needed improvement)\nImproved Version: (Example of improved text)\n\nONLY output a table and nothing else (no summary/intro statment) please",
  });

  return model;
}

/**
 * Converts a File object to a GoogleGenerativeAI.Part object.
 *
 * @param {Blob} file
 * @returns {GoogleGenerativeAI.Part}
 */
export async function fileToGenerativePart(file) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

/**
 * Scrolls the document all the way to the bottom.
 */
export function scrollToDocumentBottom() {
  const scrollingElement = document.scrollingElement || document.body;
  scrollingElement.scrollTop = scrollingElement.scrollHeight;
}

/**
 * Updates the `resultEl` with parsed markdown text returned by a `getResult()` call.
 *
 * @param {HTMLElement}} resultEl
 * @param {() => Promise<GoogleGenerativeAI.GenerateContentResponse>} getResult
 * @param {boolean} streaming
 */
export async function updateUI(resultEl, getResult, streaming) {
  resultEl.className = "loading";
  const debugEl = document.querySelector("#debug-result");
  let text = "";
  try {
    const result = await getResult();

    if (streaming) {
      resultEl.innerText = "";
      debugEl.innerText = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text += chunkText;
        // Show raw output in debug
        debugEl.innerText = text;
        
        // Convert markdown table syntax to HTML table
        const styledText = text
          .replace(/\|{2,}/g, '|')  // Remove multiple consecutive pipes
          .replace(/^\s*\||\|\s*$/gm, '')  // Remove leading/trailing pipes
          .split('\n')
          .map((line, index, array) => {
            if (line.trim() === '') return '';
            
            // Split the line into cells
            const cells = line.split('|').map(cell => {
              // Apply text formatting within each cell
              return cell.trim()
                .replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<u>$1</u>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/"([^"]+)"/g, '<em>$1</em>');
            });
            
            // Check if this is a separator line (contains only - and |)
            if (line.match(/^[\s-|]+$/)) return '';
            
            // Create table row
            const cellTag = index === 0 ? 'th' : 'td';
            return `<tr>${cells.map(cell => `<${cellTag}>${cell}</${cellTag}>`).join('')}</tr>`;
          })
          .filter(line => line !== '')
          .join('');

        // Wrap in table tags if there's table content
        const finalHtml = styledText ? `<table class="result-table">${styledText}</table>` : '';
        
        resultEl.innerHTML = finalHtml;
        scrollToDocumentBottom();
      }
    } else {
      const response = await result.response;
      text = response.text();
      debugEl.innerText = text;
    }

    resultEl.className = "";
  } catch (err) {
    const errorMessage = err.toString();
    if (errorMessage.startsWith("Error")) {
      text = "\n\n> heyyyyy ur not meant to see this... how tf did u break the api stop using it for a bit maybe it will fix itsself ";
    } else {
      text = errorMessage; // Use the actual error message for other cases
    }
    debugEl.innerText = text;
    resultEl.className = "Error";
  }
}

function autoResizeTextarea() {
  const textarea = document.querySelector('#prompt');
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });
}

// Call the function when the document loads
document.addEventListener('DOMContentLoaded', autoResizeTextarea);

function setupTextareaFocus() {
  const textarea = document.querySelector('#prompt');
  
  textarea.addEventListener('focus', () => {
    document.body.classList.add('textarea-focused');
  });
  
  textarea.addEventListener('blur', () => {
    document.body.classList.remove('textarea-focused');
  });
}

document.addEventListener('DOMContentLoaded', setupTextareaFocus);

document
  .querySelector("#form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    // Disable the submit button for 5 seconds
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "calm down"; // Change button text
    submitButton.classList.add('disabled-button'); // Add a class for styling

    setTimeout(() => {
      submitButton.disabled = false;
      submitButton.textContent = "Organze"; // Reset button text
      submitButton.classList.remove('disabled-button'); // Remove the class
    }, 5000);

    const contextEl = document.querySelector("#context");
    const rubricEl = document.querySelector("#rubric");
    const assignmentEl = document.querySelector("#assignment");
    const resultEl = document.querySelector("#result");

    const emptyFields = [
      !contextEl.value.trim() && 'Context',
      !rubricEl.value.trim() && 'Rubric',
      !assignmentEl.value.trim() && 'Assignment'
    ].filter(Boolean);

    if (emptyFields.length > 0) {
      const confirmed = confirm(`sure u wanna submit without ${emptyFields.join(' and ')}? orginzer gives much better feed back with all 3 boxes filled`);
      if (confirmed) {
        if (!contextEl.value.trim()) contextEl.value = 'N/A';
        if (!rubricEl.value.trim()) rubricEl.value = 'N/A';
        if (!assignmentEl.value.trim()) assignmentEl.value = 'N/A';
      } else {
        return;
      }
    }

    const combinedPrompt = `Context: ${contextEl.value}\n\nRubric: ${rubricEl.value}\n\nAssignment: ${assignmentEl.value}\n\nPlease evaluate this assignment based on the provided context and rubric.`;

    updateUI(
      resultEl,
      () => run(combinedPrompt),
      true,
    );
  });

function setupFormToggle() {
  const toggleButton = document.querySelector('#toggle-form-size');
  const formContainer = document.querySelector('.form-container');
  const container = document.querySelector('.container');
  
  // Set initial margin since form starts collapsed
  container.style.marginTop = '20px';
  
  toggleButton.addEventListener('click', () => {
    formContainer.classList.toggle('collapsed');
    
    // Adjust container top margin when collapsed
    if (formContainer.classList.contains('collapsed')) {
      container.style.marginTop = '20px';
    } else {
      container.style.marginTop = '0';
    }
  });
}

document.addEventListener('DOMContentLoaded', setupFormToggle);
