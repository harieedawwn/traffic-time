import * as THREE from 'three';
import {
  DRIVER_PROFILES,
  idmAccel,
  idmStopAt,
  pickLateralOffset,
  pickProfile,
  VEHICLE_MIX,
  VEHICLE_PRESETS,
  yellowDecision,
  type DriverProfile,
} from '../../kit/traffic/driverModel';
import type { DetailLevel } from '../graphics/GraphicsSettings';
import { animateDogRun, animateHumanWalk, type ArticulatedDogRig, type ArticulatedHumanRig, type HumanAssetPool } from '../models/HumanBuilder';
import type { VehicleAssetPool } from '../models/VehicleBuilder';
import type { TrafficDensity } from '../types';
import { RoadGraph, type ComputedEdge } from '../world/RoadGraph';
import type { CrosswalkZone, RailwayState, SignalIntersection } from '../world/WorldBuilder';

export type NpcKind = keyof typeof VEHICLE_PRESETS | 'ambulance';

export interface NpcAgent {
  id: number;
  kind: NpcKind;
  profile: DriverProfile;
  edge: ComputedEdge;
  dir: 1 | -1;
  dist: number;
  lateral: number;
  targetLateral: number;
  speed: number;
  wheelSpin: number;
  leanAngle: number;
  pitchAngle: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  length: number;
  width: number;
  colorHex: number;
  suddenStopTimer: number;
  wrongWayBias: boolean;
  honkCooldown: number;
  sirenPhase: number;
  mesh: THREE.Group;
  wheels: THREE.Object3D[];
  sirenRed?: THREE.MeshStandardMaterial;
  sirenBlue?: THREE.MeshStandardMaterial;
}

export interface PedAgent {
  x: number;
  z: number;
  startX: number;
  startZ: number;
  nx: number;
  nz: number;
  halfSpan: number;
  pos: number;
  dir: 1 | -1;
  speed: number;
  kind: 'person' | 'vendor' | 'dog';
  mesh: THREE.Group;
  humanRig?: ArticulatedHumanRig;
  dogRig?: ArticulatedDogRig;
  phase: number;
}

function pickVehicleKind(rand = Math.random): keyof typeof VEHICLE_PRESETS {
  const total = VEHICLE_MIX.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of VEHICLE_MIX) {
    if ((r -= w) <= 0) return k;
  }
  return 'motorbike';
}

const BIKE_COLORS = [0xb91c1c, 0x1e3a8a, 0x1f2937, 0xe8e6df, 0x166534, 0x7c2d12, 0x0f766e];
const CAR_COLORS = [0xe2e8f0, 0x334155, 0x1e293b, 0x7f1d1d, 0x1e3a5f, 0xd6d3d1, 0x4b5563];
const HELMET_COLORS = [0xc8102e, 0x1d4ed8, 0xd97706, 0x15803d, 0xf1f5f9, 0x1e293b];
const SHIRT_COLORS = [0xb91c1c, 0x2563eb, 0x15803d, 0xd97706, 0x475569, 0xe2e8f0, 0x1e293b, 0x7e22ce, 0x0f766e];
const PANTS_COLORS = [0x1f2937, 0x28364a, 0x3f3a34, 0x181b20];
const DOG_COLORS = [0xb57c41, 0x78502c, 0xd4b287, 0x2b2826];

/**
 * Vietnamese NPC Traffic & Articulated Pedestrian Simulation (Zero-GC, O(N) Bucketed):
 * - Uses shared VehicleAssetPool & 1-draw-call collapsed HumanAssetPool riders
 * - O(N) edge+dir spatial bucketing + O(1) signal map lookup (eliminates O(N^2) stalls!)
 * - Camera frustum behind-view fast culling + distance LOD + dynamic bike leaning & braking pitch!
 */
export class TrafficManager {
  readonly root = new THREE.Group();
  readonly npcs: NpcAgent[] = [];
  readonly peds: PedAgent[] = [];
  private nextId = 1;
  private disposables: { dispose: () => void }[] = [];
  private cartGeo: THREE.BufferGeometry;
  private cartMat: THREE.MeshStandardMaterial;
  private lateralTick = 0;
  private frameCounter = 0;
  private cullDistSq = 280 * 280;
  private animLodDistSq = 72 * 72;
  private farSimDistSq = 120 * 120;

