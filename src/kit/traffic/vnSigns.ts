import * as THREE from 'three';

/**
 * Biển báo giao thông Việt Nam (theo nhóm của QCVN 41:2024/BGTVT) vẽ bằng Canvas.
 * Không cần file ảnh. Mã biển giữ đúng tên gọi để AI/nhà thiết kế tra cứu.
 * Màu chuẩn: đỏ #c8102e, xanh #0057a8, vàng #f6c600, đen #111.
 *
 * Gợi ý dùng: const mesh = makeSignMesh('P.127', { speed: 50 }); mesh.position.set(...)
 */
export type SignCode =
  | 'P.101' | 'P.102' | 'P.103a' | 'P.104' | 'P.106a' | 'P.123a' | 'P.123b' | 'P.124a' | 'P.127' | 'P.130' | 'P.131a'
  | 'R.122' | 'R.301' | 'R.302a' | 'R.303' | 'R.412' | 'R.420' | 'R.421' | 'I.407a' | 'I.423'
  | 'W.205a' | 'W.207' | 'W.208' | 'W.224' | 'W.225' | 'W.227' | 'W.239' | 'S.RIGHT_ON_RED';

export const SIGN_INFO: Record<SignCode, string> = {
  'P.101': 'Đường cấm (cấm mọi phương tiện cả hai chiều)',
  'P.102': 'Cấm đi ngược chiều',
  'P.103a': 'Cấm xe ô tô',
  'P.104': 'Cấm xe mô tô',
  'P.106a': 'Cấm xe tải',
  'P.123a': 'Cấm rẽ trái',
  'P.123b': 'Cấm rẽ phải',
  'P.124a': 'Cấm quay đầu xe',
  'P.127': 'Tốc độ tối đa cho phép',
  'P.130': 'Cấm dừng xe và đỗ xe',
  'P.131a': 'Cấm đỗ xe',
  'R.122': 'Dừng lại (STOP)',
  'R.301': 'Hướng đi phải theo (mũi tên)',
  'R.302a': 'Hướng phải đi vòng chướng ngại vật (sang phải)',
  'R.303': 'Nơi giao nhau chạy theo vòng xuyến',
  'R.412': 'Làn đường dành riêng cho từng loại xe',
  'R.420': 'Bắt đầu khu đông dân cư',
  'R.421': 'Hết khu đông dân cư',
  'I.407a': 'Đường một chiều',
  'I.423': 'Đường người đi bộ sang ngang',
  'W.205a': 'Đường giao nhau (cùng cấp)',
  'W.207': 'Giao nhau với đường không ưu tiên',
  'W.208': 'Giao nhau với đường ưu tiên',
  'W.224': 'Đường người đi bộ cắt ngang',
  'W.225': 'Trẻ em',
  'W.227': 'Công trường',
  'W.239': 'Đường cáp điện ở phía trên / (dùng làm chung: Chú ý nguy hiểm)',
  'S.RIGHT_ON_RED': 'Biển phụ: Xe máy, ô tô được rẽ phải khi đèn đỏ',
};

const RED = '#c8102e', BLUE = '#0057a8', YEL = '#f6c600', BLK = '#111111', WHT = '#ffffff';

function c2d(w = 256, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; }

