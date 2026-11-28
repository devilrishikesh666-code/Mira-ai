const chatPage = document.getElementById("chatPage");
const apiPage = document.getElementById("apiPage");

const chatTab = document.getElementById("chatTab");
const apiTab = document.getElementById("apiTab");

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const messagesBox = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");
const speakRepliesInput = document.getElementById("speakReplies");
const modelLine = document.getElementById("modelLine");

const ownerTokenInput = document.getElementById("ownerToken");
const connectOwnerButton = document.getElementById("connectOwner");
const ownerStatus = document.getElementById("ownerStatus");

const modelInput = document.getElementById("modelInput");
const aiEnabledInput = document.getElementById("aiEnabled");

const providerName = document.getElementById("providerName");
const keyStatus = document.getElementById("keyStatus");
const connectionStatus = document.getElementById("connectionStatus");
const apiMessage = document.getElementById("apiMessage");

const STORAGE_KEY = "mira.conversation.v1";
const SPEAK_KEY = "mira.speakReplies.v1";

let conversation = loadConversation();
let ownerToken = "";
let ownerUnlocked = false;
let waitingForReply = false;

init();

function init() {
  speakRepliesInput.checked = localStorage.getItem(SPEAK_KEY) === "true";
  renderConversation();
  checkServer();
  autoResizeInput();
}

function switchPage(page) {
  const showApi = page === "api";

  chatPage.classList.toggle("hidden", showApi);
  apiPage.classList.toggle("hidden", !showApi);

  chatTab.classList.toggle("active", !showApi);
  apiTab.classList.toggle("active", showApi);
}

chatTab.addEventListener("click", () => switchPage("chat"));
apiTab.addEventListener("click", () => switchPage("api"));

function loadConversation() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      : [];
  } catch {
    return [];
  }
}

function saveConversation() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.slice(-40)));
}

function welcomeHtml() {
  return `
    <div class="welcome-message">
      <div class="welcome-icon">✦</div>
      <h3>Hello, I'm MIRA.</h3>
      <p>What would you like to explore today?</p>
      <div class="suggestions">
        <button class="suggestion" type="button">Help me build a website</button>
        <button class="suggestion" type="button">Explain a difficult topic</button>
        <button class="suggestion" type="button">Give me creative ideas</button>
        <button class="suggestion" type="button">Help me write code</button>
      </div>
    </div>
  `;
}

function bindSuggestions() {
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.textContent));
  });
}

function renderConversation() {
  messagesBox.innerHTML = "";

  if (!conversation.length) {
    messagesBox.innerHTML = welcomeHtml();
    bindSuggestions();
    return;
  }

  conversation.forEach((message) => addMessage(message.role, message.content, "", false));
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function addMessage(role, text, extraClass = "", shouldScroll = true) {
  const message = document.createElement("div");
  message.className = `message ${role} ${extraClass}`;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdownLite(text);
  message.appendChild(content);

  if (role === "assistant" && text) {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      setTimeout(() => { copyButton.textContent = "Copy"; }, 1400);
    });
    message.appendChild(copyButton);
  }

  messagesBox.appendChild(message);
  if (shouldScroll) messagesBox.scrollTop = messagesBox.scrollHeight;
  return message;
}

function renderMarkdownLite(text) {
  const escaped = escapeHtml(text || "");
  const withCodeBlocks = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);

  return withCodeBlocks
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith("<pre>")) return block;
      const html = block
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "The server returned an unreadable response." };
  }
}

async function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText || waitingForReply) return;

  conversation.push({ role: "user", content: cleanText });
  saveConversation();
  renderConversation();

  waitingForReply = true;
  sendButton.disabled = true;
  messageInput.disabled = true;

  const loadingMessage = addMessage("assistant", "MIRA is thinking…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation.slice(-16) })
    });

    const data = await readJson(response);
    loadingMessage.remove();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    const reply = data.reply || "I could not create a response.";
    conversation.push({ role: "assistant", content: reply });
    saveConversation();
    renderConversation();
    speak(reply);
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
  autoResizeInput();
  sendMessage(text);
});

messageInput.addEventListener("input", autoResizeInput);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

function autoResizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 130)}px`;
}

document.getElementById("clearChat").addEventListener("click", () => {
  conversation = [];
  saveConversation();
  renderConversation();
});

document.getElementById("exportChat").addEventListener("click", () => {
  if (!conversation.length) return;
  const text = conversation.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mira-chat.txt";
  link.click();
  URL.revokeObjectURL(url);
});

voiceButton.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage("assistant", "Voice input is not supported in this browser.", "error");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    messageInput.value = event.results[0][0].transcript;
    autoResizeInput();
    chatForm.requestSubmit();
  };
  recognition.onerror = () => addMessage("assistant", "Voice input failed. Please try again.", "error");
  recognition.start();
});

speakRepliesInput.addEventListener("change", () => {
  localStorage.setItem(SPEAK_KEY, String(speakRepliesInput.checked));
  if (!speakRepliesInput.checked && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});

function speak(text) {
  if (!speakRepliesInput.checked || !text || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
  utterance.lang = "en-IN";
  window.speechSynthesis.speak(utterance);
}

/* SERVER STATUS */

async function checkServer() {
  const topStatus = document.getElementById("topStatus");
  const statusDot = document.querySelector(".status-dot");

  try {
    const response = await fetch("/api/health");
    const data = await readJson(response);

    topStatus.textContent = data.online ? "Server online" : "Offline";
    statusDot.classList.toggle("offline", !data.online);
    modelLine.textContent = data.apiKeyConfigured
      ? `${data.provider} · ${data.model}`
      : "API key not configured on the server";
  } catch {
    topStatus.textContent = "Server offline";
    statusDot.classList.add("offline");
    modelLine.textContent = "Server offline";
  }
}

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

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "Owner request failed.");
  }

  return data;
}

async function loadOwnerStatus() {
  const data = await ownerRequest("/api/admin/status");

  providerName.textContent = data.provider || "Unknown";
  modelInput.value = data.model;
  aiEnabledInput.checked = data.enabled;

  keyStatus.textContent = data.apiKeyConfigured ? "Configured" : "Missing";
  connectionStatus.textContent = data.enabled ? "Enabled" : "Disabled";

  ownerStatus.textContent = "Dashboard unlocked";
  ownerStatus.style.color = "#83c99b";

  apiMessage.textContent = "Owner dashboard connected. You can now manage MIRA settings.";
  ownerUnlocked = true;
}

connectOwnerButton.addEventListener("click", async () => {
  ownerToken = ownerTokenInput.value.trim();

  if (!ownerToken) {
    ownerStatus.textContent = "Enter your token";
    return;
  }

  connectOwnerButton.disabled = true;
  ownerStatus.textContent = "Checking…";

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

  apiMessage.textContent = "Saving settings…";

  try {
    const data = await ownerRequest("/api/admin/config", {
      method: "POST",
      body: JSON.stringify({
        model: modelInput.value.trim(),
        enabled: aiEnabledInput.checked
      })
    });

    providerName.textContent = data.provider || providerName.textContent;
    connectionStatus.textContent = data.enabled ? "Enabled" : "Disabled";
    modelLine.textContent = `${data.provider} · ${data.model}`;
    apiMessage.textContent = "Settings updated successfully on the running server.";
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

  apiMessage.textContent = "Testing the API connection…";

  try {
    const data = await ownerRequest("/api/admin/test", {
      method: "POST",
      body: JSON.stringify({})
    });

    providerName.textContent = data.provider || providerName.textContent;
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
