# Changelog

## 2026-11-22 — Hoàn thiện game 3D Traffic Time (Giai đoạn 1 → 5)
- **Kiến trúc & Vòng lặp game (`src/game/Game.ts`)**: Tách hoàn toàn vòng lặp 3D three.js khỏi React UI; hỗ trợ tự nhận diện Software WebGL (`afterDraw` pacing) và GPU 60 FPS; ánh sáng mặt trời + `RoomEnvironment` + sương mù tuyến tính (không neon, không bloom, không gradient).
- **Phương tiện & Góc nhìn thứ nhất chi tiết (`src/game/player/PlayerVehicle.ts`, `CameraRig.ts`)**:
  - Đủ 3 xe người chơi: Xe số Wave 110, Xe tay ga Vision 110, Ô tô Sedan hạng B (tay lái bên trái).
  - Đủ 4 chế độ camera chuyển mượt: TPS gần, TPS xa, TPS chéo trên cao, và FPV buồng lái.
  - FPV xe máy: mặt đồng hồ sống (CanvasTexture), tay lái xoay + găng tay nắm ghi-đông, viền mũ bảo hiểm, 2 gương chiếu hậu phản chiếu thật (render-to-texture), rung nhẹ mặt đường và nghiêng theo cua.
  - FPV ô tô: ghế lái bên trái, taplo, vô-lăng xoay, cụm đồng hồ tốc độ + vòng tua + xi-nhan sống, cần gạt mưa, cột A tạo điểm mù thực tế, thấy nắp capo, 3 gương chiếu hậu phản chiếu thật (gương trong + 2 gương ngoài). Hỗ trợ liếc điểm mù bằng phím `Z`/`X` hoặc kéo chuột phải.
- **4 Bản đồ đặc trưng Việt Nam (`src/game/maps/mapDefs.ts`, `WorldBuilder.ts`)**:
  - Đại lộ Trung tâm (Q1): 4–6 làn, dải phân cách có điểm mở quay đầu, làn xe máy riêng R.412, vòng xuyến lớn R.303, đèn đếm ngược & biển phụ rẽ phải khi đèn đỏ.
  - Phố cổ Hà Nội: đường hẹp 1 chiều (I.407a), ngã tư đồng cấp không đèn, giới hạn 30 km/h.
  - Khu dân cư & Hẻm: hẻm hẹp 20 km/h, ngã ba chữ T khuất có gương cầu lồi, cổng trường học (W.225/W.224).
  - Ngoại ô & Quốc lộ 1A: tốc độ 60–80 km/h, cầu vượt dốc thật, đường ray tàu hỏa có barie tự động + tàu chạy qua, trạm xăng.
  - Chi tiết phố VN: nhà ống 2–6 tầng nhiều màu, cửa cuốn, biển hiệu cửa hàng chữ Việt, ban công, máy lạnh, bồn nước inox mái nhà, cột điện bê tông + bó dây điện chằng chịt, gốc cây quét vôi trắng, quán cóc ghế nhựa đỏ/xanh, xe máy đậu vỉa hè, nắp cống, ổ gà, vạch mắt võng.
  - Hỗ trợ 4 khung giờ (Sáng/Trưa/Chiều/Đêm với đèn pha SpotLight chiếu sáng thật) và 2 thời tiết (Nắng/Mưa làm dài quãng phanh + gạt mưa).