  // O(1) lookup tables & zero-allocation scratch buffers
  private signalByNode = new Map<string, SignalIntersection>();
  private edgeBuckets = new Map<string, NpcAgent[]>();
  private scratchNeighbors: { offset: number; width: number; dist: number }[] = [];
  private scratchPt = { x: 0, y: 0, z: 0, heading: 0 };

  constructor(
    private graph: RoadGraph,
    signals: SignalIntersection[],
    private crosswalks: CrosswalkZone[],
    private vehiclePool: VehicleAssetPool,
    private humanPool: HumanAssetPool,
    density: TrafficDensity,
    detailLevel: DetailLevel,
    drawDistance: number,
    isSoftwareGl: boolean,
  ) {
    this.root.name = 'traffic-manager';
    this.setCullingDistance(drawDistance);

    for (const s of signals) {
      this.signalByNode.set(s.node.id, s);
    }

    // Pre-allocate reusable per-(edge, dir) buckets so update() allocates ZERO arrays!
    for (const ce of graph.computedEdges) {
      this.edgeBuckets.set(`${ce.edge.id}|1`, []);
      this.edgeBuckets.set(`${ce.edge.id}|-1`, []);
    }

    this.cartGeo = new THREE.BoxGeometry(0.62, 0.56, 0.85);
    this.cartMat = new THREE.MeshStandardMaterial({ color: 0x8b6239, roughness: 0.88, flatShading: true });
    this.disposables.push(this.cartGeo, this.cartMat);

    const baseCount = density === 'low' ? 32 : density === 'medium' ? 66 : 102;
    const detailMult = detailLevel === 'low' ? 0.62 : detailLevel === 'medium' ? 0.84 : 1.0;
    const targetCount = Math.round(baseCount * detailMult);
    const capped = isSoftwareGl ? Math.min(targetCount, 48) : targetCount;

    this.spawnInitialTraffic(capped);
    this.spawnPedestrians(Math.round((density === 'high' ? 28 : 18) * detailMult));
  }

  setCullingDistance(drawDistance: number) {
    const d = Math.max(110, drawDistance);
    this.cullDistSq = d * d;
    this.animLodDistSq = Math.min(88, d * 0.38) ** 2;
    this.farSimDistSq = Math.min(130, d * 0.52) ** 2;
  }

