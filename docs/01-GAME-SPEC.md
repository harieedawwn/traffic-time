# 01 — Đặc tả game Traffic Time

## Mục tiêu
Trình mô phỏng lái xe trong giao thông Việt Nam thật: **xe máy chiếm đa số (~75–80%)**, có ô tô, taxi, xe buýt, xe tải, xe đạp, người đi bộ, chó mèo chạy qua đường. Người chơi là người mới, cần tập: giữ làn, quan sát gương, xi-nhan, nhường đường, dừng đèn đỏ, rẽ khó, đi vòng xuyến, xử lý tình huống bất ngờ.

## Điều khiển (đã chốt — xem `src/kit/input/controls.ts`)
| Phím | Chức năng |
|---|---|
| W, ↑, K | Ga / tiến |
| S, ↓ | Lùi (khi đứng yên) / phanh nhẹ khi đang chạy |
| A ←, D → | Lái trái / phải |
| Space, L | Phanh |
| E, F | Bấm còi |
| T | Đèn pha (tắt → cốt → pha) |
| Đề xuất thêm | Q/R xi-nhan trái/phải, H khẩn cấp, C/V đổi camera, M minimap, 1/2 chọn xe, P/Esc tạm dừng |

Bàn phím → giá trị analog làm mượt (ga/phanh/lái không giật). Có màn hình hiển thị phím.

## Phương tiện người chơi
- **Xe số kiểu Wave 110** và **xe tay ga kiểu Vision** (thông số trong `src/kit/vehicles/dynamics.ts`), **sedan hạng B** (Vios/Accent).
- Xe máy: nghiêng khi vào cua (lean = atan(v·ω/g)), chúi khi phanh, bánh quay, tay lái xoay, chân chống, người lái đội mũ bảo hiểm.
- Ô tô: vô-lăng xoay theo lái, đồng hồ tốc độ/vòng tua thật, đèn xi-nhan nháy trên taplo, cần gạt, gương chiếu hậu **hoạt động thật** (render-to-texture bằng camera phụ, độ phân giải thấp, cập nhật mỗi 2 frame).

## Camera (4 chế độ, chuyển mượt)
1. TPS gần (sau lưng, thấp) · 2. TPS xa (cao hơn, thấy giao lộ) · 3. TPS chéo trên cao (quan sát toàn cảnh, kiểu "drone") · 4. **FPV**.
- **FPV xe máy**: mắt ~1.45 m; thấy đồng hồ xe (kim/LCD), tay lái, 2 gương, đôi tay đeo găng nắm tay lái, mép mũ bảo hiểm/kính chắn gió mờ ở rìa trên; rung nhẹ theo mặt đường, nghiêng theo lean, FOV 75–85 tăng nhẹ theo tốc độ.
- **FPV ô tô**: ghế lái bên trái, thấy taplo, vô-lăng, cụm đồng hồ, gương trong + 2 gương ngoài, cột A che tầm nhìn (điểm mù thật), nắp capo.
- Cho phép nhìn trái/phải (giữ chuột phải kéo, hoặc phím Z/X nhìn sang) để tập quan sát.

## Đồ hoạ
- three.js, PBR (MeshStandardMaterial), ACES tone mapping nhẹ, bóng đổ (CSM hoặc 1 DirectionalLight bám theo người chơi), fog tuyến tính nhẹ cho xa.
- **CẤM**: neon, bloom, gradient (bầu trời dùng màu phẳng/ảnh, UI màu phẳng).
- Chi tiết nhỏ VN: cột điện bê tông + bó dây điện chằng chịt, biển hiệu cửa hàng chữ Việt, nhà ống 3–6 tầng nhiều màu, ban công cây cảnh, máy lạnh, bồn nước inox trên mái, cửa cuốn, quán cóc ghế nhựa trên vỉa hè, xe máy đậu vỉa hè, gốc cây quét vôi trắng, ổ gà, nắp cống, vạch kẻ mờ, xe đẩy bán hàng.
- Instancing (InstancedMesh) cho xe NPC, cây, cột, nhà; gộp geometry tĩnh; LOD theo khoảng cách.
- Ngày/đêm + mưa là bonus (đèn pha bật T phải chiếu sáng thật bằng SpotLight).

## Bản đồ (nhiều map, mỗi map khác hẳn nhau)
1. **Phố cổ** (kiểu Hà Nội): đường hẹp 1 chiều, nhà ống sát nhau, ngã tư không đèn, vỉa hè lấn chiếm.
2. **Trung tâm đại lộ** (kiểu Q1 Sài Gòn): đường 4–6 làn có dải phân cách, làn riêng xe máy, vòng xuyến lớn, đèn có đếm ngược, đèn mũi tên rẽ trái.
3. **Khu dân cư + hẻm**: hẻm 2–3 m, ngã ba chữ T khuất tầm nhìn, gương cầu lồi, chợ tạm, trường học (giờ tan học).
4. **Ngoại ô / quốc lộ**: xe tải, xe khách, cây số, đường giao đường ưu tiên, cầu dốc, quay đầu xe, trạm xăng.
- Mạng đường lưu dạng đồ thị (node giao lộ + cạnh đường có số làn, chiều, giới hạn tốc độ, biển báo). Từ đồ thị sinh mesh đường, vạch, vỉa hè, nhà hai bên (seed khác nhau → khác nhau).
- **Minimap** góc dưới phải: vẽ Canvas 2D từ đồ thị đường, xoay theo hướng xe, có mũi tên người chơi, chấm đèn tín hiệu, điểm đến; phím M phóng to.

## Âm thanh (Web Audio API, xem `docs/04-ASSETS.md`)
- Động cơ: loop mẫu thật (`kenney-engine-motorcycle.ogg`, `kenney-engine-car.ogg`, `rg-engine.mp3`) chỉnh `playbackRate` theo RPM + lớp tổng hợp (procedural, tham khảo `reference/engine-sound-generator`).
- Còi xe máy VN: 2 tone ~420 Hz & ~500 Hz hơi rè, tấn công nhanh; còi ô tô: `rg-honk.mp3`.
- Xi-nhan tạch-tạch (relay), phanh rít `rg-tire-brake.mp3`, trượt `kenney-skid.ogg`, va chạm `rg-crash.mp3`, nền phố: tiếng xe xa (noise lọc) + còi ngẫu nhiên xa xa — **âm thanh đặc trưng nhất của phố VN**.
- Âm thanh 3D (PannerNode) cho xe NPC gần, giới hạn số voice.

## Hệ thống chấm điểm luyện lái
- 12 điểm như GPLX (Luật 2024): trừ khi vượt đèn đỏ, đi ngược chiều, sai làn, không xi-nhan, quá tốc độ, không nhường người đi bộ, va chạm, đi lên vỉa hè.
- Thông báo ngắn tiếng Việt giải thích lỗi + mẹo (ví dụ: "Rẽ phải khi đèn đỏ chỉ được phép khi có biển phụ cho phép").
- Chế độ: Lái tự do · Bài tập (docs/05) · Thử thách giờ cao điểm.

## UI
- Tiếng Việt, font Be Vietnam Pro, màu phẳng, emoji làm icon. Menu: chọn xe, chọn map, chọn chế độ, mật độ giao thông, giờ trong ngày, âm lượng.
- HUD: tốc độ km/h, số, giới hạn tốc độ hiện tại (biển tròn), trạng thái đèn/xi-nhan, điểm GPLX, nhắc nhở.
