/**
 * Bản đồ phím theo YÊU CẦU CỦA CHỦ DỰ ÁN (không được đổi các phím đã chốt):
 *   W / ↑ / K   : ga / tiến tới
 *   S / ↓       : lùi (khi đã dừng) — đang chạy thì là phanh nhẹ
 *   A / ←, D / →: đánh lái trái / phải
 *   Space / L   : phanh (thắng)
 *   E / F       : bấm còi ("nhấn cò")
 *   T           : bật / tắt đèn pha (pha ↔ cốt ↔ tắt)
 * Phím bổ sung (đề xuất, có thể đổi):
 *   Q / R       : xi-nhan trái / phải (bấm lại để tắt)
 *   H           : đèn khẩn cấp (hazard)
 *   C / V       : đổi góc nhìn tiếp / lùi (3 góc thứ 3 + 1 góc thứ nhất)
 *   M           : phóng to / thu nhỏ minimap
 *   1 / 2       : chọn xe máy / ô tô (ở menu hoặc khi dừng xe)
 *   P / Esc     : tạm dừng
 */
export type Action =
  | 'throttle' | 'reverse' | 'left' | 'right' | 'brake' | 'horn' | 'headlight'
  | 'signalLeft' | 'signalRight' | 'hazard' | 'cameraNext' | 'cameraPrev'
  | 'minimap' | 'vehicleBike' | 'vehicleCar' | 'pause';

export const KEYMAP: Record<Action, string[]> = {
  throttle: ['KeyW', 'ArrowUp', 'KeyK'],
  reverse: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  brake: ['Space', 'KeyL'],
  horn: ['KeyE', 'KeyF'],
  headlight: ['KeyT'],
  signalLeft: ['KeyQ'],
  signalRight: ['KeyR'],
  hazard: ['KeyH'],
  cameraNext: ['KeyC'],
  cameraPrev: ['KeyV'],
  minimap: ['KeyM'],
  vehicleBike: ['Digit1'],
  vehicleCar: ['Digit2'],
  pause: ['KeyP', 'Escape'],
};

/** Giá trị analog đã làm mượt (0..1) để xe không giật khi dùng bàn phím. */
export interface DriveInput {
  throttle: number; // 0..1
  brake: number;    // 0..1
  steer: number;    // -1 (trái) .. +1 (phải)
  reverse: boolean;
  horn: boolean;
}

type Listener = (a: Action) => void;

export class Controls {
  private down = new Set<string>();
  private pressedListeners: Listener[] = [];
  readonly input: DriveInput = { throttle: 0, brake: 0, steer: 0, reverse: false, horn: false };

  constructor(private target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', () => this.down.clear());
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
  }

  /** Lắng nghe hành động dạng "bấm 1 lần" (đèn, xi-nhan, đổi camera...). */
  onPressed(fn: Listener) { this.pressedListeners.push(fn); return () => { this.pressedListeners = this.pressedListeners.filter(f => f !== fn); }; }

  isDown(a: Action) { return KEYMAP[a].some(k => this.down.has(k)); }

  /** Gọi mỗi frame. Làm mượt ga/phanh/lái như tay người thật — trả lái nhanh và ổn định. */
  update(dt: number) {
    const i = this.input;
    const approach = (v: number, t: number, rate: number) => v + Math.sign(t - v) * Math.min(Math.abs(t - v), rate * dt);
    i.throttle = approach(i.throttle, this.isDown('throttle') ? 1 : 0, this.isDown('throttle') ? 5.2 : 7.5);
    i.brake = approach(i.brake, this.isDown('brake') ? 1 : 0, 8.5);
    const steerTarget = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    // Trả lái về giữa nhanh hơn nhiều so với đánh lái để xe máy & ô tô dễ giữ thẳng làn
    const steerRate = steerTarget === 0 ? 8.5 : (steerTarget * i.steer < 0 ? 7.5 : 3.4);
    i.steer = approach(i.steer, steerTarget, steerRate);
    i.reverse = this.isDown('reverse');
    i.horn = this.isDown('horn');
  }

  private onDown = (e: KeyboardEvent) => {
    const isGameKey = Object.values(KEYMAP).some(list => list.includes(e.code));
    if (isGameKey) e.preventDefault(); // chặn Space/mũi tên cuộn trang
    if (e.repeat) return;
    this.down.add(e.code);
    for (const [action, codes] of Object.entries(KEYMAP) as [Action, string[]][]) {
      if (codes.includes(e.code)) this.pressedListeners.forEach(fn => fn(action));
    }
  };
  private onUp = (e: KeyboardEvent) => { this.down.delete(e.code); };
}