- **Mô phỏng giao thông NPC VN (`src/game/traffic/TrafficManager.ts`)**: ~76% xe máy/tay ga đi tự do chiều ngang (`pickLateralOffset`), luồn lách & dồn vạch đèn đỏ; ô tô, taxi xanh, xe buýt, xe tải, xe đạp, xe cứu thương hú còi; shipper dừng gấp; người đi bộ qua vạch ngựa vằn, bán hàng rong nón lá, chó băng qua đường.
- **Âm thanh Web Audio (`src/game/audio/AudioEngine.ts`)**: Dùng file CC0 động cơ xe máy/ô tô đổi cao độ theo RPM, còi ô tô, phanh rít, va chạm; tổng hợp còi xe máy 2 âm kiểu VN, xi-nhan tạch-tạch, nền phố với còi xa xa, còi hụ xe cứu thương; chỉnh âm lượng & tắt tiếng.
- **17 Bài tập luyện lái & Hệ thống 12 điểm GPLX (`src/game/rules/scenarios.ts`, `RuleChecker.ts`)**: Đầy đủ 17 bài từ `docs/05-SCENARIOS.md`, phát hiện vi phạm (vượt đèn đỏ, rẽ phải khi đèn đỏ không biển phụ, đi ngược chiều, quá tốc độ, sai làn R.412, không xi-nhan, leo vỉa hè, không nhường người đi bộ, vượt barie tàu hỏa, quên đèn ban đêm, va chạm) và giải thích tiếng Việt.
- **Giao diện tiếng Việt phẳng (`MenuScreen.tsx`, `HudOverlay.tsx`, `Modals.tsx`, `Minimap.ts`)**: Màu phẳng 100%, font Be Vietnam Pro, emoji làm icon, minimap xoay góc phải phóng to/thu nhỏ bằng `M`.
- **Kiểm thử & tinh chỉnh đồ họa (`PlayerVehicle.ts`, `CameraRig.ts`, `Game.ts`, `controls.ts`)**: Render tức thì tất cả gương chiếu hậu & cụm đồng hồ ngay khung đầu vào FPV; tinh chỉnh bố cục ghi-đông/găng tay xe máy và vô-lăng/taplo/nắp capo/cột A ô tô; đổ bóng tiếp xúc dạng oval mềm; nâng camera bay tổng quan ở màn hình tiêu đề & render khung 0 ngay khi khởi tạo/đổi kích thước; chạy mượt 7/7 unit test và 0 lỗi/cảnh báo trình duyệt.

## 2026-11-22 — Lột xác mô hình 3D, Cài đặt Đồ hoạ, Tối ưu WebGL & Giao diện không Emoji
- **Hệ thống Cài đặt Đồ hoạ trực tiếp (`src/game/graphics/GraphicsSettings.ts`, `MenuScreen.tsx`, `Modals.tsx`)**:
  - 4 mức đồ hoạ cài sẵn (**Thấp / Trung bình / Cao / Siêu nét**) lưu tự động trong `localStorage`, đổi trực tiếp từ Menu chính hoặc Menu Tạm dừng mà không mất tiến trình lái.
  - Tuỳ chỉnh chi tiết: Tỷ lệ độ phân giải (`Render Scale` 65%–125%), Chất lượng bóng đổ (`Tắt / Thấp 512 / Vừa 1024 / Cao 2048`), Tầm nhìn & Culling (`140–440m`), Gương chiếu hậu FPV (`Tắt / Thấp / Rõ nét`), Chi tiết sơn & mô hình (`Thấp / Vừa / Cao`), và tuỳ chọn bật/tắt bộ đếm **FPS & Draw Calls** trên HUD.
- **Lột xác mô hình xe 3D thực tế (`src/game/models/VehicleBuilder.ts`, `PlayerVehicle.ts`)**:
  - Chuyển sang thân xe tạo khối vát cạnh (`ExtrudeGeometry` bevel) theo dáng thực tế cho Sedan hạng B, Taxi Mai Linh, Xe buýt xanh Sài Gòn có bảng LED tuyến, Xe tải thùng gân sóng, Xe cứu thương mui cao, Xe máy số Wave 110, Tay ga Vision 110 và Xe đạp.
  - Bổ sung sơn phủ bóng `MeshPhysicalMaterial` (clearcoat), mâm đúc nhiều chấu + đĩa phanh + cụm kẹp phanh, lưới tản nhiệt, đèn pha/hậu rõ nét và biển số xe Việt Nam (`CanvasTexture`).
- **Lột xác con người & chó 3D có khớp giải phẫu (`src/game/models/HumanBuilder.ts`)**:
  - Tạo hình người 14 bộ phận khớp nối (khung chậu, eo, ngực, cổ, đầu, hàm, tóc, khẩu trang y tế tùy chọn, mũ bảo hiểm nửa đầu kính râm hoặc nón lá `LatheGeometry`, ba lô, cánh tay 2 khúc, chân 2 khúc, giày).
  - Hoạt ảnh bước đi hình sin tự nhiên cho người đi bộ (`animateHumanWalk`), tư thế cầm lái nghiêng người theo tay lái cho người đi xe máy (`animateHumanRide`), và chó 4 chân chạy có vẫy đuôi (`animateDogRun`).
