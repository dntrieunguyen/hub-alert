# X / Twitter Authoritative Intelligence Sources

Tài liệu đặc tả và ma trận xác minh các tài khoản X (Twitter) có thẩm quyền cao trong data pipeline Crypto / Meme / Macro Intelligence.

---

## 1. Kiến trúc Layer

```text
Official / Trusted X Accounts
            ↓
   RSSHub (/twitter/user/:handle)
            ↓
       X Collector
            ↓
    Normalize / Extract (URLs, RTs, Quotes)
            ↓
       Verification (Compromise Defense)
            ↓
      Event Detection (Listings, ETFs, Central Bank, Policy)
            ↓
      Event Aggregator (Rolling 20-min window)
            ↓
       Database & API
```

---

## 2. Ma trận nguồn Authoritative X Accounts

| Handle | Organization | Type (`XSourceType`) | Priority | Credibility | Official Domain | Topics | RSSHub Route | Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `@federalreserve` | Federal Reserve | `CENTRAL_BANK` | P0 | 100 | `federalreserve.gov` | Rates, FOMC, Inflation, QT, QE | `/twitter/user/federalreserve` | Yes |
| `@USTreasury` | U.S. Treasury | `GOVERNMENT_AGENCY` | P0 | 100 | `home.treasury.gov` | Sanctions, OFAC, Stablecoins, Debt | `/twitter/user/USTreasury` | Yes |
| `@SECGov` | SEC | `GOVERNMENT_AGENCY` | P0 | 100 | `sec.gov` | ETF, Enforcement, Securities | `/twitter/user/SECGov` | Yes |
| `@CFTC` | CFTC | `GOVERNMENT_AGENCY` | P0 | 100 | `cftc.gov` | Derivatives, Futures, Perpetuals | `/twitter/user/CFTC` | Yes |
| `@BLS_gov` | Bureau of Labor Statistics | `GOVERNMENT_AGENCY` | P0 | 100 | `bls.gov` | CPI, PPI, Jobs, NFP, Unemployment | `/twitter/user/BLS_gov` | Yes |
| `@WhiteHouse` | The White House | `GOVERNMENT_INSTITUTION` | P0 | 100 | `whitehouse.gov` | Executive Orders, Sanctions, Tariffs | `/twitter/user/WhiteHouse` | Yes |
| `@POTUS` | POTUS Institutional | `GOVERNMENT_INSTITUTION` | P0 | 100 | `whitehouse.gov` | Policy, Tariffs, Sanctions | `/twitter/user/POTUS` | Yes |
| `@realDonaldTrump` | Donald Trump | `PUBLIC_OFFICIAL` | P0 | 90 | — | Crypto, Tariffs, Economy | `/twitter/user/realDonaldTrump` | Yes |
| `@ECB` | European Central Bank | `CENTRAL_BANK` | P0 | 100 | `ecb.europa.eu` | Euro, Rates, Inflation, Digital Euro | `/twitter/user/ECB` | Yes |
| `@bankofengland` | Bank of England | `CENTRAL_BANK` | P0 | 100 | `bankofengland.co.uk` | Rates, GBP, Financial Stability | `/twitter/user/bankofengland` | Yes |
| `@RobinhoodApp` | Robinhood (US) | `BROKER` | P0 | 95 | `robinhood.com` | Listings, Memecoins, PEPE, SHIB | `/twitter/user/RobinhoodApp` | Yes |
| `@RobinhoodApp_EU` | Robinhood EU Crypto | `BROKER` | P0 | 95 | `robinhood.com` | EU Crypto, Token Listings | `/twitter/user/RobinhoodApp_EU` | Yes |
| `@CoinbaseMarkets` | Coinbase Markets | `EXCHANGE` | P0 | 95 | `coinbase.com` | Spot/Futures Listings, Asset Support | `/twitter/user/CoinbaseMarkets` | Yes |
| `@Coinbase` | Coinbase Main | `EXCHANGE` | P1 | 90 | `coinbase.com` | Web3, Announcements | `/twitter/user/Coinbase` | Yes |
| `@binance` | Binance | `EXCHANGE` | P0 | 95 | `binance.com` | Launchpool, Listings, Futures | `/twitter/user/binance` | Yes |
| `@ethereum` | Ethereum | `CRYPTO_PROJECT` | P1 | 95 | `ethereum.org` | Upgrades, Mainnet, Hard fork | `/twitter/user/ethereum` | Yes |
| `@solana` | Solana | `CRYPTO_PROJECT` | P1 | 92 | `solana.com` | Outage, Validator, Performance | `/twitter/user/solana` | Yes |
| `@base` | Base | `CRYPTO_PROJECT` | P1 | 92 | `base.org` | Sequencer, Bridge, Layer 2 | `/twitter/user/base` | Yes |
| `@arbitrum` | Arbitrum | `CRYPTO_PROJECT` | P1 | 90 | `arbitrum.io` | Nitro, Sequencer, Layer 2 | `/twitter/user/arbitrum` | Yes |
| `@Optimism` | Optimism | `CRYPTO_PROJECT` | P1 | 90 | `optimism.io` | Superchain, Fault Proofs | `/twitter/user/Optimism` | Yes |
| `@chainlink` | Chainlink | `CRYPTO_PROJECT` | P1 | 90 | `chain.link` | Oracles, CCIP, Data Feeds | `/twitter/user/chainlink` | Yes |

