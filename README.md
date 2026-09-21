# Hub Alert

<p align="center">
  <strong>Hệ thống tổng hợp tin tức và phát hiện cảnh báo thị trường thông minh theo thời gian thực</strong><br>
  <em>Real-time Market & Intelligence Alert Platform</em>
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

## 📖 Giới thiệu (Overview)

**Hub Alert** là giải pháp nền tảng chuyên biệt phục vụ thu thập dữ liệu, phân tích thông minh và phát cảnh báo thị trường tự động theo thời gian thực. Hệ thống được thiết kế hướng tới việc giải quyết triệt để vấn đề "nhiễu loạn thông tin" trong thị trường tài chính và tiền điện tử (Crypto, Memecoins, Macroeconomics).

Tích hợp kiến trúc **Collector & Intelligence** hiện đại kết hợp sức mạnh từ mô hình ngôn ngữ lớn **DeepSeek AI**, Hub Alert liên tục quét hàng trăm kênh dữ liệu, loại bỏ trùng lặp thông minh, tự động chấm điểm độ quan trọng (Impact Scoring), trích xuất tín hiệu then chốt và lập tức phát cảnh báo trực quan đến các kênh trao đổi công việc (Google Chat, Telegram).

---

## ✨ Tính năng nổi bật (Key Features)

### 1. Thu thập đa nguồn chuyên sâu (Multi-Tier Ingestion)
- **Nguồn chính thống (Tier 1 - Official)**: Thông báo niêm yết/hủy niêm yết từ Binance, OKX, thông cáo báo chí từ Ủy ban Chứng khoán Hoa Kỳ (SEC), Cục Dự trữ Liên bang Mỹ (Federal Reserve), Ethereum Foundation, Solana Foundation,...
- **Báo chí & Kênh tin tức uy tín (Tier 2 - News)**: CoinDesk, Cointelegraph, Decrypt, The Block, Blockworks, Foresight News, Odaily, ChainCatcher, CNBC Finance/Economy, Jin10,...
- **Nghiên cứu & Báo cáo chuyên sâu (Tier 3 - Research)**: Messari Research, Bankless, Blog cá nhân của Vitalik Buterin,...
- **Cộng đồng & Mạng xã hội (Tier 4 - Social & Community)**:
  - Tích hợp quét trực tiếp mạng xã hội Twitter/X (các tài khoản lãnh đạo vĩ mô, cơ quan chính phủ, sàn giao dịch, dự án cốt lõi và KOLs săn alpha) qua cơ chế xác thực token phiên làm việc.
  - Theo dõi diễn biến thảo luận cộng đồng trên Reddit (`r/CryptoCurrency`, `r/memecoins`, `r/solana`).

### 2. Bộ xử lý thông minh (Intelligence Collector Pipeline)
- **Lọc trùng lặp đa lớp (Deduplication Engine)**: Kết hợp băm chuỗi nội dung (SHA-256), chuẩn hóa URL gốc và so khớp tương đồng văn bản để triệt tiêu hoàn toàn các tin tức bị xào xáo hoặc đưa tin lại từ nhiều đầu báo.
- **Phân tích chuyên sâu với DeepSeek AI**:
  - Dịch thuật và biên tập tự động sang Tiếng Việt chuẩn xác với văn phong tài chính chuyên nghiệp.
  - Nhận diện xu hướng tác động thị trường: **Tích cực (Bullish)**, **Tiêu cực (Bearish)** hoặc **Trung lập (Neutral)**.
  - Trích xuất tự động danh sách các Token/Ticker liên quan (`BTC`, `ETH`, `SOL`,...).
  - Đúc kết ngắn gọn nguyên nhân cốt lõi và khuyến nghị hành động chiến lược.
- **Hệ thống chấm điểm tác động (Impact & Ranking Scoring)**:
  - Điểm độ tin cậy của nguồn (`Credibility`: 0 - 100).
  - Điểm tác động thị trường (`Impact Score`: 0 - 100).
  - Điểm giá trị thông tin và độ phù hợp thị trường (`Information Value` & `Market Relevance`).

### 3. Bản tin Crypto Digest & Cảnh báo khẩn cấp (Hot News Fast-Path)
- **Bản tin định kỳ Top 10 Crypto Intelligence**:
  - Tự động biên soạn và phát hành vào các khung giờ vàng: **05:00 Sáng**, **11:00 Trưa** và **17:00 Chiều** (múi giờ `Asia/Ho_Chi_Minh`).
  - Thuật toán đa dạng hóa nội dung (Diversity rules) giúp bản tin cân bằng, không bị áp đảo bởi một đồng coin hoặc một nguồn tin duy nhất.