- **Thủ thuật tối ưu hiệu năng WebGL chuyên sâu (`WorldBuilder.ts`, `TrafficManager.ts`, `Game.ts`)**:
  - **Static Geometry Batching (`mergeGeometries` theo vật liệu)**: Gộp toàn bộ hình khối tĩnh của thành phố (nhà ống, ban công, cột điện, cây cối, vạch kẻ, biển hiệu) để giảm số lệnh vẽ (draw calls) tĩnh từ hàng nghìn xuống chỉ vài chục draw calls.
  - **Shared Geometry & Material Pools (`VehicleAssetPool`, `HumanAssetPool`)**: Dùng chung toàn bộ bộ geometry & vật liệu cho 50–90 NPC mà không tạo bản sao thừa.
  - **Spatial Distance Culling & Animation LOD**: Ẩn NPC ngoài tầm nhìn (`drawDistance`) bằng khoảng cách bình phương không căn bậc hai, và chỉ cập nhật khớp tay chân / quay bánh xe cho các đối tượng ở tầm gần–trung.
  - **Texture Anisotropy động** & tái sử dụng vector/ma trận tránh rác bộ nhớ (zero-GC trong vòng lặp khung hình).
- **Loại bỏ 100% Emoji (`src/components/UiIcons.tsx`)**: Xoá sạch toàn bộ emoji trên toàn bộ giao diện, thay bằng bộ icon SVG hình học phẳng sắc nét (không gradient, không neon, giữ nguyên font Be Vietnam Pro và màu phẳng đặc trưng).

## 2026-11-22 — Chuyển phong cách Blocky / Voxel-Craft siêu chi tiết, Đèn giao thông sắc nét, Tương phản cao & Mở rộng Bản đồ
- **Phong cách Đồ hoạ Blocky / Voxel-Craft sắc nét & Tương phản cao (`Game.ts`, `textures.ts`, `WorldBuilder.ts`)**:
  - Giảm `environmentIntensity` xuống `0.24`, tăng ánh sáng mặt trời định hướng (`2.55–2.75`) đối lập ánh sáng đổ bóng bán cầu tông lạnh (`0.46–0.54`), nhựa đường than chì sẫm có vệt lốp (`#2f343b`) và `flatShading: true` giúp từng cạnh khối và bóng đổ nổi bật rõ rệt.
  - Thay cây tròn nhựa thành **cây xanh voxel 4 tầng vuông bậc thang** có bồn gạch và gốc quét vôi trắng vuông; nhà ống Việt Nam thêm khung cửa sổ nổi, cửa chớp xanh, bồn hoa ban công đất nung, mái hắt, dàn nóng máy lạnh có lưới quạt và cột điện bê tông vuông.
- **Đèn giao thông siêu rõ tầm xa (`src/kit/traffic/signalController.ts`)**:
  - Tăng kích thước hộp đèn (`0.62×1.72m`) có viền phản quang trắng, chụp che nắng 3 mặt sâu, thấu kính đỏ/vàng/xanh không bị giảm sáng tone-map (`toneMapped: false`), bảng LED đếm ngược cỡ lớn (`0.68×0.56m`) và đèn phụ tầm mắt đọc rõ từ hơn 120m.
- **Mở rộng quy mô toàn bộ 4 bản đồ (`src/game/maps/mapDefs.ts`, `TrafficManager.ts`)**:
  - Đại lộ Trung tâm mở rộng lên lưới 5×5 đô thị (`560m × 480m`), Phố cổ mở rộng lên lưới 4×4, Khu dân cư bổ sung vòng đại lộ bao quanh và Quốc lộ 1A kéo dài hơn `640m`, đi kèm mật độ giao thông và người đi bộ tăng tương xứng nhưng vẫn culling mượt mà.
