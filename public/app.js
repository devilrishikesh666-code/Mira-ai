
const chatPage = document.getElementById("chatPage");
const apiPage = document.getElementById("apiPage");

const chatTab = document.getElementById("chatTab");
const apiTab = document.getElementById("apiTab");

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const messagesBox = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");

const ownerTokenInput = document.getElementById("ownerToken");
const connectOwnerButton = document.getElementById("connectOwner");
const ownerStatus = document.getElementById("ownerStatus");

const modelInput = document.getElementById("modelInput");
const aiEnabledInput = document.getElementById("aiEnabled");

const keyStatus = document.getElementById("keyStatus");
const connectionStatus = document.getElementById("connectionStatus");
const apiMessage = document.getElementById("apiMessage");

let conversation = [];
let ownerToken = "";
let ownerUnlocked = false;
let waitingForReply = false;

function switchPage(page) {
  const showApi = page === "api";

  chatPage.classList.toggle("hidden", showApi);
  apiPage.classList.toggle("hidden", !showApi);

  chatTab.classList.toggle("active", !showApi);
  apiTab.classList.toggle("active", showApi);
}

chatTab.addEventListener("click", () => switchPage("chat"));

apiTab.addEventListener("click", () => switchPage("api"));

function addMessage(role, text, extraClass = "") {
  const message = document.createElement("div");

  message.className = `message ${role} ${extraClass}`;
  message.textContent = text;

  messagesBox.appendChild(message);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  return message;
}

function removeWelcome() {
  const welcome = messagesBox.querySelector(".welcome-message");
  if (welcome) welcome.remove();
}

async function sendMessage(text) {
  const cleanText = text.trim();

  if (!cleanText || waitingForReply) return;

  removeWelcome();

  conversation.push({
    role: "user",
    content: cleanText
  });

  addMessage("user", cleanText);

  waitingForReply = true;
  sendButton.disabled = true;
  messageInput.disabled = true;

  const loadingMessage = addMessage("assistant", "MIRA is thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation.slice(-12)
      })
    });

    const data = await response.json();

    loadingMessage.remove();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    const reply = data.reply || "I could not create a response.";

    conversation.push({
      role: "assistant",
      content: reply
    });

    addMessage("assistant", reply);
  } catch (error) {
    loadingMessage.remove();
    addMessage("assistant", error.message, "error");
  } finally {
    waitingForReply = false;
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value;
  if (!text.trim()) return;

  messageInput.value = "";
  sendMessage(text);
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    sendMessage(button.textContent);
  });
});

document.getElementById("clearChat").addEventListener("click", () => {
  conversation = [];

  messagesBox.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">✦</div>
      <h3>Hello, I'm MIRA.</h3>
      <p>What would you like to explore today?</p>
      <div class="suggestions">
        <button class="suggestion">Help me build a website</button>
        <button class="suggestion">Explain a difficult topic</button>
        <button class="suggestion">Give me creative ideas</button>
        <button class="suggestion">Help me write code</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      sendMessage(button.textContent);
    });
  });
});

/* SERVER STATUS */

async function checkServer() {
  const topStatus = document.getElementById("topStatus");

  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    topStatus.textContent = data.online ? "Server online" : "Offline";
  } catch {
    topStatus.textContent = "Server offline";
  }
}

checkServer();

/* OWNER DASHBOARD */

async function ownerRequest(url, options = {}) {
  if (!ownerToken) {
    throw new Error("Enter your owner token first.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-owner-token": ownerToken,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Owner request failed.");
  }

  return data;
}

async function loadOwnerStatus() {
  const data = await ownerRequest("/api/admin/status");

  modelInput.value = data.model;
  aiEnabledInput.checked = data.enabled;

  keyStatus.textContent = data.apiKeyConfigured
    ? "Configured"
    : "Missing";

  connectionStatus.textContent = data.enabled
    ? "Enabled"
    : "Disabled";

  ownerStatus.textContent = "Dashboard unlocked";
  ownerStatus.style.color = "#83c99b";

  apiMessage.textContent =
    "Owner dashboard connected. You can now manage MIRA settings.";

  ownerUnlocked = true;
}

connectOwnerButton.addEventListener("click", async () => {
  ownerToken = ownerTokenInput.value.trim();

  if (!ownerToken) {
    ownerStatus.textContent = "Enter your token";
    return;
  }

  connectOwnerButton.disabled = true;
  ownerStatus.textContent = "Checking...";

  try {
    await loadOwnerStatus();
  } catch (error) {
    ownerUnlocked = false;
    ownerToken = "";
    ownerStatus.textContent = error.message;
    ownerStatus.style.color = "#e18b7d";
  } finally {
    connectOwnerButton.disabled = false;
  }
});

/* SAVE SETTINGS */

document.getElementById("saveSettings").addEventListener("click", async () => {
  if (!ownerUnlocked) {
    apiMessage.textContent = "Unlock the owner dashboard first.";
    return;
  }

  apiMessage.textContent = "Saving settings...";

  try {
    const data = await ownerRequest("/api/admin/config", {
      method: "POST",
      body: JSON.stringify({
        model: modelInput.value.trim(),
        enabled: aiEnabledInput.checked
      })
    });

    connectionStatus.textContent = data.enabled
      ? "Enabled"
      : "Disabled";

    apiMessage.textContent =
      "Settings updated successfully on the running server.";
  } catch (error) {
    apiMessage.textContent = error.message;
  }
});

/* TEST API */

document.getElementById("testApi").addEventListener("click", async () => {
  if (!ownerUnlocked) {
    apiMessage.textContent = "Unlock the owner dashboard first.";
    return;
  }

  apiMessage.textContent = "Testing the API connection...";

  try {
    const data = await ownerRequest("/api/admin/test", {
      method: "POST",
      body: JSON.stringify({})
    });

    connectionStatus.textContent = "Connected";
    apiMessage.textContent = data.message;
  } catch (error) {
    connectionStatus.textContent = "Test failed";
    apiMessage.textContent = error.message;
  }
});

/* CLEAR OWNER ACCESS WHEN LEAVING THE PAGE */

window.addEventListener("pagehide", () => {
  ownerToken = "";
  ownerUnlocked = false;
});
