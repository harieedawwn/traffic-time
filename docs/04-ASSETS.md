# 04 — Tài nguyên có sẵn (tất cả CC0 / MIT, dùng thương mại được)

Kích thước gốc chi tiết (bounding box, animation) ở `docs/model-catalog.jsonl`. Tất cả đã giải nén meshopt → GLTFLoader thường đọc được (không cần decoder).

## Model 3D — `public/assets/models/`
| Thư mục | File | Ghi chú & scale gợi ý |
|---|---|---|
| `vehicles/` | sedan, sedan_sports, hatchback_sports, suv, suv_luxury, taxi, police_car, van, delivery_van, delivery_flat, truck, truck_flat, garbage_truck, ambulance, firetruck, tractor, digger | Low-poly (Quaternius/Kenney). Dài gốc ~2.5–3.4 → **scale ≈ 1.6–1.75** để sedan dài ~4.4 m. Kiểm tra hướng mũi xe khi load và xoay cho khớp quy ước tiến = +Z. Dùng làm xe NPC. |
| `kenney-racing/` | vehicle-motorcycle, vehicle-truck-* (+ `Textures/colormap.png`) | Có node tách sẵn `wheel-front`, `wheel-back`, `fork`, `body` → quay bánh/lái được. Mô tô dài 2.44 → scale ≈ 0.8. Phong cách đồ chơi: nên dùng xe máy **dựng thủ tục** (procedural) chi tiết cho người chơi, model này cho NPC xa/LOD. |
| `buildings/` | building_a..h, skyscraper_a..c | Scale ~10–12. Dùng cho khu trung tâm/cao tầng; phố VN nên tự dựng **nhà ống** thủ tục (rộng 4–5 m, sâu 15–20 m, 2–6 tầng). |
| `kenney-city/` | building-small-a..d, garage, fountain, road-straight-lightposts, grass-trees-tall | Ô 1×1 → scale theo ô lưới. |
| `nature/` | tree_* (oak, palm, pine…), bush, flower, rock, log, stump | Scale ~5–7 cho cây đường phố. Gốc cây VN thường quét vôi trắng ~1 m. |
| `people/` | mini_male_a..f, mini_female_a..f | 32 animation: idle, walk, sprint, sit, **drive**… Dùng làm người đi bộ, người lái/ngồi sau xe máy (anim `drive`/`sit`). |
| `people/` | worker, cat, shiba, pug | Scale gốc ~200 → nhân ≈ 0.006–0.009. Chó/mèo chạy qua đường. |
| `props/` | barrel, barrels, crate, fence, generator | Công trường, chắn đường. |

## Âm thanh — `public/assets/audio/`
| File | Dùng cho |
|---|---|
| `vehicles/kenney-engine-motorcycle.ogg` (8 s loop) | Động cơ xe máy, `playbackRate` 0.6→2.0 theo RPM |
| `vehicles/kenney-engine-car.ogg` (8 s loop) | Động cơ ô tô |
| `vehicles/rg-engine.mp3`, `rg-accelerate.mp3` | Lớp động cơ / tăng ga ô tô |
| `vehicles/rg-honk.mp3` | Còi ô tô |
| `vehicles/rg-tire-brake.mp3`, `kenney-skid.ogg` | Phanh rít / trượt |
| `vehicles/rg-crash.mp3`, `impacts/*.ogg` | Va chạm |
| `vehicles/rg-boost.mp3` | (không cần — có thể xoá) |
Còi xe máy, xi-nhan, tiếng nền phố: tổng hợp bằng Web Audio (oscillator + noise + filter).

## Code tham khảo — `reference/`
- `engine-sound-generator/` (MIT): tổng hợp tiếng động cơ vật lý bằng AudioWorklet + Doppler.
- `RoadTrafficSimulator/` (MIT, CoffeeScript): mô hình làn, giao lộ, đèn tín hiệu, IDM, quỹ đạo rẽ bằng đường cong.
- `pmndrs-racing-game/` (MIT): xe raycast vehicle, hiệu ứng vết bánh/bụi, quản lý âm thanh động cơ/phanh/còi.

## Thư viện npm sẵn trong package.json
three · @dimforge/rapier3d-compat · simplex-noise (sinh địa hình/biến thể) · react. Thêm gì thì `npm i`.

Nguồn & giấy phép: xem `CREDITS.md`.
