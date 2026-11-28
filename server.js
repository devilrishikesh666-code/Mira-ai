import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: "40kb" }));
app.use(express.static(path.join(__dirname, "public")));

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const provider = process.env.OPENROUTER_API_KEY ? "OpenRouter" : "OpenAI";
const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";

const client = new OpenAI({
  apiKey,
  ...(provider === "OpenRouter"
    ? {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "MIRA AI"
        }
      }
    : {})
});

let activeModel =
  process.env.OPENROUTER_MODEL ||
  process.env.OPENAI_MODEL ||
  (provider === "OpenRouter" ? "openrouter/auto" : "gpt-4.1-mini");
let aiEnabled = true;

const MIRA_INSTRUCTIONS = `
You are MIRA, a helpful AI assistant created by Rishikesh Singh.

Personality:
- Friendly, confident, thoughtful and respectful.
- Speak naturally and clearly.
- Explain difficult topics in simple steps.
- Help with learning, writing, coding, creativity and everyday questions.
- Be honest when you do not know something.
- Do not claim to have performed actions you cannot perform.
- Do not ask users for passwords, API keys or private credentials.
- Keep responses age-appropriate and safe.
`;

function isOwnerRequest(req) {
  const expected = process.env.OWNER_DASHBOARD_TOKEN;
  const supplied = req.get("x-owner-token") || "";

  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function ownerOnly(req, res, next) {
  if (!process.env.OWNER_DASHBOARD_TOKEN) {
    return res.status(503).json({
      error: "Owner dashboard is not configured on the server."
    });
  }

  if (!isOwnerRequest(req)) {
    return res.status(401).json({
      error: "Owner authentication failed."
    });
  }

  next();
}

function safeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((item) =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim()
    )
    .slice(-16)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 5000)
    }));
}

async function createChatReply(messages, ownerMode = false) {
  const ownerInstruction = ownerMode
    ? "Verified Owner Mode is active. The server has verified the private owner code, so the person speaking is Rishikesh Singh, the owner and creator of MIRA AI. Address him respectfully as the owner when relevant, help with coding, prompting, project planning, and dashboard questions, and never reveal or repeat the owner code."
    : "Owner Mode is not active. Treat the person as a normal visitor and do not claim they are the owner.";

  const response = await client.chat.completions.create({
    model: activeModel,
    messages: [
      { role: "system", content: `${MIRA_INSTRUCTIONS}\n\n${ownerInstruction}` },
      ...messages
    ],
    temperature: 0.7
  });

  return response.choices?.[0]?.message?.content || "I could not generate a response.";
}

app.get("/api/health", (req, res) => {
  res.json({
    online: true,
    assistant: "MIRA AI",
    provider,
    model: activeModel,
    enabled: aiEnabled,
    apiKeyConfigured: Boolean(apiKey)
  });
});

/* PUBLIC CHAT API */

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!aiEnabled) {
      return res.status(503).json({
        error: "MIRA AI is temporarily disabled by the owner."
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: "The server API key has not been configured. Add OPENROUTER_API_KEY or OPENAI_API_KEY to the server environment."
      });
    }

    const messages = safeMessages(req.body?.messages);

    if (!messages.length) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const ownerMode = isOwnerRequest(req);
    const reply = await createChatReply(messages, ownerMode);
    res.json({ reply, provider, model: activeModel, ownerMode });
  } catch (error) {
    console.error("Chat API error:", error.message);

    res.status(500).json({
      error: "MIRA could not respond right now. Please try again."
    });
  }
});

/* OWNER API CONTROL PANEL */

app.get("/api/admin/status", adminLimiter, ownerOnly, (req, res) => {
  res.json({
    provider,
    model: activeModel,
    enabled: aiEnabled,
    apiKeyConfigured: Boolean(apiKey)
  });
});

app.post("/api/admin/config", adminLimiter, ownerOnly, (req, res) => {
  const { model, enabled } = req.body || {};

  if (typeof model !== "string" || !/^[a-zA-Z0-9._:\/-]{2,120}$/.test(model.trim())) {
    return res.status(400).json({
      error: "Enter a valid model name, for example openrouter/auto or openai/gpt-4o-mini."
    });
  }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      error: "The enabled setting must be true or false."
    });
  }

  activeModel = model.trim();
  aiEnabled = enabled;

  res.json({
    success: true,
    provider,
    model: activeModel,
    enabled: aiEnabled
  });
});

app.post("/api/admin/test", adminLimiter, ownerOnly, async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "No API key is configured. Add OPENROUTER_API_KEY or OPENAI_API_KEY to the server environment."
      });
    }

    const message = await createChatReply([
      { role: "user", content: "Reply with exactly: MIRA API connection successful." }
    ]);

    res.json({
      success: true,
      provider,
      model: activeModel,
      message
    });
  } catch (error) {
    console.error("API test error:", error.message);

    res.status(500).json({
      success: false,
      error: "API test failed. Check the server key, model and API access."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MIRA AI running on port ${PORT} with ${provider} (${activeModel})`);
});
