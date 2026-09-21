# Hub Alert

<p align="center">
  <strong>Real-time Market & Intelligence Alert Platform</strong><br>
  <em>Automated collection, DeepSeek AI analysis, impact scoring, and multi-channel alerting</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node Version">
  <img src="https://img.shields.io/badge/typescript-%5E5.0-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/docker-ready-blue.svg" alt="Docker">
  <img src="https://img.shields.io/badge/AI-DeepSeek-purple.svg" alt="DeepSeek AI">
  <img src="https://img.shields.io/badge/alerts-Google%20Chat%20%7C%20Telegram-orange.svg" alt="Alert Channels">
</p>

<p align="center">
  <a href="./README.md">🇻🇳 Tiếng Việt</a> | <a href="./README_EN.md">🇬🇧 English</a>
</p>

---

## 📖 Overview

**Hub Alert** is a dedicated, real-time intelligence gathering and market alert platform. It is engineered to solve information overload and signal-to-noise ratio challenges in cryptocurrency, financial markets, and macroeconomics.

Powered by a robust **Collector & Intelligence** architecture and integrated with **DeepSeek AI**, Hub Alert continuously ingests data from hundreds of sources, deduplicates news, evaluates market significance via an intelligent Impact Scoring algorithm, and dispatches visually rich notifications directly to communication channels (Google Chat, Telegram).

---

## ✨ Key Features

### 1. Multi-Tier Data Ingestion
- **Official Sources (Tier 1)**: Listing & delisting announcements from top exchanges (Binance, OKX), official press releases from the SEC, US Federal Reserve, Ethereum Foundation, Solana Foundation.
- **Top Financial & Crypto Media (Tier 2)**: CoinDesk, Cointelegraph, Decrypt, The Block, Blockworks, Foresight News, Odaily, ChainCatcher, CNBC Finance/Economy, Jin10.
- **Fundamental & Macro Research (Tier 3)**: Messari Research, Bankless, Vitalik Buterin's technical blog.
- **Social Media & Community Intelligence (Tier 4)**:
  - Live Twitter/X tracking of key macro figures, government regulators, crypto foundations, and alpha hunters via session authentication.
  - Social sentiment and emerging discussion tracking on Reddit (`r/CryptoCurrency`, `r/memecoins`, `r/solana`).

### 2. Intelligent Collector Pipeline
- **Multi-layer Deduplication Engine**: Combines SHA-256 content hashing, canonical URL normalization, and fuzzy string similarity to filter out duplicate reporting and regurgitated articles across different publishers.
- **DeepSeek AI Market Intelligence**:
  - Contextual summaries and key takeaway synthesis.
  - Market sentiment classification: **Bullish**, **Bearish**, or **Neutral**.
  - Token and ticker extraction (`BTC`, `ETH`, `SOL`, etc.).
  - Strategic takeaways and actionable implications.
- **Impact & Relevance Scoring**:
  - `Credibility Score` (0 - 100): Weighted by source tier and reliability.
  - `Impact Score` (0 - 100): Assessed potential to influence price or market direction.
  - `Information Value` & `Market Relevance`.

### 3. Crypto Digest & Critical Fast-Path Alerts
- **Top 10 Crypto Intelligence Digest**:
  - Scheduled generation during peak market hours: **05:00 Morning**, **11:00 Noon**, and **17:00 Evening** (`Asia/Ho_Chi_Minh` timezone).
  - Built-in diversity constraints (limits per source, token, and topic) to prevent single-event saturation.
- **Critical Alert Fast-Path**:
  - Immediately bypasses schedule windows and broadcasts critical events if `Impact Score >= 90/95`.

### 4. Rich Multi-Channel Notifications
- **Google Chat Interactive Cards**: Visual cards with color-coded impact badges, category labels, AI takeaways, and one-click access to original source URLs.
- **Telegram Bot**: Instant dispatch to private channels or team groups.

---

## 🏗️ System Architecture

```
[ Data Ingestion: Exchanges / Media / X / Reddit / Macro Agencies ]
                                │
                                ▼
                       [ Ingestion Core ]
                                │
                                ▼
                     [ Deduplication Engine ]
                 (Content hashing & URL cleanup)
                                │
                                ▼
              [ DeepSeek AI & Scoring Engine ]
              ├─ Semantic analysis & translation
              ├─ Structured summary extraction
              └─ Scoring: Impact / Credibility / Relevance
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[ Critical Fast-Path ]                        [ Scheduled Crypto Digest ]
(Impact Score >= 90/95)                       (05:00, 11:00, 17:00 Windows)
        │                                               │
        └───────────────────────┬───────────────────────┘
                                ▼
                     [ Central Dispatcher ]
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
     [ Google Chat Webhook ]             [ Telegram Bot ]
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **Package Manager**: `pnpm` (recommended)
- **Docker & Docker Compose** (recommended for production)
- **Redis** (optional, recommended for production caching)

---

### 1. Environment Configuration (.env)

Copy the example environment configuration:

```bash
cp .env.example .env
```

Configure core environment parameters:

```ini
# --- SYSTEM CONFIGURATION ---
NODE_ENV=production
PORT=1200
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379

