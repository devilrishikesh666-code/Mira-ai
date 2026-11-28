# MIRA AI

MIRA AI is a premium AI assistant web app created by **Rishikesh Singh**. It features an elegant chat interface, an owner API control dashboard, and server-side support for **OpenRouter** or **OpenAI**.

## Features

- Beautiful gold-and-black assistant interface
- Chat with MIRA from a responsive web UI
- OpenRouter support with models such as `openrouter/auto`
- OpenAI fallback support
- Owner dashboard for model and enable/disable settings
- Server-side API keys for better security
- Rate limiting and security headers
- Voice input and optional spoken replies in supported browsers
- Markdown-style formatting for assistant replies
- Local chat history in the browser

## Tech stack

- Node.js
- Express
- OpenAI SDK configured for OpenRouter or OpenAI
- HTML, CSS, and JavaScript

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Add your OpenRouter key:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/auto
OWNER_DASHBOARD_TOKEN=replace_with_a_long_random_secret
PORT=3000
```

Start the app:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## OpenRouter models

You can change the model in `.env` or from the owner dashboard. Examples:

- `openrouter/auto`
- `openai/gpt-4o-mini`
- `anthropic/claude-3.5-sonnet`
- `google/gemini-2.0-flash-001`
- `meta-llama/llama-3.3-70b-instruct`

Model availability depends on your OpenRouter account and credits.

## Owner dashboard and Owner Mode

Set a private owner code in your server environment:

```env
OWNER_DASHBOARD_TOKEN=replace_with_a_long_random_secret
```

Open the **API Control** tab in the website and enter that same code. The server verifies it with a timing-safe comparison. When the code is correct, the dashboard unlocks and chat enters **Owner Mode**: MIRA is told by the server that the verified owner, Rishikesh Singh, is speaking. Visitors without the correct code remain in normal mode and cannot unlock the dashboard.

The owner code is never stored in the browser's local storage and is cleared when the page is closed or Owner Mode is locked. Do not share the code or commit it to GitHub.

The dashboard can:

- View provider and API-key status
- Change the active model
- Enable or disable public chat
- Test the API connection

Dashboard changes are kept in server memory and reset when the server restarts. For permanent model changes, update `.env`.

## Security

Never commit real API keys or owner tokens. Keep secrets in `.env` locally or in your hosting provider's environment variables.

## Scripts

```bash
npm start   # Start the server
npm run dev # Start with Node watch mode
npm run check # Syntax-check server and browser JavaScript
```

## Project structure

```text
.
├── server.js
├── package.json
├── .env.example
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## Creator

Designed and developed by **Rishikesh Singh**.
