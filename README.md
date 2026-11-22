# 🛵 Traffic Time — Luyện lái trong giao thông Việt Nam (3D)

Game mô phỏng giao thông VN thật (xe máy + ô tô) để người mới tập lái. Repo này được chuẩn bị sẵn để AI (Gemini trong Google AI Studio) xây game.

- **Cách dùng với AI Studio:** xem [`PROMPT_AI_STUDIO.md`](PROMPT_AI_STUDIO.md)
- **AI đọc trước:** [`GEMINI.md`](GEMINI.md) → `docs/`
- Chạy local: `npm install && npm run dev` (cổng 3000)

## Cấu trúc
```
GEMINI.md / AGENTS.md   hướng dẫn cho AI agent
PROMPT_AI_STUDIO.md     system instructions + prompt đầu tiên
docs/                   đặc tả game, luật giao thông VN, kiến trúc, tài nguyên, bài tập
src/kit/                module khởi đầu (điều khiển, động lực học xe, IDM, đèn tín hiệu, biển báo VN, texture)
public/assets/          model 3D + âm thanh CC0
reference/              code tham khảo MIT (âm thanh động cơ, mô phỏng giao thông, game đua xe)
```
Giấy phép tài nguyên: [`CREDITS.md`](CREDITS.md).
