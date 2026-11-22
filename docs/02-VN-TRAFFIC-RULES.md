# 02 — Luật & thói quen giao thông Việt Nam để mô phỏng

Căn cứ: Luật Trật tự, an toàn giao thông đường bộ 2024 (36/2024/QH15, hiệu lực 01/01/2025), QCVN 41:2024/BGTVT (báo hiệu), Thông tư 38/2024/TT-BGTVT (tốc độ), Nghị định 168/2024 (xử phạt). Đây là tóm tắt cho game, không phải tư vấn pháp lý.

## Quy tắc cốt lõi
- Đi bên phải chiều đi của mình. Xe máy đi làn bên phải; ô tô làn trái hơn. Có làn riêng xe máy (biển R.412) thì phải đi đúng.
- **Đèn đỏ: cấm rẽ phải**, trừ nơi có biển phụ / đèn mũi tên cho phép (đây là lỗi người mới hay mắc nhất — phải có trong game).
- Đèn vàng: phải dừng trước vạch, trừ khi đã quá gần không dừng an toàn được. Vàng nhấp nháy: giảm tốc, chú ý, nhường đường.
- Thứ tự hiệu lực: hiệu lệnh CSGT > đèn tín hiệu > biển báo > vạch kẻ.
- Đồng hồ đếm ngược trên đèn (phổ biến ở VN).
- Vạch mắt võng (vàng, kiểu lưới) tại nút giao: không được dừng xe trong phạm vi đó.

## Nhường đường tại giao lộ không đèn
1. Xe ưu tiên (cứu hoả > quân sự/công an khẩn cấp > cứu thương …) luôn được đi trước — có còi hú + đèn.
2. Đường ưu tiên (biển W.208/W.207, biển ưu tiên) → xe từ đường nhánh nhường.
3. Đường cùng cấp: **nhường xe đi đến từ bên phải**.
4. Vòng xuyến (R.303): nhường xe đang đi trong vòng xuyến (đến từ bên trái); đi ngược chiều kim đồng hồ.
5. Xe rẽ phải/rẽ trái phải nhường người đi bộ trên vạch qua đường và xe đi thẳng ngược chiều (khi rẽ trái).
6. Quay đầu: chỉ nơi được phép, nhường xe đi ngược chiều & cùng chiều. Biển P.124a cấm quay đầu nhưng vẫn được rẽ trái; P.123a cấm rẽ trái.

## Tốc độ tối đa (Thông tư 38/2024)
| Loại đường | Trong khu đông dân cư | Ngoài khu đông dân cư |
|---|---|---|
| Đường đôi / một chiều ≥2 làn | 60 km/h | 70–90 km/h tuỳ loại xe |
| Đường hai chiều / một chiều 1 làn | 50 km/h | 60–80 km/h tuỳ loại xe |
| Xe gắn máy (≤50cc) & xe máy chuyên dùng | 40 km/h | 40 km/h |
Khu đông dân cư bắt đầu ở biển R.420, hết ở R.421. Hẻm/phố cổ trong game: 20–30 km/h bằng biển P.127.

## Hành vi xe máy
- Đội mũ bảo hiểm (cả người ngồi sau). Không dùng điện thoại khi lái.
- Xi-nhan trước khi rẽ/chuyển làn; dùng còi đúng mục đích (khu dân cư cấm còi 22h–5h).
- Đèn: bật đèn cốt từ 18h–6h; đèn pha khi đường tối, chuyển cốt khi có xe ngược chiều.

## "Thói quen thực tế" cần có ở NPC để luyện xử lý (đã mã hoá trong `src/kit/traffic/driverModel.ts`)
- Xe máy không đi theo làn cứng: tràn ngang, luồn lách vào khe trống, dồn lên đầu ở đèn đỏ (đứng vượt vạch dừng một chút).
- Bấm còi liên tục khi bị cản, khi vượt, khi qua ngã tư khuất.
- Một số xe vượt đèn vàng/đỏ cuối pha, rẽ phải khi đèn đỏ.
- Đi ngược chiều sát mép đường quãng ngắn để tới hẻm; quay đầu bất ngờ giữa đường.
- Shipper dừng đột ngột ven đường; xe buýt tạt vào trạm; taxi dừng đón khách.
- Người đi bộ băng qua đường không ở vạch; bán hàng rong đẩy xe dưới lòng đường; chó chạy ra.
- Xe chở hàng cồng kềnh (thùng xốp, ống nước dài), chở 3.
- Giờ cao điểm 7–8h, 17–18h30: mật độ dày gấp 3.