function circle(ctx: CanvasRenderingContext2D, fill: string, ring?: string, ringW = 26) {
  ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fillStyle = ring ?? fill; ctx.fill();
  if (ring) { ctx.beginPath(); ctx.arc(128, 128, 124 - ringW, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
}
function slash(ctx: CanvasRenderingContext2D, color = RED, w = 22) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(48, 48); ctx.lineTo(208, 208); ctx.stroke(); ctx.restore();
}
function triangle(ctx: CanvasRenderingContext2D) {
  ctx.beginPath(); ctx.moveTo(128, 10); ctx.lineTo(250, 236); ctx.lineTo(6, 236); ctx.closePath(); ctx.fillStyle = RED; ctx.fill();
  ctx.beginPath(); ctx.moveTo(128, 46); ctx.lineTo(220, 218); ctx.lineTo(36, 218); ctx.closePath(); ctx.fillStyle = YEL; ctx.fill();
}
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -len / 2 + w, w, len - w);
  ctx.beginPath(); ctx.moveTo(0, -len / 2 - w * 0.4); ctx.lineTo(w * 1.4, -len / 2 + w * 1.3); ctx.lineTo(-w * 1.4, -len / 2 + w * 1.3); ctx.fill();
  ctx.restore();
}
function turnArrow(ctx: CanvasRenderingContext2D, dir: 'L' | 'R' | 'U', color = BLK) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 20; ctx.lineCap = 'butt';
  ctx.beginPath();
  if (dir === 'U') { ctx.moveTo(150, 190); ctx.lineTo(150, 110); ctx.arc(120, 110, 30, 0, Math.PI, true); ctx.lineTo(90, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(90, 185); ctx.lineTo(62, 145); ctx.lineTo(118, 145); ctx.fill(); }
  else { const s = dir === 'L' ? -1 : 1; ctx.moveTo(128 - s * 10, 195); ctx.lineTo(128 - s * 10, 125); ctx.quadraticCurveTo(128 - s * 10, 100, 128 + s * 20, 100); ctx.lineTo(128 + s * 40, 100); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128 + s * 78, 100); ctx.lineTo(128 + s * 38, 70); ctx.lineTo(128 + s * 38, 130); ctx.fill(); }
  ctx.restore();
}
function carIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = BLK) {
  ctx.fillStyle = color; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillRect(-50, -8, 100, 26); ctx.beginPath(); ctx.moveTo(-32, -8); ctx.lineTo(-20, -30); ctx.lineTo(22, -30); ctx.lineTo(36, -8); ctx.fill();
  ctx.beginPath(); ctx.arc(-28, 20, 11, 0, 7); ctx.arc(28, 20, 11, 0, 7); ctx.fill(); ctx.restore();
}
function bikeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = BLK) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(-34, 18, 16, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(36, 18, 16, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, 18); ctx.lineTo(-8, -2); ctx.lineTo(22, -2); ctx.lineTo(36, 18); ctx.moveTo(22, -2); ctx.lineTo(28, -24); ctx.lineTo(40, -24); ctx.stroke();
  ctx.fillRect(-20, -12, 30, 10); ctx.restore();
}
function walker(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = BLK) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -46, 10, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(-4, 4); ctx.lineTo(-20, 40); ctx.moveTo(-4, 4); ctx.lineTo(14, 40); ctx.moveTo(-2, -24); ctx.lineTo(-20, -2); ctx.moveTo(-2, -24); ctx.lineTo(18, -6); ctx.stroke(); ctx.restore();
}
function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, color = BLK, weight = 700) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Be Vietnam Pro", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
}

export interface SignOptions { speed?: number; arrowAngle?: number; label?: string }

