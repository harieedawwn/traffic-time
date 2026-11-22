import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSignalPole, SignalController, type Approach, type TrafficLightHead } from '../../kit/traffic/signalController';
import { makeSignMesh } from '../../kit/traffic/vnSigns';
import {
  asphaltTexture,
  curbTexture,
  plasterWallTexture,
  ROAD_PAINT,
  rng,
  SHOP_NAMES,
  shopSignTexture,
  shutterTexture,
  sidewalkTexture,
} from '../../kit/world/textures';
import type { TimeOfDay, WeatherKind } from '../types';
import type { ComputedEdge, RoadGraph, RoadNode } from './RoadGraph';

export interface SignalIntersection {
  node: RoadNode;
  controller: SignalController;
  /** Approach direction -> array of TrafficLightHeads facing incoming traffic from that approach */
  approachHeads: Map<'N' | 'S' | 'E' | 'W', TrafficLightHead[]>;
  /** All 4 pole groups for fast distance culling */
  poleGroups: THREE.Group[];
  stopDistance: number;
}

export interface RailwayState {
  x: number;
  z: number;
  timer: number;
  cycle: number; // total cycle sec
  gateClosed: boolean;
  warningActive: boolean;
  trainPos: number; // along X crossing
  gateLeft: THREE.Object3D;
  gateRight: THREE.Object3D;
  trainGroup: THREE.Group;
  lampA: THREE.MeshStandardMaterial;
  lampB: THREE.MeshStandardMaterial;
}

export interface CrosswalkZone {
  x: number;
  z: number;
  nx: number; // direction pedestrians walk across
  nz: number;
  halfLength: number;
  edgeId: string;
}

export interface LivingWorldRefs {
  cloudsGroup: THREE.Group;
  cloudMat: THREE.MeshStandardMaterial;
  birdsMesh: THREE.InstancedMesh;
  birdSeeds: { cx: number; cz: number; radius: number; height: number; speed: number; phase: number }[];
  flagsMesh: THREE.InstancedMesh | null;
  flagBaseMatrices: THREE.Matrix4[];
}

export interface BuiltWorld {
  root: THREE.Group;
  signals: SignalIntersection[];
  crosswalks: CrosswalkZone[];
  railway: RailwayState | null;
  rainPoints: THREE.Points | null;
  living: LivingWorldRefs;
  asphaltMaterials: THREE.MeshStandardMaterial[];
  windowMaterials: THREE.MeshStandardMaterial[];
  streetLampBulbs: THREE.MeshStandardMaterial[];
  streetLampLights: THREE.PointLight[];
  textures: THREE.Texture[];
  shadowCasters: THREE.Object3D[];
  waypointMarker: THREE.Group;
  dispose: () => void;
}

const HOUSE_PALETTE = ['#e2be7d', '#d8ae82', '#a8c2b0', '#9cb4cc', '#dfd0ad', '#d19880', '#bec8d4', '#d4bc92', '#e4d5b4'];
const SHOP_BG = ['#b81d18', '#0a4a8a', '#146634', '#c97200', '#7a1c3a', '#1e354d'];
const SHOP_FG = ['#fff6d5', '#ffffff', '#ffe866'];