- **Tái thiết kế siêu chi tiết từng phương tiện & con người dạng Blocky (`VehicleBuilder.ts`, `HumanBuilder.ts`)**:
  - **Xe buýt Sài Gòn 01**: Livery xanh–trắng–vàng, 7 ô cửa sổ có khung đố & nhìn xuyên thấy hàng ghế hành khách xanh, tay vịn vàng và khoang lái bên trong; 2 cửa lên xuống gấp đôi; 2 bảng LED tuyến trước/sau; 2 cụm điều hoà mái có lưới tản nhiệt; gương tai thỏ; 4 đèn pha + biển số vàng `51B-284.61`.
  - **Xe máy Wave 110 & Vision 110**: Loại bỏ hoàn toàn yếm vuông thô và phuộc lơ lửng; làm lại dàn áo tầng lớp sắc nét, ổ khoá + móc treo đồ, động cơ có cánh tản nhiệt, gác chân, ống xả có ốp chống nóng, phuộc sau lò xo kép, tay dắt inox, đĩa phanh + kẹp phanh vàng và gương chiếu hậu.
  - **Ô tô Sedan, Taxi Mai Linh, Xe tải, Xe cứu thương, Xe đạp**: Đầy đủ lưới tản nhiệt mạ crôm, đèn sương mù, gạt mưa, vây cá mập, tay nắm cửa, dải đèn hậu LED liền mạch, ống xả kép, ca-rô taxi, thùng xe tải gân sóng + thanh khoá cửa sau, dấu thập đỏ cứu thương và giỏ xe đạp.
  - **Người đi bộ, người lái xe & chó đường phố dạng Blocky**: Khớp nối liền mạch không còn khối hình nhộng rời rạc; khuôn mặt có mắt trắng + đồng tử + lông mày + mũi, tóc nhiều lớp, khẩu trang y tế, mũ bảo hiểm nửa đầu sọc thể thao có kính râm hoặc nón lá 4 tầng bậc thang, áo khoác có cổ/khoá kéo/túi/ba lô, giày thể thao hai tông màu; tay nắm chuẩn ghi-đông và chân đặt đúng gác chân xe máy.

## 2026-11-22 — Khắc phục triệt để lỗi chớp nháy 3D (Z-fighting & rung bóng đổ khi di chuyển)
- **Độ chính xác bộ đệm chiều sâu (`src/game/Game.ts`, `CameraRig.ts`)**:
  - Bật `logarithmicDepthBuffer: true` trên `WebGLRenderer` để triệt tiêu sai số chiều sâu từ `0.1m` đến `600m+`.
  - Tách `camera.near` linh hoạt: `0.28m` ở 3 góc nhìn thứ ba (TPS) và `0.10m` khi vào buồng lái (FPV).
- **Khoá lưới bóng đổ chống rung cạnh (`src/game/Game.ts`)**:
  - Cố định toạ độ camera bóng đổ của đèn mặt trời theo bước lưới `4m` (`Math.round(x / 4) * 4`) khi di chuyển, chấm dứt hoàn toàn hiện tượng viền bóng đổ bị chớp/trôi theo từng khung hình.
- **Triệt tiêu mặt phẳng trùng nhau trên toàn bộ bản đồ (`src/game/world/WorldBuilder.ts`)**:
  - Cắt gọn hai đầu mặt nhựa đường vào đúng mép ngã tư và vòng xuyến (`nodeTrimRadius`), đặt tấm ngã tư có `polygonOffset`, chấm dứt hiện tượng hai mặt đường ngang/dọc cắt nhau chớp nháy.
  - Dịch toàn bộ vỉa hè lùi hẳn ra ngoài mép bó vỉa `0.26m` để không còn trùng mặt đứng dọc lề đường.
  - Phân tầng độ cao rõ rệt (`3–6mm` + `polygonOffset`) cho ổ gà, nắp cống, đường chéo vạch mắt võng, vạch phân làn, vạch đi bộ, khung vạch mắt võng và vạch dừng.
  - Kiểm tra chống chồng lấn mặt bằng nhà ống tại các góc ngã tư và tách khoảng cách mặt ngoài cho cửa cuốn, khung cửa sổ, cửa chớp, chậu cây ban công, dàn nóng máy lạnh và viền mái.