  private buildNpcMesh(kind: NpcKind, colorHex: number) {
    if (kind === 'motorbike' || kind === 'scooter') {
      const isShipper = Math.random() < 0.24;
      const shipperColor = Math.random() < 0.65 ? 0x15803d : 0xd9580c;
      const built = this.vehiclePool.buildMotorbike({
        kind: kind === 'scooter' ? 'vision110' : 'wave110',
        colorHex,
        isHero: false,
        castShadow: false,
        cargoBoxColor: isShipper ? shipperColor : null,
      });

      const rider = this.humanPool.buildHuman({
        pose: kind === 'scooter' ? 'rideScooter' : 'rideMotorbike',
        shirtColor: isShipper ? shipperColor : SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
        pantsColor: PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)],
        helmetColor: HELMET_COLORS[Math.floor(Math.random() * HELMET_COLORS.length)],
        faceMask: Math.random() < 0.68,
        backpackColor: !isShipper && Math.random() < 0.28 ? 0x262c36 : null,
        heightScale: 0.94 + Math.random() * 0.1,
        castShadow: false,
      });
      built.group.add(rider.root);
      return built;
    }

    if (kind === 'bicycle') {
      const built = this.vehiclePool.buildBicycle(colorHex);
      const rider = this.humanPool.buildHuman({
        pose: 'rideBicycle',
        shirtColor: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
        pantsColor: PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)],
        conicalHat: Math.random() < 0.45,
        helmetColor: null,
        faceMask: Math.random() < 0.4,
        castShadow: false,
      });
      built.group.add(rider.root);
      return built;
    }

    if (kind === 'bus') return this.vehiclePool.buildBus(false);
    if (kind === 'truck') return this.vehiclePool.buildTruck(colorHex, false);
    if (kind === 'ambulance') return this.vehiclePool.buildAmbulance(false);

    return this.vehiclePool.buildSedan({
      colorHex,
      isHero: false,
      isTaxi: kind === 'taxi',
      castShadow: false,
    });
  }

  private spawnInitialTraffic(count: number) {
    const edges = this.graph.computedEdges;
    if (!edges.length) return;
    for (let i = 0; i < count; i++) {
      const edge = edges[i % edges.length];
      if (edge.length < 25) continue;
      let kind: NpcKind = pickVehicleKind();
      if (edge.edge.style === 'alley' && (kind === 'bus' || kind === 'truck')) kind = 'motorbike';
      if (this.graph.data.id === 'highway' && Math.random() < 0.18) kind = 'truck';
      const dir: 1 | -1 = edge.edge.lanesBackward === 0 ? 1 : Math.random() > 0.5 ? 1 : -1;
      const dist = 16 + Math.random() * Math.max(10, edge.length - 32);
      this.spawnNpc(kind, edge, dir, dist);
    }
  }

  spawnNpc(kind: NpcKind, edge: ComputedEdge, dir: 1 | -1, dist: number, forcedProfile?: DriverProfile): NpcAgent {
    const preset = kind === 'ambulance' ? VEHICLE_PRESETS.car : VEHICLE_PRESETS[kind];
    const profile = forcedProfile ?? pickProfile();
    const carriageway = dir === 1 ? edge.halfWidthForward : edge.halfWidthBackward || edge.halfWidthForward;
    const isBike = kind === 'motorbike' || kind === 'scooter' || kind === 'bicycle';
    const lateral = isBike
      ? Math.min(carriageway - 0.5, 0.65 + Math.random() * Math.min(edge.edge.laneWidth, carriageway - 1.0))
      : Math.max(1.2, carriageway - edge.edge.laneWidth * 0.5 - Math.random() * Math.max(0, carriageway - edge.edge.laneWidth * 1.5));

    const colorHex = isBike
      ? BIKE_COLORS[Math.floor(Math.random() * BIKE_COLORS.length)]
      : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const built = this.buildNpcMesh(kind, colorHex);
    const pt = this.graph.pointOnEdgeInto(edge, dir, dist, lateral, this.scratchPt);
    built.group.position.set(pt.x, pt.y, pt.z);
    built.group.rotation.order = 'YXZ';
    built.group.rotation.y = pt.heading;
    this.root.add(built.group);

    const npc: NpcAgent = {
      id: this.nextId++,
      kind,
      profile,
      edge,
      dir,
      dist,
      lateral,
      targetLateral: lateral,
      speed: preset.v0 * (0.5 + Math.random() * 0.4),
      wheelSpin: 0,
      leanAngle: 0,
      pitchAngle: 0,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      heading: pt.heading,
      length: preset.length,
      width: preset.width,
      colorHex,
      suddenStopTimer: 0,
      wrongWayBias: false,
      honkCooldown: 3 + Math.random() * 6,
      sirenPhase: 0,
      mesh: built.group,
      wheels: built.wheels,
      sirenRed: built.sirenRed,
      sirenBlue: built.sirenBlue,
    };
    this.npcs.push(npc);
    return npc;
  }

  spawnScenarioAmbulance(_px: number, _pz: number) {
    const edge = this.graph.computedEdges.find((ce) => ce.edge.id === 'S_S2') ?? this.graph.computedEdges[0];
    if (!edge) return;
    const amb = this.spawnNpc('ambulance', edge, -1, 4, DRIVER_PROFILES[1]);
    amb.speed = 16;
    amb.lateral = Math.max(1.5, edge.halfWidthBackward - 1.8);
    amb.targetLateral = amb.lateral;
  }

  spawnSurpriseDog(x: number, z: number) {
    const built = this.buildPedActor('dog');
    built.mesh.position.set(x - 4.5, 0, z);
    this.root.add(built.mesh);
    this.peds.push({
      x: x - 4.5,
      z,
      startX: x,
      startZ: z,
      nx: 1,
      nz: 0,
      halfSpan: 5.5,
      pos: -4.5,
      dir: 1,
      speed: 4.2,
      kind: 'dog',
      mesh: built.mesh,
      dogRig: built.dogRig,
      phase: 0,
    });
  }

  private buildPedActor(kind: 'person' | 'vendor' | 'dog'): {
    mesh: THREE.Group;
    humanRig?: ArticulatedHumanRig;
    dogRig?: ArticulatedDogRig;
  } {
    if (kind === 'dog') {
      const dogRig = this.humanPool.buildDog(DOG_COLORS[Math.floor(Math.random() * DOG_COLORS.length)], false);
      return { mesh: dogRig.root, dogRig };
    }
    const humanRig = this.humanPool.buildHuman({
      pose: 'walk',
      shirtColor: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      pantsColor: PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)],
      conicalHat: kind === 'vendor' || Math.random() < 0.16,
      helmetColor: null,
      faceMask: Math.random() < 0.55,
      backpackColor: kind === 'person' && Math.random() < 0.25 ? 0x2a3340 : null,
      heightScale: 0.92 + Math.random() * 0.13,
      castShadow: false,
    });
    if (kind === 'vendor') {
      const cart = new THREE.Mesh(this.cartGeo, this.cartMat);
      cart.position.set(0, 0.54, 0.66);
      humanRig.root.add(cart);
    }
    return { mesh: humanRig.root, humanRig };
  }

  private spawnPedestrians(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.crosswalks.length > 0 && i < count - 3) {
        const cw = this.crosswalks[i % this.crosswalks.length];
        const laneIdx = Math.floor(i / this.crosswalks.length);
        const depthOffset = laneIdx === 0 ? 0 : (laneIdx % 2 === 1 ? 1 : -1) * Math.min(1.3, 0.9 * Math.ceil(laneIdx / 2));
        const baseX = cw.x - cw.nz * depthOffset;
        const baseZ = cw.z + cw.nx * depthOffset;
        const kind: 'person' | 'vendor' = i % 6 === 0 ? 'vendor' : 'person';
        const built = this.buildPedActor(kind);
        const startPos = (Math.random() * 2 - 1) * cw.halfLength;
        const x = baseX + cw.nx * startPos;
        const z = baseZ + cw.nz * startPos;
        built.mesh.position.set(x, 0, z);
        this.root.add(built.mesh);
        this.peds.push({
          x,
          z,
          startX: baseX,
          startZ: baseZ,
          nx: cw.nx,
          nz: cw.nz,
          halfSpan: cw.halfLength,
          pos: startPos,
          dir: laneIdx % 2 === 0 ? 1 : -1,
          speed: kind === 'vendor' ? 0.95 : 1.2 + Math.random() * 0.45,
          kind,
          mesh: built.mesh,
          humanRig: built.humanRig,
          phase: Math.random() * Math.PI * 2,
        });
      } else {
        const ce = this.graph.computedEdges[i % this.graph.computedEdges.length];
        const kind: 'person' | 'dog' = i % 2 === 0 ? 'dog' : 'person';
        const built = this.buildPedActor(kind);
        const midX = (ce.ax + ce.bx) * 0.5;
        const midZ = (ce.az + ce.bz) * 0.5;
        built.mesh.position.set(midX, 0, midZ);
        this.root.add(built.mesh);
        this.peds.push({
          x: midX,
          z: midZ,
          startX: midX,
          startZ: midZ,
          nx: ce.rx,
          nz: ce.rz,
          halfSpan: ce.totalWidth * 0.5 + 2,
          pos: -ce.totalWidth * 0.5,
          dir: 1,
          speed: kind === 'dog' ? 3.2 : 1.25,
          kind,
          mesh: built.mesh,
          humanRig: built.humanRig,
          dogRig: built.dogRig,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    playerHeading: number,
    playerSpeed: number,
    playerRadius: number,
    railway: RailwayState | null,
    cullAnchorX: number,
    cullAnchorZ: number,
    onNpcHonk?: (distance: number) => void,
    camFx = 0,
    camFz = 0,
    allowRearCull = false,
  ): { collided: boolean; pushX: number; pushZ: number; pedNearMiss: boolean; ambulanceNearby: boolean } {
    this.frameCounter++;
    this.lateralTick += dt;
    const doLateral = this.lateralTick > 0.28;
    if (doLateral) this.lateralTick = 0;

    // 1. O(N) spatial bucket refill (reuses pre-allocated arrays -> zero GC!)
    for (const bucket of this.edgeBuckets.values()) {
      bucket.length = 0;
    }
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      const key = `${a.edge.edge.id}|${a.dir}`;
      let b = this.edgeBuckets.get(key);
      if (!b) {
        b = [];
        this.edgeBuckets.set(key, b);
      }
      b.push(a);
    }

    let collided = false;
    let pushX = 0;
    let pushZ = 0;
    let ambulanceNearby = false;
    const parity = this.frameCounter & 1;

    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      const cdxPrev = a.x - cullAnchorX;
      const cdzPrev = a.z - cullAnchorZ;
      const prevDistSq = cdxPrev * cdxPrev + cdzPrev * cdzPrev;

      // Throttle distant NPCs beyond 120m to half-rate updates with 2x dt (saves ~40% traffic CPU!)
      const isFar = prevDistSq > this.farSimDistSq && a.kind !== 'ambulance';
      if (isFar && (i & 1) !== parity) continue;
      const stepDt = isFar ? Math.min(0.12, dt * 2) : dt;

      const isBike = a.kind === 'motorbike' || a.kind === 'scooter' || a.kind === 'bicycle';
      const preset = a.kind === 'ambulance' ? VEHICLE_PRESETS.car : VEHICLE_PRESETS[a.kind];
      const vLimit =
        Math.min(a.edge.edge.speedLimitKmh / 3.6, preset.v0 * a.profile.speedFactor) * (a.kind === 'ambulance' ? 1.35 : 1);

      if (a.kind === 'ambulance' && a.sirenRed && a.sirenBlue) {
        a.sirenPhase += stepDt * 7;
        const flash = Math.sin(a.sirenPhase) > 0;
        a.sirenRed.emissiveIntensity = flash ? 3.0 : 0.1;
        a.sirenBlue.emissiveIntensity = !flash ? 3.0 : 0.1;
        const distP = Math.hypot(a.x - playerX, a.z - playerZ);
        if (distP < 55) ambulanceNearby = true;
      }

      if (a.suddenStopTimer > 0) {
        a.suddenStopTimer -= stepDt;
      } else if (
        a.profile.violations.stopSuddenly &&
        Math.random() < a.profile.violations.stopSuddenly * stepDt * 0.08 &&
        a.dist > 25 &&
        a.dist < a.edge.length - 25
      ) {
        a.suddenStopTimer = 2.5 + Math.random() * 2.5;
      }

      let minGap = Infinity;
      let leadSpeed = vLimit;
      const neighbors = this.scratchNeighbors;
      neighbors.length = 0;

      // O(1) bucket scan on same edge + direction (instead of O(N) full scan!)
      const sameBucket = this.edgeBuckets.get(`${a.edge.edge.id}|${a.dir}`);
      if (sameBucket) {
        for (let j = 0; j < sameBucket.length; j++) {
          const b = sameBucket[j];
          if (b === a) continue;
          const dAhead = b.dist - a.dist;
          if (dAhead > 0 && dAhead < 28) {
            if (isBike && doLateral) neighbors.push({ offset: b.lateral, width: b.width, dist: dAhead });
            const latOverlap = Math.abs(b.lateral - a.lateral) < (a.width + b.width) * 0.5 + 0.35;
            if (latOverlap) {
              const gap = dAhead - (a.length + b.length) * 0.5;
              if (gap < minGap) {
                minGap = gap;
                leadSpeed = b.speed;
              }
            }
          }
        }
      }

      const dxP = playerX - a.x;
      const dzP = playerZ - a.z;
      const distSqP = dxP * dxP + dzP * dzP;
      if (distSqP < 625) {
        const fx = Math.sin(a.heading);
        const fz = Math.cos(a.heading);
        const rx = -Math.cos(a.heading);
        const rz = Math.sin(a.heading);
        const forwardDist = dxP * fx + dzP * fz;
        const sideDist = Math.abs(dxP * rx + dzP * rz);
        if (forwardDist > 0 && forwardDist < 22 && sideDist < a.width * 0.5 + playerRadius + 0.45) {
          const gap = forwardDist - a.length * 0.5 - playerRadius;
          if (gap < minGap) {
            minGap = gap;
            leadSpeed = Math.max(0, playerSpeed);
          }
          a.honkCooldown -= stepDt;
          if (a.honkCooldown <= 0 && a.speed < 2.2 && forwardDist < 10 && Math.random() < 0.35) {
            a.honkCooldown = 4 + Math.random() * 5;
            onNpcHonk?.(Math.sqrt(distSqP));
          }
        }

        const minSep = Math.max(a.width, a.length * 0.42) + playerRadius * 0.85;
        const distP = Math.sqrt(distSqP);
        if (distP < minSep && distP > 0.01) {
          collided = true;
          const overlap = minSep - distP;
          pushX += (dxP / distP) * overlap * 0.85;
          pushZ += (dzP / distP) * overlap * 0.85;
          a.speed *= 0.25;
        }
      }

      const prevLat = a.lateral;
      if (isBike && doLateral) {
        const carriageway = a.dir === 1 ? a.edge.halfWidthForward : a.edge.halfWidthBackward || a.edge.halfWidthForward;
        const maxWidth = a.edge.edge.hasMotorbikeLane ? Math.min(carriageway, a.edge.edge.laneWidth + 0.6) : carriageway;
        a.targetLateral = pickLateralOffset(a.lateral, maxWidth, a.width, neighbors, 0.7);
      }
      a.lateral += (a.targetLateral - a.lateral) * Math.min(1, stepDt * 3.0);

      let accel = idmAccel(a.speed, minGap, a.speed - leadSpeed, preset, vLimit);
      if (a.suddenStopTimer > 0) accel = Math.min(accel, -preset.b * 1.4);

      const destNodeId = a.dir === 1 ? a.edge.edge.to : a.edge.edge.from;
      const distToEnd = a.edge.length - a.dist;
      const sig = this.signalByNode.get(destNodeId);
      if (sig && a.kind !== 'ambulance' && distToEnd > 8 && distToEnd < 34) {
        const app = RoadGraph.approachIdFromVector(Math.sin(a.heading), Math.cos(a.heading));
        const light = sig.controller.lightFor(app);
        const stopLineOffset = sig.stopDistance - (isBike ? 1.4 : 0);
        const distToStop = distToEnd - stopLineOffset;
        if (distToStop > 0) {
          const runsRed = Boolean(a.profile.violations.redLightRun) && Math.random() < (a.profile.violations.redLightRun ?? 0) * 0.02;
          if (!runsRed && light === 'red') {
            accel = Math.min(accel, idmStopAt(a.speed, distToStop, preset));
          } else if (light === 'yellow') {
            const dec = yellowDecision(a.speed, distToStop, sig.controller.countdownFor(app), preset, a.profile.aggression);
            if (dec === 'stop') accel = Math.min(accel, idmStopAt(a.speed, distToStop, preset));
          }
        }
      }

      if (railway && railway.warningActive && a.edge.edge.hasRailwayCrossing) {
        const mid = a.edge.length * 0.5;
        const distToBar = mid - 7.5 - a.dist;
        if (distToBar > 0 && distToBar < 30) {
          accel = Math.min(accel, idmStopAt(a.speed, distToBar, preset));
        }
      }

      // Only scan pedestrians when NPC is in active close/mid range
      if (!isFar) {
        const fx = Math.sin(a.heading);
        const fz = Math.cos(a.heading);
        for (let pIdx = 0; pIdx < this.peds.length; pIdx++) {
          const ped = this.peds[pIdx];
          const pdx = ped.x - a.x;
          const pdz = ped.z - a.z;
          const dPedSq = pdx * pdx + pdz * pdz;
          if (dPedSq < 56.25) {
            const fwd = pdx * fx + pdz * fz;
            if (fwd > 0.5 && fwd < 7) {
              accel = Math.min(accel, idmStopAt(a.speed, Math.max(0.4, fwd - 2.0), preset));
            }
          }
        }
      }

      a.speed = Math.max(0, Math.min(vLimit * 1.15, a.speed + accel * stepDt));
      a.dist += a.speed * stepDt;

      if (a.dist >= a.edge.length - 4) {
        const nextNodeId = a.dir === 1 ? a.edge.edge.to : a.edge.edge.from;
        const adj = this.graph.adjacency.get(nextNodeId);
        let chosen: ComputedEdge | null = null;
        if (adj && adj.length > 0) {
          let validCount = 0;
          for (let k = 0; k < adj.length; k++) {
            const ce = adj[k];
            if (ce === a.edge) continue;
            if (ce.edge.lanesBackward === 0 && ce.edge.from !== nextNodeId) continue;
            validCount++;
            if (Math.random() < 1 / validCount) chosen = ce;
          }
        }
        if (chosen) {
          a.edge = chosen;
          a.dir = chosen.edge.from === nextNodeId ? 1 : -1;
          a.dist = 5;
        } else {
          if (a.edge.edge.lanesBackward > 0) {
            a.dir = a.dir === 1 ? -1 : 1;
            a.dist = 5;
          } else {
            a.dist = 5;
          }
        }
        const cw = a.dir === 1 ? a.edge.halfWidthForward : a.edge.halfWidthBackward || a.edge.halfWidthForward;
        a.lateral = Math.min(a.lateral, Math.max(0.8, cw - 0.8));
        a.targetLateral = a.lateral;
      }

      const pt = this.graph.pointOnEdgeInto(a.edge, a.dir, a.dist, a.lateral, this.scratchPt);
      a.x = pt.x;
      a.y = pt.y;
      a.z = pt.z;
      a.heading = pt.heading;

      // Distance + Rear-of-Camera Fast Frustum Culling + Living Dynamic Lean/Pitch!
      const cdx = pt.x - cullAnchorX;
      const cdz = pt.z - cullAnchorZ;
      const distSqAnchor = cdx * cdx + cdz * cdz;
      let vis = distSqAnchor < this.cullDistSq;
      if (vis && allowRearCull && distSqAnchor > 576) {
        // Skip rendering vehicles >24m strictly behind TPS camera!
        const dotFwd = cdx * camFx + cdz * camFz;
        if (dotFwd < -18) vis = false;
      }
      a.mesh.visible = vis;
      if (vis) {
        a.mesh.position.set(pt.x, pt.y, pt.z);
        a.mesh.rotation.y = pt.heading;
        if (distSqAnchor < this.animLodDistSq) {
          if (isBike) {
            const latVel = (a.lateral - prevLat) / Math.max(0.01, stepDt);
            const targetLean = THREE.MathUtils.clamp(-latVel * 0.14, -0.22, 0.22);
            a.leanAngle += (targetLean - a.leanAngle) * Math.min(1, stepDt * 7);
            a.mesh.rotation.z = a.leanAngle;
          }
          const targetPitch = accel < -2.2 && a.speed > 0.5 ? 0.032 : 0;
          a.pitchAngle += (targetPitch - a.pitchAngle) * Math.min(1, stepDt * 8);
          a.mesh.rotation.x = a.pitchAngle;

          if (a.speed > 0.2) {
            a.wheelSpin += (a.speed * stepDt) / 0.32;
            for (let w = 0; w < a.wheels.length; w++) a.wheels[w].rotation.x = a.wheelSpin;
          }
        }
      }
    }

    // Step Articulated Pedestrians, Vendors & Dogs with bipedal gait & LOD culling
    let pedNearMiss = false;
    const pedCullSq = Math.min(this.cullDistSq * 0.45, 115 * 115);
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      p.pos += p.dir * p.speed * dt;
      if (p.pos > p.halfSpan) {
        p.pos = p.halfSpan;
        p.dir = -1;
      } else if (p.pos < -p.halfSpan) {
        p.pos = -p.halfSpan;
        p.dir = 1;
      }
      p.x = p.startX + p.nx * p.pos;
      p.z = p.startZ + p.nz * p.pos;
      p.phase += dt * p.speed * 4.4;

      const cdx = p.x - cullAnchorX;
      const cdz = p.z - cullAnchorZ;
      const distSqAnchor = cdx * cdx + cdz * cdz;
      let vis = distSqAnchor < pedCullSq;
      if (vis && allowRearCull && distSqAnchor > 400) {
        if (cdx * camFx + cdz * camFz < -14) vis = false;
      }
      p.mesh.visible = vis;
      if (vis) {
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = Math.atan2(p.nx * p.dir, p.nz * p.dir);
        if (distSqAnchor < this.animLodDistSq) {
          if (p.humanRig) animateHumanWalk(p.humanRig, p.phase, p.kind === 'vendor');
          else if (p.dogRig) animateDogRun(p.dogRig, p.phase * 1.4);
        }
      }

      const dPx = p.x - playerX;
      const dPz = p.z - playerZ;
      const dPSq = dPx * dPx + dPz * dPz;
      if (dPSq < 4.84) {
        collided = true;
        pedNearMiss = true;
      } else if (dPSq < 20.25 && Math.abs(playerSpeed) > 4.2 && p.kind !== 'dog') {
        pedNearMiss = true;
      }
    }

    void playerHeading;
    return { collided, pushX, pushZ, pedNearMiss, ambulanceNearby };
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
