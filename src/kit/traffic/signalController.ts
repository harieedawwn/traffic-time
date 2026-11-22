import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bộ điều khiển đèn tín hiệu kiểu Việt Nam.
 * - Pha xanh → vàng (3 s) → toàn đỏ (1 s) → pha kế tiếp.
 * - Có ĐỒNG HỒ ĐẾM NGƯỢC (rất phổ biến ở VN) cho cả xanh và đỏ.
 * - Chế độ "vàng nhấp nháy" (giờ thấp điểm / đèn hỏng): người lái phải giảm tốc, nhường đường theo quy tắc.
 * - Thời gian rút ngắn cho game (đèn đỏ ~10 s theo yêu cầu) — chỉnh trong SignalTiming.
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
  private approachMap = new Map<string, Approach>();

  constructor(public approaches: Approach[], public timing: SignalTiming = GAME_TIMING, offset = 0) {
    this.groups = Math.max(...approaches.map(a => a.group)) + 1;
    this.time = offset;
    for (const a of approaches) this.approachMap.set(a.id, a);
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
    const a = this.approachMap.get(approachId); if (!a) return 'off';
    if (a.group !== this.phase) return 'red';
    return this.stage === 'green' ? 'green' : this.stage === 'yellow' ? 'yellow' : 'red';
  }

  /** Số giây còn lại hiển thị trên đồng hồ đếm ngược của hướng này. */
  countdownFor(approachId: string): number {
    const a = this.approachMap.get(approachId); if (!a || this.flashingMode) return 0;
    const T = this.timing; const per = T.green + T.yellow + T.allRed;
    const t = this.time % this.cycle;
    const startOfGroup = a.group * per;
    if (a.group === this.phase) {
      const local = t - startOfGroup;
      if (local < T.green) return Math.ceil(T.green - local);
      if (local < T.green + T.yellow) return Math.ceil(T.green + T.yellow - local);
      return 0;
    }
    let wait = startOfGroup - t; if (wait < 0) wait += this.cycle;
    return Math.ceil(wait);
  }
}

/* ---------------------------------------------------------------- 3D (Ultra-Batched!) ---- */

interface ColoredBoxPart {
  w: number;
  h: number;
  d: number;
  color: number;
  x?: number;
  y?: number;
  z?: number;
  rz?: number;
}

const _tmpMat4 = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _tmpPos = new THREE.Vector3();
const _tmpScale = new THREE.Vector3(1, 1, 1);
const _tmpCol = new THREE.Color();

function bakeSignalParts(parts: ColoredBoxPart[]): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const raw = new THREE.BoxGeometry(p.w, p.h, p.d);
    const g = raw.toNonIndexed();
    raw.dispose();
    _tmpPos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    _tmpEuler.set(0, 0, p.rz ?? 0);
    _tmpQuat.setFromEuler(_tmpEuler);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    g.applyMatrix4(_tmpMat4);
    g.computeVertexNormals();
    const count = g.attributes.position.count;
    _tmpCol.setHex(p.color);
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = _tmpCol.r;
      cols[i * 3 + 1] = _tmpCol.g;
      cols[i * 3 + 2] = _tmpCol.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) throw new Error('bakeSignalParts failed');
  merged.computeBoundingSphere();
  return merged;
}

const _batchedStaticMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.62,
  metalness: 0.28,
  flatShading: true,
});

const _geoLens = new THREE.BoxGeometry(0.42, 0.42, 0.06);
const _geoBoardFace = new THREE.PlaneGeometry(0.60, 0.48);

function buildBakedHeadHousing(showCountdown: boolean): THREE.BufferGeometry {
  const parts: ColoredBoxPart[] = [
    // High-contrast white reflective backplate border (cleanly behind housing, zero Z-fighting!)
    { w: 0.76, h: 1.88, d: 0.05, color: 0xe8edf2, z: -0.195 },
    // Bold dark blocky housing
    { w: 0.62, h: 1.72, d: 0.34, color: 0x16191e },
  ];
  for (const y of [0.54, 0, -0.54]) {
    // Recessed bezel frame + 3-sided blocky sun hood (mái che nắng)
    parts.push(
      { w: 0.48, h: 0.48, d: 0.04, color: 0x0f1216, y, z: 0.16 },
      { w: 0.50, h: 0.06, d: 0.30, color: 0x0f1216, y: y + 0.23, z: 0.28 },
      { w: 0.05, h: 0.36, d: 0.24, color: 0x0f1216, x: -0.23, y: y + 0.06, z: 0.25 },
      { w: 0.05, h: 0.36, d: 0.24, color: 0x0f1216, x: 0.23, y: y + 0.06, z: 0.25 },
    );
  }
  if (showCountdown) {
    parts.push({ w: 0.68, h: 0.56, d: 0.24, color: 0x16191e, x: 0.66, y: 0.36, z: 0.02 });
  }
  return bakeSignalParts(parts);
}

// Pre-baked once globally: turns 16 static head meshes into 1 single draw call!
const _geoHeadWithCountdown = buildBakedHeadHousing(true);
const _geoHeadSimple = buildBakedHeadHousing(false);
const _poleGeoCache = new Map<number, THREE.BufferGeometry>();