- **Tách lớp chi tiết trên xe, biển báo & đèn tín hiệu (`PlayerVehicle.ts`, `VehicleBuilder.ts`, `signalController.ts`, `vnSigns.ts`)**:
  - Nâng bóng tiếp xúc mềm của xe lên trên lớp vạch kẻ (`y = 0.064`, `polygonOffset: -3`).
  - Nới khoảng cách giữa các lớp bánh xe (lốp/vành/đĩa phanh/trục), tách mặt hông thân Sedan và hốc bánh/cửa xe Buýt không còn mặt đồng phẳng.
  - Đẩy mặt trước/sau biển báo giao thông ra ngoài thân cột thép và tách tấm nền/bảng đếm ngược của đèn tín hiệu.

## 2026-11-22 — Tối ưu hiệu năng vượt trội (giảm mạnh Draw Calls & giữ FPS ổn định), Thành phố sống động & Lột xác Giao diện phẳng
- **Tối ưu hiệu năng WebGL & Giữ FPS ổn định (`signalController.ts`, `HumanBuilder.ts`, `TrafficManager.ts`, `RoadGraph.ts`, `Game.ts`, `GraphicsSettings.ts`)**:
  - **Gộp toàn bộ trụ đèn và hộp đèn giao thông (`mergeGeometries` theo vertex color)** + **ẩn trụ đèn ngoài tầm nhìn (distance culling)**: giảm hơn 90% lệnh vẽ từ hệ thống đèn tín hiệu trên bản đồ 5×5 Đại lộ Trung tâm.
  - **Gộp mô hình người ngồi xe máy NPC thành 1 lưới duy nhất dùng chung**: cắt giảm ~10× số draw call cho người lái xe máy xung quanh.
  - **Chuyển mô phỏng giao thông từ O(N²) sang O(N)** bằng bảng phân nhóm tuyến đường tiền cấp phát, ánh xạ đèn giao thông O(1), tái sử dụng bộ đệm không cấp phát rác (zero-GC `pointOnEdgeInto`), ẩn sớm NPC sau lưng camera và giãn nhịp mô phỏng NPC ở khoảng cách xa (`>120m`).
  - **Cập nhật bóng đổ thông minh (`shadowMap.autoUpdate = false`)** theo nhịp 30Hz / bước lưới mặt trời 4m, giãn nhịp vẽ Minimap 2D xuống 20Hz và bổ sung **Tự ổn định FPS (`autoFpsGuard`)** tự động hạ/khôi phục tỷ lệ độ phân giải mượt mà để tránh tụt khung hình.
- **Thế giới phố Việt Nam sinh động hơn (`WorldBuilder.ts`, `TrafficManager.ts`, `Game.ts`)**:
  - Thêm **18 đám mây khối trôi êm trên trời** (1 draw call gộp), **đàn 16 chim én/bồ câu lượn vòng** (1 `InstancedMesh`), và **hàng chục lá cờ đỏ sao vàng bay phấp phới trên ban công** (1 `InstancedMesh`).
  - Thêm **nghiêng thân khi luồn lách & nhún đầu khi phanh** cho xe máy/tay ga NPC, cùng **hệ thống hạt bụi lốp / tia nước mưa** phía sau bánh xe người chơi (1 `InstancedMesh` dùng lại không tạo rác bộ nhớ).
- **Lột xác giao diện phẳng sắc nét (`index.css`, `MenuScreen.tsx`, `HudOverlay.tsx`, `Modals.tsx`, `Minimap.ts`)**:
  - Thiết kế hoàn toàn màu phẳng chuẩn biển báo QCVN & bảng đồng hồ ô tô (không gradient, không neon, không blur, không emoji), dùng bóng đổ khối kiến trúc sắc nét và nút phím `<kbd>` nổi bật.
  - Màn hình chính bổ sung bảng thông số phương tiện, biển báo tốc độ giới hạn QCVN cho từng bản đồ, bảng biển chỉ dẫn xem trước thành phố góc phải và tuỳ chọn bật/tắt **Tự ổn định FPS**.
  - HUD khi lái nâng cấp thẻ **GPLX PET 12 điểm**, biển tên đường nền xanh QCVN, cụm đèn giao thông 3 thấu kính đếm ngược mini, thanh vòng tua 16 vạch phân đoạn, đèn báo xi-nhan nhấp nháy `Q`/`R`/`H`, Minimap có viền đường 2 lớp + nón tầm nhìn và thẻ theo dõi FPS & Draw Calls trực tiếp.

