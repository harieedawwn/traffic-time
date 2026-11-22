import type { HeadlightMode, TimeOfDay, VehicleId, ViolationCode, ViolationEvent } from '../types';
import type { RoadProjection } from '../world/RoadGraph';

export interface RuleEvalContext {
  dt: number;
  elapsedSec: number;
  vehicle: VehicleId;
  speedKmh: number;
  speedMs: number;
  heading: number;
  yawRate: number;
  signalLeft: boolean;
  signalRight: boolean;
  headlight: HeadlightMode;
  timeOfDay: TimeOfDay;
  projection: RoadProjection | null;
  /** Red-light crossing check computed from traffic signal controller */
  crossedRedLight: boolean;
  crossedRightOnRedAllowed: boolean;
  isTurningRight: boolean;
  /** True if player crossed railway line while barrier is down */
  crossedClosedRailway: boolean;
  /** True if player collided with NPC/obstacle this step */
  collided: boolean;
  /** True if player failed to yield to pedestrian in crosswalk */
  pedestrianNearMiss: boolean;
}

interface ViolationDef {
  points: number;
  title: string;
  detail: string;
  tip: string;
  cooldownSec: number;
}

export const VIOLATION_DEFS: Record<ViolationCode, ViolationDef> = {
  RED_LIGHT: {
    points: 4,
    title: 'Vượt đèn đỏ',
    detail: 'Bạn đã vượt qua vạch dừng khi đèn tín hiệu đang đỏ.',
    tip: 'Giảm tốc sớm khi đồng hồ xanh còn 3 giây và dừng trước vạch kẻ trắng.',
    cooldownSec: 7,
  },
  RIGHT_ON_RED_FORBIDDEN: {
    points: 4,
    title: 'Rẽ phải khi đèn đỏ sai quy định',
    detail: 'Giao lộ này KHÔNG có biển phụ hoặc đèn mũi tên cho phép rẽ phải khi đèn đỏ.',
    tip: 'Luật 2024: Đèn đỏ mặc định cấm rẽ phải, chỉ được rẽ khi có biển phụ cho phép.',
    cooldownSec: 7,
  },
  WRONG_WAY: {
    points: 4,
    title: 'Đi ngược chiều',
    detail: 'Bạn đang đi ngược chiều quy định của làn đường hoặc đường một chiều.',
    tip: 'Luôn đi bên PHẢI theo chiều đi của mình và chú ý biển I.407a / P.102.',
    cooldownSec: 6,
  },
  SPEEDING: {
    points: 2,
    title: 'Chạy quá tốc độ cho phép',
    detail: 'Tốc độ hiện tại vượt quá giới hạn biển báo P.127 trên tuyến đường này.',
    tip: 'Quan sát biển tròn viền đỏ tốc độ tối đa trên góc màn hình và ven đường.',
    cooldownSec: 7,
  },
  WRONG_LANE: {
    points: 2,
    title: 'Đi sai làn đường (R.412)',
    detail: 'Bạn đang đi vào làn đường dành riêng cho loại phương tiện khác.',
    tip: 'Trên đại lộ có biển R.412: xe máy đi làn sát bên phải, ô tô đi các làn bên trái.',
    cooldownSec: 8,
  },
  NO_SIGNAL: {
    points: 1,
    title: 'Chuyển hướng không bật xi-nhan',
    detail: 'Bạn đã rẽ hoặc chuyển hướng gấp mà chưa bật đèn báo rẽ.',
    tip: 'Bấm Q (xi-nhan trái) hoặc R (xi-nhan phải) trước khi rẽ ít nhất 20–30 m.',
    cooldownSec: 8,
  },
  PEDESTRIAN_YIELD: {
    points: 2,
    title: 'Không nhường người đi bộ',
    detail: 'Bạn đi quá sát hoặc không giảm tốc khi có người đi bộ trên vạch qua đường.',
    tip: 'Luôn giảm tốc và nhường đường khi thấy biển W.224/W.225 và người đang sang đường.',
    cooldownSec: 6,
  },
  SIDEWALK: {
    points: 2,
    title: 'Điều khiển xe lên vỉa hè',
    detail: 'Bạn đã cho xe chạy lên phần vỉa hè dành cho người đi bộ.',
    tip: 'Kể cả khi đường đông, tuyệt đối không leo lên vỉa hè để vượt xe khác.',
    cooldownSec: 5,
  },
  COLLISION: {
    points: 3,
    title: 'Va chạm giao thông',
    detail: 'Xe của bạn vừa xảy ra va chạm với phương tiện hoặc chướng ngại vật.',
    tip: 'Giữ khoảng cách an toàn, giảm tốc tại giao lộ và chú ý điểm mù gương chiếu hậu.',
    cooldownSec: 3.5,
  },
  NO_HEADLIGHT_NIGHT: {
    points: 1,
    title: 'Không bật đèn chiếu sáng ban đêm',
    detail: 'Trời đang tối nhưng bạn chưa bật đèn xe (18h–6h bắt buộc bật đèn).',
    tip: 'Nhấn phím T để bật đèn cốt khi chạy ban đêm trong đô thị.',
    cooldownSec: 12,
  },
  RAILWAY_BARRIER: {
    points: 4,
    title: 'Vượt rào chắn đường sắt',
    detail: 'Bạn cố băng qua đường ray khi barie đang đóng và tàu hỏa đang tới!',
    tip: 'Dừng cách barie tối thiểu 5 m và chỉ đi khi rào chắn đã mở hoàn toàn.',
    cooldownSec: 8,
  },
  NO_STOP_SIGN: {
    points: 2,
    title: 'Không dừng tại biển STOP (R.122)',
    detail: 'Bạn không dừng lại quan sát trước khi ra đường ưu tiên.',
    tip: 'Gặp biển bát giác đỏ STOP, bắt buộc dừng hẳn xe và nhường xe đường chính.',
    cooldownSec: 8,
  },
};

