document.addEventListener("DOMContentLoaded", function () {
  // Initialize toast for notifications
  let copyToast;
  const copyToastElement = document.getElementById("copy-toast");
  if (copyToastElement) {
    try {
      copyToast = new bootstrap.Toast(copyToastElement);
    } catch (e) {
      console.error("Failed to initialize toast:", e);
    }
  }

  // =====================================
  // GENERATE PASSWORD TAB FUNCTIONALITY
  // =====================================

  // DOM Elements for generate tab
  const passwordDisplay = document.getElementById("password-display");
  const copyBtn = document.getElementById("copy-btn");
  const visibilityBtn = document.getElementById("visibility-btn");
  const exportBtn = document.getElementById("export-btn");
  const generateBtn = document.getElementById("generate-btn");
  const favoriteBtn = document.getElementById("favorite-btn");
  const crackTimeElem = document.getElementById("crack-time");
  const timeTocrackElem = document.getElementById("time-to-crack");
  const entropyElem = document.getElementById("entropy-value");
  const methodSelect = document.getElementById("method-select");
  const lengthSlider = document.getElementById("length-slider");
  const lengthValue = document.getElementById("length-value");
  
  // FIX: Make sure we query for strength meter correctly - it might be a child element
  const strengthMeterContainer = document.querySelector(".progress");
  const strengthMeter = strengthMeterContainer ? 
    strengthMeterContainer.querySelector(".progress-bar") : 
    document.getElementById("strength-meter");
  
  const patternInput = document.getElementById("pattern-input");
  const patternContainer = document.getElementById("pattern-container");
  const entropyContainer = document.getElementById("entropy-container");
  const analysisContainer = document.getElementById("analysis-container");

  // Password options checkboxes
  const uppercaseCheck = document.getElementById("uppercase-check");
  const lowercaseCheck = document.getElementById("lowercase-check");
  const digitsCheck = document.getElementById("digits-check");
  const symbolsCheck = document.getElementById("symbols-check");
  const excludeSimilarCheck = document.getElementById("exclude-similar-check");
  const excludeAmbiguousCheck = document.getElementById("exclude-ambiguous-check");

  // Current password state
  let currentPassword = "";
  let passwordHidden = false;
  let savedPasswords = getSavedPasswords();
  let passwordHistory = [];

  // Track generated passwords for batch export
  let sessionPasswords = [];

  // Initialize favicons for all previously saved passwords
  function getSavedPasswords() {
    const saved = localStorage.getItem("savedPasswords");
    return saved ? JSON.parse(saved) : [];
  }

  // Update length display when slider changes
  if (lengthSlider) {
    lengthSlider.addEventListener("input", function () {
      if (lengthValue) {
        lengthValue.textContent = lengthSlider.value;
      }
    });
  }

  // Show/hide pattern input based on method selection
  if (methodSelect && patternContainer) {
    methodSelect.addEventListener("change", function () {
      if (methodSelect.value === "pattern") {
        patternContainer.classList.remove("d-none");
      } else {
        patternContainer.classList.add("d-none");
      }
    });
  }

  // Function to generate a password
  function generatePassword() {
    // Get options from UI
    const options = {
      length: parseInt(lengthSlider ? lengthSlider.value : 12),
      uppercase: uppercaseCheck ? uppercaseCheck.checked : true,
      lowercase: lowercaseCheck ? lowercaseCheck.checked : true,
      digits: digitsCheck ? digitsCheck.checked : true,
      symbols: symbolsCheck ? symbolsCheck.checked : true,
      method: methodSelect ? methodSelect.value : "random",
      exclude_similar: excludeSimilarCheck ? excludeSimilarCheck.checked : false,
      exclude_ambiguous: excludeAmbiguousCheck ? excludeAmbiguousCheck.checked : false,
    };

    // Add pattern if applicable
    if (methodSelect && methodSelect.value === "pattern" && patternInput && patternInput.value) {
      options.pattern = patternInput.value;
    }

    // Make sure at least one character type is selected
    if (
      !options.uppercase &&
      !options.lowercase &&
      !options.digits &&
      !options.symbols
    ) {
      // Default to lowercase if nothing is selected
      options.lowercase = true;
      if (lowercaseCheck) lowercaseCheck.checked = true;
    }

    // Request password from server
    fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Save current password
        currentPassword = data.password;

        // Add to session passwords for batch export
        if (currentPassword && sessionPasswords.indexOf(currentPassword) === -1) {
          sessionPasswords.push(currentPassword);
        }

        // Display password
        displayPassword();

        // Update crack time
        if (timeTocrackElem && crackTimeElem && data.crack_time) {
          timeTocrackElem.textContent = data.crack_time;
          // Remove any existing strength classes first
          timeTocrackElem.className = '';
          timeTocrackElem.classList.add(`strength-${data.score || 0}`);
          crackTimeElem.classList.remove("d-none");
        }

        // Update entropy
        if (entropyElem && entropyContainer && typeof data.entropy === 'number') {
          entropyElem.textContent = data.entropy.toFixed(1) + " bits";
          entropyContainer.classList.remove("d-none");
        }

        // FIX: Update strength meter - make sure we have a valid element and proper score
        updateStrengthMeter(data.score || 0);

        // Display analysis if available
        if (data.analysis && analysisContainer) {
          displayAnalysis(data.analysis);
        }

        // Show buttons
        if (copyBtn) copyBtn.classList.remove("d-none");
        if (visibilityBtn) visibilityBtn.classList.remove("d-none");
        if (exportBtn) exportBtn.classList.remove("d-none");
        if (favoriteBtn) favoriteBtn.classList.remove("d-none");

        // Check if this password is already saved
        updateFavoriteButton();

        // Fetch and update history
        fetchPasswordHistory();
      })
      .catch((error) => {
        console.error("Error generating password:", error);
        if (passwordDisplay) {
          passwordDisplay.textContent = "Error generating password. Please try again.";
          passwordDisplay.classList.add("text-danger");
        }
      });
  }

  // Function to display password (considers visibility toggle)
  function displayPassword() {
    if (!passwordDisplay || !currentPassword) return;
    
    if (passwordHidden) {
      // Show password as dots
      passwordDisplay.textContent = "•".repeat(currentPassword.length);
    } else {
      // Show actual password
      passwordDisplay.textContent = currentPassword;
    }

    // Reset any error classes
    passwordDisplay.classList.remove("text-danger");
  }

  // Function to update strength meter
  function updateStrengthMeter(score) {
    // FIX: Improved debugging for strength meter issues
    console.log("Updating strength meter with score:", score);
    console.log("Strength meter element:", strengthMeter);
    
    if (!strengthMeter) {
      console.error("Strength meter element not found");
      return;
    }

    // Make sure score is a number between 0-4
    score = Math.min(Math.max(Number(score) || 0, 0), 4);

    try {
      // Update progress bar
      const percentage = (score / 4) * 100;
      console.log("Setting width to:", `${percentage}%`);
      strengthMeter.style.width = `${percentage}%`;
      strengthMeter.setAttribute("aria-valuenow", percentage);

      // Remove any existing color classes
      strengthMeter.classList.remove("bg-danger", "bg-warning", "bg-info", "bg-success");
      
      // Add new color class based on score
      if (score <= 1) {
        strengthMeter.classList.add("bg-danger");
      } else if (score === 2) {
        strengthMeter.classList.add("bg-warning");
      } else if (score === 3) {
        strengthMeter.classList.add("bg-info");
      } else {
        strengthMeter.classList.add("bg-success");
      }
      
      console.log("Strength meter updated successfully");
    } catch (error) {
      console.error("Error updating strength meter:", error);
    }
  }

  // Function to display password analysis
  function displayAnalysis(analysis) {
    if (!analysisContainer) return;
    if (!analysis) {
      console.error("Analysis data is missing");
      return;
    }

    try {
      // Show analysis container
      analysisContainer.classList.remove("d-none");

      // Safely access character sets
      const charSets = analysis.character_sets || {
        uppercase: 0,
        lowercase: 0,
        digits: 0,
        symbols: 0
      };

      // Create HTML for analysis
      let analysisHTML = `
        <div class="card-header">
          <h5 class="mb-0">Password Analysis</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6">
              <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between">
                  <span>Length</span>
                  <span class="badge bg-primary rounded-pill">${analysis.length || 0}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between">
                  <span>Uppercase</span>
                  <span class="badge ${
                    charSets.uppercase > 0 ? "bg-success" : "bg-secondary"
                  } rounded-pill">
                    ${charSets.uppercase}
                  </span>
                </li>
                <li class="list-group-item d-flex justify-content-between">
                  <span>Lowercase</span>
                  <span class="badge ${
                    charSets.lowercase > 0 ? "bg-success" : "bg-secondary"
                  } rounded-pill">
                    ${charSets.lowercase}
                  </span>
                </li>
              </ul>
            </div>
            <div class="col-md-6">
              <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between">
                  <span>Digits</span>
                  <span class="badge ${
                    charSets.digits > 0 ? "bg-success" : "bg-secondary"
                  } rounded-pill">
                    ${charSets.digits}
                  </span>
                </li>
                <li class="list-group-item d-flex justify-content-between">
                  <span>Symbols</span>
                  <span class="badge ${
                    charSets.symbols > 0 ? "bg-success" : "bg-secondary"
                  } rounded-pill">
                    ${charSets.symbols}
                  </span>
                </li>
                <li class="list-group-item d-flex justify-content-between">
                  <span>Character Variety</span>
                  <span class="badge ${
                    getCharSetCount(charSets) >= 3 ? "bg-success" : "bg-warning"
                  } rounded-pill">
                    ${getCharSetCount(charSets)}/4
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      `;

      analysisContainer.innerHTML = analysisHTML;
    } catch (error) {
      console.error("Error displaying analysis:", error);
    }
  }

  // Helper function to count character sets used
  function getCharSetCount(charSets) {
    if (!charSets) return 0;
    return (
      (charSets.uppercase > 0 ? 1 : 0) +
      (charSets.lowercase > 0 ? 1 : 0) +
      (charSets.digits > 0 ? 1 : 0) +
      (charSets.symbols > 0 ? 1 : 0)
    );
  }

  // Function to fetch password history
  function fetchPasswordHistory() {
    fetch("/history")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch history");
        }
        return response.json();
      })
      .then((data) => {
        passwordHistory = data.history || [];
        updateHistoryDisplay();
      })
      .catch((error) => {
        console.error("Error fetching history:", error);
      });
  }

  // Function to update history display
  function updateHistoryDisplay() {
    const historyContainer = document.getElementById("password-history");
    if (!historyContainer) {
      console.error("Password history container not found");
      return;
    }

    // Clear existing history
    historyContainer.innerHTML = "";

    if (!passwordHistory || passwordHistory.length === 0) {
      historyContainer.innerHTML = `
        <div class="text-center text-muted py-3">
          No recent passwords
        </div>
      `;
      return;
    }

    try {
      // Create history list
      const historyTable = document.createElement("table");
      historyTable.className = "table table-sm table-hover";

      // Add table header
      historyTable.innerHTML = `
        <thead class="table-light">
          <tr>
            <th scope="col">Password</th>
            <th scope="col">Strength</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tableBody = historyTable.querySelector("tbody");

      // Add each password to the history
      passwordHistory.forEach((item, index) => {
        if (!item || !item.password) return;
        
        const row = document.createElement("tr");
        
        // Create masked password display
        const maskedPassword = "•".repeat(item.password.length);

        row.innerHTML = `
          <td class="password-cell" data-password="${item.password}">
            <span class="password-text">${maskedPassword}</span>
          </td>
          <td>
            <span class="badge strength-${item.score || 0}">${item.crack_time || "Unknown"}</span>
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-copy" data-password="${item.password}" title="Copy">
                <i class="bi bi-clipboard"></i>
              </button>
              <button class="btn btn-outline-secondary btn-view" title="View">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary btn-favorite ${
                savedPasswords.includes(item.password) ? "active" : ""
              }" 
                      data-password="${item.password}" title="Save">
                <i class="bi bi-star${
                  savedPasswords.includes(item.password) ? "-fill" : ""
                }"></i>
              </button>
            </div>
          </td>
        `;

        tableBody.appendChild(row);
      });

      historyContainer.appendChild(historyTable);

      // Add event listeners to history buttons
      addHistoryEventListeners();
    } catch (error) {
      console.error("Error updating history display:", error);
      historyContainer.innerHTML = `
        <div class="text-center text-danger py-3">
          Error displaying password history
        </div>
      `;
    }
  }

  // Add event listeners to history table buttons
  function addHistoryEventListeners() {
    // Copy buttons in history
    document.querySelectorAll("#password-history .btn-copy").forEach((btn) => {
      btn.addEventListener("click", function () {
        const password = this.getAttribute("data-password");
        copyToClipboard(password);
      });
    });

    // View buttons in history
    document.querySelectorAll("#password-history .btn-view").forEach((btn) => {
      btn.addEventListener("click", function () {
        const passwordCell = this.closest("tr").querySelector(".password-cell");
        const passwordText = passwordCell.querySelector(".password-text");
        const password = passwordCell.getAttribute("data-password");

        if (passwordText.textContent.includes("•")) {
          passwordText.textContent = password;
          this.querySelector("i").classList.replace("bi-eye", "bi-eye-slash");
        } else {
          passwordText.textContent = "•".repeat(password.length);
          this.querySelector("i").classList.replace("bi-eye-slash", "bi-eye");
        }
      });
    });

    // Favorite buttons in history
    document
      .querySelectorAll("#password-history .btn-favorite")
      .forEach((btn) => {
        btn.addEventListener("click", function () {
          const password = this.getAttribute("data-password");
          toggleSavedPassword(password);

          // Update button appearance
          if (savedPasswords.includes(password)) {
            this.classList.add("active");
            this.querySelector("i").classList.replace(
              "bi-star",
              "bi-star-fill"
            );
          } else {
            this.classList.remove("active");
            this.querySelector("i").classList.replace(
              "bi-star-fill",
              "bi-star"
            );
          }
        });
      });
  }

  // Function to update favorite button state
  function updateFavoriteButton() {
    if (!favoriteBtn || !currentPassword) return;

    const isSaved = savedPasswords.includes(currentPassword);

    if (isSaved) {
      favoriteBtn.classList.add("active");
      const icon = favoriteBtn.querySelector("i");
      if (icon) {
        if (icon.classList.contains("bi-star")) {
          icon.classList.replace("bi-star", "bi-star-fill");
        }
      }
      favoriteBtn.setAttribute("title", "Remove from saved");
    } else {
      favoriteBtn.classList.remove("active");
      const icon = favoriteBtn.querySelector("i");
      if (icon) {
        if (icon.classList.contains("bi-star-fill")) {
          icon.classList.replace("bi-star-fill", "bi-star");
        }
      }
      favoriteBtn.setAttribute("title", "Save password");
    }
  }

  // Function to toggle password saved state
  function toggleSavedPassword(password) {
    if (!password) return;
    
    const index = savedPasswords.indexOf(password);

    if (index === -1) {
      // Add to saved passwords
      savedPasswords.push(password);
    } else {
      // Remove from saved passwords
      savedPasswords.splice(index, 1);
    }

    // Save to localStorage
    localStorage.setItem("savedPasswords", JSON.stringify(savedPasswords));

    // Update display if toggling current password
    if (password === currentPassword) {
      updateFavoriteButton();
    }

    // Update saved passwords tab
    updateSavedPasswordsDisplay();
  }

  // Function to copy password to clipboard
  function copyToClipboard(text) {
    if (!text) return;
    
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Show toast
        if (copyToast) {
          const toastText = document.getElementById("toast-text");
          if (toastText) {
            toastText.textContent = "Password copied to clipboard!";
          }
          copyToast.show();
        }
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        alert("Failed to copy to clipboard");
      });
  }

  // Function to update saved passwords display
  function updateSavedPasswordsDisplay() {
    const savedContainer = document.getElementById("saved-passwords");
    if (!savedContainer) return;

    // Clear existing content
    savedContainer.innerHTML = "";

    if (savedPasswords.length === 0) {
      savedContainer.innerHTML = `
        <div class="text-center text-muted py-3">
          No saved passwords
        </div>
      `;
      return;
    }

    // Create table for saved passwords
    const savedTable = document.createElement("table");
    savedTable.className = "table table-striped table-hover";

    savedTable.innerHTML = `
      <thead class="table-light">
        <tr>
          <th scope="col">Password</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tableBody = savedTable.querySelector("tbody");

    // Add each saved password
    savedPasswords.forEach((password) => {
      if (!password) return; // Skip if password is missing
      
      const row = document.createElement("tr");

      row.innerHTML = `
        <td class="saved-password-cell" data-password="${password}">
          <span class="saved-password-text">•••••••••••••</span>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-copy" data-password="${password}" title="Copy">
              <i class="bi bi-clipboard"></i>
            </button>
            <button class="btn btn-outline-secondary btn-view" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger btn-remove" data-password="${password}" title="Remove">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;

      tableBody.appendChild(row);
    });

    savedContainer.appendChild(savedTable);

    // Add event listeners to saved password buttons
    addSavedPasswordEventListeners();
  }

  // Add event listeners to saved passwords table
  function addSavedPasswordEventListeners() {
    // Copy buttons in saved passwords
    document.querySelectorAll("#saved-passwords .btn-copy").forEach((btn) => {
      btn.addEventListener("click", function () {
        const password = this.getAttribute("data-password");
        copyToClipboard(password);
      });
    });

    // View buttons in saved passwords
    document.querySelectorAll("#saved-passwords .btn-view").forEach((btn) => {
      btn.addEventListener("click", function () {
        const passwordCell = this.closest("tr").querySelector(
          ".saved-password-cell"
        );
        const passwordText = passwordCell.querySelector(".saved-password-text");
        const password = passwordCell.getAttribute("data-password");

        if (passwordText.textContent.includes("•")) {
          passwordText.textContent = password;
          this.querySelector("i").classList.replace("bi-eye", "bi-eye-slash");
        } else {
          passwordText.textContent = "•••••••••••••";
          this.querySelector("i").classList.replace("bi-eye-slash", "bi-eye");
        }
      });
    });

    // Remove buttons in saved passwords
    document.querySelectorAll("#saved-passwords .btn-remove").forEach((btn) => {
      btn.addEventListener("click", function () {
        const password = this.getAttribute("data-password");
        const index = savedPasswords.indexOf(password);

        if (index !== -1) {
          savedPasswords.splice(index, 1);
          localStorage.setItem(
            "savedPasswords",
            JSON.stringify(savedPasswords)
          );
          updateSavedPasswordsDisplay();

          // Update favorite button if removing current password
          if (password === currentPassword) {
            updateFavoriteButton();
          }
        }
      });
    });
  }

  // Function to export passwords
  function exportPasswords(passwords, filename = "passwords.txt") {
    if (!passwords || passwords.length === 0) {
      alert("No passwords to export");
      return;
    }

    try {
      const content = passwords.join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error exporting passwords:", error);
      alert("Failed to export passwords");
    }
  }

  // =====================================
  // EVENT LISTENERS
  // =====================================

  // Generate button click
  if (generateBtn) {
    generateBtn.addEventListener("click", generatePassword);
  }

  // Copy button click
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      copyToClipboard(currentPassword);
    });
  }

  // Visibility toggle button click
  if (visibilityBtn) {
    visibilityBtn.addEventListener("click", function () {
      passwordHidden = !passwordHidden;

      // Update icon
      const icon = visibilityBtn.querySelector("i");
      if (icon) {
        if (passwordHidden) {
          icon.classList.replace("bi-eye-slash", "bi-eye");
        } else {
          icon.classList.replace("bi-eye", "bi-eye-slash");
        }
      }

      // Update display
      displayPassword();
    });
  }

  // Favorite button click
  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", function () {
      toggleSavedPassword(currentPassword);
    });
  }

  // Export button click
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      exportPasswords([currentPassword], "password.txt");
    });
  }

  // FIX: Export session passwords button
  const exportSessionBtn = document.getElementById("export-session-btn");
  if (exportSessionBtn) {
    console.log("Adding event listener to export session button");
    exportSessionBtn.addEventListener("click", function () {
      console.log("Export session button clicked, passwords:", sessionPasswords);
      // Make sure we have session passwords to export
      if (sessionPasswords && sessionPasswords.length > 0) {
        exportPasswords(sessionPasswords, "passwords_session.txt");
      } else {
        alert("No session passwords to export");
      }
    });
  } else {
    console.error("Export session button not found");
  }

  // FIX: Export saved passwords button
  const exportSavedBtn = document.getElementById("export-saved-btn");
  if (exportSavedBtn) {
    console.log("Adding event listener to export saved button");
    exportSavedBtn.addEventListener("click", function () {
      console.log("Export saved button clicked, passwords:", savedPasswords);
      // Make sure we have saved passwords to export
      if (savedPasswords && savedPasswords.length > 0) {
        exportPasswords(savedPasswords, "passwords_saved.txt");
      } else {
        alert("No saved passwords to export");
      }
    });
  } else {
    console.error("Export saved button not found");
  }

  // FIX: Clear history button
  const clearHistoryBtn = document.getElementById("clear-history-btn");
  if (clearHistoryBtn) {
    console.log("Adding event listener to clear history button");
    clearHistoryBtn.addEventListener("click", function () {
      console.log("Clear history button clicked");
      
      // Direct approach - clear local history first
      passwordHistory = [];
      updateHistoryDisplay();
      
      // Then try to clear on server
      fetch("/clear-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json" 
        }
      })
      .then(response => {
        console.log("Clear history response:", response);
        if (!response.ok) {
          console.error("Server error:", response.status);
        }
        return response.json().catch(() => ({}));
      })
      .then(data => {
        console.log("Clear history data:", data);
        // Show notification
        if (copyToast) {
          const toastText = document.getElementById("toast-text");
          if (toastText) {
            toastText.textContent = "Password history cleared!";
            copyToast.show();
          }
        }
      })
      .catch(error => {
        console.error("Error clearing history:", error);
        // We've already cleared locally, so just show a notification
        if (copyToast) {
          const toastText = document.getElementById("toast-text");
          if (toastText) {
            toastText.textContent = "History cleared locally";
            copyToast.show();
          }
        }
      });
    });
  } else {
    console.error("Clear history button not found");
  }

  // =====================================
  // INITIALIZATION
  // =====================================

  // Initialize displays
  updateSavedPasswordsDisplay();
  fetchPasswordHistory();

  // Initial length display
  if (lengthValue && lengthSlider) {
    lengthValue.textContent = lengthSlider.value;
  }

  // Show/hide pattern input on initial load
  if (methodSelect && patternContainer) {
    if (methodSelect.value === "pattern") {
      patternContainer.classList.remove("d-none");
    } else {
      patternContainer.classList.add("d-none");
    }
  }

  // Generate a password on page load if auto-generate is enabled
  const autoGenerate = document.getElementById("auto-generate-check");
  if (autoGenerate && autoGenerate.checked) {
    generatePassword();
  }

  // =====================================
  // TAB SWITCHING FUNCTIONALITY
  // =====================================

  // Get all tab buttons
  const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');

  // Add event listener for tab changes
  tabButtons.forEach((tabButton) => {
    tabButton.addEventListener("shown.bs.tab", function (event) {
      const targetTab = event.target.getAttribute("data-bs-target");

      // If switching to saved passwords tab, refresh the display
      if (targetTab === "#saved-tab") {
        updateSavedPasswordsDisplay();
      }
      // If switching to history tab, refresh the display
      else if (targetTab === "#history-tab") {
        fetchPasswordHistory();
      }
    });
  });

  // Log initialization completion
  console.log("Password manager initialized");

  // =====================================
  // CHECK STRENGTH TAB FUNCTIONALITY
  // =====================================

  // DOM Elements for check strength tab
  const checkForm = document.getElementById("check-form");
  const checkPasswordInput = document.getElementById("check-password-input");
  const checkTogglePassword = document.getElementById("check-toggle-password");
  const checkResults = document.getElementById("check-results");
  const checkStrengthText = document.getElementById("check-strength-text");
  const checkStrengthMeter = document.getElementById("check-strength-meter");
  const checkTimeToCrack = document.getElementById("check-time-to-crack");
  const checkFeedbackList = document.getElementById("check-feedback-list");
  const advancedAnalysisBtn = document.getElementById("advanced-analysis-btn");
  const advancedAnalysis = document.getElementById("advanced-analysis");
  const advancedAnalysisContent = document.getElementById("advanced-analysis-content");

  // Toggle password visibility in check strength tab
  if (checkTogglePassword) {
    checkTogglePassword.addEventListener("click", function() {
      const type = checkPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      checkPasswordInput.setAttribute("type", type);
      
      // Update icon
      const icon = this.querySelector("i");
      if (icon) {
        if (type === "text") {
          icon.classList.replace("bi-eye", "bi-eye-slash");
        } else {
          icon.classList.replace("bi-eye-slash", "bi-eye");
        }
      }
    });
  }

  // Handle form submission for password strength check
  if (checkForm) {
    checkForm.addEventListener("submit", function(e) {
      e.preventDefault();
      
      const password = checkPasswordInput.value;
      if (!password) {
        alert("Please enter a password to check");
        return;
      }

      // Show loading state
      checkResults.classList.add("d-none");
      checkStrengthText.textContent = "Analyzing...";
      checkStrengthMeter.style.width = "0%";

      // Send password to server for analysis
      fetch("/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: password })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(data => {
        // Show results
        checkResults.classList.remove("d-none");

        // Update strength text and meter
        checkStrengthText.textContent = data.strength;
        checkStrengthMeter.style.width = `${data.score_percent}%`;
        
        // Update strength meter color based on score
        checkStrengthMeter.classList.remove("bg-danger", "bg-warning", "bg-info", "bg-success");
        if (data.score <= 1) {
          checkStrengthMeter.classList.add("bg-danger");
        } else if (data.score === 2) {
          checkStrengthMeter.classList.add("bg-warning");
        } else if (data.score === 3) {
          checkStrengthMeter.classList.add("bg-info");
        } else {
          checkStrengthMeter.classList.add("bg-success");
        }

        // Update crack time
        checkTimeToCrack.textContent = data.crack_time;

        // Update feedback list
        checkFeedbackList.innerHTML = "";
        if (data.feedback && data.feedback.length > 0) {
          data.feedback.forEach(suggestion => {
            const li = document.createElement("li");
            li.className = "list-group-item";
            li.textContent = suggestion;
            checkFeedbackList.appendChild(li);
          });
        }

        // Update advanced analysis content
        if (data.analysis) {
          const analysisHTML = `
            <div class="row">
              <div class="col-md-6">
                <ul class="list-group list-group-flush">
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Length</span>
                    <span class="badge bg-primary rounded-pill">${data.analysis.length}</span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Uppercase</span>
                    <span class="badge ${data.analysis.character_sets.uppercase > 0 ? "bg-success" : "bg-secondary"} rounded-pill">
                      ${data.analysis.character_sets.uppercase}
                    </span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Lowercase</span>
                    <span class="badge ${data.analysis.character_sets.lowercase > 0 ? "bg-success" : "bg-secondary"} rounded-pill">
                      ${data.analysis.character_sets.lowercase}
                    </span>
                  </li>
                </ul>
              </div>
              <div class="col-md-6">
                <ul class="list-group list-group-flush">
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Digits</span>
                    <span class="badge ${data.analysis.character_sets.digits > 0 ? "bg-success" : "bg-secondary"} rounded-pill">
                      ${data.analysis.character_sets.digits}
                    </span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Symbols</span>
                    <span class="badge ${data.analysis.character_sets.symbols > 0 ? "bg-success" : "bg-secondary"} rounded-pill">
                      ${data.analysis.character_sets.symbols}
                    </span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between">
                    <span>Entropy</span>
                    <span class="badge bg-info rounded-pill">
                      ${data.entropy.toFixed(1)} bits
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          `;
          advancedAnalysisContent.innerHTML = analysisHTML;
        }

        // Hide advanced analysis section initially
        advancedAnalysis.classList.add("d-none");
      })
      .catch(error => {
        console.error("Error checking password strength:", error);
        alert("Error checking password strength. Please try again.");
      });
    });
  }

  // Toggle advanced analysis section
  if (advancedAnalysisBtn) {
    advancedAnalysisBtn.addEventListener("click", function() {
      advancedAnalysis.classList.toggle("d-none");
      
      // Update button text
      const isHidden = advancedAnalysis.classList.contains("d-none");
      this.innerHTML = `
        <i class="fas fa-microscope me-2"></i>
        ${isHidden ? "Show" : "Hide"} Advanced Analysis
      `;
    });
  }

  // Starfield Background
  function createStarfield() {
    const starfield = document.getElementById('starfield');
    const stars = 200;
    
    for (let i = 0; i < stars; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      
      // Random position
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      
      // Random size
      const size = Math.random() * 2;
      
      // Random animation delay
      const delay = Math.random() * 4;
      
      star.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
        background: white;
        border-radius: 50%;
      `;
      
      starfield.appendChild(star);
    }
  }

  // Parallax effect for the main card
  function setupParallax() {
    const card = document.querySelector('.main-card');
    const container = document.querySelector('.container');
    
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    container.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });
  }

  // Typewriter effect for password display
  function typewriterEffect(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    
    function type() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(type, speed);
      }
    }
    
    type();
  }

  // Update password display with typewriter effect
  function displayPassword() {
    if (!passwordDisplay || !currentPassword) return;
    
    if (passwordHidden) {
      passwordDisplay.textContent = "•".repeat(currentPassword.length);
    } else {
      typewriterEffect(passwordDisplay, currentPassword);
    }
  }

  // Initialize the new design elements
  document.addEventListener('DOMContentLoaded', function() {
    // Create starfield background
    createStarfield();
    
    // Setup parallax effect
    setupParallax();
    
    // Update existing event listeners to use new animations
    if (generateBtn) {
      generateBtn.addEventListener('click', function() {
        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        this.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => ripple.remove(), 1000);
        
        generatePassword();
      });
    }
    
    // Update copy button animation
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        this.classList.add('copied');
        setTimeout(() => this.classList.remove('copied'), 1000);
        copyToClipboard(currentPassword);
      });
    }
    
    // Update visibility toggle animation
    if (visibilityBtn) {
      visibilityBtn.addEventListener('click', function() {
        const icon = this.querySelector('i');
        icon.classList.add('rotate');
        setTimeout(() => icon.classList.remove('rotate'), 500);
        
        passwordHidden = !passwordHidden;
        displayPassword();
      });
    }
    
    // Update strength meter animation
    function updateStrengthMeter(score) {
      if (!strengthMeter) return;
      
      const percentage = (score / 4) * 100;
      strengthMeter.style.width = `${percentage}%`;
      strengthMeter.setAttribute('aria-valuenow', percentage);
      
      // Update color classes
      strengthMeter.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success');
      if (score <= 1) {
        strengthMeter.classList.add('bg-danger');
      } else if (score === 2) {
        strengthMeter.classList.add('bg-warning');
      } else if (score === 3) {
        strengthMeter.classList.add('bg-info');
      } else {
        strengthMeter.classList.add('bg-success');
      }
      
      // Add pulse animation
      strengthMeter.classList.add('pulse');
      setTimeout(() => strengthMeter.classList.remove('pulse'), 1000);
    }
  });
});