function getBakedPoleGeo(armLength: number): THREE.BufferGeometry {
  const key = Math.round(armLength * 10);
  const cached = _poleGeoCache.get(key);
  if (cached) return cached;
  const parts: ColoredBoxPart[] = [
    // Concrete plinth base
    { w: 0.48, h: 0.36, d: 0.48, color: 0x1e2228, y: 0.18 },
    // Crisp square steel vertical pole
    { w: 0.22, h: 6.2, d: 0.22, color: 0x6c747e, y: 3.2 },
    // Horizontal cantilevered truss arm
    { w: armLength, h: 0.18, d: 0.18, color: 0x6c747e, x: -armLength / 2, y: 5.95 },
    // Diagonal support brace under arm
    { w: 1.1, h: 0.1, d: 0.1, color: 0x6c747e, x: -0.55, y: 5.45, rz: Math.PI / 4 },
    // Electrical control cabinet bolted to pole
    { w: 0.32, h: 0.48, d: 0.26, color: 0xe2e8f0, x: 0.24, y: 1.55 },
  ];
  // Bold red-white painted warning stripes at lower pole (rất đặc trưng VN)
  for (let i = 0; i < 4; i++) {
    parts.push({
      w: 0.25,
      h: 0.28,
      d: 0.25,
      color: i % 2 === 0 ? 0xd41c2c : 0xf4f5f2,
      y: 0.50 + i * 0.28,
    });
  }
  const geo = bakeSignalParts(parts);
  _poleGeoCache.set(key, geo);
  return geo;
}

/**
 * Hộp đèn 3 bóng dọc kiểu blocky Việt Nam — tối ưu gộp vỏ/mái che thành 1 draw call duy nhất,
 * bóng đèn màu tươi sắc nét (toneMapped: false) nhìn rõ từ xa > 120 m!
 */
export class TrafficLightHead {
  group = new THREE.Group();
  private lamps: Record<'red' | 'yellow' | 'green', THREE.MeshBasicMaterial>;
  private digitsCanvas: HTMLCanvasElement | null = null;
  private digitsTex: THREE.CanvasTexture | null = null;
  private lastShown = '';
  private lastLight: Light | '' = '';

  constructor(private showCountdown = true) {
    // Single batched mesh for backplate + housing + 3 bezels + 9 sun visors + countdown box!
    const housing = new THREE.Mesh(showCountdown ? _geoHeadWithCountdown : _geoHeadSimple, _batchedStaticMat);
    this.group.add(housing);

    const mkLens = (y: number, offHex: number) => {
      const m = new THREE.MeshBasicMaterial({ color: offHex, toneMapped: false });
      const lens = new THREE.Mesh(_geoLens, m);
      lens.position.set(0, y, 0.185);
      this.group.add(lens);
      return m;
    };

    this.lamps = {
      red: mkLens(0.54, 0x331111),
      yellow: mkLens(0, 0x33290e),
      green: mkLens(-0.54, 0x0e2d1a),
    };

    if (showCountdown) {
      this.digitsCanvas = document.createElement('canvas');
      this.digitsCanvas.width = 96;
      this.digitsCanvas.height = 72;
      this.digitsTex = new THREE.CanvasTexture(this.digitsCanvas);
      this.digitsTex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(_geoBoardFace, new THREE.MeshBasicMaterial({ map: this.digitsTex, toneMapped: false }));
      face.position.set(0.66, 0.36, 0.155);
      this.group.add(face);
    }
  }

  set(light: Light, countdown: number) {
    if (light !== this.lastLight) {
      this.lastLight = light;
      this.lamps.red.color.setHex(light === 'red' ? 0xff2222 : 0x2c1111);
      this.lamps.yellow.color.setHex(light === 'yellow' || light === 'flashing' ? 0xffc400 : 0x2c240d);
      this.lamps.green.color.setHex(light === 'green' ? 0x10e860 : 0x0d2817);
    }

    if (!this.showCountdown || !this.digitsCanvas || !this.digitsTex) return;

    const txt = light === 'flashing' || light === 'off' || countdown <= 0 ? '--' : String(Math.min(99, countdown)).padStart(2, '0');
    const color = light === 'green' ? '#18f068' : light === 'yellow' || light === 'flashing' ? '#ffc800' : '#ff2e2e';
    const key = txt + color;
    if (key !== this.lastShown) {
      const ctx = this.digitsCanvas.getContext('2d')!;
      ctx.fillStyle = '#07090c';
      ctx.fillRect(0, 0, 96, 72);
      ctx.strokeStyle = '#38414d';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 93, 69);
      ctx.fillStyle = color;
      ctx.font = '800 54px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 48, 39);
      this.digitsTex.needsUpdate = true;
      this.lastShown = key;
    }
  }
}

/** Cột đèn cần vươn blocky tối ưu (gộp toàn bộ thân cột + cần vươn + sọc đỏ trắng thành 1 draw call!). */
export function makeSignalPole(armLength = 4.2) {
  const g = new THREE.Group();
  g.name = 'signal-pole';

  const poleMesh = new THREE.Mesh(getBakedPoleGeo(armLength), _batchedStaticMat);
  g.add(poleMesh);

  // Main overhead signal head (large, with countdown) + eye-level repeater head
  const high = new TrafficLightHead(true);
  high.group.position.set(-armLength + 0.55, 5.15, 0.2);
  g.add(high.group);

  const low = new TrafficLightHead(false);
  low.group.scale.setScalar(0.76);
  low.group.position.set(0, 3.1, 0.26);
  g.add(low.group);

  return { group: g, heads: [high, low] };
}