/** Vẽ biển ra canvas 256×256 (hoặc 256×128 cho biển phụ). Trả về canvas để làm texture hoặc icon HUD. */
export function drawSign(code: SignCode, o: SignOptions = {}): HTMLCanvasElement {
  if (code === 'S.RIGHT_ON_RED') {
    const [c, ctx] = c2d(256, 128); ctx.fillStyle = WHT; ctx.fillRect(0, 0, 256, 128); ctx.strokeStyle = BLK; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 122);
    text(ctx, o.label ?? 'Xe máy được rẽ phải', 128, 44, 24); text(ctx, 'khi đèn đỏ', 128, 84, 24); return c;
  }
  const [c, ctx] = c2d();
  switch (code) {
    case 'P.101': circle(ctx, WHT, RED); break;
    case 'P.102': circle(ctx, RED); ctx.fillStyle = WHT; ctx.fillRect(40, 108, 176, 40); break;
    case 'P.103a': circle(ctx, WHT, RED); carIcon(ctx, 128, 132, 1.25); slash(ctx); break;
    case 'P.104': circle(ctx, WHT, RED); bikeIcon(ctx, 128, 128, 1.3); slash(ctx); break;
    case 'P.106a': circle(ctx, WHT, RED); ctx.fillStyle = BLK; ctx.fillRect(62, 96, 90, 46); ctx.fillRect(152, 110, 40, 32); ctx.beginPath(); ctx.arc(90, 152, 12, 0, 7); ctx.arc(170, 152, 12, 0, 7); ctx.fill(); break;
    case 'P.123a': circle(ctx, WHT, RED); turnArrow(ctx, 'L'); slash(ctx); break;
    case 'P.123b': circle(ctx, WHT, RED); turnArrow(ctx, 'R'); ctx.save(); ctx.translate(256, 0); ctx.scale(-1, 1); slash(ctx); ctx.restore(); break;
    case 'P.124a': circle(ctx, WHT, RED); turnArrow(ctx, 'U'); slash(ctx); break;
    case 'P.127': circle(ctx, WHT, RED, 24); text(ctx, String(o.speed ?? 50), 128, 134, 100); break;
    case 'P.130': circle(ctx, BLUE, RED); ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(196, 196); ctx.moveTo(196, 60); ctx.lineTo(60, 196); ctx.stroke(); ctx.restore(); break;
    case 'P.131a': circle(ctx, BLUE, RED); slash(ctx, RED, 20); break;
    case 'R.122': {
      ctx.fillStyle = WHT; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(128 + 126 * Math.cos(a), 128 + 126 * Math.sin(a)); } ctx.fill();
      ctx.fillStyle = RED; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(128 + 116 * Math.cos(a), 128 + 116 * Math.sin(a)); } ctx.fill();
      text(ctx, 'STOP', 128, 132, 78, WHT); break;
    }
    case 'R.301': circle(ctx, BLUE); arrow(ctx, 128, 132, o.arrowAngle ?? 0, 150, 30, WHT); break;
    case 'R.302a': circle(ctx, BLUE); arrow(ctx, 128, 128, Math.PI * 0.75, 170, 30, WHT); break;
    case 'R.303': circle(ctx, BLUE); for (let i = 0; i < 3; i++) arrow(ctx, 128 + 62 * Math.cos(i * 2.094), 128 + 62 * Math.sin(i * 2.094), i * 2.094 + Math.PI, 70, 18, WHT); break;
    case 'R.412': ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = WHT; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 236, 236); bikeIcon(ctx, 128, 110, 1.3, WHT); text(ctx, o.label ?? 'XE MÁY', 128, 205, 40, WHT); break;
    case 'R.420': case 'R.421': {
      ctx.fillStyle = WHT; ctx.fillRect(0, 30, 256, 196); ctx.strokeStyle = BLK; ctx.lineWidth = 6; ctx.strokeRect(4, 34, 248, 188);
      ctx.fillStyle = BLK; for (let i = 0; i < 5; i++) { const h = 40 + ((i * 37) % 60); ctx.fillRect(30 + i * 42, 190 - h, 34, h); ctx.beginPath(); ctx.moveTo(30 + i * 42, 190 - h); ctx.lineTo(47 + i * 42, 175 - h); ctx.lineTo(64 + i * 42, 190 - h); ctx.fill(); }
      if (code === 'R.421') slash(ctx, RED, 16); break;
    }
    case 'I.407a': ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 256, 256); arrow(ctx, 128, 132, 0, 190, 40, WHT); break;
    case 'I.423': ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = WHT; ctx.beginPath(); ctx.moveTo(128, 22); ctx.lineTo(234, 220); ctx.lineTo(22, 220); ctx.fill(); walker(ctx, 128, 150, 1.25); for (let i = 0; i < 5; i++) { ctx.fillStyle = BLK; ctx.fillRect(48 + i * 34, 202, 20, 10); } break;
    case 'W.205a': triangle(ctx); ctx.fillStyle = BLK; ctx.fillRect(116, 92, 24, 116); ctx.fillRect(70, 138, 116, 24); break;
    case 'W.207': triangle(ctx); ctx.fillStyle = BLK; ctx.fillRect(112, 84, 32, 126); ctx.fillRect(80, 144, 96, 12); break;
    case 'W.208': triangle(ctx); ctx.fillStyle = BLK; ctx.fillRect(120, 90, 16, 120); ctx.fillRect(70, 136, 116, 30); break;
    case 'W.224': triangle(ctx); walker(ctx, 128, 160, 1.1); break;
    case 'W.225': triangle(ctx); walker(ctx, 104, 168, 0.9); walker(ctx, 152, 172, 0.75); break;
    case 'W.227': triangle(ctx); ctx.fillStyle = BLK; ctx.beginPath(); ctx.arc(108, 112, 12, 0, 7); ctx.fill(); ctx.fillRect(98, 126, 18, 56); ctx.fillRect(130, 170, 60, 14); ctx.save(); ctx.translate(140, 140); ctx.rotate(-0.8); ctx.fillRect(-4, -30, 8, 60); ctx.restore(); break;
    case 'W.239': triangle(ctx); text(ctx, '!', 128, 160, 120); break;
  }
  return c;
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function signTexture(code: SignCode, o: SignOptions = {}) {
  const key = code + JSON.stringify(o);
  let t = texCache.get(key);
  if (!t) { t = new THREE.CanvasTexture(drawSign(code, o)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(key, t); }
  return t;
}

/** Biển + cột thép mạ kẽm. Mặt biển hướng về +Z (xe đi theo -Z tới sẽ nhìn thấy) — xoay group cho đúng hướng. */
export function makeSignMesh(code: SignCode, o: SignOptions & { height?: number; size?: number } = {}) {
  const g = new THREE.Group(); g.name = `sign:${code}`;
  const size = o.size ?? 0.7, h = o.height ?? 2.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 10), new THREE.MeshStandardMaterial({ color: 0x9ea3a6, metalness: 0.6, roughness: 0.45 }));
  pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const isPlate = code === 'S.RIGHT_ON_RED';
  const geo = isPlate ? new THREE.PlaneGeometry(size, size / 2) : new THREE.PlaneGeometry(size, size);
  const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: signTexture(code, o), transparent: true, alphaTest: 0.5, roughness: 0.5 }));
  face.position.set(0, h - size / 2, 0.054); g.add(face);
  const sil = drawSign(code, o); const sctx = sil.getContext('2d')!;
  sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, sil.width, sil.height); // giữ hình dáng, xoá hoa văn
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8d9295, metalness: 0.5, roughness: 0.6, alphaMap: new THREE.CanvasTexture(sil), alphaTest: 0.5 }));
  back.position.set(0, h - size / 2, 0.040); back.rotation.y = Math.PI; g.add(back);
  g.userData = { signCode: code, meaning: SIGN_INFO[code], ...o };
  return g;
}