## 2026-11-22 — Nâng cấp thẩm mỹ toàn diện: Đường chân trời 360°, Chi tiết kiến trúc Việt Nam & Hoàn thiện cực nét Ô tô / Xe máy
- **Đường chân trời & cảnh xa sắc nét không còn khoảng trống (`WorldBuilder.ts`, `Game.ts`)**:
  - Thêm **vành đai đường chân trời thành phố Việt Nam 360° + đồi xanh nhiệt đới** (gộp hoàn toàn vào **1 draw call duy nhất** dùng vertex color + fog tự nhiên) với 62 tòa chung cư, cao ốc phân tầng có dải kính, tháp ăng-ten đỏ trắng và đồi xanh xa xăm bao quanh bản đồ.
  - Tăng tầm nhìn camera (`far >= 680m`) cùng bảng màu bầu trời & sương mù nhiệt đới hài hoà; nâng cấp **36 cụm mây khối nhiều tầng** bố trí sẵn vòng quanh đường chân trời để luôn hiện diện sinh động ở mọi hướng nhìn.
  - Nâng cấp **Tượng đài Vòng xuyến trung tâm** với hai vòng bồn hoa cúc vàng & hoa đỏ bậc thang, 4 cây cọ nhiệt đới, bệ đá trắng gắn 4 phù điêu đồng; nâng cấp **tháp cao ốc biểu tượng** với khối đế, nan kính đứng bạc, đèn báo hàng không đỉnh tháp và vòng sân đáp trực thăng vàng.
- **Chi tiết kiến trúc & đường phố giàu sức sống nhưng vẫn siêu nhẹ (`WorldBuilder.ts`, `textures.ts`)**:
  - Nâng cấp chất liệu mặt đường (vệt bánh xe, dải dầu, vết vá nhựa), vỉa hè gạch terrazzo có rãnh cắt, tường vôi có chỉ cột và chân tường đá, biển hiệu cửa hàng có khung viền & đổ bóng chữ sắc nét.
  - Nâng cấp **nhà ống Việt Nam** (0 draw call tăng thêm nhờ gộp static): bổ sung **mái ngói đỏ bậc thang**, **mái tôn sân thượng xanh**, chỉ phào phân tầng, diềm mái bạt tương phản và hoa đỏ/vàng nở trên bồn cây ban công.
  - Nâng cấp **cây xanh đường phố** thêm cành Y nổi và ~19% cây **Hoa Phượng Đỏ** + **Muồng Hoàng Yến vàng** nở rộ dọc đại lộ.
  - Gộp **cột điện bê tông + xà sắt + tủ điện + cần đèn cao áp kiểu cổ ngỗng** vào **1 `InstancedMesh` duy nhất** (tiết kiệm 2 draw call); bổ sung **bụi hoa giấy dải phân cách**, **bàn nhựa quán cóc kèm bình trà đá** và **thùng rác công cộng xanh-vàng**.
- **Hoàn thiện cực nét mô hình Ô tô Sedan & Xe máy Wave 110 / Vision 110 (`VehicleBuilder.ts`, `PlayerVehicle.ts`)**:
  - **Ô tô Sedan**: thêm mâm đúc 5 chấu kép có đĩa phanh tản nhiệt & cùm phanh đỏ, hai đường gân nổi nắp capo, cửa sổ trời toàn cảnh đen bóng, viền chân kính crôm, cánh lướt gió đuôi kiểu ducktail, bộ khuếch tán gió sau 3 vây + cặp ống xả crôm khoét lõi; buồng lái FPV thêm gân nắp capo, **màn hình giải trí bản đồ GPS phẳng sắc nét**, cửa gió điều hoà có lẫy bạc và chân gương hậu.
  - **Xe máy Wave 110 & Vision 110**: thêm cặp phuộc sau lò xo đỏ nổi bật, cần đạp nổ, gác chân sau, ốp chống nóng ống xả bạc, yên hai tầng có đường chỉ, tem hông thể thao, dải đèn định vị LED DRL cho Vision, ba lô người lái khi nhìn từ sau; buồng lái FPV thêm cụm công tắc ghi-đông hai bên, bình dầu phanh trước và ổ khoá kèm chìa.

