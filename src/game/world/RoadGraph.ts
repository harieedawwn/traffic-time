import type { SignCode, SignOptions } from '../../kit/traffic/vnSigns';
import type { MapId } from '../types';

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  y?: number;
  kind: 'intersection' | 'roundabout' | 'bend' | 'end' | 'railway';
  hasSignal?: boolean;
  signalOffset?: number;
  flashingYellow?: boolean;
  /** Map from incoming approach direction ('N'|'S'|'E'|'W') to right-on-red permission */
  rightOnRed?: Partial<Record<'N' | 'S' | 'E' | 'W', boolean>>;
  /** Roundabout outer radius (m) if kind === 'roundabout' */
  roundaboutRadius?: number;
  /** Priority axis at unsignaled intersections: 'NS' | 'EW' | 'none' */
  priorityAxis?: 'NS' | 'EW' | 'none';
  hasConvexMirror?: boolean;
  isSchoolZone?: boolean;
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  name: string;
  /** Number of lanes in forward direction (from -> to) */
  lanesForward: number;
  /** Number of lanes in backward direction (to -> from). 0 = one-way street */
  lanesBackward: number;
  laneWidth: number;
  speedLimitKmh: number;
  hasMedian?: boolean;
  /** True if rightmost lane is dedicated motorbike lane (R.412) */
  hasMotorbikeLane?: boolean;
  /** True if road has a median U-turn opening near midpoint */
  hasUTurnOpening?: boolean;
  /** Sidewalk width on each side (m) */
  sidewalkWidth: number;
  /** Bridge crest height in meters (parabolic elevation profile along edge) */
  bridgeHeight?: number;
  /** True if railway crosses midpoint */
  hasRailwayCrossing?: boolean;
  /** True if crosswalk exists near endpoints */
  hasCrosswalk?: boolean;
  /** Street character */
  style: 'boulevard' | 'oldquarter' | 'alley' | 'highway';
  /** Prohibition signs along this road */
  noLeftTurn?: boolean;
  noUTurn?: boolean;
}

export interface PlacedSign {
  code: SignCode;
  options?: SignOptions;
  x: number;
  z: number;
  rotationY: number;
}

export interface StreetZone {
  kind: 'school' | 'market' | 'parking' | 'fuel' | 'construction';
  x: number;
  z: number;
  radius: number;
  label: string;
}

export interface RoadGraphData {
  id: MapId;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  nodes: RoadNode[];
  edges: RoadEdge[];
  signs: PlacedSign[];
  zones: StreetZone[];
  defaultSpawn: { x: number; z: number; heading: number };
  /** Landmarks for skyline/orientation */
  landmarks: { x: number; z: number; kind: 'tower' | 'gate' | 'school' | 'market' | 'fuel'; label: string }[];
}

export interface ComputedEdge {
  edge: RoadEdge;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  dx: number; // unit vector from A to B
  dz: number;
  /** Right normal relative to A->B direction: (-dz, dx) in our coord system where forward=(sin h, cos h) and right=(-cos h, sin h)! */
  rx: number;
  rz: number;
  length: number;
  heading: number; // atan2(dx, dz)
  halfWidthForward: number;
  halfWidthBackward: number;
  medianHalf: number;
  totalWidth: number;
}

export interface RoadProjection {
  edge: ComputedEdge;
  t: number; // 0..1 along edge
  distAlong: number; // meters from A
  /** Signed lateral offset from road centerline along right vector of A->B */
  signedLateral: number;
  /** Distance from road surface edge (0 if on asphalt, >0 if on sidewalk/offroad) */
  offAsphaltDist: number;
  onSidewalk: boolean;
  /** Direction of travel relative to A->B: +1 aligned, -1 opposite */
  travelDir: 1 | -1;
  /** True if player is going against legal traffic direction */
  isWrongWay: boolean;
  /** True if player is on the rightmost motorbike lane */
  inMotorbikeLane: boolean;
  /** Distance from right curb of the player's travel direction (m) */
  distFromRightCurb: number;
  /** Width of the travel carriageway on player's side (m) */
  carriagewayWidth: number;
  /** Ground elevation Y at this position (for sloped bridges) */
  elevationY: number;
}

/**
 * Pure geometry & query helper for a Vietnamese road network.
 * Coordinate convention (matching src/kit/vehicles/dynamics.ts):
 *   Y up, heading h around Y: forward = (sin h, 0, cos h), right = (-cos h, 0, sin h).
 */
export class RoadGraph {
  readonly nodeMap = new Map<string, RoadNode>();
  readonly computedEdges: ComputedEdge[] = [];
  readonly adjacency = new Map<string, ComputedEdge[]>();

