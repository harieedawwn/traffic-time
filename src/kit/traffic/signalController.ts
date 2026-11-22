import * as THREE from 'three';

/**
 * Bộ điều khiển đèn tín hiệu kiểu Việt Nam.
 * - Pha xanh → vàng (3 s) → toàn đỏ (1 s) → pha kế tiếp.
 * - Có ĐỒNG HỒ ĐẾM NGƯỢC (rất phổ biến ở VN) cho cả xanh và đỏ.
 * - Chế độ "vàng nhấp nháy" (giờ thấp điểm / đèn hỏng): người lái phải giảm tốc, nhường đường theo quy tắc.
 * - Thời gian rút ngắn cho game (đèn đỏ ~10 s theo yêu cầu) — chỉnh trong SignalTiming.
 * QCVN 41:2024 quy định xanh tối thiểu 15 s ngoài đời; game cố ý ngắn hơn cho nhịp chơi.
 */
export type Light = 'green' | 'yellow' | 'red' | 'flashing' | 'off';

export interface SignalTiming { green: number; yellow: number; allRed: number }
export const GAME_TIMING: SignalTiming = { green: 10, yellow: 3, allRed: 1 };

export interface Approach {
  id: string;          // ví dụ 'N', 'S', 'E', 'W'
  group: number;       // các hướng cùng group xanh cùng lúc (N+S = 0, E+W = 1)
  rightOnRedAllowed?: boolean; // có biển phụ cho phép rẽ phải khi đèn đỏ
}

export class SignalController {
  time = 0;
  phase = 0;           // group đang được xanh
  stage: 'green' | 'yellow' | 'allRed' = 'green';
  flashingMode = false;
  private groups: number;

  constructor(public approaches: Approach[], public timing: SignalTiming = GAME_TIMING, offset = 0) {
    this.groups = Math.max(...approaches.map(a => a.group)) + 1;
    this.time = offset;
  }

  get cycle() { return this.groups * (this.timing.green + this.timing.yellow + this.timing.allRed); }

  update(dt: number) {
    this.time += dt;
    const T = this.timing; const per = T.green + T.yellow + T.allRed;
    const t = this.time % this.cycle;
    this.phase = Math.floor(t / per);
    const local = t - this.phase * per;
    this.stage = local < T.green ? 'green' : local < T.green + T.yellow ? 'yellow' : 'allRed';
  }

  lightFor(approachId: string): Light {
    if (this.flashingMode) return (this.time % 1) < 0.5 ? 'flashing' : 'off';
    const a = this.approaches.find(x => x.id === approachId); if (!a) return 'off';
    if (a.group !== this.phase) return 'red';
    return this.stage === 'green' ? 'green' : this.stage === 'yellow' ? 'yellow' : 'red';
  }

  /** Số giây còn lại hiển thị trên đồng hồ đếm ngược của hướng này. */
  countdownFor(approachId: string): number {
    const a = this.approaches.find(x => x.id === approachId); if (!a || this.flashingMode) return 0;
    const T = this.timing; const per = T.green + T.yellow + T.allRed;
    const t = this.time % this.cycle;
    const startOfGroup = a.group * per;
    if (a.group === this.phase) {
      const local = t - startOfGroup;
      if (local < T.green) return Math.ceil(T.green - local);
      if (local < T.green + T.yellow) return Math.ceil(T.green + T.yellow - local);
      return 0;
    }
    // còn bao lâu tới lượt xanh
    let wait = startOfGroup - t; if (wait < 0) wait += this.cycle;
    return Math.ceil(wait);
  }
}

/* ---------------------------------------------------------------- 3D ---- */

/** Hộp đèn 3 bóng dọc (kiểu VN) + đồng hồ đếm ngược 2 chữ số bên dưới. Mặt đèn hướng +Z. */
export class TrafficLightHead {
  group = new THREE.Group();
  private lamps: Record<'red' | 'yellow' | 'green', THREE.MeshStandardMaterial>;
  private digitsCanvas = document.createElement('canvas');
  private digitsTex: THREE.CanvasTexture;
  private lastShown = '';

  constructor() {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.22), new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.7 }));
    housing.castShadow = true; this.group.add(housing);
    const mk = (y: number) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, roughness: 0.3 });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), m); lens.position.set(0, y, 0.112); this.group.add(lens);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 16, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x151515, side: THREE.DoubleSide }));
      visor.rotation.x = Math.PI / 2; visor.position.set(0, y + 0.01, 0.19); this.group.add(visor);
      return m;
    };
    this.lamps = { red: mk(0.31), yellow: mk(0), green: mk(-0.31) };
    this.digitsCanvas.width = 128; this.digitsCanvas.height = 64;
    this.digitsTex = new THREE.CanvasTexture(this.digitsCanvas); this.digitsTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    board.position.set(0, -0.62, 0); this.group.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), new THREE.MeshBasicMaterial({ map: this.digitsTex, toneMapped: false }));
    face.position.set(0, -0.62, 0.061); this.group.add(face);
  }

  set(light: Light, countdown: number) {
    const on = { red: light === 'red', yellow: light === 'yellow' || light === 'flashing', green: light === 'green' };
    const col = { red: 0xff2a1a, yellow: 0xffb300, green: 0x19e07a } as const;
    (Object.keys(this.lamps) as (keyof typeof col)[]).forEach(k => {
      const m = this.lamps[k]; m.color.setHex(on[k] ? col[k] : 0x2a2a2a); m.emissive.setHex(on[k] ? col[k] : 0x000000); m.emissiveIntensity = on[k] ? 2.2 : 0;
    });
    const txt = light === 'flashing' || light === 'off' || countdown <= 0 ? '' : String(Math.min(99, countdown)).padStart(2, '0');
    const color = light === 'green' ? '#19e07a' : light === 'yellow' ? '#ffb300' : '#ff2a1a';
    const key = txt + color;
    if (key !== this.lastShown) {
      const ctx = this.digitsCanvas.getContext('2d')!; ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = color; ctx.font = '700 54px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 64, 35);
      this.digitsTex.needsUpdate = true; this.lastShown = key;
    }
  }
}

/** Cột đèn cần vươn (cột chữ L) đặt ở góc giao lộ: 1 đầu đèn trên cần + 1 đầu đèn thấp trên thân cột. */
export function makeSignalPole(armLength = 3.5) {
  const g = new THREE.Group(); g.name = 'signal-pole';
  const metal = new THREE.MeshStandardMaterial({ color: 0x8e9396, metalness: 0.7, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 12), metal); pole.position.y = 3; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, armLength, 10), metal); arm.rotation.z = Math.PI / 2; arm.position.set(-armLength / 2, 5.6, 0); g.add(arm);
  // sọc trắng đỏ chân cột (thường thấy ở VN)
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.25, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc8102e : 0xf0f0f0 })); b.position.y = 0.125 + i * 0.25; g.add(b); }
  const high = new TrafficLightHead(); high.group.position.set(-armLength + 0.3, 5.0, 0.15); g.add(high.group);
  const low = new TrafficLightHead(); low.group.position.set(0, 3.0, 0.2); g.add(low.group);
  return { group: g, heads: [high, low] };
}
