# GEMINI.md — Hướng dẫn cho AI agent (đọc file này TRƯỚC TIÊN)

Bạn đang xây **Traffic Time**: game 3D mô phỏng giao thông THẬT ở Việt Nam để người lái còn non tay luyện tập (xe máy + ô tô).

## Quyền hạn
- Bạn có **TOÀN QUYỀN** với repo: tạo / sửa / xoá / đổi tên / cài thêm package. **Không cần hỏi lại**, cứ làm và ghi chú trong `CHANGELOG.md`.
- Mọi thứ trong `src/kit/`, `public/assets/`, `reference/` là **nguyên liệu gợi ý**: dùng cái nào tốt thì dùng, sửa tuỳ ý, thấy dở thì xoá.
- `src/App.tsx` hiện chỉ là màn hình thử tài nguyên — hãy thay bằng game thật.

## Thứ tự đọc
1. `docs/01-GAME-SPEC.md` — yêu cầu đầy đủ (phím, xe, camera, đồ hoạ, map, âm thanh).
2. `docs/02-VN-TRAFFIC-RULES.md` — luật & thói quen giao thông VN cần mô phỏng.
3. `docs/03-ARCHITECTURE.md` — kiến trúc code đề xuất + hiệu năng.
4. `docs/04-ASSETS.md` — danh mục model/âm thanh có sẵn, kích thước, cách scale.
5. `docs/05-SCENARIOS.md` — các bài tập/tình huống luyện lái.

## Luật cứng (không được vi phạm)
- Phím đã chốt: W/↑/K ga · S/↓ lùi · A/← D/→ lái · Space/L phanh · E/F còi · T đèn pha.
- Đồ hoạ 3D **không neon, không bloom, không gradient** (kể cả UI/HUD: màu phẳng). Không dùng UnrealBloomPass.
- Có minimap. Có 3 góc nhìn thứ 3 + 1 góc nhìn thứ nhất cho cả xe máy và ô tô.
- Lái bên PHẢI, tay lái ô tô bên TRÁI. Đèn đỏ rút ngắn ~10 s cho game.
- Giữ nguyên chuỗi model AI (model strings) nếu có trong code.
- Dùng emoji thay icon SVG trong UI.
- Mỗi lần xong một phần lớn: chạy `npm run build` và sửa hết lỗi TypeScript.
