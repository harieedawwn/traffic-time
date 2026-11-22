# 03 — Kiến trúc đề xuất

Stack: **Vite + React 19 + TypeScript + three.js 0.187**. React chỉ cho menu/HUD (overlay DOM); game loop chạy bằng three.js thuần trong class `Game` (không dùng react-three-fiber cho mô phỏng nặng — tránh re-render). Rapier (`@dimforge/rapier3d-compat`) đã có trong package.json nếu cần va chạm vật lý; với mô phỏng đường phố, va chạm OBB tự viết + dynamics trong `src/kit/vehicles/dynamics.ts` là đủ và ổn định hơn.

```
src/
  App.tsx            → menu + mount <GameCanvas/> + HUD
  game/Game.ts       → vòng lặp: input → player → traffic → signals → camera → audio → render
  game/world/        → RoadGraph (dữ liệu) → RoadMeshBuilder → CityBuilder (nhà ống, cột điện, cây, biển)
  game/maps/*.ts     → định nghĩa từng map (node, edge, seed, đặc điểm)
  game/traffic/      → TrafficManager (spawn/despawn quanh người chơi, IDM, lateral cho xe máy, xe ưu tiên), Pedestrians
  game/player/       → PlayerVehicle (dynamics + model + cockpit), CameraRig (4 chế độ), Mirrors
  game/audio/        → AudioEngine (engine loop theo RPM, còi, xi-nhan, nền phố, 3D voices)
  game/rules/        → RuleChecker (phát hiện vi phạm, trừ điểm, thông báo)
  game/ui/Minimap.ts → canvas 2D
  kit/               → module có sẵn (dùng / sửa / xoá tuỳ ý)
```

## Module có sẵn trong `src/kit/`
| File | Nội dung |
|---|---|
| `input/controls.ts` | Keymap đã chốt + làm mượt analog + sự kiện bấm 1 lần |
| `vehicles/dynamics.ts` | Bicycle model cho Wave110/Vision110/Sedan: lái giảm theo tốc độ, nghiêng xe máy, RPM, số tự động/CVT |
| `traffic/driverModel.ts` | IDM, quyết định đèn vàng, gap acceptance, lateral offset xe máy, tính cách tài xế, tỉ lệ loại xe VN |
| `traffic/signalController.ts` | Đèn 3 bóng dọc + đồng hồ đếm ngược, pha xanh/vàng/toàn đỏ, vàng nhấp nháy, cột đèn chữ L |
| `traffic/vnSigns.ts` | 28 biển báo VN vẽ bằng Canvas (P/R/W/I + biển phụ rẽ phải khi đỏ) + mesh biển có cột |
| `world/textures.ts` | Texture thủ tục: nhựa đường cũ, gạch vỉa hè, bó vỉa, tường sơn có ố, cửa cuốn, bảng hiệu chữ Việt + danh sách tên quán |

Quy ước toạ độ: Y lên, đơn vị mét, heading quay quanh Y, tiến = (sin h, 0, cos h), phải = (−cos h, 0, sin h).

## Hiệu năng (mục tiêu 60 fps laptop tầm trung)
- InstancedMesh cho xe NPC cùng loại; chỉ mô phỏng NPC trong bán kính ~250 m, ngoài đó despawn; ≤ 150 xe hoạt động.
- Gộp geometry tĩnh theo ô (chunk 100 m), frustum culling theo chunk, LOD nhà (xa → hộp đơn).
- Shadow map 2048 bám người chơi; gương chiếu hậu render-target 256×128, cập nhật luân phiên.
- Texture canvas tạo 1 lần, cache theo key.
- Không tạo object mới trong vòng lặp (tái dùng Vector3).