- **Kênh cảnh báo khẩn cấp (Critical Alert Fast-Path)**:
  - Bỏ qua chu kỳ chờ định kỳ để đẩy tin tức lập tức nếu phát hiện sự kiện nhạy cảm có điểm tác động cực cao (`Impact Score >= 90/95`).

### 4. Đa kênh thông báo trực quan (Visual Multi-Channel Notifications)
- **Google Chat Interactive Cards**: Trình bày bằng thẻ tương tác đẹp mắt với dải màu theo thang điểm tác động, nhãn phân loại, tóm tắt AI và nút liên kết trực tiếp đến bài viết gốc.
- **Telegram Alert**: Đẩy tin nhắn định dạng phong phú tức thì về nhóm hoặc kênh riêng tư.

---

## 🏗️ Kiến trúc hệ thống (Architecture)

```
[ Nguồn dữ liệu: Sàn giao dịch / Báo chí / X / Reddit / Cơ quan vĩ mô ]
                               │
                               ▼
                   [ Bộ nạp dữ liệu Ingestion ]
                               │
                               ▼
                   [ Deduplication Engine ]
                   (Lọc trùng lặp & chuẩn hóa URL)
                               │
                               ▼
            [ DeepSeek AI & Scoring Processing ]
            ├─ Phân tích ngữ cảnh & xu hướng
            ├─ Tóm tắt súc tích tiếng Việt
            └─ Chấm điểm: Impact / Credibility / Relevance
                               │
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
[ Cảnh báo khẩn cấp ]                       [ Bản tin Crypto Digest ]
(Impact Score >= 90/95)                     (Khung giờ 05:00, 11:00, 17:00)
        │                                             │
        └──────────────────────┬──────────────────────┘
                               ▼
                    [ Dispatcher Trung tâm ]
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
    [ Google Chat Webhook ]            [ Telegram Bot ]
```

---

## 🚀 Bắt đầu nhanh (Quick Start)

### Yêu cầu hệ thống (Prerequisites)
- **Node.js**: Phiên bản `>= 20.0.0`
- **Quản lý gói**: `pnpm` (khuyến nghị)
- **Docker & Docker Compose** (khuyến nghị cho môi trường triển khai)
- **Redis** (tùy chọn bộ nhớ đệm hiệu năng cao)

---

### 1. Thiết lập biến môi trường (.env)

Sao chép file cấu hình mẫu `.env.example`:

```bash
cp .env.example .env
```

Cấu hình các tham số cốt lõi trong `.env`:

```ini
# --- CẤU HÌNH HỆ THỐNG ---
NODE_ENV=production
PORT=1200
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379

# --- BỘ LẬP LỊCH COLLECTOR ---
COLLECTOR_AUTO_START=true
RSSHUB_BASE_URL=http://localhost:1200

# --- CẢNH BÁO GOOGLE CHAT ---
GOOGLE_CHAT_ENABLED=true
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=YOUR_KEY
GOOGLE_CHAT_MIN_IMPACT_SCORE=80

# --- TÍCH HỢP AI DEEPSEEK ---
AI_NEWS_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-flash
AI_NEWS_LANGUAGE=vi
AI_NEWS_REQUIRE_VIETNAMESE=true

# --- BẢN TIN CRYPTO DIGEST & HOT NEWS ---
CRYPTO_DIGEST_ENABLED=true
CRYPTO_CRITICAL_ALERT_ENABLED=true
CRYPTO_CRITICAL_ALERT_THRESHOLD=95
AI_HOT_NEWS_ENABLED=true
AI_HOT_NEWS_MIN_IMPACT_SCORE=90

# --- NGUỒN X (TWITTER) COOKIE (TÙY CHỌN) ---
TWITTER_AUTH_TOKEN=your_twitter_auth_token_cookie
```

---

### 2. Khởi chạy bằng Docker Compose (Khuyến nghị)

Khởi động toàn bộ cụm dịch vụ bao gồm Hub Alert, Redis và trình duyệt mô phỏng:

```bash
# Khởi động dịch vụ nền
docker compose up -d

# Theo dõi nhật ký log hệ thống
docker compose logs -f
```

Giao diện dịch vụ sẽ hoạt động tại: `http://localhost:1200`

---

### 3. Khởi chạy trực tiếp (Local Development)