  constructor(readonly data: RoadGraphData) {
    for (const n of data.nodes) {
      this.nodeMap.set(n.id, n);
      this.adjacency.set(n.id, []);
    }
    for (const edge of data.edges) {
      const a = this.nodeMap.get(edge.from);
      const b = this.nodeMap.get(edge.to);
      if (!a || !b) continue;
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const length = Math.hypot(vx, vz);
      if (length < 0.01) continue;
      const dx = vx / length;
      const dz = vz / length;
      // forward = (sin h, cos h) = (dx, dz) => right = (-cos h, sin h) = (-dz, dx)
      const rx = -dz;
      const rz = dx;
      const heading = Math.atan2(dx, dz);
      const medianHalf = edge.hasMedian ? 0.65 : 0;
      const halfWidthForward = edge.lanesForward * edge.laneWidth;
      const halfWidthBackward = edge.lanesBackward * edge.laneWidth;
      const totalWidth = halfWidthForward + halfWidthBackward + medianHalf * 2;
      const ce: ComputedEdge = {
        edge,
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        dx,
        dz,
        rx,
        rz,
        length,
        heading,
        halfWidthForward,
        halfWidthBackward,
        medianHalf,
        totalWidth,
      };
      this.computedEdges.push(ce);
      this.adjacency.get(a.id)?.push(ce);
      this.adjacency.get(b.id)?.push(ce);
    }
  }

  /** Ground height Y at world (x, z), accounting for bridge elevation curves. */
  elevationAt(x: number, z: number): number {
    let bestY = 0;
    for (const ce of this.computedEdges) {
      if (!ce.edge.bridgeHeight) continue;
      const px = x - ce.ax;
      const pz = z - ce.az;
      const along = px * ce.dx + pz * ce.dz;
      if (along < 0 || along > ce.length) continue;
      const lat = Math.abs(px * ce.rx + pz * ce.rz);
      if (lat > ce.totalWidth * 0.5 + ce.edge.sidewalkWidth + 1.5) continue;
      const u = along / ce.length;
      // Smooth sine arch that starts/ends flat at intersections
      if (u > 0.12 && u < 0.88) {
        const s = (u - 0.12) / 0.76;
        const y = ce.edge.bridgeHeight * Math.sin(s * Math.PI) ** 1.6;
        if (y > bestY) bestY = y;
      }
    }
    return bestY;
  }

  /** Project a vehicle pose (x, z, heading) onto the nearest road segment. */
  projectPoint(x: number, z: number, heading: number): RoadProjection | null {
    let bestEdge: ComputedEdge | null = null;
    let bestScore = Infinity;
    let bestT = 0;
    let bestLat = 0;

    // First check if inside a roundabout ring
    for (const n of this.data.nodes) {
      if (n.kind === 'roundabout' && n.roundaboutRadius) {
        const d = Math.hypot(x - n.x, z - n.z);
        if (d <= n.roundaboutRadius + 10) {
          // Still project to nearest road edge for name/limit, but mark on-asphalt safely
        }
      }
    }

    for (const ce of this.computedEdges) {
      const px = x - ce.ax;
      const pz = z - ce.az;
      const rawAlong = px * ce.dx + pz * ce.dz;
      const clampedAlong = Math.max(0, Math.min(ce.length, rawAlong));
      const t = clampedAlong / ce.length;
      const cx = ce.ax + ce.dx * clampedAlong;
      const cz = ce.az + ce.dz * clampedAlong;
      const distSq = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (distSq < bestScore) {
        bestScore = distSq;
        bestEdge = ce;
        bestT = t;
        bestLat = px * ce.rx + pz * ce.rz;
      }
    }

    if (!bestEdge) return null;

    const ce = bestEdge;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const dotDir = fx * ce.dx + fz * ce.dz;
    const travelDir: 1 | -1 = dotDir >= 0 ? 1 : -1;

    // Asymmetric road bounds relative to road center:
    // Forward direction (A->B) occupies [+medianHalf .. +medianHalf + halfWidthForward] (right side!)
    // Backward direction (B->A) occupies [-medianHalf - halfWidthBackward .. -medianHalf] (left side of A->B, which is right side of B->A!)
    // Wait: if one-way (lanesBackward === 0), center the road symmetrically from [-halfWidthForward/2 .. +halfWidthForward/2]
    let minAsphalt: number;
    let maxAsphalt: number;
    let isWrongWay = false;
    let distFromRightCurb = 0;
    let carriagewayWidth = ce.halfWidthForward;

    if (ce.edge.lanesBackward === 0) {
      minAsphalt = -ce.halfWidthForward * 0.5;
      maxAsphalt = ce.halfWidthForward * 0.5;
      isWrongWay = dotDir < -0.35;
      distFromRightCurb = maxAsphalt - bestLat;
      carriagewayWidth = ce.halfWidthForward;
    } else {
      minAsphalt = -(ce.medianHalf + ce.halfWidthBackward);
      maxAsphalt = ce.medianHalf + ce.halfWidthForward;
      // Right-hand driving: going A->B must be on positive lateral (>= 0), going B->A must be on negative lateral (<= 0)
      if (travelDir === 1) {
        isWrongWay = bestLat < -ce.medianHalf - 0.65 && Math.abs(dotDir) > 0.5;
        distFromRightCurb = maxAsphalt - bestLat;
        carriagewayWidth = ce.halfWidthForward;
      } else {
        isWrongWay = bestLat > ce.medianHalf + 0.65 && Math.abs(dotDir) > 0.5;
        distFromRightCurb = bestLat - minAsphalt;
        carriagewayWidth = ce.halfWidthBackward;
      }
    }

    // Check if inside an intersection box or roundabout so turning doesn't trigger off-asphalt or wrong-way
    let insideJunction = false;
    for (const n of this.data.nodes) {
      const distNode = Math.hypot(x - n.x, z - n.z);
      const jRad = n.kind === 'roundabout' ? (n.roundaboutRadius ?? 18) + 8 : 13;
      if (distNode < jRad) {
        insideJunction = true;
        break;
      }
    }

    let offAsphaltDist = 0;
    if (!insideJunction) {
      if (bestLat < minAsphalt) offAsphaltDist = minAsphalt - bestLat;
      else if (bestLat > maxAsphalt) offAsphaltDist = bestLat - maxAsphalt;
    } else {
      isWrongWay = false;
    }

    const onSidewalk = !insideJunction && offAsphaltDist > 0.45 && offAsphaltDist <= ce.edge.sidewalkWidth + 1.2;
    const inMotorbikeLane =
      Boolean(ce.edge.hasMotorbikeLane) && !insideJunction && distFromRightCurb >= 0 && distFromRightCurb <= ce.edge.laneWidth + 0.35;

    return {
      edge: ce,
      t: bestT,
      distAlong: bestT * ce.length,
      signedLateral: bestLat,
      offAsphaltDist,
      onSidewalk,
      travelDir,
      isWrongWay,
      inMotorbikeLane,
      distFromRightCurb,
      carriagewayWidth,
      elevationY: this.elevationAt(x, z),
    };
  }