## 2026-11-22 — Điều khiển êm mượt hết nghiêng quá đà, Lái tự do Vô tận & Đổi mới Giao diện phong cách Sài Gòn Hiện Đại
- **Điều khiển xe máy & ô tô cực dễ, dứt điểm lỗi xe máy nghiêng quá đà (`src/kit/vehicles/dynamics.ts`, `src/kit/input/controls.ts`, `src/game/player/CameraRig.ts`)**:
  - Giảm và khóa chặt góc nghiêng xe máy phổ thông tối đa **`±0.22 rad` (~12.6°)** thay vì `±0.75 rad` (~43°), tự đứng thẳng ở tốc độ chậm và dựng thẳng cực nhanh (`rate 11.0`) khi nhả phím lái.
  - Tinh chỉnh góc lái theo tốc độ theo đường cong phi tuyến mượt (`maxSteer` 0.44 cho Wave, 0.43 cho Vision, 0.48 cho Sedan), tốc độ tự trả lái về thẳng nhanh gấp đôi tốc độ đánh lái để giữ thẳng làn cực kỳ dễ dàng trên bàn phím.
  - Giảm độ nghiêng đường chân trời ở góc nhìn thứ nhất (FPV) và tăng độ bám theo mượt mà của camera góc nhìn thứ ba.
  - Bổ sung bộ unit test `src/kit/vehicles/dynamics.test.ts` kiểm chứng góc nghiêng xe máy, độ tự trả lái và độ ổn định thân xe ô tô.
- **Chế độ Lái tự do (Free Drive) thật sự VÔ TẬN (`src/game/Game.ts`, `HudOverlay.tsx`, `Modals.tsx`)**:
  - Chế độ `Lái tự do` không bao giờ kết thúc hay báo thua kể cả khi mắc nhiều lỗi vi phạm — vẫn hiển thị nhắc lỗi & mẹo luật giao thông tiếng Việt để người mới thoải mái luyện lái không áp lực; thêm nút **Xoá nhật ký lỗi** trực tiếp trong Menu Tạm dừng mà không cần chạy lại từ đầu.
  - Chế độ `17 Bài tập GPLX` và `Giờ cao điểm` vẫn giữ nguyên luật trừ 12 điểm GPLX nghiêm ngặt.
- **Đổi mới toàn bộ giao diện — Phong cách Saigon Modernist Transit (`src/index.css`, `MenuScreen.tsx`, `HudOverlay.tsx`, `Modals.tsx`)**:
  - Thiết kế 100% màu phẳng độc đáo (không gradient, không neon, không blur, không emoji): giấy kem Sài Gòn (`#f4efe4`) tương phản mạnh với mực than (`#141820`), đỏ son (`#d92d20`), xanh biển báo QCVN (`#0c4da2`) và vàng nghệ (`#eab308`) cùng viền sắc nét và bóng đổ khối cứng.
  - Màn hình chính đột phá với thẻ chọn xe thiết kế theo **biển số xe Việt Nam thật** (`59-D1 682.45`, `59-X3 419.08`, `30K 862.19`), thẻ bản đồ gắn **biển báo tốc độ QCVN P.127** tròn viền đỏ, và biển chỉ đường xanh QCVN nổi bật ở góc phải.
  - HUD buồng lái nâng cấp cụm đồng hồ vát góc với **thanh vòng tua 18 cột bậc thang tăng dần**, biển tên đường nền xanh QCVN hai viền, đèn giao thông 3 thấu kính đếm ngược, thẻ **LÁI TỰ DO · VÔ TẬN** có biểu tượng vô cực, và Minimap có ký hiệu hướng Bắc `B`.
