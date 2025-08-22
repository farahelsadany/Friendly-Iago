import { getBackendURL } from "../config.js";

// Get DOM elements
const input = document.getElementById("input");
const wordCount = document.getElementById("wordCount");
const checkBtn = document.getElementById("checkBtn");
const copyBtn = document.getElementById("copyBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resultsSection = document.getElementById("resultsSection");
const originalText = document.getElementById("originalText");
const suggestionText = document.getElementById("suggestionText");
const statusBar = document.getElementById("statusBar");
const container = document.querySelector(".container");

// Status messages
const statusMessages = {
  ready: "Ready to help make your words kinder",
  processing: "Analyzing your comment...",
  success: "Analysis complete!",
  error: "Something went wrong. Try again!"
};

// Update status
function updateStatus(status) {
  const statusText = document.querySelector(".status-text");
  statusText.textContent = statusMessages[status] || statusMessages.ready;
}

// Count words in text
function countWords(text) {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

// Update word count display
function updateWordCount() {
  const count = countWords(input.value);
  wordCount.textContent = `${count} / 200 words`;
  
  // Disable button if over word limit
  if (count > 200) {
    checkBtn.disabled = true;
    wordCount.style.color = "#e74c3c";
  } else {
    checkBtn.disabled = false;
    wordCount.style.color = "#6b7280";
  }
}

// Set processing state
function setProcessing(isProcessing) {
  if (isProcessing) {
    container.classList.add("loading");
    updateStatus("processing");
    checkBtn.disabled = true;
  } else {
    container.classList.remove("loading");
    checkBtn.disabled = false;
  }
}

// Show results section
function showResults() {
  resultsSection.style.display = "block";
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 100);
}

// Copy to clipboard functionality
function setupCopyButton() {
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(suggestionText.textContent);
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = "#27ae60";
        copyBtn.style.color = "white";
        setTimeout(() => {
          copyBtn.textContent = "Copy Suggestion";
          copyBtn.style.background = "white";
          copyBtn.style.color = "#374151";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy: ", err);
        // Fallback for older browsers
        const range = document.createRange();
        range.selectNodeContents(suggestionText);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("copy");
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = "#27ae60";
        copyBtn.style.color = "white";
        setTimeout(() => {
          copyBtn.textContent = "Copy Suggestion";
          copyBtn.style.background = "white";
          copyBtn.style.color = "#374151";
        }, 2000);
      }
    });
  }
}

// Refresh/try again functionality
function setupRefreshButton() {
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      input.value = "";
      updateWordCount();
      resultsSection.style.display = "none";
      updateStatus("ready");
    });
  }
}

// Main analysis function
async function analyzeText() {
  const text = input.value.trim();
  if (!text) {
    updateStatus("ready");
    return;
  }

  const wordCount = countWords(text);
  if (wordCount > 200) {
    updateStatus("Please keep your comment under 200 words");
    return;
  }

  setProcessing(true);

  try {
    const url = await getBackendURL();
    
    const response = await fetch(`${url}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text, 
        context: {}, 
        prefs: {
          tone: "polite",
          length: "similar",
          keepSlang: false,
          strictness: "medium" 
        }, 
        userStyle: {}, 
        instruction: "Check if offensive and paraphrase if needed. Keep similar length to original." 
      })
    });

    const data = await response.json();
    
    if (data?.ok && data.data) {
      const severity = data.data.classification?.severity || "none";
      const isOffensive = data.data.classification?.is_offensive;
      
      // Set original text
      originalText.textContent = text;
      
      // Set suggestion text
      if (severity === "none" && !isOffensive) {
        suggestionText.textContent = "Your comment looks great! No changes needed.";
        container.classList.add("success");
        updateStatus("Your comment is already friendly!");
      } else {
        suggestionText.textContent = data.data.final_suggestion || 
                                   data.data.suggestions?.[0]?.text || 
                                   "Unable to generate suggestion. Please try again.";
        container.classList.add("success");
        updateStatus("Here's a kinder version of your comment");
      }
      
      showResults();
    } else {
      throw new Error(data?.error || "Unknown error occurred");
    }
  } catch (error) {
    console.error("Analysis error:", error);
    container.classList.add("error");
    updateStatus("Connection error. Please check if the server is running.");
    originalText.textContent = text;
    suggestionText.textContent = "Unable to connect to the analysis service. Please try again later.";
    showResults();
  } finally {
    setProcessing(false);
  }
}

// Event listeners
checkBtn.addEventListener("click", analyzeText);

// Setup additional functionality
setupCopyButton();
setupRefreshButton();

// Add word counting functionality
input.addEventListener("input", updateWordCount);

// Initialize
updateStatus("ready");
updateWordCount();