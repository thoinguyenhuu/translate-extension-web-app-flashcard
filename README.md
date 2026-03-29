# Vocabulary Extension + Web App

Chrome Extension để tra từ và web app để ôn từ vựng. Dữ liệu dùng Supabase.

## Cấu trúc

```text
.
├─ extension/            # Chrome Extension (Manifest V3)
├─ web/                  # Web app React + Vite
├─ scripts/
│  └─ generate-config.js # Sinh extension/config.js từ .env
├─ supabase/
│  └─ schema.sql         # SQL tạo bảng vocabulary
└─ .env                  # Biến môi trường dùng chung
```

## Yêu cầu

- Node.js 18+
- Google Chrome
- Tài khoản Supabase

## 1. Tạo project Supabase

1. Vào [https://supabase.com](https://supabase.com)
2. Đăng ký hoặc đăng nhập
3. Tạo `New project`
4. Chờ project khởi tạo xong
5. Vào `SQL Editor`
6. Chạy toàn bộ file `supabase/schema.sql`

Sau đó lấy 2 giá trị trong `Project Settings`:
- `Project URL`
- `anon` / `publishable` key

Không dùng `service_role` key cho app này.

## 2. Tạo file `.env`

Tạo file `.env` ở thư mục gốc:

```env
DEEPL_API_KEY=your_deepl_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_or_publishable_key
```

Ý nghĩa:
- `DEEPL_API_KEY`: dùng cho extension để dịch
- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_KEY`: chỉ dùng `anon/publishable key`

## 3. Cài và chạy Chrome Extension

### Bước 1: Sinh config cho extension

Từ thư mục gốc, chạy:

```powershell
node scripts/generate-config.js
```

Lệnh này sẽ tạo:

```text
extension/config.js
```

### Bước 2: Load extension vào Chrome

1. Mở `chrome://extensions`
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Chọn thư mục:

```text
extension/
```

### Bước 3: Dùng extension

1. Bấm icon extension
2. Nhập từ cần tra
3. Dịch và lưu theo flow hiện tại của extension

Nếu bạn sửa `.env`, cần chạy lại:

```powershell
node scripts/generate-config.js
```

sau đó `Reload` extension trong `chrome://extensions`.

## 4. Chạy web app local

```powershell
cd web
npm install
npm run dev
```

Build production:

```powershell
cd web
npm run build
```

## 5. Deploy web lên Vercel

Thiết lập:

- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment Variables trên Vercel:

- `SUPABASE_URL`
- `SUPABASE_KEY`

`DEEPL_API_KEY` không cần cho web nếu web không gọi DeepL.

## 6. Bảo mật liên quan tới `.env`

Các điểm hiện tại ổn:

- `.env` đã nằm trong `.gitignore`
- `extension/config.js` đã nằm trong `.gitignore`
- `web/dist` và `web/node_modules` cũng đã được ignore

Các điểm cần lưu ý:

1. Không bao giờ đưa `service_role` key vào `.env`
Chỉ dùng `SUPABASE_KEY` là `anon/publishable key`.

2. `SUPABASE_KEY` ở web là public theo thiết kế
Vì web chạy client-side, key này sẽ xuất hiện phía trình duyệt. Điều này chấp nhận được nếu đó là `anon/publishable key` và Supabase có RLS/policy đúng.

3. `DEEPL_API_KEY` trong extension không thực sự bí mật
Extension là client-side. Sau khi generate `extension/config.js`, key sẽ đi theo extension đã load. Nghĩa là người dùng cuối có thể lấy được key này nếu họ muốn.

4. Không commit các file sau
- `.env`
- `extension/config.js`

5. Nếu lỡ lộ key
- Rotate `DEEPL_API_KEY`
- Rotate `SUPABASE anon/publishable key` nếu cần

## 7. Khuyến nghị bảo mật

Nếu muốn production an toàn hơn:

- Không gọi DeepL trực tiếp từ extension
- Chuyển phần dịch sang server/edge function
- Giữ DeepL key ở backend thay vì trong `.env` cho client

Với kiến trúc hiện tại:
- Supabase `anon/publishable key`: chấp nhận được ở frontend
- DeepL API key: chưa an toàn tuyệt đối nếu để trong extension

## 8. Troubleshooting

### Extension không chạy sau khi đổi `.env`

Chạy lại:

```powershell
node scripts/generate-config.js
```

rồi reload extension.

### Web không lấy được dữ liệu Supabase

Kiểm tra:
- `SUPABASE_URL` đúng project
- `SUPABASE_KEY` là `anon/publishable key`
- đã chạy `supabase/schema.sql`

### Xóa dữ liệu trên web lỗi

Khả năng cao do policy/RLS của bảng `vocabulary` chưa cho phép `DELETE`.