```bash
# Cài đặt các thư viện phụ thuộc
pnpm install

# Khởi chạy chế độ phát triển (hot-reload)
pnpm dev
```

---

## 📡 Danh sách REST API của Collector

Hub Alert cung cấp hệ thống endpoint đầy đủ để giám sát và điều khiển thủ công:

| Phương thức | Đường dẫn | Mô tả chi tiết |
|---|---|---|
| `GET` | `/api/collector/feeds/latest` *(hoặc `/latest`)* | Lấy danh sách tin tức phân tích mới nhất, tự động đẩy lên Google Chat nếu đủ điều kiện điểm (`?limit=20`, `?notify=false`) |
| `GET` | `/api/collector/status` | Xem tình trạng hoạt động, lịch trình cron và thống kê số lượng tin đã xử lý |
| `POST` | `/api/collector/start` | Kích hoạt chu kỳ lập lịch thu thập tự động |
| `POST` | `/api/collector/stop` | Tạm dừng chu kỳ lập lịch thu thập |
| `POST` | `/api/collector/run-now` | Ép hệ thống thực hiện ngay một chu kỳ quét và phân tích tin tức tức thời |
| `POST` | `/api/collector/digest` | Tổng hợp và kích hoạt gửi ngay bản tin Top 10 Crypto Digest |
| `POST` | `/api/collector/notifications/google-chat/test` | Bắn thẻ tin nhắn mẫu kiểm tra tính sẵn sàng của webhook Google Chat |

---

## ⚙️ Bảng tham số cấu hình chính (.env)

| Biến môi trường | Mặc định | Ý nghĩa & Mục đích |
|---|---|---|
| `PORT` | `1200` | Cổng HTTP mà máy chủ lắng nghe |
| `CACHE_TYPE` | `memory` | Loại bộ đệm lưu trữ (`memory` hoặc `redis`) |
| `REDIS_URL` | - | Chuỗi kết nối máy chủ Redis (nếu dùng cache redis) |
| `COLLECTOR_AUTO_START` | `true` | Tự động kích hoạt collector khi máy chủ khởi động |
| `GOOGLE_CHAT_ENABLED` | `false` | Bật/tắt phát thông báo qua Google Chat |
| `GOOGLE_CHAT_WEBHOOK_URL`| - | Đường dẫn Webhook của Google Chat Space tiếp nhận tin |
| `GOOGLE_CHAT_MIN_IMPACT_SCORE` | `80` | Điểm tác động tối thiểu để kích hoạt thông báo Google Chat thông thường |
| `AI_PROVIDER` | `deepseek` | Nhà cung cấp trí tuệ nhân tạo (`deepseek`) |
| `DEEPSEEK_API_KEY` | - | Khóa API DeepSeek |
| `DEEPSEEK_MODEL` | `deepseek-flash`| Mô hình AI phân tích tin tức (`deepseek-flash` hoặc `deepseek-chat`) |
| `AI_HOT_NEWS_ENABLED` | `true` | Cho phép cảnh báo tức thời các tin tức cực kỳ quan trọng |
| `AI_HOT_NEWS_MIN_IMPACT_SCORE` | `90` | Ngưỡng điểm tác động để kích hoạt tin nóng tức thời |
| `CRYPTO_DIGEST_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ phát hành bản tin định kỳ |
| `CRYPTO_CRITICAL_ALERT_THRESHOLD` | `95` | Ngưỡng điểm kích hoạt cảnh báo khẩn cấp bypass |
| `TWITTER_AUTH_TOKEN` | - | Cookie xác thực tài khoản Twitter/X để nạp dữ liệu mạng xã hội |

---

## 🌐 Triển khai môi trường Production (Deployment)

Hệ thống được đóng gói tối ưu để dễ dàng vận hành trên nhiều nền tảng:
- **Máy chủ chuyên dụng / VPS**: Triển khai nhanh chóng qua Docker và Docker Compose.
- **Nền tảng đám mây PaaS (Render, Railway, Fly.io)**: Triển khai từ kho mã nguồn với `Dockerfile`.
- **Ansible Automation**: Hỗ trợ kịch bản tự động hóa cài đặt bare-metal tại thư mục [`scripts/ansible`](./scripts/ansible/README.md).

---

## 📄 Tác quyền & Giấy phép (License)

- Bản quyền dự án thuộc về **[@dntrieunguyen](https://github.com/dntrieunguyen)**.
- Phát hành và phân phối theo giấy phép [AGPL-3.0 License](./LICENSE).