# --- COLLECTOR SCHEDULER ---
COLLECTOR_AUTO_START=true
RSSHUB_BASE_URL=http://localhost:1200

# --- GOOGLE CHAT NOTIFICATIONS ---
GOOGLE_CHAT_ENABLED=true
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=YOUR_KEY
GOOGLE_CHAT_MIN_IMPACT_SCORE=80

# --- DEEPSEEK AI INTEGRATION ---
AI_NEWS_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-flash
AI_NEWS_LANGUAGE=vi
AI_NEWS_REQUIRE_VIETNAMESE=true

# --- CRYPTO DIGEST & FAST-PATH ALERTS ---
CRYPTO_DIGEST_ENABLED=true
CRYPTO_CRITICAL_ALERT_ENABLED=true
CRYPTO_CRITICAL_ALERT_THRESHOLD=95
AI_HOT_NEWS_ENABLED=true
AI_HOT_NEWS_MIN_IMPACT_SCORE=90

# --- TWITTER/X COOKIE (OPTIONAL) ---
TWITTER_AUTH_TOKEN=your_twitter_auth_token_cookie
```

---

### 2. Run with Docker Compose (Recommended)

Start the entire stack (Hub Alert, Redis, and headless browser container):

```bash
# Launch background services
docker compose up -d

# Follow system logs
docker compose logs -f
```

Access the service at: `http://localhost:1200`

---

### 3. Local Development

```bash
# Install dependencies
pnpm install

# Start development server with hot-reload
pnpm dev
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/collector/feeds/latest` *(or `/latest`)* | Retrieve the latest analyzed intelligence feeds. Automatically pushes to Google Chat if criteria match (`?limit=20`, `?notify=false`). |
| `GET` | `/api/collector/status` | Check scheduler status, active cron schedules, and processed item statistics. |
| `POST` | `/api/collector/start` | Start the automated collector polling scheduler. |
| `POST` | `/api/collector/stop` | Pause the automated collector polling scheduler. |
| `POST` | `/api/collector/run-now` | Trigger an immediate ad-hoc scan and intelligence analysis cycle. |
| `POST` | `/api/collector/digest` | Generate and broadcast the Top 10 Crypto Intelligence Digest immediately. |
| `POST` | `/api/collector/notifications/google-chat/test` | Dispatch a sample card to verify Google Chat webhook connectivity. |

---

## ⚙️ Configuration Matrix (.env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `1200` | HTTP port for the server |
| `CACHE_TYPE` | `memory` | Caching backend (`memory` or `redis`) |
| `REDIS_URL` | - | Redis connection URL |
| `COLLECTOR_AUTO_START` | `true` | Automatically starts collector on boot |
| `GOOGLE_CHAT_ENABLED` | `false` | Enables Google Chat webhook alerts |
| `GOOGLE_CHAT_WEBHOOK_URL`| - | Webhook URL for Google Chat space |
| `GOOGLE_CHAT_MIN_IMPACT_SCORE` | `80` | Minimum impact score threshold for Google Chat dispatch |
| `AI_PROVIDER` | `deepseek` | AI provider (`deepseek`) |
| `DEEPSEEK_API_KEY` | - | DeepSeek API authentication key |
| `DEEPSEEK_MODEL` | `deepseek-flash`| Model identifier (`deepseek-flash` or `deepseek-chat`) |
| `AI_HOT_NEWS_ENABLED` | `true` | Enables real-time fast-path alerts |
| `AI_HOT_NEWS_MIN_IMPACT_SCORE` | `90` | Minimum impact score required for real-time fast-path |
| `CRYPTO_DIGEST_TIMEZONE` | `Asia/Ho_Chi_Minh` | Timezone for scheduled digests |
| `CRYPTO_CRITICAL_ALERT_THRESHOLD` | `95` | Threshold for immediate critical bypass alerts |
| `TWITTER_AUTH_TOKEN` | - | Session cookie for Twitter/X ingestion |

---

## 🌐 Production Deployment

- **VPS / Bare-Metal**: Deploy with Docker Compose or automated Ansible playbooks in [`scripts/ansible`](./scripts/ansible/README.md).
- **PaaS (Render, Railway, Fly.io)**: Build and run using the provided `Dockerfile`.
- **Serverless Worker**: Supports worker builds (`pnpm run worker-build`).

---

## 📄 License

- Created and maintained by **[@dntrieunguyen](https://github.com/dntrieunguyen)**.
- Released under the [AGPL-3.0 License](./LICENSE).