/**
 * Pure, testable Vietnamese Traffic Law (Luật 36/2024/QH15) 12-point GPLX evaluator.
 */
export class RuleChecker {
  readonly maxPoints = 12;
  points = 12;
  violations: ViolationEvent[] = [];
  private nextId = 1;
  private cooldowns = new Map<ViolationCode, number>();
  private wrongWayTimer = 0;
  private wrongLaneTimer = 0;
  private speedingTimer = 0;
  private sidewalkTimer = 0;
  private nightNoLightTimer = 0;
  private turnAccumRad = 0;

  reset() {
    this.points = this.maxPoints;
    this.violations = [];
    this.cooldowns.clear();
    this.wrongWayTimer = 0;
    this.wrongLaneTimer = 0;
    this.speedingTimer = 0;
    this.sidewalkTimer = 0;
    this.nightNoLightTimer = 0;
    this.turnAccumRad = 0;
  }

  private trigger(code: ViolationCode, elapsedSec: number, customDetail?: string): ViolationEvent | null {
    const last = this.cooldowns.get(code) ?? -999;
    const def = VIOLATION_DEFS[code];
    if (elapsedSec - last < def.cooldownSec) return null;
    this.cooldowns.set(code, elapsedSec);
    this.points = Math.max(0, this.points - def.points);
    const ev: ViolationEvent = {
      id: this.nextId++,
      code,
      points: def.points,
      title: def.title,
      detail: customDetail ?? def.detail,
      tip: def.tip,
      timestamp: elapsedSec,
    };
    this.violations.unshift(ev);
    if (this.violations.length > 30) this.violations.length = 30;
    return ev;
  }

