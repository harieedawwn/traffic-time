import * as THREE from 'three';

/**
 * Texture thủ tục vẽ bằng Canvas 2D — phong cách blocky sắc nét, độ tương phản cao,
 * không gradient trang trí, nổi bật rõ ràng dưới ánh nắng.
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

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, size = 3) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = 1 + Math.floor(r() * size);
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s);
  }
}

/** Nhựa đường charcoal tương phản cao: hạt đá rõ, vệt lốp xe tối, miếng vá sắc nét. */
export function asphaltTexture(seed = 7, worn = 0.5) {
  const [c, ctx] = canvas(512, 512); const r = rng(seed);
  ctx.fillStyle = '#2d3239'; ctx.fillRect(0, 0, 512, 512);
  // Crisp blocky asphalt aggregate grain (high-contrast salt-and-pepper gravel)
  speckle(ctx, 512, 512, 26000, ['#23282e', '#363c44', '#434a54', '#272c33', '#515864', '#1f2329'], r, 3);
  // Subtle darker tire-track wear bands + center oil-drip sheen strip
  ctx.fillStyle = 'rgba(15, 18, 22, 0.24)';
  ctx.fillRect(88, 0, 78, 512);
  ctx.fillRect(346, 0, 78, 512);
  ctx.fillStyle = 'rgba(18, 20, 24, 0.14)';
  ctx.fillRect(228, 0, 56, 512);
  // Rectangular repaired asphalt patches with crisp tar perimeter
  for (let i = 0; i < 3 * worn + 1; i++) {
    const px = Math.floor(r() * 410);
    const py = Math.floor(r() * 410);
    const pw = 38 + Math.floor(r() * 88);
    const ph = 26 + Math.floor(r() * 58);
    ctx.fillStyle = r() > 0.5 ? '#22262c' : '#393f48';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(12, 14, 17, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  }
  // Crisp tar crack lines
  ctx.strokeStyle = 'rgba(14, 16, 19, 0.72)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4 * worn; i++) {
    let x = r() * 512, y = r() * 512; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 32; y += (r() - 0.5) * 32; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return finish(c);
}

/** Gạch lát vỉa hè kiểu VN sắc nét (mạch gạch đậm, khối gạch rõ ràng). */
export function sidewalkTexture(seed = 3, style: 'red' | 'grey' | 'terrazzo' = 'red') {
  const [c, ctx] = canvas(512, 512); const r = rng(seed);
  const base =
    style === 'red'
      ? ['#9d4b3d', '#914336', '#ab5647', '#853c30']
      : style === 'grey'
        ? ['#8d8e8a', '#81827e', '#989995']
        : ['#bab2a1', '#aca492', '#c5bdab'];
  const tile = 64;
  ctx.fillStyle = '#48453f'; ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += tile) for (let x = 0; x < 512; x += tile) {
    ctx.fillStyle = base[(r() * base.length) | 0];
    ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);
    // Highlight top/left bevel edge for crisp blocky tile depth!
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 3, y + 3, tile - 6, 3);
    ctx.fillRect(x + 3, y + 3, 3, tile - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 3, y + tile - 6, tile - 6, 3);
    ctx.fillRect(x + tile - 6, y + 3, 3, tile - 6);
    if (style === 'red') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + 10, y + tile / 2 - 1, tile - 20, 2);
      ctx.fillRect(x + tile / 2 - 1, y + 10, 2, tile - 20);
    } else if (style === 'terrazzo') {
      // Classic Vietnamese terrazzo inner cross groove
      ctx.fillStyle = 'rgba(72,68,62,0.22)';
      ctx.fillRect(x + 8, y + tile / 2 - 1, tile - 16, 2);
      ctx.fillRect(x + tile / 2 - 1, y + 8, 2, tile - 16);
    }
  }
  speckle(ctx, 512, 512, 6500, ['rgba(0,0,0,0.14)', 'rgba(255,255,255,0.08)'], r, 2);
  if (style === 'terrazzo') speckle(ctx, 512, 512, 3200, ['#665e53', '#e5dfd1', '#4a453f', '#8d8374'], r, 3);
  return finish(c);
}

