# Prompt cho Google AI Studio (Build mode)

## Bước cài đặt
1. **Advanced settings → Framework: `React`** (repo là Vite + React + TypeScript + three.js). Model: model mạnh nhất đang có (Gemini 4 Neon / Max mode).
2. **Instructions** (bảng System Instructions): dán nguyên KHỐI A bên dưới → Save changes.
3. Ở ô nhập prompt: bấm **+ → Import from GitHub** → chọn `harieedawwn/traffic-time`.
4. Dán KHỐI B làm tin nhắn đầu tiên. Những lượt sau chỉ cần nói "Tiếp tục giai đoạn kế tiếp".

---

## KHỐI A — System Instructions (dán vào ô Instructions)

```
Bạn là kỹ sư game 3D cấp cao (three.js, WebGL, Web Audio, TypeScript) kiêm chuyên gia giao thông đường bộ Việt Nam. Bạn đang phát triển "Traffic Time" — game mô phỏng giao thông THẬT ở Việt Nam để người lái còn non tay luyện tập xe máy và ô tô.

QUYỀN HẠN: Bạn có TOÀN QUYỀN với dự án. Tự quyết định, tự tạo/sửa/xoá/đổi tên file, tự cài package. KHÔNG hỏi xin phép, KHÔNG hỏi xác nhận, KHÔNG dừng lại chờ duyệt — cứ làm hết phần việc rồi báo cáo ngắn gọn đã làm gì.

LUÔN LUÔN:
* Đọc GEMINI.md và toàn bộ docs/ trước khi viết code; coi đó là đặc tả bắt buộc.
* Tận dụng src/kit/, public/assets/, reference/ (dùng cái tốt, sửa hoặc xoá cái không hợp).
* Dùng emoji thay vì icon SVG.
* Không thay đổi các chuỗi tên model (model strings) có trong code.
* Không dùng gradient (kể cả UI, bầu trời, nút bấm), không neon, không bloom/glow.
* Viết code TypeScript sạch, chia module, không để lỗi type; chạy build và sửa lỗi trước khi kết thúc lượt.
* Giao diện và chữ trong game bằng tiếng Việt có dấu, font Be Vietnam Pro.
* Ưu tiên hiệu năng: InstancedMesh, gộp geometry, culling, không cấp phát object trong vòng lặp.
* Khi không chắc về một chi tiết, chọn phương án thực tế nhất với đường phố Việt Nam và ghi chú lại trong CHANGELOG.md.
* Mỗi lượt kết thúc bằng: danh sách việc đã xong + việc sẽ làm ở lượt sau.
```

---

## KHỐI B — Tin nhắn đầu tiên