  evaluate(ctx: RuleEvalContext): ViolationEvent[] {
    const fired: ViolationEvent[] = [];
    const push = (ev: ViolationEvent | null) => {
      if (ev) fired.push(ev);
    };

    // 1. Collision
    if (ctx.collided) {
      push(this.trigger('COLLISION', ctx.elapsedSec));
    }

    // 2. Red light & Right-on-red rule
    if (ctx.crossedRedLight) {
      if (ctx.isTurningRight) {
        if (!ctx.crossedRightOnRedAllowed) {
          push(this.trigger('RIGHT_ON_RED_FORBIDDEN', ctx.elapsedSec));
        }
      } else {
        push(this.trigger('RED_LIGHT', ctx.elapsedSec));
      }
    }

    // 3. Railway crossing while closed
    if (ctx.crossedClosedRailway) {
      push(this.trigger('RAILWAY_BARRIER', ctx.elapsedSec));
    }

    // 4. Pedestrian yield
    if (ctx.pedestrianNearMiss) {
      push(this.trigger('PEDESTRIAN_YIELD', ctx.elapsedSec));
    }

    // 5. Road projection rules
    const p = ctx.projection;
    if (p) {
      // Speeding (allow 5 km/h grace buffer, sustained 1.4s)
      const limit = p.edge.edge.speedLimitKmh;
      if (ctx.speedKmh > limit + 5) {
        this.speedingTimer += ctx.dt;
        if (this.speedingTimer > 1.4) {
          this.speedingTimer = 0;
          push(
            this.trigger(
              'SPEEDING',
              ctx.elapsedSec,
              `Bạn chạy ${Math.round(ctx.speedKmh)} km/h trên đường giới hạn ${limit} km/h (${p.edge.edge.name}).`,
            ),
          );
        }
      } else {
        this.speedingTimer = Math.max(0, this.speedingTimer - ctx.dt * 2);
      }

      // Wrong-way driving (sustained 1.2s at > 6 km/h)
      if (p.isWrongWay && ctx.speedKmh > 6) {
        this.wrongWayTimer += ctx.dt;
        if (this.wrongWayTimer > 1.2) {
          this.wrongWayTimer = 0;
          push(this.trigger('WRONG_WAY', ctx.elapsedSec, `Bạn đang đi ngược chiều trên ${p.edge.edge.name}.`));
        }
      } else {
        this.wrongWayTimer = Math.max(0, this.wrongWayTimer - ctx.dt * 2);
      }

      // Sidewalk driving (sustained 0.9s at > 8 km/h)
      if (p.onSidewalk && ctx.speedKmh > 8) {
        this.sidewalkTimer += ctx.dt;
        if (this.sidewalkTimer > 0.9) {
          this.sidewalkTimer = 0;
          push(this.trigger('SIDEWALK', ctx.elapsedSec));
        }
      } else {
        this.sidewalkTimer = Math.max(0, this.sidewalkTimer - ctx.dt * 2);
      }

      // Dedicated motorbike / car lane discipline (R.412)
      const isBike = ctx.vehicle === 'wave110' || ctx.vehicle === 'vision110';
      const hasBikeLane = Boolean(p.edge.edge.hasMotorbikeLane);
      if (hasBikeLane && !p.onSidewalk && !p.isWrongWay && ctx.speedKmh > 14 && p.t > 0.14 && p.t < 0.86) {
        const wrongLane = isBike
          ? p.distFromRightCurb > p.edge.edge.laneWidth + 1.4 // motorbike far left in car-only lane
          : p.inMotorbikeLane && p.distFromRightCurb < p.edge.edge.laneWidth - 0.5; // car driving inside motorbike lane
        if (wrongLane) {
          this.wrongLaneTimer += ctx.dt;
          if (this.wrongLaneTimer > 2.4) {
            this.wrongLaneTimer = 0;
            push(
              this.trigger(
                'WRONG_LANE',
                ctx.elapsedSec,
                isBike
                  ? 'Xe máy cần đi trong làn sát bên phải có biển R.412.'
                  : 'Ô tô không được chạy vào làn dành riêng cho xe máy sát lề phải.',
              ),
            );
          }
        } else {
          this.wrongLaneTimer = Math.max(0, this.wrongLaneTimer - ctx.dt * 2);
        }
      } else {
        this.wrongLaneTimer = 0;
      }
    }

    // 6. Turning without turn signal (detect sharp turn > 55 deg without corresponding signal)
    if (ctx.speedKmh > 8 && Math.abs(ctx.yawRate) > 0.35) {
      this.turnAccumRad += ctx.yawRate * ctx.dt;
      if (Math.abs(this.turnAccumRad) > 0.96) {
        // positive yawRate => heading decreases => right turn; negative yawRate => left turn
        const turnedRight = this.turnAccumRad > 0;
        const signaled = turnedRight ? ctx.signalRight : ctx.signalLeft;
        if (!signaled) {
          push(
            this.trigger(
              'NO_SIGNAL',
              ctx.elapsedSec,
              turnedRight ? 'Bạn rẽ phải mà chưa bật xi-nhan phải (phím R).' : 'Bạn rẽ trái mà chưa bật xi-nhan trái (phím Q).',
            ),
          );
        }
        this.turnAccumRad = 0;
      }
    } else {
      this.turnAccumRad *= Math.max(0, 1 - ctx.dt * 3);
    }

    // 7. Headlights at night
    if (ctx.timeOfDay === 'night' && ctx.headlight === 0 && ctx.speedKmh > 10) {
      this.nightNoLightTimer += ctx.dt;
      if (this.nightNoLightTimer > 4.0) {
        this.nightNoLightTimer = 0;
        push(this.trigger('NO_HEADLIGHT_NIGHT', ctx.elapsedSec));
      }
    } else {
      this.nightNoLightTimer = 0;
    }

    return fired;
  }
}