  /** Get approach cardinal direction ('N'|'S'|'E'|'W') for a vehicle approaching a node along (fx, fz). */
  static approachIdFromVector(fx: number, fz: number): 'N' | 'S' | 'E' | 'W' {
    if (Math.abs(fz) >= Math.abs(fx)) {
      return fz > 0 ? 'N' : 'S';
    }
    return fx > 0 ? 'W' : 'E';
  }

  /** Compute world position on an edge given direction (+1 from->to, -1 to->from), progress distance, and lateral offset from right curb. */
  pointOnEdge(ce: ComputedEdge, dir: 1 | -1, distFromStart: number, offsetFromRightCurb: number): { x: number; y: number; z: number; heading: number } {
    const out = { x: 0, y: 0, z: 0, heading: 0 };
    return this.pointOnEdgeInto(ce, dir, distFromStart, offsetFromRightCurb, out);
  }

  /** Zero-allocation variant of pointOnEdge for hot simulation loops. */
  pointOnEdgeInto<T extends { x: number; y: number; z: number; heading: number }>(
    ce: ComputedEdge,
    dir: 1 | -1,
    distFromStart: number,
    offsetFromRightCurb: number,
    out: T,
  ): T {
    const clampedDist = Math.max(0, Math.min(ce.length, distFromStart));
    let x: number;
    let z: number;
    let heading: number;
    if (ce.edge.lanesBackward === 0) {
      const lat = ce.halfWidthForward * 0.5 - offsetFromRightCurb;
      x = ce.ax + ce.dx * clampedDist + ce.rx * lat;
      z = ce.az + ce.dz * clampedDist + ce.rz * lat;
      heading = ce.heading;
    } else if (dir === 1) {
      const lat = ce.medianHalf + ce.halfWidthForward - offsetFromRightCurb;
      x = ce.ax + ce.dx * clampedDist + ce.rx * lat;
      z = ce.az + ce.dz * clampedDist + ce.rz * lat;
      heading = ce.heading;
    } else {
      const d = ce.length - clampedDist;
      const lat = -(ce.medianHalf + ce.halfWidthBackward) + offsetFromRightCurb;
      x = ce.ax + ce.dx * d + ce.rx * lat;
      z = ce.az + ce.dz * d + ce.rz * lat;
      heading = Math.atan2(-ce.dx, -ce.dz);
    }
    out.x = x;
    out.y = ce.edge.bridgeHeight ? this.elevationAt(x, z) : 0;
    out.z = z;
    out.heading = heading;
    return out;
  }
}
