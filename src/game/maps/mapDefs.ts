import type { MapId } from '../types';
import type { PlacedSign, RoadEdge, RoadGraphData, RoadNode, StreetZone } from '../world/RoadGraph';

function buildBoulevardMap(): RoadGraphData {
  // Đại lộ Trung tâm MỞ RỘNG (5×5 đại đô thị ~520m × 600m):
  // Giữ nguyên toàn bộ nút lõi (NW..SE, S2, SW2, SE2) để 17 bài tập giữ đúng tọa độ,
  // đồng thời mở rộng vòng ngoài Đông/Tây/Bắc/Nam thành đô thị rộng lớn!
  const nodes: RoadNode[] = [
    // Far-North Grand Ring (z = -240)
    { id: 'N2W', x: -120, z: -240, kind: 'intersection', hasSignal: true, signalOffset: 3, rightOnRed: { S: true } },
    { id: 'N2',  x: 0,    z: -240, kind: 'intersection', hasSignal: true, signalOffset: 9, rightOnRed: { N: true, S: true, E: true } },
    { id: 'N2E', x: 120,  z: -240, kind: 'intersection', hasSignal: true, signalOffset: 13, rightOnRed: { W: true } },

    // Core Central Grid (X in [-240, -120, 0, 120, 240], Z in [-120, 0, 120])
    { id: 'NW_OUT', x: -240, z: -120, kind: 'bend' },
    { id: 'NW', x: -120, z: -120, kind: 'intersection', hasSignal: true, signalOffset: 0, rightOnRed: { S: true, E: false } },
    { id: 'N',  x: 0,    z: -120, kind: 'intersection', hasSignal: true, signalOffset: 6, rightOnRed: { N: true, S: false, E: true, W: false } },
    { id: 'NE', x: 120,  z: -120, kind: 'intersection', hasSignal: true, signalOffset: 12, rightOnRed: { W: true, S: false } },
    { id: 'NE_OUT', x: 240, z: -120, kind: 'bend' },

    { id: 'W2', x: -240, z: 0,    kind: 'intersection', hasSignal: true, signalOffset: 11, rightOnRed: { E: true, S: true } },
    { id: 'W',  x: -120, z: 0,    kind: 'intersection', hasSignal: true, signalOffset: 4, rightOnRed: { N: false, S: true, E: true } },
    { id: 'C',  x: 0,    z: 0,    kind: 'roundabout',   roundaboutRadius: 20 }, // Vòng xuyến Trung tâm
    { id: 'E',  x: 120,  z: 0,    kind: 'intersection', hasSignal: true, signalOffset: 10, rightOnRed: { N: true, S: false, W: false } },
    { id: 'E2', x: 240,  z: 0,    kind: 'intersection', hasSignal: true, signalOffset: 1, rightOnRed: { W: true, N: true } },

    { id: 'SW_OUT', x: -240, z: 120, kind: 'bend' },
    { id: 'SW', x: -120, z: 120,  kind: 'intersection', hasSignal: true, signalOffset: 8, rightOnRed: { N: true, E: true } },
    { id: 'S',  x: 0,    z: 120,  kind: 'intersection', hasSignal: true, signalOffset: 2, rightOnRed: { N: true, S: true, E: false, W: true } },
    { id: 'SE', x: 120,  z: 120,  kind: 'intersection', hasSignal: true, signalOffset: 14, rightOnRed: { N: false, W: true } },
    { id: 'SE_OUT', x: 240, z: 120, kind: 'bend' },

    // Southern Boulevard Extensions (z = 220 & z = 320)
    { id: 'SW2', x: -120, z: 220, kind: 'intersection', hasSignal: true, signalOffset: 6, rightOnRed: { E: true } },
    { id: 'S2',  x: 0,    z: 220, kind: 'intersection', hasSignal: true, signalOffset: 5, rightOnRed: { S: true, N: false, E: true } },
    { id: 'SE2', x: 120,  z: 220, kind: 'intersection', hasSignal: true, signalOffset: 9, rightOnRed: { W: true } },

    { id: 'SW3', x: -120, z: 320, kind: 'bend' },
    { id: 'S3',  x: 0,    z: 320, kind: 'intersection', hasSignal: true, signalOffset: 12, rightOnRed: { N: true } },
    { id: 'SE3', x: 120,  z: 320, kind: 'bend' },
  ];

  const edges: RoadEdge[] = [
    // Main North-South 6-lane grand boulevard (560m continuous spine!)
    { id: 'N2_N', from: 'N2', to: 'N',  name: 'Đại lộ Lê Duẩn', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 4.0, hasCrosswalk: true, style: 'boulevard' },
    { id: 'N_C',  from: 'N',  to: 'C',  name: 'Đại lộ Lê Lợi', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 4.0, hasCrosswalk: true, style: 'boulevard' },
    { id: 'C_S',  from: 'C',  to: 'S',  name: 'Đại lộ Lê Lợi', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 4.0, hasCrosswalk: true, style: 'boulevard' },
    { id: 'S_S2', from: 'S',  to: 'S2', name: 'Đại lộ Võ Văn Kiệt', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 4.0, hasCrosswalk: true, style: 'boulevard' },
    { id: 'S2_S3', from: 'S2', to: 'S3', name: 'Đại lộ Võ Văn Kiệt Nam', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 4.0, hasCrosswalk: true, style: 'boulevard' },

    // Main East-West 6-lane grand boulevard (480m continuous spine!)
    { id: 'W2_W', from: 'W2', to: 'W', name: 'Đại lộ Trần Hưng Đạo Tây', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 3.8, hasCrosswalk: true, style: 'boulevard' },
    { id: 'W_C',  from: 'W',  to: 'C', name: 'Đại lộ Trần Hưng Đạo', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 3.8, hasCrosswalk: true, style: 'boulevard' },
    { id: 'C_E',  from: 'C',  to: 'E', name: 'Đại lộ Trần Hưng Đạo', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 3.8, hasCrosswalk: true, style: 'boulevard' },
    { id: 'E_E2', from: 'E',  to: 'E2', name: 'Đại lộ Trần Hưng Đạo Đông', lanesForward: 3, lanesBackward: 3, laneWidth: 3.3, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 3.8, hasCrosswalk: true, style: 'boulevard' },

    // Core perimeter 4-lane avenues
    { id: 'NW_N', from: 'NW', to: 'N', name: 'Đường Điện Biên Phủ', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 50, hasMedian: true, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },
    { id: 'N_NE', from: 'N',  to: 'NE', name: 'Đường Điện Biên Phủ', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 50, hasMedian: true, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },
    { id: 'SW_S', from: 'SW', to: 'S',  name: 'Đường Nguyễn Thị Minh Khai', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 50, hasMedian: false, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard', noLeftTurn: true },
    { id: 'S_SE', from: 'S',  to: 'SE', name: 'Đường Nguyễn Thị Minh Khai', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 50, hasMedian: false, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },

    { id: 'NW_W', from: 'NW', to: 'W',  name: 'Đường Pasteur', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },
    { id: 'W_SW', from: 'W',  to: 'SW', name: 'Đường Pasteur', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },
    { id: 'NE_E', from: 'NE', to: 'E',  name: 'Đường Nam Kỳ Khởi Nghĩa', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },
    { id: 'E_SE', from: 'E',  to: 'SE', name: 'Đường Nam Kỳ Khởi Nghĩa', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'boulevard' },

    // Southern district avenues
    { id: 'SW_SW2', from: 'SW', to: 'SW2', name: 'Đường Pasteur Nam', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SW2_S2', from: 'SW2', to: 'S2', name: 'Đường Bến Chương Dương', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'S2_SE2', from: 'S2', to: 'SE2', name: 'Đường Bến Chương Dương', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SE2_SE', from: 'SE2', to: 'SE', name: 'Đường Nam Kỳ Nam', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },

    { id: 'SW2_SW3', from: 'SW2', to: 'SW3', name: 'Đường Tôn Đức Thắng Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SW3_S3',  from: 'SW3', to: 'S3',  name: 'Đường Hàm Nghi Nam', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'S3_SE3',  from: 'S3',  to: 'SE3', name: 'Đường Hàm Nghi Nam', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SE3_SE2', from: 'SE3', to: 'SE2', name: 'Đường Đồng Khởi Nam', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },

    // Northern district avenues
    { id: 'N2W_NW', from: 'N2W', to: 'NW', name: 'Đường Hai Bà Trưng Bắc', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'N2W_N2', from: 'N2W', to: 'N2', name: 'Đường Võ Thị Sáu', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, hasMedian: true, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'N2_N2E', from: 'N2',  to: 'N2E', name: 'Đường Võ Thị Sáu', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, hasMedian: true, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'N2E_NE', from: 'N2E', to: 'NE', name: 'Đường Đinh Tiên Hoàng', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },

    // Far West & East outer district loops
    { id: 'NW_OUT_NW', from: 'NW_OUT', to: 'NW', name: 'Đường Điện Biên Phủ Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'NW_OUT_W2', from: 'NW_OUT', to: 'W2', name: 'Đường Cách Mạng Tháng 8', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'W2_SW_OUT', from: 'W2', to: 'SW_OUT', name: 'Đường Cách Mạng Tháng 8', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SW_OUT_SW', from: 'SW_OUT', to: 'SW', name: 'Đường Nguyễn Thị Minh Khai Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },

    { id: 'NE_NE_OUT', from: 'NE', to: 'NE_OUT', name: 'Đường Điện Biên Phủ Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'NE_OUT_E2', from: 'NE_OUT', to: 'E2', name: 'Đường Tôn Đức Thắng', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'E2_SE_OUT', from: 'E2', to: 'SE_OUT', name: 'Đường Tôn Đức Thắng', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
    { id: 'SE_SE_OUT', from: 'SE', to: 'SE_OUT', name: 'Đường Nguyễn Thị Minh Khai Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.3, speedLimitKmh: 50, sidewalkWidth: 3.0, style: 'boulevard' },
  ];

  const signs: PlacedSign[] = [
    { code: 'P.127', options: { speed: 60 }, x: 11.2, z: 185, rotationY: 0 },
    { code: 'R.412', options: { label: 'XE MÁY' }, x: 11.2, z: 165, rotationY: 0 },
    { code: 'S.RIGHT_ON_RED', x: 11.2, z: 136, rotationY: 0 },
    { code: 'R.303', x: 11.2, z: 38, rotationY: 0 },
    { code: 'P.127', options: { speed: 60 }, x: 11.2, z: 85, rotationY: 0 },
    { code: 'R.412', options: { label: 'XE MÁY' }, x: 11.2, z: 65, rotationY: 0 },
    { code: 'P.124a', x: 11.2, z: -45, rotationY: 0 },
    { code: 'W.224', x: 11.2, z: -92, rotationY: 0 },
    { code: 'R.303', x: -11.2, z: -38, rotationY: Math.PI },
    { code: 'P.127', options: { speed: 60 }, x: -11.2, z: -80, rotationY: Math.PI },
    { code: 'R.412', options: { label: 'XE MÁY' }, x: -11.2, z: 45, rotationY: Math.PI },
    { code: 'S.RIGHT_ON_RED', x: -11.2, z: 103, rotationY: Math.PI },
    { code: 'R.303', x: -38, z: 11.2, rotationY: -Math.PI / 2 },
    { code: 'R.303', x: 38, z: -11.2, rotationY: Math.PI / 2 },
    { code: 'P.123a', x: -24, z: 8.2 + 120, rotationY: -Math.PI / 2 },
    { code: 'P.127', options: { speed: 60 }, x: 11.2, z: 275, rotationY: 0 },
    { code: 'P.127', options: { speed: 60 }, x: -11.2, z: -180, rotationY: Math.PI },
  ];

  const zones: StreetZone[] = [
    { kind: 'parking', x: 11.2, z: 152, radius: 7, label: 'Khu đỗ xe ven đường' },
  ];

  return {
    id: 'boulevard',
    name: 'Đại lộ Trung tâm (Q1)',
    bounds: { minX: -295, maxX: 295, minZ: -295, maxZ: 375 },
    nodes,
    edges,
    signs,
    zones,
    defaultSpawn: { x: 8.2, z: 192, heading: Math.PI },
    landmarks: [
      { x: -66, z: 62, kind: 'tower', label: 'Cao ốc Sài Gòn Centre' },
      { x: -58, z: -58, kind: 'tower', label: 'Tháp Bitexco Sài Gòn' },
      { x: 62, z: -60, kind: 'tower', label: 'Trung tâm Thương mại Q1' },
      { x: 175, z: -60, kind: 'tower', label: 'Landmark Đông Sài Gòn' },
      { x: -175, z: 65, kind: 'tower', label: 'Trung tâm Tài chính Tây' },
    ],
  };
}

function buildOldQuarterMap(): RoadGraphData {
  // Phố cổ Hà Nội MỞ RỘNG (4×4 ô phố cổ ~400m × 400m): giữ nguyên A1..C3 lõi!
  const nodes: RoadNode[] = [
    { id: 'A1', x: -90, z: -90, kind: 'intersection', hasSignal: false, priorityAxis: 'none' },
    { id: 'A2', x: 0,   z: -90, kind: 'intersection', hasSignal: false, priorityAxis: 'NS' },
    { id: 'A3', x: 90,  z: -90, kind: 'intersection', hasSignal: false, priorityAxis: 'none' },
    { id: 'A4', x: 180, z: -90, kind: 'intersection', hasSignal: true, signalOffset: 4 },

    { id: 'B0', x: -180, z: 0,  kind: 'bend' },
    { id: 'B1', x: -90, z: 0,   kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'B2', x: 0,   z: 0,   kind: 'intersection', hasSignal: false, priorityAxis: 'none' },
    { id: 'B3', x: 90,  z: 0,   kind: 'intersection', hasSignal: true, signalOffset: 0, rightOnRed: { N: false, S: false, E: true, W: false } },
    { id: 'B4', x: 180, z: 0,   kind: 'intersection', hasSignal: false, priorityAxis: 'NS' },

    { id: 'C0', x: -180, z: 90, kind: 'bend' },
    { id: 'C1', x: -90, z: 90,  kind: 'intersection', hasSignal: false, priorityAxis: 'none' },
    { id: 'C2', x: 0,   z: 90,  kind: 'intersection', hasSignal: false, priorityAxis: 'NS' },
    { id: 'C3', x: 90,  z: 90,  kind: 'intersection', hasSignal: false, priorityAxis: 'none' },
    { id: 'C4', x: 180, z: 90,  kind: 'bend' },

    { id: 'D1', x: -90, z: 180, kind: 'bend' },
    { id: 'D2', x: 0,   z: 180, kind: 'intersection', hasSignal: true, signalOffset: 7, rightOnRed: { S: true } },
    { id: 'D3', x: 90,  z: 180, kind: 'bend' },
  ];

  const edges: RoadEdge[] = [
    { id: 'D2_C2', from: 'D2', to: 'C2', name: 'Phố Đinh Tiên Hoàng', lanesForward: 2, lanesBackward: 0, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.6, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'C2_B2', from: 'C2', to: 'B2', name: 'Phố Hàng Đào', lanesForward: 2, lanesBackward: 0, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.6, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'B2_A2', from: 'B2', to: 'A2', name: 'Phố Hàng Ngang', lanesForward: 2, lanesBackward: 0, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.6, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'A2_A3', from: 'A2', to: 'A3', name: 'Phố Hàng Đường', lanesForward: 2, lanesBackward: 0, laneWidth: 3.0, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'A3_A4', from: 'A3', to: 'A4', name: 'Phố Hàng Chiếu', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'A4_B4', from: 'A4', to: 'B4', name: 'Phố Trần Nhật Duật', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'B4_C4', from: 'B4', to: 'C4', name: 'Phố Trần Quang Khải', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'C4_C3', from: 'C4', to: 'C3', name: 'Phố Cầu Gỗ Đông', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'A3_B3', from: 'A3', to: 'B3', name: 'Phố Hàng Mã', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.6, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'B3_C3', from: 'B3', to: 'C3', name: 'Phố Hàng Bạc', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.6, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'C3_C2', from: 'C3', to: 'C2', name: 'Phố Hàng Gai', lanesForward: 2, lanesBackward: 0, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.6, style: 'oldquarter' },
    { id: 'C2_C1', from: 'C2', to: 'C1', name: 'Phố Hàng Bông', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.6, style: 'oldquarter' },
    { id: 'C1_C0', from: 'C1', to: 'C0', name: 'Phố Hàng Bông Tây', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'C0_B0', from: 'C0', to: 'B0', name: 'Phố Phùng Hưng', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'B0_B1', from: 'B0', to: 'B1', name: 'Phố Hàng Điếu', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'C1_B1', from: 'C1', to: 'B1', name: 'Phố Lý Quốc Sư', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'B1_A1', from: 'B1', to: 'A1', name: 'Phố Hàng Trống', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'A1_A2', from: 'A1', to: 'A2', name: 'Phố Cầu Gỗ', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'B1_B2', from: 'B1', to: 'B2', name: 'Phố Hàng Bồ', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'B2_B3', from: 'B2', to: 'B3', name: 'Phố Tạ Hiện', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'B3_B4', from: 'B3', to: 'B4', name: 'Phố Lương Ngọc Quyến', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'C1_D1', from: 'C1', to: 'D1', name: 'Phố Hàng Quạt', lanesForward: 1, lanesBackward: 1, laneWidth: 3.1, speedLimitKmh: 30, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'D1_D2', from: 'D1', to: 'D2', name: 'Phố Tràng Thi', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'D2_D3', from: 'D2', to: 'D3', name: 'Phố Tràng Tiền', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'D3_C3', from: 'D3', to: 'C3', name: 'Phố Lý Thái Tổ', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 2.6, style: 'oldquarter' },
  ];

  const signs: PlacedSign[] = [
    { code: 'I.407a', x: 3.8, z: 75, rotationY: 0 },
    { code: 'P.127', options: { speed: 30 }, x: 3.8, z: 62, rotationY: 0 },
    { code: 'W.205a', x: 3.8, z: 16, rotationY: 0 },
    { code: 'P.102', x: -3.8, z: -16, rotationY: Math.PI },
    { code: 'W.208', x: -16, z: 4.0, rotationY: -Math.PI / 2 },
    { code: 'W.207', x: 3.8, z: -74, rotationY: 0 },
    { code: 'P.131a', x: 3.8, z: 38, rotationY: 0 },
  ];

  const zones: StreetZone[] = [
    { kind: 'market', x: 35, z: -20, radius: 15, label: 'Chợ Đồng Xuân mini' },
    { kind: 'parking', x: 3.5, z: 48, radius: 6, label: 'Điểm đỗ xe Hàng Đào' },
  ];

  return {
    id: 'oldquarter',
    name: 'Phố cổ Hà Nội',
    bounds: { minX: -230, maxX: 230, minZ: -155, maxZ: 235 },
    nodes,
    edges,
    signs,
    zones,
    defaultSpawn: { x: 1.5, z: 78, heading: Math.PI },
    landmarks: [
      { x: 0, z: -120, kind: 'gate', label: 'Ô Quan Chưởng' },
      { x: 45, z: 45, kind: 'market', label: 'Chợ Phố Cổ' },
    ],
  };
}

function buildResidentialMap(): RoadGraphData {
  // Khu dân cư + Hẻm MỞ RỘNG (~380m × 340m): giữ nguyên R1..S4 lõi!
  const nodes: RoadNode[] = [
    { id: 'R0', x: -180, z: 100, kind: 'bend' },
    { id: 'R1', x: -100, z: 100, kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'R2', x: 0,    z: 100, kind: 'intersection', hasSignal: false, priorityAxis: 'EW', hasConvexMirror: true },
    { id: 'R3', x: 100,  z: 100, kind: 'intersection', hasSignal: true, signalOffset: 3, rightOnRed: { W: true } },
    { id: 'R4', x: 180,  z: 100, kind: 'bend' },

    { id: 'T1', x: 0,    z: 30,  kind: 'intersection', hasSignal: false, priorityAxis: 'none', hasConvexMirror: true },
    { id: 'T2', x: -65,  z: 30,  kind: 'bend' },
    { id: 'T3', x: 65,   z: 30,  kind: 'intersection', hasSignal: false, priorityAxis: 'NS', hasConvexMirror: true },

    { id: 'S0', x: -180, z: -50, kind: 'bend' },
    { id: 'S1', x: -100, z: -50, kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'S2', x: 0,    z: -50, kind: 'intersection', hasSignal: false, priorityAxis: 'EW', isSchoolZone: true },
    { id: 'S3', x: 100,  z: -50, kind: 'intersection', hasSignal: true, signalOffset: 7 },
    { id: 'S4', x: 65,   z: -50, kind: 'intersection', hasSignal: false, priorityAxis: 'EW', hasConvexMirror: true },
    { id: 'S5', x: 180,  z: -50, kind: 'bend' },

    { id: 'N1', x: -100, z: -130, kind: 'bend' },
    { id: 'N2', x: 100,  z: -130, kind: 'bend' },
  ];

  const edges: RoadEdge[] = [
    { id: 'R0_R1', from: 'R0', to: 'R1', name: 'Đường Tô Hiến Thành Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.1, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'R1_R2', from: 'R1', to: 'R2', name: 'Đường Tô Hiến Thành', lanesForward: 2, lanesBackward: 2, laneWidth: 3.1, speedLimitKmh: 40, sidewalkWidth: 2.8, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'R2_R3', from: 'R2', to: 'R3', name: 'Đường Tô Hiến Thành', lanesForward: 2, lanesBackward: 2, laneWidth: 3.1, speedLimitKmh: 40, sidewalkWidth: 2.8, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'R3_R4', from: 'R3', to: 'R4', name: 'Đường Tô Hiến Thành Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.1, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'R2_T1', from: 'R2', to: 'T1', name: 'Hẻm 128 Khu dân cư', lanesForward: 1, lanesBackward: 1, laneWidth: 2.6, speedLimitKmh: 20, sidewalkWidth: 1.5, style: 'alley' },
    { id: 'T2_T1', from: 'T2', to: 'T1', name: 'Ngách 128/4', lanesForward: 1, lanesBackward: 1, laneWidth: 2.5, speedLimitKmh: 20, sidewalkWidth: 1.4, style: 'alley' },
    { id: 'T1_T3', from: 'T1', to: 'T3', name: 'Hẻm 128 Chợ Tạm', lanesForward: 1, lanesBackward: 1, laneWidth: 2.6, speedLimitKmh: 20, sidewalkWidth: 1.5, style: 'alley' },
    { id: 'T3_S4', from: 'T3', to: 'S4', name: 'Hẻm Trường Học', lanesForward: 1, lanesBackward: 1, laneWidth: 2.7, speedLimitKmh: 20, sidewalkWidth: 1.6, style: 'alley' },
    { id: 'S0_S1', from: 'S0', to: 'S1', name: 'Đường Chu Văn An Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'S1_S2', from: 'S1', to: 'S2', name: 'Đường Chu Văn An (Cổng Trường)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'S2_S4', from: 'S2', to: 'S4', name: 'Đường Chu Văn An (Cổng Trường)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 30, sidewalkWidth: 3.2, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'S4_S3', from: 'S4', to: 'S3', name: 'Đường Chu Văn An', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 3.0, style: 'oldquarter' },
    { id: 'S3_S5', from: 'S3', to: 'S5', name: 'Đường Chu Văn An Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'R0_S0', from: 'R0', to: 'S0', name: 'Đường Vành đai Khu Tây', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'R1_S1', from: 'R1', to: 'S1', name: 'Đường Liên Khu Tây', lanesForward: 1, lanesBackward: 1, laneWidth: 3.3, speedLimitKmh: 40, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'R3_S3', from: 'R3', to: 'S3', name: 'Đường Liên Khu Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, hasCrosswalk: true, style: 'oldquarter' },
    { id: 'R4_S5', from: 'R4', to: 'S5', name: 'Đường Vành đai Khu Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.5, style: 'oldquarter' },
    { id: 'T2_S1', from: 'T2', to: 'S1', name: 'Hẻm Tây', lanesForward: 1, lanesBackward: 1, laneWidth: 2.6, speedLimitKmh: 20, sidewalkWidth: 1.4, style: 'alley' },
    { id: 'S1_N1', from: 'S1', to: 'N1', name: 'Đường Công Viên Tây', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.6, style: 'oldquarter' },
    { id: 'N1_N2', from: 'N1', to: 'N2', name: 'Đường Bắc Khu Dân Cư', lanesForward: 2, lanesBackward: 2, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.8, style: 'oldquarter' },
    { id: 'N2_S3', from: 'N2', to: 'S3', name: 'Đường Công Viên Đông', lanesForward: 1, lanesBackward: 1, laneWidth: 3.2, speedLimitKmh: 40, sidewalkWidth: 2.6, style: 'oldquarter' },
  ];

  const signs: PlacedSign[] = [
    { code: 'P.127', options: { speed: 20 }, x: 3.2, z: 86, rotationY: 0 },
    { code: 'W.239', x: 3.2, z: 42, rotationY: 0 },
    { code: 'W.225', x: -35, z: -43, rotationY: -Math.PI / 2 },
    { code: 'W.224', x: -18, z: -43, rotationY: -Math.PI / 2 },
    { code: 'I.423', x: -12, z: -43, rotationY: -Math.PI / 2 },
    { code: 'W.225', x: 35, z: -57, rotationY: Math.PI / 2 },
    { code: 'W.224', x: 18, z: -57, rotationY: Math.PI / 2 },
    { code: 'R.122', x: 3.4, z: 88, rotationY: Math.PI },
  ];

  const zones: StreetZone[] = [
    { kind: 'school', x: 0, z: -65, radius: 22, label: 'Trường Tiểu học Chu Văn An' },
    { kind: 'market', x: 32, z: 22, radius: 14, label: 'Chợ tạm Hẻm 128' },
  ];

  return {
    id: 'residential',
    name: 'Khu dân cư & Hẻm',
    bounds: { minX: -225, maxX: 225, minZ: -175, maxZ: 150 },
    nodes,
    edges,
    signs,
    zones,
    defaultSpawn: { x: 1.3, z: 82, heading: Math.PI },
    landmarks: [
      { x: 0, z: -68, kind: 'school', label: 'Trường Tiểu Học Chu Văn An' },
      { x: 32, z: 18, kind: 'market', label: 'Chợ Tạm Hẻm 128' },
    ],
  };
}

function buildHighwayMap(): RoadGraphData {
  // Ngoại ô / Quốc lộ 1A MỞ RỘNG (dài hơn 640m từ Tây sang Đông, có cầu vượt dốc + đường sắt + KCN!)
  const nodes: RoadNode[] = [
    { id: 'H0', x: -310, z: 80,  kind: 'bend' },
    { id: 'H1', x: -180, z: 80,  kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H2', x: -60,  z: 80,  kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H3', x: 80,   z: 80,  kind: 'intersection', hasSignal: true, signalOffset: 0, rightOnRed: { W: true, E: true } },
    { id: 'H4', x: 180,  z: 80,  kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H4E', x: 310, z: 80,  kind: 'bend' },

    { id: 'H5E', x: 310, z: -80, kind: 'bend' },
    { id: 'H5', x: 180,  z: -80, kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H6', x: 60,   z: -80, kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H7', x: -60,  z: -80, kind: 'intersection', hasSignal: true, signalOffset: 5, rightOnRed: { E: false, W: true } },
    { id: 'H8', x: -180, z: -80, kind: 'intersection', hasSignal: false, priorityAxis: 'EW' },
    { id: 'H9', x: -310, z: -80, kind: 'bend' },
  ];

  const edges: RoadEdge[] = [
    { id: 'H0_H1', from: 'H0', to: 'H1', name: 'Quốc lộ 1A (Cửa ngõ Tây)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.6, speedLimitKmh: 80, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 2.5, style: 'highway' },
    { id: 'H1_H2', from: 'H1', to: 'H2', name: 'Quốc lộ 1A (Đoạn Ngoại ô)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.6, speedLimitKmh: 70, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 2.5, style: 'highway' },
    { id: 'H2_H3', from: 'H2', to: 'H3', name: 'Cầu vượt Quốc lộ 1A', lanesForward: 2, lanesBackward: 2, laneWidth: 3.6, speedLimitKmh: 60, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 2.2, bridgeHeight: 5.5, style: 'highway' },
    { id: 'H3_H4', from: 'H3', to: 'H4', name: 'Quốc lộ 1A (Trạm xăng)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.6, speedLimitKmh: 70, hasMedian: true, hasUTurnOpening: true, sidewalkWidth: 2.5, style: 'highway' },
    { id: 'H4_H4E', from: 'H4', to: 'H4E', name: 'Quốc lộ 1A (Khu Đông)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.6, speedLimitKmh: 80, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 2.5, style: 'highway' },

    { id: 'H4_H5', from: 'H4', to: 'H5', name: 'Đường tỉnh lộ 743 (Đường sắt)', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 50, sidewalkWidth: 2.4, hasRailwayCrossing: true, style: 'highway' },
    { id: 'H4E_H5E', from: 'H4E', to: 'H5E', name: 'Đường Vành đai Đông', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 70, sidewalkWidth: 2.4, style: 'highway' },

    { id: 'H5E_H5', from: 'H5E', to: 'H5', name: 'Xa lộ Hà Nội Đông', lanesForward: 3, lanesBackward: 3, laneWidth: 3.5, speedLimitKmh: 80, hasMedian: true, hasMotorbikeLane: true, sidewalkWidth: 2.6, style: 'highway' },
    { id: 'H5_H6', from: 'H5', to: 'H6', name: 'Xa lộ Hà Nội', lanesForward: 3, lanesBackward: 3, laneWidth: 3.5, speedLimitKmh: 80, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 2.6, style: 'highway' },
    { id: 'H6_H7', from: 'H6', to: 'H7', name: 'Xa lộ Hà Nội', lanesForward: 3, lanesBackward: 3, laneWidth: 3.5, speedLimitKmh: 80, hasMedian: true, hasMotorbikeLane: true, hasUTurnOpening: true, sidewalkWidth: 2.6, style: 'highway' },
    { id: 'H7_H8', from: 'H7', to: 'H8', name: 'Xa lộ Hà Nội', lanesForward: 2, lanesBackward: 2, laneWidth: 3.5, speedLimitKmh: 70, hasMedian: true, sidewalkWidth: 2.5, style: 'highway' },
    { id: 'H8_H9', from: 'H8', to: 'H9', name: 'Xa lộ Hà Nội Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.5, speedLimitKmh: 80, hasMedian: true, sidewalkWidth: 2.5, style: 'highway' },

    { id: 'H9_H0', from: 'H9', to: 'H0', name: 'Đường Cao tốc Vành đai Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 70, sidewalkWidth: 2.4, style: 'highway' },
    { id: 'H8_H1', from: 'H8', to: 'H1', name: 'Đường Vành đai Tây', lanesForward: 2, lanesBackward: 2, laneWidth: 3.4, speedLimitKmh: 60, sidewalkWidth: 2.4, style: 'highway' },
    { id: 'H2_H7', from: 'H2', to: 'H7', name: 'Đường nhánh Khu Công Nghiệp', lanesForward: 1, lanesBackward: 1, laneWidth: 3.4, speedLimitKmh: 50, sidewalkWidth: 2.4, hasCrosswalk: true, style: 'highway' },
  ];

  const signs: PlacedSign[] = [
    { code: 'R.421', x: -155, z: 89, rotationY: -Math.PI / 2 },
    { code: 'P.127', options: { speed: 70 }, x: -130, z: 89, rotationY: -Math.PI / 2 },
    { code: 'W.207', x: -80, z: 89, rotationY: -Math.PI / 2 },
    { code: 'P.127', options: { speed: 60 }, x: -45, z: 89, rotationY: -Math.PI / 2 },
    { code: 'W.239', x: 189, z: 22, rotationY: 0 },
    { code: 'R.122', x: 189, z: 12, rotationY: 0 },
    { code: 'P.127', options: { speed: 80 }, x: 140, z: -92, rotationY: Math.PI / 2 },
    { code: 'R.412', options: { label: 'XE MÁY' }, x: 110, z: -92, rotationY: Math.PI / 2 },
    { code: 'W.208', x: -53, z: 58, rotationY: Math.PI },
  ];

  const zones: StreetZone[] = [
    { kind: 'fuel', x: 130, z: 98, radius: 14, label: 'Trạm xăng Petrolimex' },
  ];

  return {
    id: 'highway',
    name: 'Ngoại ô & Quốc lộ 1A',
    bounds: { minX: -360, maxX: 360, minZ: -150, maxZ: 150 },
    nodes,
    edges,
    signs,
    zones,
    defaultSpawn: { x: -150, z: 85.8, heading: Math.PI / 2 },
    landmarks: [
      { x: 10, z: 80, kind: 'gate', label: 'Cầu vượt Quốc lộ 1A' },
      { x: 130, z: 102, kind: 'fuel', label: 'Trạm xăng Petrolimex' },
    ],
  };
}

export function createMapData(id: MapId): RoadGraphData {
  switch (id) {
    case 'boulevard':
      return buildBoulevardMap();
    case 'oldquarter':
      return buildOldQuarterMap();
    case 'residential':
      return buildResidentialMap();
    case 'highway':
      return buildHighwayMap();
  }
}