/** Bó vỉa (curb) sơn trắng-đỏ đậm sắc nét hoặc xám bê tông. */
export function curbTexture(painted = false) {
  const [c, ctx] = canvas(256, 32); const r = rng(11);
  if (painted) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#c9231f' : '#ebe9e1';
      ctx.fillRect(i * 64, 0, 64, 32);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 0, 256, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(0, 26, 256, 6);
  } else {
    ctx.fillStyle = '#8b8a84'; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, 0, 256, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(0, 26, 256, 6);
  }
  speckle(ctx, 256, 32, 1200, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)'], r, 2);
  return finish(c);
}

/** Tường sơn nhà phố VN (màu ấm có độ tương phản, chân tường gạch ốp & đường chỉ ngang rõ). */
export function plasterWallTexture(color: string, seed = 5) {
  const [c, ctx] = canvas(256, 256); const r = rng(seed);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  // Subtle masonry block horizontal bands & vertical edge pilasters
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < 256; y += 32) {
    ctx.fillRect(0, y, 256, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, 10, 256);
  ctx.fillRect(246, 0, 10, 256);
  speckle(ctx, 256, 256, 4800, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)'], r, 2);
  // Authentic tropical rain-drip streaks beneath ledges & balconies
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(42,38,32,0.10)';
    const x = r() * 256; ctx.fillRect(x, 0, 3 + r() * 6, 42 + r() * 110);
  }
  // Darker stone plinth skirt + crisp horizontal trim band at wall base
  ctx.fillStyle = 'rgba(32,29,25,0.32)'; ctx.fillRect(0, 228, 256, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(0, 226, 256, 3);
  return finish(c);
}

/** Cửa cuốn sắt (rolling shutter) tương phản đậm rõ rãnh ngang. */
export function shutterTexture(seed = 9) {
  const [c, ctx] = canvas(128, 128); const r = rng(seed);
  for (let y = 0; y < 128; y += 8) {
    ctx.fillStyle = y % 16 ? '#747d86' : '#636c75'; ctx.fillRect(0, y, 128, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.40)'; ctx.fillRect(0, y + 6, 128, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, y, 128, 1);
  }
  // Lock bar near bottom of Vietnamese rolling shutter
  ctx.fillStyle = '#252b32'; ctx.fillRect(50, 104, 28, 10);
  speckle(ctx, 128, 128, 450, ['rgba(110,65,38,0.28)'], r, 2);
  return finish(c);
}

/** Bảng hiệu cửa hàng (chữ đậm rõ viền kép nổi bật) — biểu tượng phố VN. */
export function shopSignTexture(text: string, bg = '#b3261e', fg = '#fff6d5', sub?: string) {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  // Crisp outer & inner metallic frame bands (flat colors, zero gradient)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, 512, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 118, 512, 10);
  ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
  // Crisp flat shadow behind Vietnamese lettering for high readability
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${sub ? 52 : 62}px "Be Vietnam Pro", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(text, 259, (sub ? 50 : 66) + 3, 472);
  ctx.fillStyle = fg;
  ctx.fillText(text, 256, sub ? 50 : 66, 472);
  if (sub) {
    ctx.font = '700 25px "Be Vietnam Pro", Arial, sans-serif';
    ctx.fillStyle = fg;
    ctx.fillText(sub, 256, 97, 472);
  }
  return finish(c, false);
}

export const SHOP_NAMES: [string, string?][] = [
  ['PHỞ BÒ', 'Tái - Nạm - Gầu'], ['CƠM TẤM', 'Sườn bì chả'], ['TẠP HÓA', 'Thu Hằng'], ['SỬA XE', 'Vá vỏ - Thay nhớt'],
  ['CÀ PHÊ', 'Võng - Sân vườn'], ['NHÀ THUỐC', 'Tây y'], ['ĐIỆN THOẠI', 'Mua bán - Sửa chữa'], ['BÁNH MÌ', 'Thịt nguội - Pate'],
  ['TIỆM VÀNG', 'Kim Thành'], ['SALON TÓC', 'Nam Nữ'], ['VẬT LIỆU XD', 'Sắt thép - Xi măng'], ['QUÁN NHẬU', 'Lẩu dê'],
  ['RỬA XE', 'Máy - Ô tô'], ['PHOTO', 'In ấn - Văn phòng phẩm'], ['BÚN BÒ HUẾ'], ['TRÀ SỮA'], ['GẠO'], ['BIA HƠI'],
];

/** Vạch kẻ đường: màu sáng rõ nổi bật trên mặt nhựa đường tối. */
export const ROAD_PAINT = { white: 0xf4f2ea, yellow: 0xf0be26, red: 0xc92a24 } as const;