/** Build the entire 3D Vietnamese city world from a RoadGraph with static mesh merging & instancing. */
export function buildWorld(
  graph: RoadGraph,
  timeOfDay: TimeOfDay,
  weather: WeatherKind,
  castShadows: boolean,
  anisotropy = 4,
): BuiltWorld {
  const root = new THREE.Group();
  root.name = `world-${graph.data.id}`;
  // All static architecture, roads, markings, sidewalks go into staticRoot and get merged by material!
  const staticRoot = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const textures: THREE.Texture[] = [];
  const shadowCasters: THREE.Object3D[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const trackTex = (tex: THREE.Texture): THREE.Texture => {
    tex.anisotropy = Math.max(1, anisotropy);
    textures.push(tex);
    disposables.push(tex);
    return tex;
  };

  const rand = rng(
    graph.data.id === 'boulevard' ? 101 : graph.data.id === 'oldquarter' ? 202 : graph.data.id === 'residential' ? 303 : 404,
  );

  // Shared materials
  const asphaltTex = trackTex(asphaltTexture(17, graph.data.id === 'oldquarter' ? 0.8 : 0.45));
  const asphaltMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltTex,
      roughness: weather === 'rain' ? 0.34 : 0.86,
      metalness: weather === 'rain' ? 0.14 : 0.02,
    }),
  );
  const sidewalkStyle = graph.data.id === 'boulevard' ? 'terrazzo' : graph.data.id === 'highway' ? 'grey' : 'red';
  const sidewalkTex = trackTex(sidewalkTexture(13, sidewalkStyle));
  const sidewalkMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: sidewalkTex, roughness: 0.88 }));
  const curbPaintedTex = trackTex(curbTexture(true));
  const curbGreyTex = trackTex(curbTexture(false));
  const curbPaintedMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: curbPaintedTex, roughness: 0.78 }));
  const curbGreyMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: curbGreyTex, roughness: 0.82 }));
  const whitePaintMat = track(
    new THREE.MeshStandardMaterial({ color: ROAD_PAINT.white, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  const yellowPaintMat = track(
    new THREE.MeshStandardMaterial({ color: ROAD_PAINT.yellow, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  const asphaltPadMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltTex,
      roughness: weather === 'rain' ? 0.34 : 0.86,
      metalness: weather === 'rain' ? 0.14 : 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const shutterTex = trackTex(shutterTexture(21));
  const shutterMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: shutterTex, roughness: 0.52, metalness: 0.38 }));
  const concreteMat = track(new THREE.MeshStandardMaterial({ color: 0x7e8388, roughness: 0.9, flatShading: true }));
  const darkMetalMat = track(new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.52, metalness: 0.55, flatShading: true }));
  const inoxMat = track(new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.28, metalness: 0.78, flatShading: true }));
  const grassMat = track(new THREE.MeshStandardMaterial({ color: graph.data.id === 'highway' ? 0x4b6e39 : 0x3f6134, roughness: 0.94, flatShading: true }));
  const awningBlueMat = track(new THREE.MeshStandardMaterial({ color: 0x16548a, roughness: 0.72, flatShading: true }));
  const awningRedMat = track(new THREE.MeshStandardMaterial({ color: 0xb32d22, roughness: 0.72, flatShading: true }));
  const shutterGreenMat = track(new THREE.MeshStandardMaterial({ color: 0x23593a, roughness: 0.78, flatShading: true }));
  const planterClayMat = track(new THREE.MeshStandardMaterial({ color: 0xa65336, roughness: 0.88, flatShading: true }));
  const planterLeafMat = track(new THREE.MeshStandardMaterial({ color: 0x3a7a36, roughness: 0.85, flatShading: true }));
  const windowFrameMat = track(new THREE.MeshStandardMaterial({ color: 0xebe6da, roughness: 0.82, flatShading: true }));
  const roofTileMat = track(new THREE.MeshStandardMaterial({ color: 0xb5442a, roughness: 0.82, flatShading: true }));
  const roofTinMat = track(new THREE.MeshStandardMaterial({ color: 0x265d78, roughness: 0.56, metalness: 0.32, flatShading: true }));
  const flowerRedMat = track(new THREE.MeshStandardMaterial({ color: 0xd63638, roughness: 0.78, flatShading: true }));
  const flowerGoldMat = track(new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.76, flatShading: true }));
  const bronzeMat = track(new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 0.46, metalness: 0.58, flatShading: true }));
  const stoneWhiteMat = track(new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 0.76, flatShading: true }));
  const palmTrunkMat = track(new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.92, flatShading: true }));
  const asphaltMaterials = [asphaltMat, asphaltPadMat];
  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const streetLampBulbs: THREE.MeshStandardMaterial[] = [];
  const streetLampLights: THREE.PointLight[] = [];

  const wallMats = HOUSE_PALETTE.map((hex, i) => {
    const t = trackTex(plasterWallTexture(hex, 30 + i * 7));
    return track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, roughness: 0.88, flatShading: true }));
  });

  const winLitMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1c2b3a,
      emissive: 0xffd27d,
      emissiveIntensity: timeOfDay === 'night' ? 0.95 : 0.0,
      roughness: 0.2,
      metalness: 0.35,
      flatShading: true,
    }),
  );
  const winDarkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x15202b,
      emissive: 0xffe4aa,
      emissiveIntensity: timeOfDay === 'night' ? 0.3 : 0.0,
      roughness: 0.24,
      metalness: 0.35,
      flatShading: true,
    }),
  );
  windowMaterials.push(winLitMat, winDarkMat);

  const shopMats = SHOP_NAMES.map(([title, sub], i) => {
    const bg = SHOP_BG[i % SHOP_BG.length];
    const fg = SHOP_FG[i % SHOP_FG.length];
    const tex = trackTex(shopSignTexture(title, bg, fg, sub));
    return track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.55 }));
  });

  // 1. Extended Ground Plane (14cm below road asphalt so grass NEVER Z-fights through roads!)
  const b = graph.data.bounds;
  const spanX = b.maxX - b.minX + 360;
  const spanZ = b.maxZ - b.minZ + 360;
  const groundMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(spanX, spanZ)), grassMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set((b.minX + b.maxX) * 0.5, -0.14, (b.minZ + b.maxZ) * 0.5);
  groundMesh.receiveShadow = true;
  root.add(groundMesh);

  // Track placed house footprints to guarantee ZERO overlapping/Z-fighting corner buildings!
  const placedHouses: { x: number; z: number; r: number }[] = [];

  // Precompute per-node intersection pad half-sizes so flat road planes trim cleanly to pad edges (ZERO crossing coplanar asphalt!)
  const nodeTrimRadius = new Map<string, number>();
  for (const node of graph.data.nodes) {
    if (node.kind === 'roundabout') {
      nodeTrimRadius.set(node.id, (node.roundaboutRadius ?? 20) + 11.4);
    } else {
      const adj = graph.adjacency.get(node.id) ?? [];
      const maxW = Math.max(8, ...adj.map((ce) => ce.totalWidth));
      nodeTrimRadius.set(node.id, (maxW + 5) * 0.5 - 0.15);
    }
  }

  // Collect instanced prop transforms
  const treeMatrices: THREE.Matrix4[] = [];
  const poleMatrices: THREE.Matrix4[] = [];
  const stoolRedMatrices: THREE.Matrix4[] = [];
  const stoolBlueMatrices: THREE.Matrix4[] = [];
  const parkedBikeMatrices: THREE.Matrix4[] = [];
  const manholeMatrices: THREE.Matrix4[] = [];
  const potholeMatrices: THREE.Matrix4[] = [];
  const acMatrices: THREE.Matrix4[] = [];
  const tankMatrices: THREE.Matrix4[] = [];
  const flagMatrices: THREE.Matrix4[] = [];
  const medianHedgeMatrices: THREE.Matrix4[] = [];
  const cafeTableMatrices: THREE.Matrix4[] = [];
  const trashBinMatrices: THREE.Matrix4[] = [];
  const lampPositions: THREE.Vector3[] = [];
  const cablePairs: [THREE.Vector3, THREE.Vector3][] = [];
  const crosswalks: CrosswalkZone[] = [];

  const dummy = new THREE.Object3D();

  // 2. Build Road Edges (asphalt, lane markings, sidewalks, curbs, medians, bridges, potholes, manholes)
  for (const ce of graph.computedEdges) {
    const e = ce.edge;
    const isBridge = Boolean(e.bridgeHeight);
    const trimStart = isBridge ? 0 : (nodeTrimRadius.get(e.from) ?? 0);
    const trimEnd = isBridge ? 0 : (nodeTrimRadius.get(e.to) ?? 0);
    const usableLen = Math.max(2, ce.length - trimStart - trimEnd);
    const segments = isBridge ? 24 : 1;
    const segLen = usableLen / segments;

    // Road offset if asymmetric (one-way is centered; two-way centered if lanesForward === lanesBackward)
    const centerShift = e.lanesBackward === 0 ? 0 : (ce.halfWidthForward - ce.halfWidthBackward) * 0.5;

    for (let s = 0; s < segments; s++) {
      const d0 = trimStart + s * segLen;
      const d1 = trimStart + (s + 1) * segLen;
      const dm = (d0 + d1) * 0.5;
      const mx = ce.ax + ce.dx * dm + ce.rx * centerShift;
      const mz = ce.az + ce.dz * dm + ce.rz * centerShift;
      const y0 = graph.elevationAt(ce.ax + ce.dx * d0, ce.az + ce.dz * d0);
      const y1 = graph.elevationAt(ce.ax + ce.dx * d1, ce.az + ce.dz * d1);
      const ym = (y0 + y1) * 0.5;
      const pitch = Math.atan2(y1 - y0, segLen);
      const segActualLen = Math.hypot(segLen, y1 - y0);

      // Asphalt surface (cleanly trimmed at intersections so NO two roads ever overlap!)
      const roadGeo = track(new THREE.PlaneGeometry(ce.totalWidth, segActualLen));
      const uv = roadGeo.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        uv.setXY(k, uv.getX(k) * (ce.totalWidth / 4), uv.getY(k) * (segActualLen / 4));
      }
      const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
      roadMesh.position.set(mx, ym + 0.01, mz);
      roadMesh.rotation.order = 'YXZ';
      roadMesh.rotation.y = ce.heading;
      roadMesh.rotation.x = -Math.PI / 2 - pitch;
      roadMesh.receiveShadow = true;
      staticRoot.add(roadMesh);

      if (isBridge && ym > 0.25) {
        // Bridge deck underside + railings
        const deck = new THREE.Mesh(track(new THREE.BoxGeometry(ce.totalWidth + 1.4, 0.7, segActualLen + 0.15)), concreteMat);
        deck.position.set(mx, ym - 0.36, mz);
        deck.rotation.order = 'YXZ';
        deck.rotation.y = ce.heading;
        deck.rotation.x = -pitch;
        staticRoot.add(deck);
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 1.05, segActualLen + 0.1)), concreteMat);
          rail.position.set(mx + ce.rx * side * (ce.totalWidth * 0.5 + 0.45), ym + 0.52, mz + ce.rz * side * (ce.totalWidth * 0.5 + 0.45));
          rail.rotation.order = 'YXZ';
          rail.rotation.y = ce.heading;
          rail.rotation.x = -pitch;
          staticRoot.add(rail);
        }
        if (s % 4 === 2 && ym > 1.2) {
          const pier = new THREE.Mesh(track(new THREE.BoxGeometry(ce.totalWidth * 0.6, ym, 1.4)), concreteMat);
          pier.position.set(mx, ym * 0.5 - 0.3, mz);
          pier.rotation.y = ce.heading;
          staticRoot.add(pier);
        }
      }
    }

    // Sidewalks & curbs (skip elevated mid-span on bridges; terminate cleanly before roundabout rings!)
    if (!isBridge) {
      const nodeFrom = graph.nodeMap.get(e.from);
      const nodeTo = graph.nodeMap.get(e.to);
      const swMarginStart = nodeFrom?.kind === 'roundabout' ? (nodeFrom.roundaboutRadius ?? 20) + 12.6 : 8;
      const swMarginEnd = nodeTo?.kind === 'roundabout' ? (nodeTo.roundaboutRadius ?? 20) + 12.6 : 8;
      const swLen = Math.max(4, ce.length - swMarginStart - swMarginEnd);
      const swMidD = swMarginStart + swLen * 0.5;
      const midX = ce.ax + ce.dx * swMidD;
      const midZ = ce.az + ce.dz * swMidD;
      for (const side of [-1, 1]) {
        const edgeDist =
          e.lanesBackward === 0
            ? ce.halfWidthForward * 0.5
            : side > 0
              ? ce.medianHalf + ce.halfWidthForward
              : ce.medianHalf + ce.halfWidthBackward;
        const curbW = 0.26;
        // Place sidewalk strictly OUTSIDE the 0.26m curb so sidewalk & curb NEVER share a coplanar vertical face!
        const swWidth = Math.max(0.5, e.sidewalkWidth - curbW);
        const swCenter = edgeDist + curbW + swWidth * 0.5;
        const sx = midX + ce.rx * side * swCenter;
        const sz = midZ + ce.rz * side * swCenter;
        const swGeo = track(new THREE.BoxGeometry(swWidth, 0.18, swLen));
        // Tile sidewalk UVs cleanly in world meters (zero stretched stripes!)
        const swUv = swGeo.attributes.uv;
        const swNorm = swGeo.attributes.normal;
        for (let k = 0; k < swUv.count; k++) {
          const ny = Math.abs(swNorm.getY(k));
          if (ny > 0.5) {
            swUv.setXY(k, swUv.getX(k) * (swWidth / 2.2), swUv.getY(k) * (swLen / 2.2));
          } else {
            swUv.setXY(k, swUv.getX(k) * (swLen / 2.2), swUv.getY(k) * 0.25);
          }
        }
        const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
        swMesh.position.set(sx, 0.09, sz);
        swMesh.rotation.y = ce.heading;
        swMesh.receiveShadow = true;
        staticRoot.add(swMesh);

        // Curb occupies [edgeDist, edgeDist + 0.26] cleanly with proportional red-white stripe UV tiling
        const curbGeo = track(new THREE.BoxGeometry(curbW, 0.22, swLen));
        const cUv = curbGeo.attributes.uv;
        const cNorm = curbGeo.attributes.normal;
        for (let k = 0; k < cUv.count; k++) {
          if (Math.abs(cNorm.getX(k)) > 0.5) {
            cUv.setXY(k, cUv.getX(k) * (swLen / 3.2), cUv.getY(k));
          } else if (Math.abs(cNorm.getY(k)) > 0.5) {
            cUv.setXY(k, cUv.getY(k) * (swLen / 3.2), cUv.getX(k));
          }
        }
        const curbMesh = new THREE.Mesh(
          curbGeo,
          e.style === 'boulevard' ? curbPaintedMat : curbGreyMat,
        );
        curbMesh.position.set(midX + ce.rx * side * (edgeDist + curbW * 0.5), 0.11, midZ + ce.rz * side * (edgeDist + curbW * 0.5));
        curbMesh.rotation.y = ce.heading;
        staticRoot.add(curbMesh);
      }
    }

    // Center line / Median strip (with U-turn opening!)
    const nodeFromM = graph.nodeMap.get(e.from);
    const nodeToM = graph.nodeMap.get(e.to);
    const lineStart = nodeFromM?.kind === 'roundabout' ? (nodeFromM.roundaboutRadius ?? 20) + 12.8 : 12;
    const lineEnd = ce.length - (nodeToM?.kind === 'roundabout' ? (nodeToM.roundaboutRadius ?? 20) + 12.8 : 12);
    if (e.hasMedian && e.lanesBackward > 0 && !isBridge && lineEnd > lineStart + 4) {
      const uMid = (lineStart + lineEnd) * 0.5;
      const segmentsMed: [number, number][] = e.hasUTurnOpening
        ? [
            [lineStart, uMid - 8],
            [uMid + 8, lineEnd],
          ]
        : [[lineStart, lineEnd]];
      for (const [m0, m1] of segmentsMed) {
        if (m1 - m0 < 3) continue;
        const len = m1 - m0;
        const mc = (m0 + m1) * 0.5;
        const medGeo = track(new THREE.BoxGeometry(ce.medianHalf * 1.9, 0.26, len));
        const mUv = medGeo.attributes.uv;
        const mNorm = medGeo.attributes.normal;
        for (let k = 0; k < mUv.count; k++) {
          if (Math.abs(mNorm.getX(k)) > 0.5) {
            mUv.setXY(k, mUv.getX(k) * (len / 3.2), mUv.getY(k));
          } else if (Math.abs(mNorm.getY(k)) > 0.5) {
            mUv.setXY(k, mUv.getY(k) * (len / 3.2), mUv.getX(k));
          }
        }
        const med = new THREE.Mesh(medGeo, curbPaintedMat);
        med.position.set(ce.ax + ce.dx * mc, 0.13, ce.az + ce.dz * mc);
        med.rotation.y = ce.heading;
        med.castShadow = castShadows;
        med.receiveShadow = true;
        staticRoot.add(med);
        if (e.style === 'boulevard' && len > 12) {
          const hedge = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.34, len - 2.2)), grassMat);
          hedge.position.set(ce.ax + ce.dx * mc, 0.42, ce.az + ce.dz * mc);
          hedge.rotation.y = ce.heading;
          staticRoot.add(hedge);
          // Flowering bougainvillea shrubs spaced cleanly along the boulevard median
          for (let hd = m0 + 2.8; hd < m1 - 2.8; hd += 6.2) {
            dummy.position.set(ce.ax + ce.dx * hd, 0.58, ce.az + ce.dz * hd);
            dummy.rotation.set(0, ce.heading + ((Math.round(hd) % 2) * Math.PI) / 2, 0);
            const hs = 0.92 + rand() * 0.24;
            dummy.scale.set(hs, hs, hs);
            dummy.updateMatrix();
            medianHedgeMatrices.push(dummy.matrix.clone());
          }
        }
      }
    } else if (e.lanesBackward > 0 && lineEnd > lineStart) {
      const len = lineEnd - lineStart;
      const mc = (lineStart + lineEnd) * 0.5;
      const yLine = new THREE.Mesh(track(new THREE.PlaneGeometry(0.18, len)), yellowPaintMat);
      yLine.position.set(ce.ax + ce.dx * mc, graph.elevationAt(ce.ax + ce.dx * mc, ce.az + ce.dz * mc) + 0.044, ce.az + ce.dz * mc);
      yLine.rotation.order = 'YXZ';
      yLine.rotation.y = ce.heading;
      yLine.rotation.x = -Math.PI / 2;
      staticRoot.add(yLine);
    }

    // Dashed white lane dividers (and solid line separating motorbike lane R.412!)
    const drawLaneLines = (dirSign: 1 | -1, lanes: number) => {
      for (let l = 1; l < lanes; l++) {
        const latFromCenter =
          e.lanesBackward === 0
            ? -ce.halfWidthForward * 0.5 + l * e.laneWidth
            : dirSign * (ce.medianHalf + l * e.laneWidth);
        const isMotorbikeBoundary = Boolean(e.hasMotorbikeLane) && l === lanes - 1;
        if (isMotorbikeBoundary && !isBridge) {
          const len = Math.max(2, lineEnd - lineStart);
          const mc = (lineStart + lineEnd) * 0.5;
          const solid = new THREE.Mesh(track(new THREE.PlaneGeometry(0.16, len)), whitePaintMat);
          solid.position.set(ce.ax + ce.dx * mc + ce.rx * latFromCenter, 0.044, ce.az + ce.dz * mc + ce.rz * latFromCenter);
          solid.rotation.order = 'YXZ';
          solid.rotation.y = ce.heading;
          solid.rotation.x = -Math.PI / 2;
          staticRoot.add(solid);
        } else {
          for (let d = lineStart; d < lineEnd - 3; d += 7) {
            const x = ce.ax + ce.dx * (d + 1.5) + ce.rx * latFromCenter;
            const z = ce.az + ce.dz * (d + 1.5) + ce.rz * latFromCenter;
            const y = graph.elevationAt(x, z);
            const dash = new THREE.Mesh(track(new THREE.PlaneGeometry(0.14, 3.0)), whitePaintMat);
            dash.position.set(x, y + 0.044, z);
            dash.rotation.order = 'YXZ';
            dash.rotation.y = ce.heading;
            dash.rotation.x = -Math.PI / 2;
            staticRoot.add(dash);
          }
        }
      }
    };
    drawLaneLines(1, e.lanesForward);
    if (e.lanesBackward > 0) drawLaneLines(-1, e.lanesBackward);

    // Crosswalks & stop lines near intersections
    if (e.hasCrosswalk && ce.length > 36) {
      for (const endIdx of [0, 1]) {
        const dist = endIdx === 0 ? 13.5 : ce.length - 13.5;
        const node = graph.nodeMap.get(endIdx === 0 ? e.from : e.to);
        if (!node || node.kind === 'roundabout' || node.kind === 'bend') continue;
        const cx = ce.ax + ce.dx * dist;
        const cz = ce.az + ce.dz * dist;
        const stripeCount = Math.max(3, Math.floor(ce.totalWidth / 1.1));
        for (let i = 0; i < stripeCount; i++) {
          const offset = -ce.totalWidth * 0.44 + (i / Math.max(1, stripeCount - 1)) * ce.totalWidth * 0.88;
          const stripe = new THREE.Mesh(track(new THREE.PlaneGeometry(0.46, 2.8)), whitePaintMat);
          stripe.position.set(cx + ce.rx * offset, 0.048, cz + ce.rz * offset);
          stripe.rotation.order = 'YXZ';
          stripe.rotation.y = ce.heading;
          stripe.rotation.x = -Math.PI / 2;
          staticRoot.add(stripe);
        }
        const stopDist = endIdx === 0 ? dist + 2.4 : dist - 2.4;
        const stopW = e.lanesBackward === 0 ? ce.halfWidthForward : endIdx === 0 ? ce.halfWidthBackward : ce.halfWidthForward;
        const stopLat =
          e.lanesBackward === 0
            ? 0
            : endIdx === 0
              ? -(ce.medianHalf + ce.halfWidthBackward * 0.5)
              : ce.medianHalf + ce.halfWidthForward * 0.5;
        const stopLine = new THREE.Mesh(track(new THREE.PlaneGeometry(stopW - 0.3, 0.36)), whitePaintMat);
        stopLine.position.set(ce.ax + ce.dx * stopDist + ce.rx * stopLat, 0.052, ce.az + ce.dz * stopDist + ce.rz * stopLat);
        stopLine.rotation.order = 'YXZ';
        stopLine.rotation.y = ce.heading;
        stopLine.rotation.x = -Math.PI / 2;
        staticRoot.add(stopLine);

        crosswalks.push({
          x: cx,
          z: cz,
          nx: ce.rx,
          nz: ce.rz,
          halfLength: ce.totalWidth * 0.5 + 1.2,
          edgeId: e.id,
        });
      }
    }

    // Manholes & potholes along road (strictly outside roundabouts & intersections!)
    const roadPropStart = Math.max(20, trimStart + 4);
    const roadPropEnd = ce.length - Math.max(20, trimEnd + 4);
    if (!isBridge && roadPropEnd > roadPropStart + 6) {
      for (let d = roadPropStart; d < roadPropEnd; d += 26) {
        if (rand() < 0.65) {
          const side = rand() > 0.5 ? 1 : -1;
          const lat = side * Math.max(1.0, ce.totalWidth * 0.34);
          dummy.position.set(ce.ax + ce.dx * d + ce.rx * lat, 0.036, ce.az + ce.dz * d + ce.rz * lat);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          manholeMatrices.push(dummy.matrix.clone());
        }
        if (rand() < 0.38 && d + 7 < roadPropEnd) {
          const lat = (rand() - 0.5) * ce.totalWidth * 0.65;
          dummy.position.set(ce.ax + ce.dx * (d + 7) + ce.rx * lat, 0.033, ce.az + ce.dz * (d + 7) + ce.rz * lat);
          dummy.rotation.set(-Math.PI / 2, rand() * Math.PI, 0);
          dummy.scale.set(0.6 + rand() * 0.6, 0.45 + rand() * 0.5, 1);
          dummy.updateMatrix();
          potholeMatrices.push(dummy.matrix.clone());
        }
      }
    }

    // Buildings, trees, utility poles, sidewalk stalls & parked bikes along both sides
    if (!isBridge) {
      let prevPoleLeft: THREE.Vector3 | null = null;
      let prevPoleRight: THREE.Vector3 | null = null;
      const nodeFromP = graph.nodeMap.get(e.from);
      const nodeToP = graph.nodeMap.get(e.to);
      const startD = nodeFromP?.kind === 'roundabout' ? (nodeFromP.roundaboutRadius ?? 20) + 15.5 : 18;
      const endD = ce.length - (nodeToP?.kind === 'roundabout' ? (nodeToP.roundaboutRadius ?? 20) + 15.5 : 18);

      for (const side of [-1, 1]) {
        const edgeDist =
          e.lanesBackward === 0
            ? ce.halfWidthForward * 0.5
            : side > 0
              ? ce.medianHalf + ce.halfWidthForward
              : ce.medianHalf + ce.halfWidthBackward;
        const curbDist = edgeDist + 0.55;
        const houseFrontDist = edgeDist + e.sidewalkWidth + 0.25;

        // Utility poles + street trees + sidewalk props every ~18m
        for (let d = startD; d <= endD; d += 18) {
          const px = ce.ax + ce.dx * d + ce.rx * side * curbDist;
          const pz = ce.az + ce.dz * d + ce.rz * side * curbDist;
          // Utility pole (on one side or alternating)
          if (side === 1 || e.style === 'boulevard') {
            dummy.position.set(px, 0.18, pz);
            dummy.rotation.set(0, ce.heading + (side > 0 ? 0 : Math.PI), 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            poleMatrices.push(dummy.matrix.clone());

            const poleTop = new THREE.Vector3(px, 6.4, pz);
            if (side === 1) {
              if (prevPoleRight && prevPoleRight.distanceTo(poleTop) < 28) cablePairs.push([prevPoleRight, poleTop]);
              prevPoleRight = poleTop;
            } else {
              if (prevPoleLeft && prevPoleLeft.distanceTo(poleTop) < 28) cablePairs.push([prevPoleLeft, poleTop]);
              prevPoleLeft = poleTop;
            }
            if (lampPositions.length < 30 && d % 36 === startD % 36) {
              lampPositions.push(new THREE.Vector3(px, 6.1, pz));
            }
          }

          // Street tree with whitewashed trunk
          const tx = ce.ax + ce.dx * (d + 8) + ce.rx * side * (curbDist + 0.3);
          const tz = ce.az + ce.dz * (d + 8) + ce.rz * side * (curbDist + 0.3);
          if (d + 8 < endD && e.style !== 'alley') {
            dummy.position.set(tx, 0.18, tz);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            const sc = 0.85 + rand() * 0.38;
            dummy.scale.set(sc, sc, sc);
            dummy.updateMatrix();
            treeMatrices.push(dummy.matrix.clone());
          }

          // Quán cóc ghế nhựa (plastic stools + low plastic café table) & parked motorbikes on sidewalk!
          if (e.sidewalkWidth >= 2.2 && rand() < 0.65) {
            const stX = ce.ax + ce.dx * (d + 4) + ce.rx * side * (edgeDist + e.sidewalkWidth * 0.55);
            const stZ = ce.az + ce.dz * (d + 4) + ce.rz * side * (edgeDist + e.sidewalkWidth * 0.55);
            // Low blocky café table in the center of the stool cluster
            dummy.position.set(stX, 0.18, stZ);
            dummy.rotation.set(0, ce.heading + (rand() - 0.5) * 0.25, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            cafeTableMatrices.push(dummy.matrix.clone());
            for (let k = 0; k < 3; k++) {
              const ang = (k / 3) * Math.PI * 2 + 0.4;
              dummy.position.set(stX + Math.cos(ang) * 0.68, 0.18, stZ + Math.sin(ang) * 0.68);
              dummy.rotation.set(0, rand() * Math.PI, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              if (k % 2 === 0) stoolRedMatrices.push(dummy.matrix.clone());
              else stoolBlueMatrices.push(dummy.matrix.clone());
            }
          }
          // Iconic Vietnamese green public curbside trash bin every ~36m
          if (e.sidewalkWidth >= 2.2 && Math.round(d - startD) % 36 === 0 && rand() < 0.65) {
            const binX = ce.ax + ce.dx * (d + 2.2) + ce.rx * side * (curbDist + 0.35);
            const binZ = ce.az + ce.dz * (d + 2.2) + ce.rz * side * (curbDist + 0.35);
            dummy.position.set(binX, 0.18, binZ);
            dummy.rotation.set(0, ce.heading + (side > 0 ? Math.PI : 0), 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            trashBinMatrices.push(dummy.matrix.clone());
          }
          if (e.sidewalkWidth >= 2.2 && rand() < 0.55) {
            const bx = ce.ax + ce.dx * (d + 12) + ce.rx * side * (edgeDist + e.sidewalkWidth * 0.42);
            const bz = ce.az + ce.dz * (d + 12) + ce.rz * side * (edgeDist + e.sidewalkWidth * 0.42);
            dummy.position.set(bx, 0.18, bz);
            dummy.rotation.set(0, ce.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            parkedBikeMatrices.push(dummy.matrix.clone());
          }
        }

        // Vietnamese Tube Houses (Nhà ống) along the street
        if (e.style === 'highway' && rand() < 0.4) continue; // Highway has sparser houses
        let cursor = startD + 2;
        while (cursor < endD - 5) {
          const width = e.style === 'boulevard' ? 6.0 + rand() * 3.5 : 4.2 + rand() * 2.2;
          if (cursor + width > endD) break;
          const depth = e.style === 'alley' ? 7 + rand() * 4 : 11 + rand() * 5;
          const floors = e.style === 'boulevard' ? 3 + Math.floor(rand() * 4) : e.style === 'oldquarter' ? 2 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 2);
          const height = floors * 3.2;

          const hx = ce.ax + ce.dx * (cursor + width * 0.5) + ce.rx * side * (houseFrontDist + depth * 0.5);
          const hz = ce.az + ce.dz * (cursor + width * 0.5) + ce.rz * side * (houseFrontDist + depth * 0.5);

          // Ensure house does not overlap any other road edge OR any previously placed corner house!
          const houseRad = Math.hypot(width * 0.5, depth * 0.5) * 0.86;
          const overlapsHouse = placedHouses.some((h) => Math.hypot(hx - h.x, hz - h.z) < houseRad + h.r - 0.3);
          if (!overlapsHouse && !isNearAnyRoad(hx, hz, graph, ce.edge.id, depth * 0.48)) {
            placedHouses.push({ x: hx, z: hz, r: houseRad });
            const houseGroup = new THREE.Group();
            houseGroup.position.set(hx, 0, hz);
            // Face the road: local +Z faces street!
            houseGroup.rotation.y = ce.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);

            const wallMat = wallMats[Math.floor(rand() * wallMats.length)];
            const body = new THREE.Mesh(track(new THREE.BoxGeometry(width - 0.14, height, depth)), wallMat);
            body.position.y = height * 0.5;
            body.castShadow = castShadows;
            body.receiveShadow = true;
            houseGroup.add(body);

            // Rooftop parapet trim + varied Vietnamese roofs (terracotta mái ngói đỏ / corrugated mái tôn / flat cornice!)
            const parapet = new THREE.Mesh(track(new THREE.BoxGeometry(width + 0.08, 0.46, depth + 0.22)), concreteMat);
            parapet.position.y = height + 0.24;
            houseGroup.add(parapet);
            const roofRoll = rand();
            if (roofRoll < 0.26) {
              // Stepped blocky Vietnamese terracotta tile roof (mái ngói đỏ)
              const rTier1 = new THREE.Mesh(track(new THREE.BoxGeometry(width + 0.34, 0.55, depth * 0.58)), roofTileMat);
              rTier1.position.set(0, height + 0.74, depth * 0.18);
              houseGroup.add(rTier1);
              const rTier2 = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.92, 0.55, depth * 0.34)), roofTileMat);
              rTier2.position.set(0, height + 1.29, depth * 0.18);
              houseGroup.add(rTier2);
              const ridge = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.96, 0.22, 0.42)), windowFrameMat);
              ridge.position.set(0, height + 1.66, depth * 0.18);
              houseGroup.add(ridge);
            } else if (roofRoll < 0.48) {
              // Corrugated blue-teal rooftop tin shed (mái tôn sân thượng)
              const tinRoof = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.92, 0.18, depth * 0.62)), roofTinMat);
              tinRoof.position.set(0, height + 1.68, depth * 0.12);
              tinRoof.rotation.x = 0.14;
              houseGroup.add(tinRoof);
              for (const sx of [-1, 1]) {
                const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 1.25, 0.14)), darkMetalMat);
                post.position.set(sx * (width * 0.4), height + 1.05, depth * 0.36);
                houseGroup.add(post);
              }
            } else {
              const roofEdge = new THREE.Mesh(track(new THREE.BoxGeometry(width + 0.26, 0.24, 0.52)), rand() > 0.45 ? roofTileMat : windowFrameMat);
              roofEdge.position.set(0, height + 0.16, depth * 0.5 + 0.36);
              houseGroup.add(roofEdge);
            }

            // Ground floor rolling shutter + side concrete storefront columns
            const shutter = new THREE.Mesh(track(new THREE.PlaneGeometry(width * 0.72, 2.55)), shutterMat);
            shutter.position.set(0, 1.38, depth * 0.5 + 0.06);
            houseGroup.add(shutter);
            for (const s of [-1, 1]) {
              const col = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 3.05, 0.28)), windowFrameMat);
              col.position.set(s * (width * 0.44), 1.52, depth * 0.5 + 0.12);
              houseGroup.add(col);
            }

            // Shop sign above ground floor (Vietnamese store names!)
            if (e.style !== 'alley' || rand() < 0.4) {
              const signMat = shopMats[Math.floor(rand() * shopMats.length)];
              const sign = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.92, 0.98, 0.22)), signMat);
              sign.position.set(0, 3.22, depth * 0.5 + 0.18);
              houseGroup.add(sign);
            }

            // Corrugated awning with crisp contrasting front valance trim!
            if (rand() < 0.68) {
              const awning = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.90, 0.10, 1.38)), rand() > 0.5 ? awningBlueMat : awningRedMat);
              awning.position.set(0, 2.72, depth * 0.5 + 0.72);
              awning.rotation.x = 0.22;
              houseGroup.add(awning);
              const valance = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.90, 0.18, 0.06)), windowFrameMat);
              valance.position.set(0, 2.52, depth * 0.5 + 1.40);
              houseGroup.add(valance);
            }

            // Upper floor balconies, horizontal cornice ledges, framed recessed windows, green shutters & blooming flower boxes!
            for (let fl = 1; fl < floors; fl++) {
              const fy = fl * 3.2 + 0.2;
              const winW = width * 0.52;
              // Crisp horizontal floor molding cornice across facade
              const cornice = new THREE.Mesh(track(new THREE.BoxGeometry(width + 0.04, 0.14, 0.16)), windowFrameMat);
              cornice.position.set(0, fy + 2.86, depth * 0.5 + 0.08);
              houseGroup.add(cornice);

              // Crisp white window surround frame
              const frame = new THREE.Mesh(track(new THREE.BoxGeometry(winW + 0.24, 1.62, 0.10)), windowFrameMat);
              frame.position.set(0, fy + 1.18, depth * 0.5 + 0.06);
              houseGroup.add(frame);

              // Deep recessed glass window pane (cleanly proud of frame front!)
              const win = new THREE.Mesh(track(new THREE.BoxGeometry(winW, 1.42, 0.08)), rand() < 0.55 ? winLitMat : winDarkMat);
              win.position.set(0, fy + 1.18, depth * 0.5 + 0.11);
              houseGroup.add(win);

              // Classic Vietnamese colonial green louvered side shutters (outside frame, zero overlap!)
              if (rand() < 0.6) {
                for (const s of [-1, 1]) {
                  const sh = new THREE.Mesh(track(new THREE.BoxGeometry(0.30, 1.44, 0.08)), shutterGreenMat);
                  sh.position.set(s * (winW * 0.5 + 0.30), fy + 1.18, depth * 0.5 + 0.09);
                  houseGroup.add(sh);
                }
              }

              // Stepped floor balcony slab + crisp dark metal railing
              const balc = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.88, 0.22, 0.96)), concreteMat);
              balc.position.set(0, fy, depth * 0.5 + 0.49);
              houseGroup.add(balc);
              const railTop = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.86, 0.08, 0.08)), darkMetalMat);
              railTop.position.set(0, fy + 0.90, depth * 0.5 + 0.92);
              houseGroup.add(railTop);
              const railMid = new THREE.Mesh(track(new THREE.BoxGeometry(width * 0.86, 0.48, 0.06)), darkMetalMat);
              railMid.position.set(0, fy + 0.42, depth * 0.5 + 0.92);
              houseGroup.add(railMid);

              // Balcony terracotta flower box + blocky voxel green plant + vibrant crimson/gold blooms!
              if (rand() < 0.58) {
                const px = (rand() - 0.5) * width * 0.36;
                const pot = new THREE.Mesh(track(new THREE.BoxGeometry(0.86, 0.28, 0.28)), planterClayMat);
                pot.position.set(px, fy + 0.27, depth * 0.5 + 0.72);
                houseGroup.add(pot);
                const bush = new THREE.Mesh(track(new THREE.BoxGeometry(0.76, 0.34, 0.26)), planterLeafMat);
                bush.position.set(px, fy + 0.58, depth * 0.5 + 0.72);
                houseGroup.add(bush);
                if (rand() < 0.72) {
                  const bloomMat = rand() > 0.45 ? flowerRedMat : flowerGoldMat;
                  const bloom = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.14, 0.20)), bloomMat);
                  bloom.position.set(px, fy + 0.82, depth * 0.5 + 0.72);
                  houseGroup.add(bloom);
                }
              }

              if (rand() < 0.62) {
                const worldPos = new THREE.Vector3(width * 0.33, fy + 0.52, depth * 0.5 + 0.26);
                worldPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), houseGroup.rotation.y);
                worldPos.add(houseGroup.position);
                dummy.position.copy(worldPos);
                dummy.rotation.set(0, houseGroup.rotation.y, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                acMatrices.push(dummy.matrix.clone());
              }
            }

            if (rand() < 0.74) {
              const tankPos = new THREE.Vector3((rand() - 0.5) * width * 0.3, height + 1.05, -depth * 0.28);
              tankPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), houseGroup.rotation.y);
              tankPos.add(houseGroup.position);
              dummy.position.copy(tankPos);
              dummy.rotation.set(0, houseGroup.rotation.y, Math.PI / 2);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              tankMatrices.push(dummy.matrix.clone());
            }

            // Iconic Vietnamese red-star street flags mounted at 45° on select storefronts!
            if (rand() < 0.26 && flagMatrices.length < 72) {
              const fPos = new THREE.Vector3(-width * 0.34, 3.65, depth * 0.5 + 0.34);
              fPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), houseGroup.rotation.y);
              fPos.add(houseGroup.position);
              dummy.position.copy(fPos);
              dummy.rotation.set(0.42, houseGroup.rotation.y, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              flagMatrices.push(dummy.matrix.clone());
            }

            staticRoot.add(houseGroup);
          }

          cursor += width + (e.style === 'highway' ? 6 + rand() * 8 : 0.2);
        }
      }
    }
  }

  // 3. Build Intersections, Yellow Box Junctions (vạch mắt võng), Roundabouts, Traffic Signals & Convex Mirrors
  const signals: SignalIntersection[] = [];
  for (const node of graph.data.nodes) {
    if (node.kind === 'roundabout') {
      const r = node.roundaboutRadius ?? 20;
      const outerR = r + 12;
      const ringGeo = track(new THREE.CircleGeometry(outerR, 48));
      const rUv = ringGeo.attributes.uv;
      const uvScale = (outerR * 2) / 4;
      for (let k = 0; k < rUv.count; k++) {
        rUv.setXY(k, rUv.getX(k) * uvScale, rUv.getY(k) * uvScale);
      }
      const ringMesh = new THREE.Mesh(ringGeo, asphaltPadMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(node.x, 0.018, node.z);
      ringMesh.receiveShadow = true;
      staticRoot.add(ringMesh);

      const laneRing = new THREE.Mesh(track(new THREE.RingGeometry(r + 4.8, r + 5.05, 48)), whitePaintMat);
      laneRing.rotation.x = -Math.PI / 2;
      laneRing.position.set(node.x, 0.046, node.z);
      staticRoot.add(laneRing);

      const rawCurbGeo = new THREE.CylinderGeometry(r * 0.62, r * 0.64, 0.32, 48);
      const islandCurbGeo = track(rawCurbGeo.toNonIndexed());
      rawCurbGeo.dispose();
      const icUv = islandCurbGeo.attributes.uv;
      const icPos = islandCurbGeo.attributes.position;
      const icNorm = islandCurbGeo.attributes.normal;
      const icStripes = Math.max(12, Math.round((2 * Math.PI * r * 0.63) / 3.2));
      for (let t = 0; t < icUv.count; t += 3) {
        if (Math.abs(icNorm.getY(t)) > 0.5) {
          let baseA = Math.atan2(icPos.getX(t), icPos.getZ(t));
          if (Math.hypot(icPos.getX(t), icPos.getZ(t)) < 0.01) {
            baseA = Math.atan2(icPos.getX(t + 1), icPos.getZ(t + 1));
          }
          for (let j = 0; j < 3; j++) {
            const idx = t + j;
            const px = icPos.getX(idx);
            const pz = icPos.getZ(idx);
            let a = Math.hypot(px, pz) < 0.01 ? baseA : Math.atan2(px, pz);
            while (a - baseA > Math.PI) a -= Math.PI * 2;
            while (a - baseA < -Math.PI) a += Math.PI * 2;
            icUv.setXY(idx, ((a + Math.PI) / (Math.PI * 2)) * icStripes, 0.5);
          }
        } else {
          for (let j = 0; j < 3; j++) {
            const idx = t + j;
            icUv.setXY(idx, icUv.getX(idx) * icStripes, icUv.getY(idx));
          }
        }
      }
      const islandCurb = new THREE.Mesh(islandCurbGeo, curbPaintedMat);
      islandCurb.position.set(node.x, 0.18, node.z);
      staticRoot.add(islandCurb);
      const islandGrass = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 0.58, r * 0.58, 0.30, 32)), grassMat);
      islandGrass.position.set(node.x, 0.23, node.z);
      staticRoot.add(islandGrass);

      // Iconic Saigon roundabout floral plaza: concentric crimson & marigold flowerbeds + white stone steps!
      const outerFlowerRing = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 0.49, r * 0.51, 0.16, 24)), flowerGoldMat);
      outerFlowerRing.position.set(node.x, 0.45, node.z);
      staticRoot.add(outerFlowerRing);
      const innerLawn = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 0.41, r * 0.42, 0.18, 24)), grassMat);
      innerLawn.position.set(node.x, 0.48, node.z);
      staticRoot.add(innerLawn);
      const innerFlowerRing = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 0.31, r * 0.33, 0.16, 20)), flowerRedMat);
      innerFlowerRing.position.set(node.x, 0.55, node.z);
      staticRoot.add(innerFlowerRing);

      // 4 Ornamental blocky tropical palms around the monument plaza
      for (let pi = 0; pi < 4; pi++) {
        const ang = (pi * Math.PI) / 2 + Math.PI / 4;
        const px = node.x + Math.cos(ang) * (r * 0.36);
        const pz = node.z + Math.sin(ang) * (r * 0.36);
        const pTrunk = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 4.4, 0.42)), palmTrunkMat);
        pTrunk.position.set(px, 2.55, pz);
        staticRoot.add(pTrunk);
        const pCrown = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.65, 1.4)), planterLeafMat);
        pCrown.position.set(px, 4.85, pz);
        staticRoot.add(pCrown);
        for (let fi = 0; fi < 4; fi++) {
          const fa = (fi * Math.PI) / 2 + ang;
          const frond = new THREE.Mesh(track(new THREE.BoxGeometry(0.65, 0.22, 2.15)), planterLeafMat);
          frond.position.set(px + Math.cos(fa) * 1.15, 4.78, pz + Math.sin(fa) * 1.15);
          frond.rotation.y = -fa + Math.PI / 2;
          frond.rotation.x = 0.26;
          staticRoot.add(frond);
        }
      }

      // Stepped white-stone octagonal pedestal with 4 flush bronze monument plaques
      const stepBase = new THREE.Mesh(track(new THREE.CylinderGeometry(5.0, 5.4, 0.55, 8)), stoneWhiteMat);
      stepBase.position.set(node.x, 0.72, node.z);
      staticRoot.add(stepBase);
      const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(3.48, 3.62, 2.2, 8)), stoneWhiteMat);
      plinth.position.set(node.x, 2.05, node.z);
      plinth.rotation.y = Math.PI / 8;
      staticRoot.add(plinth);
      for (let qi = 0; qi < 4; qi++) {
        const qa = (qi * Math.PI) / 2;
        const plaque = new THREE.Mesh(track(new THREE.BoxGeometry(1.55, 0.96, 0.12)), bronzeMat);
        plaque.position.set(node.x + Math.sin(qa) * 3.36, 2.08, node.z + Math.cos(qa) * 3.36);
        plaque.rotation.y = qa;
        staticRoot.add(plaque);
      }
      // Fluted cream obelisk with vertical bronze accent ribs & gleaming gold finial
      const obelisk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.68, 1.52, 11.2, 6)), stoneWhiteMat);
      obelisk.position.set(node.x, 8.6, node.z);
      staticRoot.add(obelisk);
      const obeliskCollar = new THREE.Mesh(track(new THREE.CylinderGeometry(1.75, 1.85, 0.45, 8)), bronzeMat);
      obeliskCollar.position.set(node.x, 3.35, node.z);
      staticRoot.add(obeliskCollar);
      const starCap = new THREE.Mesh(
        track(new THREE.OctahedronGeometry(1.25)),
        track(new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.24, metalness: 0.82, flatShading: true })),
      );
      starCap.position.set(node.x, 15.1, node.z);
      staticRoot.add(starCap);
      continue;
    }

    const adj = graph.adjacency.get(node.id) ?? [];
    const maxW = Math.max(8, ...adj.map((ce) => ce.totalWidth));
    const padSize = maxW + 5;
    const padGeo = track(new THREE.PlaneGeometry(padSize, padSize));
    const pUv = padGeo.attributes.uv;
    for (let k = 0; k < pUv.count; k++) {
      pUv.setXY(k, pUv.getX(k) * (padSize / 4), pUv.getY(k) * (padSize / 4));
    }
    const pad = new THREE.Mesh(padGeo, asphaltPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(node.x, 0.018, node.z);
    pad.receiveShadow = true;
    staticRoot.add(pad);

    if (node.hasSignal) {
      const boxS = Math.min(11, maxW * 0.65);
      const borderT = 0.22;
      // Stagger b1 (0.052), b2 (0.047), and diag (0.041) so crossing yellow strips NEVER Z-fight!
      for (const s of [-1, 1]) {
        const b1 = new THREE.Mesh(track(new THREE.PlaneGeometry(boxS, borderT)), yellowPaintMat);
        b1.rotation.x = -Math.PI / 2;
        b1.position.set(node.x, 0.052, node.z + s * boxS * 0.5);
        staticRoot.add(b1);
        const b2 = new THREE.Mesh(track(new THREE.PlaneGeometry(borderT, boxS)), yellowPaintMat);
        b2.rotation.x = -Math.PI / 2;
        b2.position.set(node.x + s * boxS * 0.5, 0.047, node.z);
        staticRoot.add(b2);
      }
      for (let k = -2; k <= 2; k++) {
        const diag = new THREE.Mesh(track(new THREE.PlaneGeometry(boxS * 1.15, 0.14)), yellowPaintMat);
        diag.rotation.order = 'YXZ';
        diag.rotation.y = Math.PI / 4;
        diag.rotation.x = -Math.PI / 2;
        diag.position.set(node.x + k * 1.4, 0.041, node.z - k * 1.4);
        staticRoot.add(diag);
      }

      // Signal Controller & 4 L-shaped signal poles
      const approaches: Approach[] = [
        { id: 'N', group: 0, rightOnRedAllowed: Boolean(node.rightOnRed?.N) },
        { id: 'S', group: 0, rightOnRedAllowed: Boolean(node.rightOnRed?.S) },
        { id: 'E', group: 1, rightOnRedAllowed: Boolean(node.rightOnRed?.E) },
        { id: 'W', group: 1, rightOnRedAllowed: Boolean(node.rightOnRed?.W) },
      ];
      const ctl = new SignalController(approaches, undefined, node.signalOffset ?? 0);
      ctl.flashingMode = Boolean(node.flashingYellow);
      const approachHeads = new Map<'N' | 'S' | 'E' | 'W', TrafficLightHead[]>();
      const half = padSize * 0.52;
      // Place 4 poles facing each incoming approach!
      // TrafficLightHead faces local +Z.
      // Approach 'S' = vehicle approaching from South heading North (-Z) -> sees lamp facing +Z (rotY = 0) placed on NE corner (+half, -half) or SE right curb (+half, +half)!
      // In VN, traffic lights sit on the right sidewalk BEFORE the stop line AND across the junction. Putting pole on near-right corner facing approaching traffic:
      const placements: { app: 'N' | 'S' | 'E' | 'W'; px: number; pz: number; rotY: number }[] = [
        { app: 'S', px: node.x + half, pz: node.z + half * 0.85, rotY: 0 }, // Vehicle coming from +Z heading -Z sees +Z
        { app: 'N', px: node.x - half, pz: node.z - half * 0.85, rotY: Math.PI }, // Vehicle coming from -Z heading +Z sees -Z
        { app: 'W', px: node.x - half * 0.85, pz: node.z + half, rotY: -Math.PI / 2 }, // Vehicle coming from -X heading +X sees -X
        { app: 'E', px: node.x + half * 0.85, pz: node.z - half, rotY: Math.PI / 2 }, // Vehicle coming from +X heading -X sees +X
      ];
      const poleGroups: THREE.Group[] = [];
      for (const pl of placements) {
        const pole = makeSignalPole(Math.min(3.8, maxW * 0.28));
        pole.group.position.set(pl.px, 0, pl.pz);
        pole.group.rotation.y = pl.rotY;
        root.add(pole.group);
        poleGroups.push(pole.group);
        approachHeads.set(pl.app, pole.heads);
      }
      signals.push({ node, controller: ctl, approachHeads, poleGroups, stopDistance: padSize * 0.5 + 3.2 });
    }

    // Convex Mirror (gương cầu lồi) at blind T-junctions
    if (node.hasConvexMirror) {
      const mGroup = new THREE.Group();
      mGroup.position.set(node.x - 4.2, 0, node.z - 4.2);
      const mPole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8)), concreteMat);
      mPole.position.y = 1.4;
      mGroup.add(mPole);
      const rim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 20)), new THREE.MeshStandardMaterial({ color: 0xd9480f, roughness: 0.45 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 2.6, 0);
      rim.rotation.z = -Math.PI / 4;
      mGroup.add(rim);
      const dome = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45)), inoxMat);
      dome.rotation.x = Math.PI / 2;
      dome.position.set(0, 2.6, 0.04);
      mGroup.add(dome);
      root.add(mGroup);
    }
  }

  // 4. Build Railway Level Crossing (for highway map)
  let railway: RailwayState | null = null;
  const railEdge = graph.computedEdges.find((ce) => ce.edge.hasRailwayCrossing);
  if (railEdge) {
    const rx = (railEdge.ax + railEdge.bx) * 0.5;
    const rz = (railEdge.az + railEdge.bz) * 0.5;
    const railGroup = new THREE.Group();
    railGroup.position.set(rx, 0, rz);

    // Track bed & steel rails crossing East-West across North-South road
    const ballast = new THREE.Mesh(track(new THREE.BoxGeometry(110, 0.08, 4.4)), new THREE.MeshStandardMaterial({ color: 0x5c5752, roughness: 0.95 }));
    ballast.position.y = 0.02;
    railGroup.add(ballast);
    for (const s of [-0.75, 0.75]) {
      const rail = new THREE.Mesh(track(new THREE.BoxGeometry(110, 0.1, 0.12)), inoxMat);
      rail.position.set(0, 0.07, s);
      railGroup.add(rail);
    }
    for (let x = -52; x <= 52; x += 1.4) {
      const tie = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.07, 2.6)), new THREE.MeshStandardMaterial({ color: 0x4b3c2f, roughness: 0.95 }));
      tie.position.set(x, 0.04, 0);
      railGroup.add(tie);
    }

    // Two animated red-white barrier arms
    const makeGate = (px: number, pz: number, dirX: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, 1.15, pz);
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.35, 1.35, 0.35)), curbPaintedMat);
      post.position.set(px, 0.68, pz);
      railGroup.add(post);
      const bar = new THREE.Mesh(track(new THREE.BoxGeometry(8.5, 0.14, 0.14)), curbPaintedMat);
      bar.position.set(dirX * 4.2, 0, 0);
      pivot.add(bar);
      railGroup.add(pivot);
      return pivot;
    };
    const gateLeft = makeGate(-8.2, 4.6, 1);
    const gateRight = makeGate(8.2, -4.6, -1);

    // Warning lamps
    const lampA = track(new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff1e00, emissiveIntensity: 0 }));
    const lampB = track(new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff1e00, emissiveIntensity: 0 }));
    for (const zSide of [-5.2, 5.2]) {
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8)), darkMetalMat);
      post.position.set(8.6, 1.6, zSide);
      railGroup.add(post);
      const l1 = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 10, 10)), lampA);
      l1.position.set(8.3, 2.8, zSide);
      railGroup.add(l1);
      const l2 = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 10, 10)), lampB);
      l2.position.set(8.9, 2.8, zSide);
      railGroup.add(l2);
    }

    // Stylized Vietnamese Thống Nhất train (locomotive + 3 coaches)
    const trainGroup = new THREE.Group();
    const locoMat = track(new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.45, metalness: 0.3 }));
    const stripeMat = track(new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.45 }));
    for (let c = 0; c < 4; c++) {
      const car = new THREE.Mesh(track(new THREE.BoxGeometry(13.5, 3.3, 2.8)), c === 0 ? locoMat : new THREE.MeshStandardMaterial({ color: 0xd8dee4, roughness: 0.5 }));
      car.position.set(-c * 14.5, 2.0, 0);
      trainGroup.add(car);
      const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(13.55, 0.48, 2.84)), stripeMat);
      stripe.position.set(-c * 14.5, 1.5, 0);
      trainGroup.add(stripe);
    }
    trainGroup.position.set(-70, 0, 0);
    railGroup.add(trainGroup);
    root.add(railGroup);

    railway = {
      x: rx,
      z: rz,
      timer: 14, // train comes soon for training!
      cycle: 34,
      gateClosed: false,
      warningActive: false,
      trainPos: -70,
      gateLeft,
      gateRight,
      trainGroup,
      lampA,
      lampB,
    };
  }

  // 5. Place VN Traffic Signs
  for (const ps of graph.data.signs) {
    const sign = makeSignMesh(ps.code, ps.options);
    sign.position.set(ps.x, 0.16, ps.z);
    sign.rotation.y = ps.rotationY;
    root.add(sign);
  }

  // 6. Iconic Landmarks (skyline orientation in initial camera vista!)
  for (const lm of graph.data.landmarks) {
    if (lm.kind === 'tower') {
      const tower = new THREE.Group();
      tower.position.set(lm.x, 0, lm.z);
      const glassMat = track(new THREE.MeshStandardMaterial({ color: 0x355876, roughness: 0.22, metalness: 0.62, flatShading: true }));
      const podium = new THREE.Mesh(track(new THREE.BoxGeometry(22, 8, 22)), stoneWhiteMat);
      podium.position.y = 4;
      tower.add(podium);
      const base = new THREE.Mesh(track(new THREE.BoxGeometry(18, 46, 18)), glassMat);
      base.position.y = 31;
      tower.add(base);
      // Crisp horizontal concrete floor-band ribs + vertical silver curtain-wall fins
      for (let fy = 12; fy <= 52; fy += 6.5) {
        const band = new THREE.Mesh(track(new THREE.BoxGeometry(18.7, 0.85, 18.7)), stoneWhiteMat);
        band.position.y = fy;
        tower.add(band);
      }
      for (const s of [-5.5, 0, 5.5]) {
        const finX = new THREE.Mesh(track(new THREE.BoxGeometry(0.55, 46, 18.9)), inoxMat);
        finX.position.set(s, 31, 0);
        tower.add(finX);
        const finZ = new THREE.Mesh(track(new THREE.BoxGeometry(18.9, 46, 0.55)), inoxMat);
        finZ.position.set(0, 31, s);
        tower.add(finZ);
      }
      const upper = new THREE.Mesh(track(new THREE.BoxGeometry(13.5, 24, 13.5)), glassMat);
      upper.position.y = 66;
      tower.add(upper);
      const upperBand = new THREE.Mesh(track(new THREE.BoxGeometry(14.2, 1.1, 14.2)), inoxMat);
      upperBand.position.y = 77.5;
      tower.add(upperBand);
      const crown = new THREE.Mesh(track(new THREE.BoxGeometry(8.5, 9, 8.5)), stoneWhiteMat);
      crown.position.y = 82.5;
      tower.add(crown);
      const spire = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 13, 1.1)), inoxMat);
      spire.position.y = 93;
      tower.add(spire);
      const beacon = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.5, 1.5, 1.5)),
        track(new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xef4444, emissiveIntensity: 1.4, flatShading: true })),
      );
      beacon.position.y = 99.8;
      tower.add(beacon);
      const helipadBeam = new THREE.Mesh(track(new THREE.BoxGeometry(9.2, 1.5, 3.4)), darkMetalMat);
      helipadBeam.position.set(6.8, 56.2, 0);
      tower.add(helipadBeam);
      const helipad = new THREE.Mesh(track(new THREE.CylinderGeometry(4.8, 4.8, 0.65, 12)), concreteMat);
      helipad.position.set(10.0, 57.1, 0);
      tower.add(helipad);
      const heliRing = new THREE.Mesh(track(new THREE.CylinderGeometry(3.8, 3.8, 0.14, 12)), flowerGoldMat);
      heliRing.position.set(10.0, 57.48, 0);
      tower.add(heliRing);
      staticRoot.add(tower);
    } else if (lm.kind === 'school') {
      const sc = new THREE.Group();
      sc.position.set(lm.x, 0, lm.z);
      const mainB = new THREE.Mesh(track(new THREE.BoxGeometry(28, 10, 11)), wallMats[0]);
      mainB.position.set(0, 5, -6);
      sc.add(mainB);
      const roof = new THREE.Mesh(track(new THREE.BoxGeometry(29.5, 1.8, 12)), new THREE.MeshStandardMaterial({ color: 0xb3432b, roughness: 0.78 }));
      roof.position.set(0, 10.8, -6);
      sc.add(roof);
      const gateMat = track(new THREE.MeshStandardMaterial({ map: track(shopSignTexture('TRƯỜNG TIỂU HỌC', '#0057a8', '#ffffff', 'CHU VĂN AN')), roughness: 0.5 }));
      const banner = new THREE.Mesh(track(new THREE.BoxGeometry(11, 1.4, 0.3)), gateMat);
      banner.position.set(0, 4.5, 4.5);
      sc.add(banner);
      for (const s of [-5.2, 5.2]) {
        const pillar = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 5.2, 0.9)), wallMats[0]);
        pillar.position.set(s, 2.6, 4.5);
        sc.add(pillar);
      }
      root.add(sc);
    } else if (lm.kind === 'fuel') {
      const st = new THREE.Group();
      st.position.set(lm.x, 0, lm.z);
      const canopy = new THREE.Mesh(track(new THREE.BoxGeometry(16, 0.9, 10)), new THREE.MeshStandardMaterial({ color: 0x0057a8, roughness: 0.45 }));
      canopy.position.set(0, 4.8, 0);
      st.add(canopy);
      const trim = new THREE.Mesh(track(new THREE.BoxGeometry(16.2, 0.3, 10.2)), new THREE.MeshStandardMaterial({ color: 0xf27d0c, roughness: 0.5 }));
      trim.position.set(0, 4.25, 0);
      st.add(trim);
      for (const sx of [-5.5, 5.5]) {
        const p = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 4.5, 0.6)), inoxMat);
        p.position.set(sx, 2.25, 0);
        st.add(p);
      }
      root.add(st);
    } else if (lm.kind === 'gate') {
      const gt = new THREE.Group();
      gt.position.set(lm.x, 0, lm.z);
      const wall = new THREE.Mesh(track(new THREE.BoxGeometry(16, 7.5, 4.2)), new THREE.MeshStandardMaterial({ color: 0xc9b489, roughness: 0.9 }));
      wall.position.y = 3.75;
      gt.add(wall);
      const roof = new THREE.Mesh(track(new THREE.BoxGeometry(11, 2.2, 4.8)), new THREE.MeshStandardMaterial({ color: 0x8b3a2b, roughness: 0.85 }));
      roof.position.y = 8.4;
      gt.add(roof);
      root.add(gt);
    }
  }

  // 6b. 360° Distant Vietnamese City Skyline & Tropical Horizon Hills Ring (1 SINGLE merged draw call!)
  // Eliminates empty horizon voids at the end of every avenue while blending seamlessly into atmospheric fog.
  {
    const skylineParts: THREE.BufferGeometry[] = [];
    const skyColor = new THREE.Color();
    const pushColoredBox = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number, rotY = 0) => {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      if (rotY !== 0) g.rotateY(rotY);
      g.translate(x, y, z);
      g.computeVertexNormals();
      const count = g.attributes.position.count;
      skyColor.setHex(hex);
      const arr = new Float32Array(count * 3);
      for (let k = 0; k < count; k++) {
        arr[k * 3] = skyColor.r;
        arr[k * 3 + 1] = skyColor.g;
        arr[k * 3 + 2] = skyColor.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      skylineParts.push(g);
    };

    const mapCx = (b.minX + b.maxX) * 0.5;
    const mapCz = (b.minZ + b.maxZ) * 0.5;
    const mapHalfR = Math.max((b.maxX - b.minX) * 0.5, (b.maxZ - b.minZ) * 0.5);
    const innerRingR = mapHalfR + 28;
    const towerPal = [0x859ab0, 0x6f89a4, 0xa2b1c0, 0xc7bba2, 0x5c7794, 0x95a5b5, 0xb5a894];
    const windowBandPal = [0x354d66, 0x283e54, 0x425b73];
    const hillPal = [0x4f7448, 0x43663e, 0x5b7e52];

    // Inner & mid-distance Vietnamese high-rise apartment clusters (chung cư) + stepped office towers
    const towerCount = graph.data.id === 'highway' ? 36 : 64;
    for (let i = 0; i < towerCount; i++) {
      const ang = (i / towerCount) * Math.PI * 2 + (rand() - 0.5) * 0.07;
      // Boost height along the 4 cardinal avenue axes so looking straight down any boulevard frames a dramatic skyline!
      const cardinalBoost = Math.pow(Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))), 6);
      const dist = innerRingR + (i % 3) * 34 + rand() * 30;
      const tx = mapCx + Math.cos(ang) * dist;
      const tz = mapCz + Math.sin(ang) * dist;
      const tw = 16 + rand() * 20;
      const td = 15 + rand() * 16;
      const th = (i % 4 === 0 ? 54 : 30) + rand() * (i % 4 === 0 ? 44 : 34) + cardinalBoost * 24;
      const bodyHex = towerPal[Math.floor(rand() * towerPal.length)];
      const bandHex = windowBandPal[Math.floor(rand() * windowBandPal.length)];
      const rotY = ang + (rand() - 0.5) * 0.35;

      pushColoredBox(tw, th, td, tx, th * 0.5 - 0.14, tz, bodyHex, rotY);
      // 3 crisp horizontal banded glass stories so distant buildings read as rich modern towers
      pushColoredBox(tw + 0.55, th * 0.12, td + 0.55, tx, th * 0.34, tz, bandHex, rotY);
      pushColoredBox(tw + 0.55, th * 0.12, td + 0.55, tx, th * 0.60, tz, bandHex, rotY);
      pushColoredBox(tw + 0.55, th * 0.12, td + 0.55, tx, th * 0.84, tz, bandHex, rotY);
      // Stepped penthouse crown on taller towers + red-white telecom mast on landmarks
      if (th > 46) {
        const cw = tw * 0.60;
        const cd = td * 0.60;
        const ch = 7 + rand() * 11;
        pushColoredBox(cw, ch, cd, tx, th + ch * 0.5 - 0.14, tz, 0xd8dee6, rotY);
        if (i % 6 === 0) {
          pushColoredBox(1.5, 16, 1.5, tx, th + ch + 7.6, tz, 0xd4382c, 0);
        }
      }
    }

    // Outer rolling blocky tropical horizon hills ring so every vista feels expansive & grounded
    const hillCount = 24;
    const hillRingR = mapHalfR + 175;
    for (let i = 0; i < hillCount; i++) {
      const ang = (i / hillCount) * Math.PI * 2 + (rand() - 0.5) * 0.1;
      const dist = hillRingR + rand() * 48;
      const hx = mapCx + Math.cos(ang) * dist;
      const hz = mapCz + Math.sin(ang) * dist;
      const hw = 64 + rand() * 56;
      const hd = 34 + rand() * 28;
      const hh = 16 + rand() * 24;
      const hHex = hillPal[i % hillPal.length];
      pushColoredBox(hw, hh, hd, hx, hh * 0.5 - 0.2, hz, hHex, ang + Math.PI / 2);
      pushColoredBox(hw * 0.6, hh * 0.48, hd * 0.68, hx, hh + hh * 0.22 - 0.2, hz, 0x678a5e, ang + Math.PI / 2);
    }

    const skylineGeo = track(mergeGeometries(skylineParts, false));
    for (const g of skylineParts) g.dispose();
    if (skylineGeo) {
      skylineGeo.computeBoundingSphere();
      const skylineMat = track(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.9,
          metalness: 0.08,
          flatShading: true,
          fog: true,
        }),
      );
      const skylineMesh = new THREE.Mesh(skylineGeo, skylineMat);
      skylineMesh.castShadow = false;
      skylineMesh.receiveShadow = false;
      root.add(skylineMesh);
    }
  }

  // 7. Instanced Ultra-Detailed Blocky Voxel Vietnamese Street Props
  // 4-Tier Stepped Voxel Street Trees with Square Brick Pit + Whitewashed Trunk + Y-Branches + Flowering Flamboyant/Golden Canopies!
  if (treeMatrices.length) {
    const pitGeo = track(new THREE.BoxGeometry(1.18, 0.16, 1.18));
    pitGeo.translate(0, 0.08, 0);
    const pitMat = track(new THREE.MeshStandardMaterial({ color: 0x6b6d6e, roughness: 0.92, flatShading: true }));

    const whiteTrunkGeo = track(new THREE.BoxGeometry(0.36, 1.25, 0.36));
    whiteTrunkGeo.translate(0, 0.72, 0);
    const whiteTrunkMat = track(new THREE.MeshStandardMaterial({ color: 0xecebe4, roughness: 0.9, flatShading: true }));

    // Upper trunk + 2 angled woody Y-branches merged into 1 geometry (0 extra draw calls!)
    const tMain = new THREE.BoxGeometry(0.28, 2.05, 0.28).toNonIndexed();
    tMain.translate(0, 2.34, 0);
    const tBrL = new THREE.BoxGeometry(0.16, 1.12, 0.16).toNonIndexed();
    tBrL.rotateZ(0.55);
    tBrL.translate(-0.42, 3.05, 0.18);
    const tBrR = new THREE.BoxGeometry(0.16, 1.05, 0.16).toNonIndexed();
    tBrR.rotateZ(-0.52);
    tBrR.rotateY(0.45);
    tBrR.translate(0.38, 3.12, -0.16);
    const upperTrunkGeo = track(mergeGeometries([tMain, tBrL, tBrR], false));
    tMain.dispose();
    tBrL.dispose();
    tBrR.dispose();
    const upperTrunkMat = track(new THREE.MeshStandardMaterial({ color: 0x4f3929, roughness: 0.94, flatShading: true }));

    // 4-Tier Stepped Blocky Voxel Foliage Cubes (rich sunlit top vs shaded lower base!)
    const crownBaseGeo = track(new THREE.BoxGeometry(2.62, 1.18, 2.62));
    crownBaseGeo.translate(0, 3.68, 0);
    const crownMidGeo = track(new THREE.BoxGeometry(2.12, 1.08, 2.12));
    crownMidGeo.translate(0.18, 4.52, -0.14);
    const crownTopGeo = track(new THREE.BoxGeometry(1.38, 0.85, 1.38));
    crownTopGeo.translate(-0.12, 5.32, 0.10);
    const crownSideGeo = track(new THREE.BoxGeometry(1.32, 0.95, 1.32));
    crownSideGeo.translate(-0.94, 3.96, 0.58);

    const crownMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, flatShading: true }));

    const iPit = new THREE.InstancedMesh(pitGeo, pitMat, treeMatrices.length);
    const iWhite = new THREE.InstancedMesh(whiteTrunkGeo, whiteTrunkMat, treeMatrices.length);
    const iUpper = new THREE.InstancedMesh(upperTrunkGeo, upperTrunkMat, treeMatrices.length);
    const iBase = new THREE.InstancedMesh(crownBaseGeo, crownMat, treeMatrices.length);
    const iMid = new THREE.InstancedMesh(crownMidGeo, crownMat, treeMatrices.length);
    const iTop = new THREE.InstancedMesh(crownTopGeo, crownMat, treeMatrices.length);
    const iSide = new THREE.InstancedMesh(crownSideGeo, crownMat, treeMatrices.length);
    iBase.castShadow = castShadows;
    iMid.castShadow = castShadows;
    shadowCasters.push(iBase, iMid);

    const tint = new THREE.Color();
    treeMatrices.forEach((m, i) => {
      iPit.setMatrixAt(i, m);
      iWhite.setMatrixAt(i, m);
      iUpper.setMatrixAt(i, m);
      iBase.setMatrixAt(i, m);
      iMid.setMatrixAt(i, m);
      iTop.setMatrixAt(i, m);
      iSide.setMatrixAt(i, m);

      const bloomRoll = rand();
      if (bloomRoll < 0.11) {
        // Iconic Vietnamese Hoa Phượng Đỏ (Crimson Flamboyant tree!)
        tint.setHSL(0.28, 0.42, 0.22);
        iBase.setColorAt(i, tint);
        tint.setHSL(0.015, 0.78, 0.42);
        iMid.setColorAt(i, tint);
        tint.setHSL(0.025, 0.86, 0.50);
        iTop.setColorAt(i, tint);
        tint.setHSL(0.01, 0.74, 0.44);
        iSide.setColorAt(i, tint);
      } else if (bloomRoll < 0.19) {
        // Iconic Vietnamese Muồng Hoàng Yến (Golden Shower tree!)
        tint.setHSL(0.29, 0.44, 0.24);
        iBase.setColorAt(i, tint);
        tint.setHSL(0.125, 0.82, 0.48);
        iMid.setColorAt(i, tint);
        tint.setHSL(0.132, 0.88, 0.56);
        iTop.setColorAt(i, tint);
        tint.setHSL(0.12, 0.78, 0.46);
        iSide.setColorAt(i, tint);
      } else {
        const hue = 0.29 + (rand() - 0.5) * 0.045;
        const sat = 0.46 + (rand() - 0.5) * 0.08;
        tint.setHSL(hue, sat, 0.22 + (rand() - 0.5) * 0.03);
        iBase.setColorAt(i, tint);
        tint.setHSL(hue + 0.008, sat + 0.05, 0.30 + (rand() - 0.5) * 0.03);
        iMid.setColorAt(i, tint);
        tint.setHSL(hue + 0.016, sat + 0.07, 0.38 + (rand() - 0.5) * 0.03);
        iTop.setColorAt(i, tint);
        tint.setHSL(hue - 0.006, sat, 0.26 + (rand() - 0.5) * 0.03);
        iSide.setColorAt(i, tint);
      }
    });
    for (const im of [iPit, iWhite, iUpper, iBase, iMid, iTop, iSide]) im.computeBoundingSphere();
    root.add(iPit, iWhite, iUpper, iBase, iMid, iTop, iSide);
  }

  // Helper to bake vertex-colored blocky geometries into a single InstancedMesh (massive draw-call savings!)
  const bakeColoredBoxList = (
    items: { w: number; h: number; d: number; x: number; y: number; z: number; hex: number; rx?: number; ry?: number; rz?: number }[],
  ): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const col = new THREE.Color();
    for (const it of items) {
      const g = new THREE.BoxGeometry(it.w, it.h, it.d).toNonIndexed();
      if (it.rx) g.rotateX(it.rx);
      if (it.ry) g.rotateY(it.ry);
      if (it.rz) g.rotateZ(it.rz);
      g.translate(it.x, it.y, it.z);
      g.computeVertexNormals();
      const n = g.attributes.position.count;
      col.setHex(it.hex);
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        arr[k * 3] = col.r;
        arr[k * 3 + 1] = col.g;
        arr[k * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      parts.push(g);
    }
    const merged = track(mergeGeometries(parts, false));
    for (const g of parts) g.dispose();
    return merged;
  };
  const vtxPropMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.14, flatShading: true }));

  // Blocky Concrete Utility Poles + Crossarm + Meter Box + Arched Cobra-Head Street Lamp Arm (1 SINGLE InstancedMesh — saves 2 DC!)
  if (poleMatrices.length) {
    const poleGeo = bakeColoredBoxList([
      { w: 0.25, h: 7.2, d: 0.25, x: 0, y: 3.6, z: 0, hex: 0x868c92 }, // Square concrete pole
      { w: 0.34, h: 0.45, d: 0.34, x: 0, y: 0.22, z: 0, hex: 0x6f757b }, // Concrete base collar
      { w: 1.38, h: 0.14, d: 0.14, x: 0, y: 6.42, z: 0, hex: 0x252b33 }, // Top steel crossarm
      { w: 0.38, h: 0.54, d: 0.24, x: 0, y: 1.85, z: 0.18, hex: 0xcbd0d6 }, // Electrical meter box
      { w: 0.08, h: 0.10, d: 1.55, x: -0.78, y: 6.86, z: 0, hex: 0x9aa4ae, ry: Math.PI / 2, rx: -0.22 }, // Swept cobra-head street lamp arm
      { w: 0.56, h: 0.16, d: 0.28, x: -1.52, y: 7.08, z: 0, hex: 0x353c45 }, // Cobra-head luminaire hood
      { w: 0.44, h: 0.06, d: 0.22, x: -1.52, y: 6.97, z: 0, hex: 0xf7e7be }, // Luminaire diffuser lens
    ]);
    const iPole = new THREE.InstancedMesh(poleGeo, vtxPropMat, poleMatrices.length);
    poleMatrices.forEach((m, i) => iPole.setMatrixAt(i, m));
    iPole.computeBoundingSphere();
    root.add(iPole);
  }

  // Boulevard Median Flowering Bougainvillea Shrubs (1 InstancedMesh — lean 3-box silhouette)
  if (medianHedgeMatrices.length) {
    const hedgeGeo = bakeColoredBoxList([
      { w: 0.72, h: 0.40, d: 0.96, x: 0, y: 0.20, z: 0, hex: 0x2e6632 },
      { w: 0.56, h: 0.24, d: 0.68, x: 0.03, y: 0.46, z: 0.04, hex: 0x3b7d3c },
      { w: 0.34, h: 0.16, d: 0.38, x: -0.06, y: 0.58, z: 0.08, hex: 0xd9366a }, // Bougainvillea magenta-red bloom crown
    ]);
    const iHedge = new THREE.InstancedMesh(hedgeGeo, vtxPropMat, medianHedgeMatrices.length);
    medianHedgeMatrices.forEach((m, i) => iHedge.setMatrixAt(i, m));
    iHedge.computeBoundingSphere();
    root.add(iHedge);
  }

  // Sidewalk Quán Cóc Plastic Tables with Trà Đá Pitchers (1 InstancedMesh)
  if (cafeTableMatrices.length) {
    const tableGeo = bakeColoredBoxList([
      { w: 0.58, h: 0.06, d: 0.46, x: 0, y: 0.52, z: 0, hex: 0x2268b8 }, // Blue plastic table top
      { w: 0.06, h: 0.50, d: 0.06, x: -0.24, y: 0.25, z: -0.18, hex: 0x1b5294 },
      { w: 0.06, h: 0.50, d: 0.06, x: 0.24, y: 0.25, z: -0.18, hex: 0x1b5294 },
      { w: 0.06, h: 0.50, d: 0.06, x: -0.24, y: 0.25, z: 0.18, hex: 0x1b5294 },
      { w: 0.06, h: 0.50, d: 0.06, x: 0.24, y: 0.25, z: 0.18, hex: 0x1b5294 },
      { w: 0.12, h: 0.16, d: 0.12, x: -0.10, y: 0.63, z: 0.04, hex: 0xe6a122 }, // Iced tea pitcher
      { w: 0.08, h: 0.09, d: 0.08, x: 0.12, y: 0.59, z: -0.05, hex: 0xe8eef4 }, // Glass cup
    ]);
    const iTable = new THREE.InstancedMesh(tableGeo, vtxPropMat, cafeTableMatrices.length);
    cafeTableMatrices.forEach((m, i) => iTable.setMatrixAt(i, m));
    iTable.computeBoundingSphere();
    root.add(iTable);
  }

  // Iconic Vietnamese Green Public Trash Bins (1 InstancedMesh)
  if (trashBinMatrices.length) {
    const binGeo = bakeColoredBoxList([
      { w: 0.42, h: 0.72, d: 0.36, x: 0, y: 0.36, z: 0, hex: 0x1f8a4c }, // Green body
      { w: 0.46, h: 0.14, d: 0.40, x: 0, y: 0.78, z: 0, hex: 0xf0b924 }, // Yellow flip lid
      { w: 0.26, h: 0.14, d: 0.06, x: 0, y: 0.64, z: 0.17, hex: 0x14201a }, // Throw slot
    ]);
    const iBin = new THREE.InstancedMesh(binGeo, vtxPropMat, trashBinMatrices.length);
    trashBinMatrices.forEach((m, i) => iBin.setMatrixAt(i, m));
    iBin.computeBoundingSphere();
    root.add(iBin);
  }

  // Overhead Power Cables (dây điện chằng chịt kiểu VN!)
  if (cablePairs.length) {
    const positions: number[] = [];
    for (const [a, b] of cablePairs) {
      for (const strand of [-0.36, 0, 0.36]) {
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps;
          const t1 = (i + 1) / steps;
          const sag0 = Math.sin(t0 * Math.PI) * (0.48 + Math.abs(strand) * 0.3);
          const sag1 = Math.sin(t1 * Math.PI) * (0.48 + Math.abs(strand) * 0.3);
          positions.push(
            THREE.MathUtils.lerp(a.x, b.x, t0) + strand * 0.4,
            THREE.MathUtils.lerp(a.y, b.y, t0) - sag0,
            THREE.MathUtils.lerp(a.z, b.z, t0) + strand * 0.4,
            THREE.MathUtils.lerp(a.x, b.x, t1) + strand * 0.4,
            THREE.MathUtils.lerp(a.y, b.y, t1) - sag1,
            THREE.MathUtils.lerp(a.z, b.z, t1) + strand * 0.4,
          );
        }
      }
    }
    const wireGeo = track(new THREE.BufferGeometry());
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const wireMat = track(new THREE.LineBasicMaterial({ color: 0x16191f }));
    root.add(new THREE.LineSegments(wireGeo, wireMat));
  }

  // Street Lamps (batched bulbs + max 5 actual PointLights for performance)
  const lampBulbMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf7e7be,
      emissive: 0xffcc66,
      emissiveIntensity: timeOfDay === 'night' ? 2.4 : 0.0,
      flatShading: true,
    }),
  );
  streetLampBulbs.push(lampBulbMat);
  lampPositions.forEach((pos, idx) => {
    const bulb = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.16, 0.26)), lampBulbMat);
    bulb.position.copy(pos);
    staticRoot.add(bulb);
    if (idx < 5) {
      const pl = new THREE.PointLight(0xffcb78, timeOfDay === 'night' ? 16 : 0, 26, 1.5);
      pl.position.set(pos.x, pos.y - 0.3, pos.z);
      root.add(pl);
      streetLampLights.push(pl);
    }
  });

  // Crisp Blocky Plastic Stools (ghế nhựa đỏ/xanh quán cóc)
  const stoolGeo = track(new THREE.BoxGeometry(0.32, 0.36, 0.32));
  stoolGeo.translate(0, 0.18, 0);
  if (stoolRedMatrices.length) {
    const im = new THREE.InstancedMesh(stoolGeo, track(new THREE.MeshStandardMaterial({ color: 0xc9251e, roughness: 0.45, flatShading: true })), stoolRedMatrices.length);
    stoolRedMatrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    root.add(im);
  }
  if (stoolBlueMatrices.length) {
    const im = new THREE.InstancedMesh(stoolGeo, track(new THREE.MeshStandardMaterial({ color: 0x1961b5, roughness: 0.45, flatShading: true })), stoolBlueMatrices.length);
    stoolBlueMatrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    root.add(im);
  }

  // Detailed Blocky Parked Motorbikes on Sidewalk (painted fairing + detailed vertex-colored wheels/rims/exhaust/seat/mirrors!)
  if (parkedBikeMatrices.length) {
    const pBodyParts: THREE.BufferGeometry[] = [];
    const pbFront = new THREE.BoxGeometry(0.40, 0.42, 0.22);
    pbFront.rotateX(-0.24);
    pbFront.translate(0, 0.68, 0.44);
    const pbFender = new THREE.BoxGeometry(0.18, 0.08, 0.40);
    pbFender.translate(0, 0.48, 0.56);
    const pbRear = new THREE.BoxGeometry(0.36, 0.28, 0.78);
    pbRear.translate(0, 0.64, -0.26);
    const pbHead = new THREE.BoxGeometry(0.34, 0.15, 0.22);
    pbHead.translate(0, 1.00, 0.48);
    pBodyParts.push(pbFront.toNonIndexed(), pbFender.toNonIndexed(), pbRear.toNonIndexed(), pbHead.toNonIndexed());
    pbFront.dispose();
    pbFender.dispose();
    pbRear.dispose();
    pbHead.dispose();
    const bodyGeo = track(mergeGeometries(pBodyParts, false));
    pBodyParts.forEach((p) => p.dispose());

    const mergedTrim = bakeColoredBoxList([
      // Front & rear tires + bright alloy hub centers
      { w: 0.11, h: 0.48, d: 0.48, x: 0, y: 0.24, z: 0.56, hex: 0x181c22 },
      { w: 0.13, h: 0.26, d: 0.26, x: 0, y: 0.24, z: 0.56, hex: 0xbac4ce },
      { w: 0.12, h: 0.48, d: 0.48, x: 0, y: 0.24, z: -0.56, hex: 0x181c22 },
      { w: 0.14, h: 0.26, d: 0.26, x: 0, y: 0.24, z: -0.56, hex: 0xbac4ce },
      // Front forks + footboard + engine block + silver exhaust muffler
      { w: 0.20, h: 0.52, d: 0.08, x: 0, y: 0.48, z: 0.54, hex: 0x9ca6b0, rx: 0.24 },
      { w: 0.36, h: 0.08, d: 0.44, x: 0, y: 0.36, z: 0.12, hex: 0x22262c },
      { w: 0.24, h: 0.22, d: 0.36, x: 0, y: 0.36, z: -0.18, hex: 0x5c646e },
      { w: 0.09, h: 0.11, d: 0.62, x: -0.19, y: 0.32, z: -0.44, hex: 0xc2cbd4, rx: -0.14 },
      // Contoured dark leather seat + chrome rear grab rail + handlebar + mirrors + headlight/taillight
      { w: 0.32, h: 0.13, d: 0.68, x: 0, y: 0.82, z: -0.22, hex: 0x1e2228 },
      { w: 0.30, h: 0.05, d: 0.14, x: 0, y: 0.84, z: -0.64, hex: 0xd0d8e0 },
      { w: 0.64, h: 0.05, d: 0.05, x: 0, y: 1.00, z: 0.42, hex: 0x1c2026 },
      { w: 0.11, h: 0.07, d: 0.04, x: 0.28, y: 1.16, z: 0.42, hex: 0x1c2026 },
      { w: 0.11, h: 0.07, d: 0.04, x: -0.28, y: 1.16, z: 0.42, hex: 0x1c2026 },
      { w: 0.18, h: 0.09, d: 0.04, x: 0, y: 1.00, z: 0.60, hex: 0xf4f0d8 },
      { w: 0.18, h: 0.09, d: 0.04, x: 0, y: 0.72, z: -0.66, hex: 0xc9221d },
    ]);

    const imBody = new THREE.InstancedMesh(bodyGeo, track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.24, flatShading: true })), parkedBikeMatrices.length);
    const imTrim = new THREE.InstancedMesh(mergedTrim, vtxPropMat, parkedBikeMatrices.length);
    const bikeColors = [0xb31e1e, 0x1a3e78, 0x242930, 0xe2dfd6, 0x1b633c];
    const col = new THREE.Color();
    parkedBikeMatrices.forEach((m, i) => {
      imBody.setMatrixAt(i, m);
      imTrim.setMatrixAt(i, m);
      col.setHex(bikeColors[i % bikeColors.length]);
      imBody.setColorAt(i, col);
    });
    imBody.computeBoundingSphere();
    imTrim.computeBoundingSphere();
    root.add(imBody, imTrim);
  }

  // AC Outdoor Units (with crisp non-coplanar recessed fan grille!) & Rooftop Inox Water Tanks
  if (acMatrices.length) {
    const acGeo = track(new THREE.BoxGeometry(0.76, 0.54, 0.34));
    const fanGeo = track(new THREE.BoxGeometry(0.38, 0.38, 0.05));
    fanGeo.translate(-0.12, 0, 0.185);
    const im = new THREE.InstancedMesh(acGeo, track(new THREE.MeshStandardMaterial({ color: 0xdad7cf, roughness: 0.6, flatShading: true })), acMatrices.length);
    const imFan = new THREE.InstancedMesh(fanGeo, darkMetalMat, acMatrices.length);
    acMatrices.forEach((m, i) => {
      im.setMatrixAt(i, m);
      imFan.setMatrixAt(i, m);
    });
    im.computeBoundingSphere();
    imFan.computeBoundingSphere();
    root.add(im, imFan);
  }
  if (tankMatrices.length) {
    const tGeo = track(new THREE.CylinderGeometry(0.52, 0.52, 1.58, 10));
    const im = new THREE.InstancedMesh(tGeo, inoxMat, tankMatrices.length);
    tankMatrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    root.add(im);
  }

  // Manholes & Potholes (with polygonOffset so zero Z-fighting against asphalt!)
  if (manholeMatrices.length) {
    const mGeo = track(new THREE.CircleGeometry(0.36, 12));
    const mMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x22272e,
        roughness: 0.52,
        metalness: 0.55,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const im = new THREE.InstancedMesh(mGeo, mMat, manholeMatrices.length);
    manholeMatrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    root.add(im);
  }
  if (potholeMatrices.length) {
    const pGeo = track(new THREE.CircleGeometry(0.45, 9));
    const pMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1c1f24,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const im = new THREE.InstancedMesh(pGeo, pMat, potholeMatrices.length);
    potholeMatrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    root.add(im);
  }

  // PRO OPTIMIZATION: Merge all static roads, markings, sidewalks, curbs & tube-houses by material!
  // Slashes static world draw calls from ~1,200+ down to ~35 draw calls!
  const mergedMeshes = mergeStaticGroupByMaterial(staticRoot, disposables);
  for (const mm of mergedMeshes) {
    if (mm.castShadow) shadowCasters.push(mm);
    root.add(mm);
  }

  // 8. Rain Particle System (allocated once, toggled visible when weather === 'rain')
  const rainCount = castShadows ? 1800 : 750;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 70;
    rainPos[i * 3 + 1] = Math.random() * 26;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = track(new THREE.PointsMaterial({ color: 0xc9d7e3, size: 0.16, transparent: true, opacity: 0.65 }));
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = weather === 'rain';
  rainPoints.frustumCulled = false;
  root.add(rainPoints);

  // 9. Living Vietnamese Sky & Street Atmosphere (only 3 extra draw calls total!)
  // 9a. Crisp Sunlit Multi-Tier Blocky Sky Clouds (1 merged draw call — guaranteed horizon ring + overhead!)
  const cloudsGroup = new THREE.Group();
  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      color: timeOfDay === 'night' ? 0x1f2b3d : timeOfDay === 'afternoon' ? 0xf8e2c8 : 0xffffff,
      emissive: timeOfDay === 'night' ? 0x0b1220 : timeOfDay === 'afternoon' ? 0xf5d4b0 : 0xffffff,
      emissiveIntensity: timeOfDay === 'night' ? 0.08 : 0.48,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
      fog: false,
    }),
  );
  const cloudParts: THREE.BufferGeometry[] = [];
  const cloudCenterX = (b.minX + b.maxX) * 0.5;
  const cloudCenterZ = (b.minZ + b.maxZ) * 0.5;
  // 24 high-altitude horizon skyline clouds cleanly above skyscraper spires + 12 overhead clouds!
  for (let i = 0; i < 36; i++) {
    let cx: number;
    let cy: number;
    let cz: number;
    if (i < 24) {
      const ang = (i / 24) * Math.PI * 2 + (rand() - 0.5) * 0.15;
      const rad = 195 + (i % 3) * 58 + rand() * 44;
      cx = cloudCenterX + Math.cos(ang) * rad;
      cz = cloudCenterZ + Math.sin(ang) * rad;
      cy = 62 + (i % 3) * 9 + rand() * 10;
    } else {
      cx = cloudCenterX + (rand() - 0.5) * 340;
      cz = cloudCenterZ + (rand() - 0.5) * 340;
      cy = 72 + rand() * 18;
    }
    const mainW = 24 + rand() * 24;
    const mainD = 12 + rand() * 12;
    const mainH = 3.6 + rand() * 2.6;
    const g1 = new THREE.BoxGeometry(mainW, mainH, mainD).toNonIndexed();
    g1.translate(cx, cy, cz);
    const g2 = new THREE.BoxGeometry(mainW * 0.62, mainH * 0.88, mainD * 0.74).toNonIndexed();
    g2.translate(cx + (rand() - 0.5) * mainW * 0.32, cy + mainH * 0.68, cz + (rand() - 0.5) * 2.4);
    const g3 = new THREE.BoxGeometry(mainW * 0.44, mainH * 0.65, mainD * 0.66).toNonIndexed();
    g3.translate(cx - mainW * 0.34, cy - mainH * 0.1, cz + mainD * 0.2);
    const g4 = new THREE.BoxGeometry(mainW * 0.36, mainH * 0.55, mainD * 0.58).toNonIndexed();
    g4.translate(cx + mainW * 0.35, cy + mainH * 0.15, cz - mainD * 0.18);
    cloudParts.push(g1, g2, g3, g4);
  }
  const mergedClouds = track(mergeGeometries(cloudParts, false));
  for (const g of cloudParts) g.dispose();
  if (mergedClouds) {
    mergedClouds.computeBoundingSphere();
    const cloudsMesh = new THREE.Mesh(mergedClouds, cloudMat);
    cloudsMesh.frustumCulled = false;
    cloudsGroup.add(cloudsMesh);
  }
  root.add(cloudsGroup);

  // 9b. Circling Flock of Crisp Blocky City Swallows/Pigeons (1 single InstancedMesh draw call!)
  const birdParts: THREE.BufferGeometry[] = [];
  const bBody = new THREE.BoxGeometry(0.18, 0.12, 0.48).toNonIndexed();
  const bWingL = new THREE.BoxGeometry(0.62, 0.05, 0.22).toNonIndexed();
  bWingL.translate(-0.34, 0.03, 0);
  const bWingR = new THREE.BoxGeometry(0.62, 0.05, 0.22).toNonIndexed();
  bWingR.translate(0.34, 0.03, 0);
  birdParts.push(bBody, bWingL, bWingR);
  const birdGeo = track(mergeGeometries(birdParts, false));
  for (const g of birdParts) g.dispose();
  const birdMat = track(new THREE.MeshStandardMaterial({ color: 0x26303d, roughness: 0.75, flatShading: true }));
  const birdCount = 16;
  const birdsMesh = new THREE.InstancedMesh(birdGeo, birdMat, birdCount);
  birdsMesh.frustumCulled = false;
  const birdSeeds: LivingWorldRefs['birdSeeds'] = [];
  for (let i = 0; i < birdCount; i++) {
    birdSeeds.push({
      cx: (rand() - 0.5) * 140,
      cz: (rand() - 0.5) * 140,
      radius: 18 + rand() * 34,
      height: 22 + rand() * 18,
      speed: 0.28 + rand() * 0.22,
      phase: rand() * Math.PI * 2,
    });
  }
  root.add(birdsMesh);

  // 9c. Waving Vietnamese Red-Star Balcony Flags (1 single InstancedMesh draw call!)
  let flagsMesh: THREE.InstancedMesh | null = null;
  if (flagMatrices.length > 0) {
    const fParts: THREE.BufferGeometry[] = [];
    const poleG = new THREE.BoxGeometry(0.05, 1.45, 0.05).toNonIndexed();
    poleG.translate(0, 0.72, 0);
    const clothG = new THREE.BoxGeometry(0.04, 0.62, 0.92).toNonIndexed();
    clothG.translate(0, 1.08, 0.48);
    const starG = new THREE.BoxGeometry(0.06, 0.22, 0.22).toNonIndexed();
    starG.translate(0, 1.08, 0.48);
    const colorize = (g: THREE.BufferGeometry, hex: number) => {
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        arr[k * 3] = c.r;
        arr[k * 3 + 1] = c.g;
        arr[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    };
    fParts.push(colorize(poleG, 0xd8dee6), colorize(clothG, 0xd41c24), colorize(starG, 0xffd000));
    const flagGeo = track(mergeGeometries(fParts, false));
    for (const g of fParts) g.dispose();
    const flagMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, flatShading: true }));
    flagsMesh = new THREE.InstancedMesh(flagGeo, flagMat, flagMatrices.length);
    flagMatrices.forEach((m, i) => flagsMesh!.setMatrixAt(i, m));
    flagsMesh.computeBoundingSphere();
    root.add(flagsMesh);
  }

  const living: LivingWorldRefs = {
    cloudsGroup,
    cloudMat,
    birdsMesh,
    birdSeeds,
    flagsMesh,
    flagBaseMatrices: flagMatrices,
  };

  // 10. Scenario Waypoint Marker
  const waypointMarker = new THREE.Group();
  waypointMarker.visible = false;
  const ringMat = track(new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide }));
  const targetRing = new THREE.Mesh(track(new THREE.RingGeometry(2.2, 2.8, 28)), ringMat);
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 0.08;
  waypointMarker.add(targetRing);
  const beaconPole = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 10)),
    track(new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.42 })),
  );
  beaconPole.position.y = 2.8;
  waypointMarker.add(beaconPole);
  root.add(waypointMarker);

  return {
    root,
    signals,
    crosswalks,
    railway,
    rainPoints,
    living,
    asphaltMaterials,
    windowMaterials,
    streetLampBulbs,
    streetLampLights,
    textures,
    shadowCasters,
    waypointMarker,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * Batch-merge all static Mesh descendants by (material, castShadow, receiveShadow).
 * Normalizes attributes (non-indexed, position + normal + uv) so mergeGeometries succeeds 100% of the time.
 */
function mergeStaticGroupByMaterial(group: THREE.Group, disposables: { dispose: () => void }[]): THREE.Mesh[] {
  group.updateMatrixWorld(true);
  const buckets = new Map<
    string,
    { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; geos: THREE.BufferGeometry[] }
  >();

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (!mat) return;
    const key = `${mat.uuid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: mat, castShadow: obj.castShadow, receiveShadow: obj.receiveShadow, geos: [] };
      buckets.set(key, bucket);
    }

    const raw = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    raw.applyMatrix4(obj.matrixWorld);
    if (!raw.attributes.normal) raw.computeVertexNormals();
    const posCount = raw.attributes.position.count;
    if (!raw.attributes.uv) {
      raw.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2));
    }
    // Strip any extra mismatched attributes so mergeGeometries never rejects a pair
    for (const attrName of Object.keys(raw.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        raw.deleteAttribute(attrName);
      }
    }
    bucket.geos.push(raw);
  });

  const result: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    if (!b.geos.length) continue;
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    disposables.push(merged);
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = b.receiveShadow;
    result.push(mesh);
  }
  return result;
}

function isNearAnyRoad(x: number, z: number, graph: RoadGraph, excludeId: string, margin: number): boolean {
  for (const ce of graph.computedEdges) {
    if (ce.edge.id === excludeId) continue;
    const px = x - ce.ax;
    const pz = z - ce.az;
    const along = Math.max(0, Math.min(ce.length, px * ce.dx + pz * ce.dz));
    const cx = ce.ax + ce.dx * along;
    const cz = ce.az + ce.dz * along;
    const d = Math.hypot(x - cx, z - cz);
    if (d < ce.totalWidth * 0.5 + ce.edge.sidewalkWidth + margin) return true;
  }
  for (const n of graph.data.nodes) {
    const r = n.kind === 'roundabout' ? (n.roundaboutRadius ?? 20) + 14 : 16;
    if (Math.hypot(x - n.x, z - n.z) < r + margin * 0.5) return true;
  }
  return false;
}

/** Advance railway gates & passing train. */
export function updateRailway(rail: RailwayState, dt: number) {
  rail.timer = (rail.timer + dt) % rail.cycle;
  // Warning starts at t=14s, gate closes 16..28s, train passes 18..26s
  rail.warningActive = rail.timer >= 14 && rail.timer <= 29;
  rail.gateClosed = rail.timer >= 16 && rail.timer <= 28;

  const targetAngle = rail.gateClosed ? 0 : Math.PI * 0.44;
  rail.gateLeft.rotation.z += (targetAngle - rail.gateLeft.rotation.z) * Math.min(1, dt * 4);
  rail.gateRight.rotation.z += (-targetAngle - rail.gateRight.rotation.z) * Math.min(1, dt * 4);

  const flash = Math.floor(rail.timer * 3.5) % 2 === 0;
  rail.lampA.emissiveIntensity = rail.warningActive && flash ? 2.8 : 0;
  rail.lampB.emissiveIntensity = rail.warningActive && !flash ? 2.8 : 0;

  if (rail.timer >= 17.5 && rail.timer <= 26.5) {
    const u = (rail.timer - 17.5) / 9.0;
    rail.trainPos = THREE.MathUtils.lerp(-75, 115, u);
    rail.trainGroup.visible = true;
    rail.trainGroup.position.x = rail.trainPos;
  } else {
    rail.trainGroup.visible = false;
  }
}

const _livingDummy = new THREE.Object3D();
const _flagSwayQuat = new THREE.Quaternion();
const _flagSwayAxis = new THREE.Vector3(0, 1, 0);
const _flagPos = new THREE.Vector3();
const _flagQuat = new THREE.Quaternion();
const _flagScale = new THREE.Vector3();
const _flagOutMat = new THREE.Matrix4();

/** Animate drifting blocky clouds, circling city birds, swaying VN flags & waypoint pulse (zero GC!). */
export function updateLivingWorld(world: BuiltWorld, dt: number, elapsedSec: number) {
  const { cloudsGroup, birdsMesh, birdSeeds, flagsMesh, flagBaseMatrices } = world.living;

  // Drift clouds gently across sky and wrap seamlessly
  cloudsGroup.position.x = ((elapsedSec * 1.35 + 260) % 520) - 260;

  // Circle flock of blocky city birds overhead with subtle wing-roll flap
  for (let i = 0; i < birdSeeds.length; i++) {
    const b = birdSeeds[i];
    const ang = b.phase + elapsedSec * b.speed;
    const x = b.cx + Math.cos(ang) * b.radius;
    const z = b.cz + Math.sin(ang) * b.radius;
    const y = b.height + Math.sin(elapsedSec * 2.1 + b.phase) * 1.3;
    _livingDummy.position.set(x, y, z);
    _livingDummy.rotation.set(0, -ang, Math.sin(elapsedSec * 11 + i * 1.7) * 0.28);
    _livingDummy.scale.set(1, 1, 1);
    _livingDummy.updateMatrix();
    birdsMesh.setMatrixAt(i, _livingDummy.matrix);
  }
  birdsMesh.instanceMatrix.needsUpdate = true;

  // Gentle wind flutter on Vietnamese balcony flags
  if (flagsMesh && flagBaseMatrices.length > 0) {
    for (let i = 0; i < flagBaseMatrices.length; i++) {
      flagBaseMatrices[i].decompose(_flagPos, _flagQuat, _flagScale);
      const sway = Math.sin(elapsedSec * 3.4 + i * 0.9) * 0.14;
      _flagSwayQuat.setFromAxisAngle(_flagSwayAxis, sway);
      _flagQuat.multiply(_flagSwayQuat);
      _flagOutMat.compose(_flagPos, _flagQuat, _flagScale);
      flagsMesh.setMatrixAt(i, _flagOutMat);
    }
    flagsMesh.instanceMatrix.needsUpdate = true;
  }

  // Subtle living pulse on active scenario waypoint ring
  if (world.waypointMarker.visible) {
    const s = 1 + Math.sin(elapsedSec * 4.2) * 0.08;
    world.waypointMarker.scale.set(s, 1, s);
  }
  void dt;
}

