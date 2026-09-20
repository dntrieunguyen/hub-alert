# Hub Alert

<p align="center">
  <strong>Personal RSS & Intelligence Alert Collector</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node Version">
  <img src="https://img.shields.io/badge/typescript-%5E5.0-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/docker-ready-blue.svg" alt="Docker">
</p>

---

## Giới thiệu (Overview)

**Hub Alert** là nền tảng cá nhân tổng hợp tin tức và phát hiện cảnh báo thị trường theo thời gian thực (Real-time Market & Intelligence Alert Platform). Được phát triển mở rộng trên nền tảng engine RSSHub, Hub Alert tích hợp sâu hệ sinh thái **Collector & Intelligence** để tự động cào dữ liệu, phân tích thông minh qua DeepSeek AI, chấm điểm mức độ ảnh hưởng (Impact Scoring), phát hiện xu hướng và phát cảnh báo trực tiếp đến các kênh chat (Google Chat, Telegram).

---

## Tính năng nổi bật (Key Features)

### 1. Nguồn tin tức phong phú (Modular RSS Feeds)
- Tận dụng hệ thống routing mạnh mẽ hỗ trợ hàng ngàn nguồn tin, mạng xã hội (Twitter/X, Telegram, Reddit, GitHub, Báo chí tài chính, Crypto news...).
- Cơ chế caching linh hoạt (Memory, Redis) giúp tiết kiệm băng thông và tối ưu hiệu năng.

### 2. Bộ xử lý thông minh (Intelligence Collector - `lib/collector`)
- **Automated Scheduling**: Tự động kích hoạt chu kỳ cào tin định kỳ (mặc định mỗi 15 phút hoặc tùy chỉnh cron).
- **DeepSeek AI Analysis**: Tự động phân tích nội dung bài viết, tóm tắt ý chính và đánh giá tác động thị trường.
- **Crypto Digest Formatter**: Định dạng bản tin tổng hợp thị trường tiền điện tử chuyên sâu, kèm phân tích xu hướng.
- **Impact Scoring (0 - 100)**: Tự động chấm điểm mức độ quan trọng để chỉ phát cảnh báo với các tin tức thực sự giá trị (ngưỡng tùy chỉnh).
- **Deduplication Engine**: Lọc trùng lặp thông minh qua mã băm và độ tương đồng nội dung, loại bỏ tin rác.
- **Trend Detection**: Nhận diện các chủ đề nóng và token/dự án đang được thảo luận nhiều nhất.

### 3. Đa kênh thông báo (Multi-channel Notifications)
- **Google Chat Webhook**: Gửi các thẻ thông báo (Interactive Cards) được định dạng chuyên nghiệp với điểm số tác động, nhãn phân loại và tóm tắt AI.
- **Telegram Bot**: Hỗ trợ đẩy tin tức tức thì về group hoặc channel riêng.

---

## Kiến trúc hệ thống (Architecture)

```
[RSS Sources / Web Scraping]
          │
          ▼
    [Hub Alert Engine]
          │
          ├─► [Cache Layer: Redis / Memory]
          │
          └─► [Intelligence Collector (`lib/collector`)]
                    │
                    ├─► Deduplication (Lọc trùng lặp)
                    ├─► AI Analysis & Crypto Digest (DeepSeek)
                    ├─► Impact Scoring (Chấm điểm tác động)
                    └─► Dispatcher ──► [Google Chat / Telegram]
```

---

## Bắt đầu nhanh (Quick Start)

### Yêu cầu hệ thống (Prerequisites)
- **Node.js**: >= 20.0.0
- **Package Manager**: `pnpm` (khuyến nghị)
- **Docker & Docker Compose** (nếu triển khai qua container)
- **Redis** (tùy chọn, khuyến nghị cho môi trường production)

---

### 1. Cấu hình môi trường (.env)

Sao chép file `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Các biến môi trường quan trọng:

```ini
# Cấu hình Server
NODE_ENV=production
PORT=1200
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379

# Cấu hình Collector & Intelligence
COLLECTOR_AUTO_START=true
COLLECTOR_CRON="*/15 * * * *"
RSSHUB_BASE_URL=http://localhost:1200

# Google Chat Webhook Alert
GOOGLE_CHAT_ENABLED=true
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...
GOOGLE_CHAT_MIN_IMPACT_SCORE=80

# DeepSeek AI Integration
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

---

### 2. Chạy với Docker Compose (Khuyến nghị)

```bash
# Khởi động toàn bộ stack (Hub Alert, Redis, Browserless)
docker compose up -d

# Xem log hoạt động
docker compose logs -f rsshub
```

Truy cập giao diện tại: `http://localhost:1200`

---

### 3. Chạy trực tiếp trên Local (Development)

```bash
# Cài đặt dependencies
pnpm install

# Khởi chạy chế độ phát triển (watch mode)
pnpm dev
```

---

## Danh sách API của Collector

Hệ thống cung cấp các REST API endpoints để quản lý và kích hoạt Collector thủ công:

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| `GET` | `/api/collector/status` | Lấy trạng thái hiện tại, số lượng tin đã xử lý và số liệu thống kê |
| `POST` | `/api/collector/start` | Khởi động cron job thu thập tin tức |
| `POST` | `/api/collector/stop` | Tạm dừng cron job thu thập |
| `POST` | `/api/collector/run-now` | Kích hoạt ngay lập tức một chu kỳ cào tin và phân tích |
| `POST` | `/api/collector/digest` | Tạo và gửi bản tin tổng hợp Crypto Digest thủ công |

---

## Triển khai (Deployment)

Hub Alert hỗ trợ đa dạng nền tảng triển khai:
- **Docker Container**: Triển khai trên bất kỳ máy chủ VPS hoặc cloud provider nào qua file `Dockerfile` và `docker-compose.yml`.
- **Render / Railway**: Sử dụng Docker build service với cổng `1200`.
- **Cloudflare Workers**: Hỗ trợ build dạng serverless worker (`pnpm run worker-build`).

---

## Tác quyền & Giấy phép (License & Credits)

- Dự án thuộc quyền sở hữu cá nhân của **[@dntrieunguyen](https://github.com/dntrieunguyen)**.
- Xây dựng và kế thừa kiến trúc từ dự án mã nguồn mở RSSHub.
- Phát hành dưới giấy phép [AGPL-3.0 License](./LICENSE).
