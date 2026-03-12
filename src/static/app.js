document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const advisorStatus = document.getElementById("advisor-status");
  const advisorLoginForm = document.getElementById("advisor-login-form");
  const advisorUsernameInput = document.getElementById("advisor-username");
  const advisorPasswordInput = document.getElementById("advisor-password");
  const advisorLogoutBtn = document.getElementById("advisor-logout-btn");

  let advisorToken = localStorage.getItem("advisorToken") || "";
  let advisorUsername = localStorage.getItem("advisorUsername") || "";

  function getAuthHeaders() {
    if (!advisorToken) {
      return {};
    }

    return {
      "X-Advisor-Token": advisorToken,
    };
  }

  function setAdvisorSession(token, username) {
    advisorToken = token;
    advisorUsername = username;
    localStorage.setItem("advisorToken", token);
    localStorage.setItem("advisorUsername", username);
    renderAdvisorStatus();
  }

  function clearAdvisorSession() {
    advisorToken = "";
    advisorUsername = "";
    localStorage.removeItem("advisorToken");
    localStorage.removeItem("advisorUsername");
    renderAdvisorStatus();
  }

  function renderAdvisorStatus() {
    const isLoggedIn = Boolean(advisorToken);
    advisorStatus.textContent = isLoggedIn
      ? `Logged in as advisor: ${advisorUsername}`
      : "Not logged in as advisor";
    advisorStatus.className = isLoggedIn ? "success" : "info";
    advisorLogoutBtn.classList.toggle("hidden", !isLoggedIn);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getFriendlyError(status, detail) {
    if (status === 401 || status === 403) {
      return "Advisor authorization failed. Please log in and try again.";
    }

    return detail || "An error occurred";
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(getFriendlyError(response.status, result.detail), "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(getFriendlyError(response.status, result.detail), "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  advisorLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = advisorUsernameInput.value.trim();
    const password = advisorPasswordInput.value;

    try {
      const response = await fetch("/auth/advisor/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        setAdvisorSession(result.token, result.username);
        advisorPasswordInput.value = "";
        showMessage("Advisor login successful.", "success");
      } else {
        showMessage(result.detail || "Advisor login failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to log in as advisor.", "error");
      console.error("Error logging in:", error);
    }
  });

  advisorLogoutBtn.addEventListener("click", async () => {
    if (!advisorToken) {
      return;
    }

    try {
      const response = await fetch("/auth/advisor/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        clearAdvisorSession();
        showMessage("Advisor logged out.", "success");
      } else {
        clearAdvisorSession();
        showMessage("Session ended. Please log in again.", "info");
      }
    } catch (error) {
      clearAdvisorSession();
      showMessage("Session ended locally. Please log in again.", "info");
      console.error("Error logging out:", error);
    }
  });

  // Initialize app
  renderAdvisorStatus();
  fetchActivities();
});