---

## 3. Nguyên tắc phòng vệ tài khoản bị chiếm đoạt (Compromised Account Defense)

> **Tuyệt đối không:** `if (source.official) confirmed = true;`

1. **Official Source + Official Domain Link** (ví dụ `@SECGov` đính kèm link `sec.gov`):
   - Phân loại: `CONFIRMED_PRIMARY_SOURCE`.
2. **Official Source không có Domain Link**:
   - Phân loại: `OFFICIAL_SOCIAL_ONLY`.
   - Giúp ngăn chặn các tin đồn sai lệch hoặc trường hợp tài khoản mạng xã hội bị hack công bố tin giả gây sốc thị trường.
3. **Public Official (Quan chức chính phủ)**:
   - Phát ngôn của quan chức được gán `ATTRIBUTED_STATEMENT` và `isEnactedPolicy = false`.
   - Không tự động biến phát ngôn chính trị thành chính sách nhà nước (`GOVERNMENT_POLICY`) cho đến khi có văn bản công bố chính thức từ cơ quan quản lý (`whitehouse.gov`, `sec.gov`, v.v.).

---

## 4. Tách biệt Tin đồn vs Sự kiện chính thức (Broker / Exchange vs Influencer)

- `@RobinhoodApp` hoặc `@CoinbaseMarkets` công bố niêm yết `$PEPE`:
  - `eventType: "BROKER_LISTING"` hoặc `"EXCHANGE_LISTING"`
  - `impactScore: 90 - 92`
  - Đưa vào pipeline ưu tiên P0.
- Influencer / Tài khoản cộng đồng nhắc đến `$PEPE`:
  - `eventType: "SOCIAL_MENTION"` hoặc `"MEME_MENTION"`
  - `impactScore: 20 - 25`

---

## 5. Event Aggregation (Gộp sự kiện 20 phút)

Khi nhiều nguồn cùng đề cập đến một token trong cửa sổ 20 phút:
```json
{
  "symbol": "PEPE",
  "event": "PEPE_MULTI_EXCHANGE_LISTING_CONSENSUS",
  "officialSources": 3,
  "newsSources": 1,
  "socialMentions": 342,
  "mentionVelocity": 4.1,
  "trendScore": 94
}
```

---

## 6. Các Endpoint API hỗ trợ

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/collector/x/sources` | Danh sách cấu hình các tài khoản X thẩm quyền (`type`, `priority`) |
| `GET` | `/api/collector/x/aggregations` | Sự kiện gộp multi-source trong cửa sổ 20 phút (`symbol`) |
| `GET` | `/api/collector/feeds?platform=X` | Lọc tin từ nguồn X (`sourceType`, `handle`, `verification`, `type`) |
| `GET` | `/api/collector/market/events` | Lọc sự kiện thị trường (`verification=CONFIRMED_PRIMARY_SOURCE`, `type=EXCHANGE_LISTING`) |
