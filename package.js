
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

app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "public")));

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let activeModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
let aiEnabled = true;

const MIRA_INSTRUCTIONS = `
You are MIRA, a helpful AI assistant.

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

function ownerOnly(req, res, next) {
  const expected = process.env.OWNER_DASHBOARD_TOKEN;
  const supplied = req.get("x-owner-token") || "";

  if (!expected) {
    return res.status(503).json({
      error: "Owner dashboard is not configured on the server."
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  const valid =
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);

  if (!valid) {
    return res.status(401).json({
      error: "Owner authentication failed."
    });
  }

  next();
}

app.get("/api/health", (req, res) => {
  res.json({
    online: true,
    assistant: "MIRA AI"
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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "The server API key has not been configured."
      });
    }

    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const safeMessages = messages
      .filter((item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      )
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 5000)
      }));

    if (!safeMessages.length) {
      return res.status(400).json({
        error: "No valid messages were received."
      });
    }

    const response = await client.responses.create({
      model: activeModel,
      instructions: MIRA_INSTRUCTIONS,
      input: safeMessages
    });

    res.json({
      reply: response.output_text || "I could not generate a response."
    });
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
    provider: "OpenAI",
    model: activeModel,
    enabled: aiEnabled,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/admin/config", adminLimiter, ownerOnly, (req, res) => {
  const { model, enabled } = req.body || {};

  if (typeof model !== "string" || !/^[a-zA-Z0-9._-]{2,80}$/.test(model)) {
    return res.status(400).json({
      error: "Enter a valid model name."
    });
  }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      error: "The enabled setting must be true or false."
    });
  }

  activeModel = model;
  aiEnabled = enabled;

  res.json({
    success: true,
    model: activeModel,
    enabled: aiEnabled
  });
});

app.post("/api/admin/test", adminLimiter, ownerOnly, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "OPENAI_API_KEY is missing from the server environment."
      });
    }

    const result = await client.responses.create({
      model: activeModel,
      input: "Reply with exactly: MIRA API connection successful."
    });

    res.json({
      success: true,
      message: result.output_text || "The API responded successfully."
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
  console.log(`MIRA AI running on port ${PORT}`);
});
