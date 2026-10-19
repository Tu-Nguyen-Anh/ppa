# ppa — Thiệp 20/10

Thiệp chúc mừng ngày Phụ nữ Việt Nam 20/10: một bó hoa hồng mở ra ảnh, trôi vào
bầu trời sao với những lời chúc rơi và sao băng, kèm một lá thư và nhạc nền.

## Cấu trúc

- **`preview-app/`** — ứng dụng Angular 20 chạy được, dùng để xem/preview thiệp.
  - `src/app/components/women-day/women-day-bouquet/` — component thiệp (bó hoa, cảnh
    trời sao `women-day-scene.ts`, lá thư).
  - `src/app/app.component.ts` — dữ liệu demo (người nhận, lời chúc, chữ chạy).
  - `public/images/women-day/` — ảnh hoa (WebP); `public/audio/women-day-bg.mp3` — nhạc nền.
- **`women-day/`**, **`women-day-bouquet/`** — bản gốc (assets + fragment component) được tách ra ban đầu.

## Chạy local

```bash
cd preview-app
npm install
npm start      # mở http://localhost:4200
```

Chạm vào bó hoa để ảnh nở ra → quà tự mở → vào cảnh trời sao; nút **Thư** (trái) mở
lá thư, nút loa (phải) bật/tắt nhạc nền.

Muốn đổi nội dung (tên người nhận, lời chúc, chữ chạy), sửa `demo` trong
`preview-app/src/app/app.component.ts`.