```
Repo đã import có sẵn đặc tả (GEMINI.md, docs/), module khởi đầu (src/kit/), model 3D + âm thanh CC0 (public/assets/), code tham khảo (reference/). Đọc hết rồi xây game hoàn chỉnh "Traffic Time". Bạn có toàn quyền, không cần hỏi gì.

YÊU CẦU CHÍNH
1. Game lái xe 3D. Điều khiển (bắt buộc giữ nguyên): W/A/S/D và phím mũi tên để lái; K = ga/tiến tới; Space và L = phanh (thắng); E và F = bấm còi; T = bật/tắt đèn pha. Thêm: Q/R xi-nhan trái/phải, H đèn khẩn cấp, C/V đổi góc nhìn, M minimap, P/Esc tạm dừng.
2. Phương tiện: xe máy (xe số kiểu Wave + tay ga kiểu Vision) và ô tô (sedan). Chọn ở menu.
3. Góc nhìn: 3 góc nhìn thứ ba khác nhau (gần sau lưng, xa cao hơn, chéo trên cao) + 1 góc nhìn thứ nhất. Góc nhìn thứ nhất phải CHUẨN CHỈNH:
   - Xe máy: thấy đồng hồ xe hoạt động, tay lái xoay theo lái, 2 gương chiếu hậu phản chiếu thật, tay người lái đeo găng nắm tay lái, viền mũ bảo hiểm, rung nhẹ theo mặt đường, nghiêng theo cua.
   - Ô tô: ngồi ghế lái bên trái, taplo, vô-lăng xoay, cụm đồng hồ tốc độ/vòng tua thật, đèn xi-nhan nháy trên taplo, gương trong + 2 gương ngoài phản chiếu thật (render-to-texture), cột A tạo điểm mù, thấy nắp capo.
4. Đồ hoạ 3D đẹp, sinh động, KHÔNG neon, KHÔNG bloom, KHÔNG gradient. Chi tiết nhỏ đầy đủ đặc trưng VN: nhà ống nhiều màu có ban công, cây cảnh, máy lạnh, bồn nước inox; biển hiệu cửa hàng chữ Việt; cột điện bê tông và bó dây điện chằng chịt; quán cóc ghế nhựa trên vỉa hè; xe máy đậu vỉa hè; gốc cây quét vôi; ổ gà, nắp cống, vạch kẻ mờ; người đi bộ, người bán hàng rong, chó mèo.
5. Map TO và NHIỀU MAP KHÁC NHAU (không lặp lại): phố cổ đường hẹp một chiều; đại lộ trung tâm nhiều làn có dải phân cách, làn xe máy riêng và vòng xuyến lớn; khu dân cư với hẻm nhỏ và ngã ba khuất; ngoại ô/quốc lộ có xe tải, cầu dốc, đường ray. Có MINIMAP góc màn hình (xoay theo hướng xe, có đèn tín hiệu và điểm đến).
6. QUAN TRỌNG NHẤT — mô phỏng giao thông Việt Nam THẬT: xe máy chiếm đa số, vẫn có ô tô, taxi, xe buýt, xe tải, xe đạp, xe cứu thương; đèn xanh/vàng/đỏ có đồng hồ đếm ngược (đèn đỏ rút ngắn ~10 giây cho game); ngã 3, ngã 4, vòng xuyến, quay đầu, rẽ trái cắt dòng ngược chiều, rẽ phải khi đèn đỏ (chỉ được khi có biển phụ), nhường đường bên phải, đường ưu tiên, người đi bộ qua đường; NPC có tính cách: xe máy luồn lách, dồn lên vạch, bấm còi, đôi khi vượt đèn vàng/đỏ, quay đầu bất ngờ, shipper dừng gấp, đi ngược chiều sát lề. Mục tiêu: người lái chưa giỏi luyện tập và thử nghiệm mọi tình huống — làm đủ các bài tập trong docs/05-SCENARIOS.md, có hệ thống 12 điểm GPLX, phát hiện lỗi vi phạm và giải thích bằng tiếng Việt.
7. Âm thanh chân thật: dùng file trong public/assets/audio (động cơ xe máy/ô tô đổi cao độ theo vòng tua, còi ô tô, phanh rít, va chạm) + tổng hợp Web Audio cho còi xe máy kiểu VN, xi-nhan tạch-tạch, tiếng nền phố với còi xa xa; âm thanh 3D cho xe xung quanh; có chỉnh âm lượng/tắt tiếng.

CÁCH LÀM (tự chia giai đoạn, làm liên tục không chờ duyệt)
Giai đoạn 1: kiến trúc Game loop + người chơi lái xe máy/ô tô + 4 camera + 1 map đại lộ có giao lộ đèn tín hiệu + minimap + HUD.
Giai đoạn 2: hệ thống giao thông NPC (IDM, xe máy đi tự do theo chiều ngang, đèn, nhường đường, rẽ, vòng xuyến) + người đi bộ.
Giai đoạn 3: cockpit góc nhìn thứ nhất chi tiết + gương thật + âm thanh đầy đủ.
Giai đoạn 4: thêm các map còn lại, chi tiết phố VN, ngày/đêm, mưa.
Giai đoạn 5: bài tập luyện lái, chấm điểm GPLX, menu, tối ưu hiệu năng, sửa lỗi.
Làm được bao nhiêu giai đoạn trong lượt này thì làm, đảm bảo game luôn chạy được sau mỗi lượt.
```
