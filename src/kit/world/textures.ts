import * as THREE from 'three';

/**
 * Texture thủ tục vẽ bằng Canvas 2D — không cần tải file, không gradient trang trí.
 * Dùng màu phẳng + nhiễu nhỏ để bề mặt "có chất liệu" (nhựa đường, gạch vỉa hè, tường vôi).
 */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = 1 + r() * size;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

/** Nhựa đường đã qua sử dụng: hạt đá, vá ổ gà, vết dầu, vết bánh xe mờ. Lặp mỗi ~4 m. */
export function asphaltTexture(seed = 7, worn = 0.5) {
  const [c, ctx] = canvas(512, 512); const r = rng(seed);
  ctx.fillStyle = '#4a4b4d'; ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 26000, ['#3e3f41', '#56575a', '#5f6063', '#444547', '#6a6a6a'], r, 2);
  // miếng vá (màu đậm hơn, mép thẳng)
  for (let i = 0; i < 3 * worn + 1; i++) {
    ctx.fillStyle = r() > 0.5 ? '#3a3b3d' : '#535456';
    ctx.fillRect(r() * 450, r() * 450, 30 + r() * 90, 20 + r() * 60);
  }
  // vết dầu loang
  for (let i = 0; i < 6 * worn; i++) {
    ctx.fillStyle = 'rgba(25,25,28,0.18)';
    ctx.beginPath(); ctx.ellipse(r() * 512, r() * 512, 6 + r() * 18, 4 + r() * 10, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // vết nứt
  ctx.strokeStyle = 'rgba(30,30,32,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5 * worn; i++) {
    let x = r() * 512, y = r() * 512; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return finish(c);
}

/** Gạch lát vỉa hè kiểu VN (gạch vuông 30–40 cm đỏ/xám, có viên vỡ). */
export function sidewalkTexture(seed = 3, style: 'red' | 'grey' | 'terrazzo' = 'red') {
  const [c, ctx] = canvas(512, 512); const r = rng(seed);
  const base = style === 'red' ? ['#a3574a', '#9a5044', '#ad6152', '#8f4a3f'] : style === 'grey' ? ['#9b9a95', '#8f8e89', '#a6a5a0'] : ['#c9c3b6', '#bfb8aa', '#d2ccc0'];
  const tile = 64;
  ctx.fillStyle = '#6d6a64'; ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += tile) for (let x = 0; x < 512; x += tile) {
    ctx.fillStyle = base[(r() * base.length) | 0];
    ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    if (style === 'red') { // hoa văn gạch con sâu đơn giản: rãnh chéo
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.moveTo(x + 8, y + tile / 2); ctx.lineTo(x + tile - 8, y + tile / 2); ctx.stroke();
    }
    if (r() < 0.06) { ctx.fillStyle = '#5e5a55'; ctx.fillRect(x + 6 + r() * 20, y + 6 + r() * 20, 14 + r() * 20, 10 + r() * 16); } // viên vỡ
  }
  speckle(ctx, 512, 512, 9000, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.08)'], r, 1.5);
  if (style === 'terrazzo') speckle(ctx, 512, 512, 3000, ['#7d7468', '#e8e2d6', '#5a554e'], r, 3);
  return finish(c);
}

/** Bó vỉa (curb) sơn trắng-đỏ hoặc xám bê tông. */
export function curbTexture(painted = false) {
  const [c, ctx] = canvas(256, 32); const r = rng(11);
  if (painted) { for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#c23b2f' : '#e6e3dc'; ctx.fillRect(i * 64, 0, 64, 32); } }
  else { ctx.fillStyle = '#a19f99'; ctx.fillRect(0, 0, 256, 32); }
  speckle(ctx, 256, 32, 1500, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.1)'], r, 1.5);
  return finish(c);
}

/** Tường sơn nước kiểu nhà phố VN (vàng, kem, xanh nhạt…) có ố mốc ở chân tường & dưới ban công. */
export function plasterWallTexture(color: string, seed = 5) {
  const [c, ctx] = canvas(256, 256); const r = rng(seed);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 5000, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], r, 2);
  // vệt ố nước mưa chảy dọc
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(60,55,45,0.07)';
    const x = r() * 256; ctx.fillRect(x, 0, 3 + r() * 6, 40 + r() * 120);
  }
  // chân tường bẩn
  ctx.fillStyle = 'rgba(50,45,40,0.18)'; ctx.fillRect(0, 236, 256, 20);
  return finish(c);
}

/** Cửa cuốn sắt (rolling shutter) — tầng trệt nhà phố khi đóng cửa. */
export function shutterTexture(seed = 9) {
  const [c, ctx] = canvas(128, 128); const r = rng(seed);
  for (let y = 0; y < 128; y += 6) {
    ctx.fillStyle = y % 12 ? '#9aa0a3' : '#8a9093'; ctx.fillRect(0, y, 128, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + 5, 128, 1);
  }
  speckle(ctx, 128, 128, 600, ['rgba(120,80,50,0.25)'], r, 2); // gỉ sét
  return finish(c);
}

/** Bảng hiệu cửa hàng (chữ trắng/vàng trên nền đỏ/xanh) — biểu tượng phố VN. */
export function shopSignTexture(text: string, bg = '#b3261e', fg = '#fff6d5', sub?: string) {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${sub ? 54 : 64}px "Be Vietnam Pro", Arial, sans-serif`;
  ctx.fillText(text, 256, sub ? 52 : 66, 480);
  if (sub) { ctx.font = '600 26px "Be Vietnam Pro", Arial, sans-serif'; ctx.fillText(sub, 256, 100, 480); }
  return finish(c, false);
}

export const SHOP_NAMES: [string, string?][] = [
  ['PHỞ BÒ', 'Tái - Nạm - Gầu'], ['CƠM TẤM', 'Sườn bì chả'], ['TẠP HÓA', 'Thu Hằng'], ['SỬA XE', 'Vá vỏ - Thay nhớt'],
  ['CÀ PHÊ', 'Võng - Sân vườn'], ['NHÀ THUỐC', 'Tây y'], ['ĐIỆN THOẠI', 'Mua bán - Sửa chữa'], ['BÁNH MÌ', 'Thịt nguội - Pate'],
  ['TIỆM VÀNG', 'Kim Thành'], ['SALON TÓC', 'Nam Nữ'], ['VẬT LIỆU XD', 'Sắt thép - Xi măng'], ['QUÁN NHẬU', 'Lẩu dê'],
  ['RỬA XE', 'Máy - Ô tô'], ['PHOTO', 'In ấn - Văn phòng phẩm'], ['BÚN BÒ HUẾ'], ['TRÀ SỮA'], ['GẠO'], ['BIA HƠI'],
];

/** Vạch kẻ đường: textureless tốt hơn — dùng mesh mỏng màu phẳng. Đây là màu chuẩn: */
export const ROAD_PAINT = { white: 0xe9e7df, yellow: 0xe0b331, red: 0xb5332a } as const;
