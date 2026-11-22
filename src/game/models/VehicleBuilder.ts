import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DetailLevel } from '../graphics/GraphicsSettings';

export interface BuiltVehicleParts {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  frontFork?: THREE.Object3D;
  headlightMats: THREE.MeshStandardMaterial[];
  brakeLightMats: THREE.MeshStandardMaterial[];
  signalLeftMats: THREE.MeshStandardMaterial[];
  signalRightMats: THREE.MeshStandardMaterial[];
  sirenRed?: THREE.MeshStandardMaterial;
  sirenBlue?: THREE.MeshStandardMaterial;
}

interface ColoredGeoSpec {
  geo: THREE.BufferGeometry;
  color: number;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

interface PlainGeoSpec {
  geo: THREE.BufferGeometry;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _col = new THREE.Color();

/** Helper to create a BoxGeometry concisely */
function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** Helper to create a flat-shaded low-poly CylinderGeometry (octagonal/12-sided blocky feel) */
function cyl(rt: number, rb: number, h: number, segs = 10): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rt, rb, h, segs);
}

/** Merge multiple sub-geometries into ONE draw call using baked sRGB-converted vertex colors. */
function bakeColoredParts(specs: ColoredGeoSpec[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  for (const sp of specs) {
    const g = sp.geo.index ? sp.geo.toNonIndexed() : sp.geo.clone();
    sp.geo.dispose();
    _p.set(sp.pos?.[0] ?? 0, sp.pos?.[1] ?? 0, sp.pos?.[2] ?? 0);
    _e.set(sp.rot?.[0] ?? 0, sp.rot?.[1] ?? 0, sp.rot?.[2] ?? 0);
    _q.setFromEuler(_e);
    _s.set(sp.scale?.[0] ?? 1, sp.scale?.[1] ?? 1, sp.scale?.[2] ?? 1);
    _m4.compose(_p, _q, _s);
    g.applyMatrix4(_m4);
    g.computeVertexNormals();
    const count = g.attributes.position.count;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    _col.setHex(sp.color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = _col.r;
      colors[i * 3 + 1] = _col.g;
      colors[i * 3 + 2] = _col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') {
        g.deleteAttribute(k);
      }
    }
    prepared.push(g);
  }
  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  if (!merged) throw new Error('bakeColoredParts failed to merge geometries');
  merged.computeBoundingSphere();
  return merged;
}

/** Merge multiple plain sub-geometries (same material) into ONE draw call. */
function bakePlainParts(specs: PlainGeoSpec[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  for (const sp of specs) {
    const g = sp.geo.index ? sp.geo.toNonIndexed() : sp.geo.clone();
    sp.geo.dispose();
    _p.set(sp.pos?.[0] ?? 0, sp.pos?.[1] ?? 0, sp.pos?.[2] ?? 0);
    _e.set(sp.rot?.[0] ?? 0, sp.rot?.[1] ?? 0, sp.rot?.[2] ?? 0);
    _q.setFromEuler(_e);
    _s.set(sp.scale?.[0] ?? 1, sp.scale?.[1] ?? 1, sp.scale?.[2] ?? 1);
    _m4.compose(_p, _q, _s);
    g.applyMatrix4(_m4);
    g.computeVertexNormals();
    const count = g.attributes.position.count;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') {
        g.deleteAttribute(k);
      }
    }
    prepared.push(g);
  }
  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  if (!merged) throw new Error('bakePlainParts failed to merge geometries');
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Shared Ultra-Detailed Blocky / Voxel-Craft Automotive Geometry & Material Pool.
 * Every vehicle features flat-shaded crisp geometry, high-contrast panel breaks,
 * dark recessed wheel wells & chassis frames, multi-slat grilles, wipers, mirrors,
 * license plates, spoked wheels, and interior bus seats — while staying batched (~6–10 draw calls/vehicle).
 * Coordinate convention: +Z forward, +Y up, +X left, -X right.
 */
export class VehicleAssetPool {
  private disposables: { dispose: () => void }[] = [];
  private paintCache = new Map<string, THREE.Material>();
  private plateCache = new Map<string, THREE.MeshStandardMaterial>();
  private npcBodyCache = new Map<string, THREE.BufferGeometry>();
  private detailLevel: DetailLevel;

  // Shared core crisp blocky materials
  readonly matVertexAuto: THREE.MeshStandardMaterial;
  readonly matVertexWheel: THREE.MeshStandardMaterial;
  readonly matGlass: THREE.MeshStandardMaterial;
  readonly matBusGlass: THREE.MeshStandardMaterial;
  readonly matHeadlightOff: THREE.MeshStandardMaterial;
  readonly matTaillightOff: THREE.MeshStandardMaterial;
  readonly matTaxiSign: THREE.MeshStandardMaterial;
  readonly matBusBlue: THREE.MeshStandardMaterial;
  readonly matBusSignFront: THREE.MeshBasicMaterial;
  readonly matBusSignRear: THREE.MeshBasicMaterial;
  readonly matCargoWhite: THREE.MeshStandardMaterial;
  readonly matAmbulanceWhite: THREE.MeshStandardMaterial;
  readonly matDarkTrim: THREE.MeshStandardMaterial;

  // Pre-baked ultra-detailed blocky geometries (+Z forward, +Y up, +X left)
  readonly geo: {
    // Sedan & Taxi
    sedanPaintShell: THREE.BufferGeometry;
    sedanGlass: THREE.BufferGeometry;
    sedanTrimBaked: THREE.BufferGeometry;
    sedanHeadlights: THREE.BufferGeometry;
    sedanTaillights: THREE.BufferGeometry;
    sedanSignalL: THREE.BufferGeometry;
    sedanSignalR: THREE.BufferGeometry;
    sedanPlates: THREE.BufferGeometry;
    taxiCheckers: THREE.BufferGeometry;
    taxiRoofSign: THREE.BufferGeometry;
    carWheelBaked: THREE.BufferGeometry;
    heavyWheelBaked: THREE.BufferGeometry;
    // Motorbikes (Wave 110 & Vision 110)
    waveBodyPaint: THREE.BufferGeometry;
    waveTrimBaked: THREE.BufferGeometry;
    visionBodyPaint: THREE.BufferGeometry;
    visionTrimBaked: THREE.BufferGeometry;
    bikeForkPaint: THREE.BufferGeometry;
    bikeForkTrim: THREE.BufferGeometry;
    bikeHeadlight: THREE.BufferGeometry;
    bikeTaillight: THREE.BufferGeometry;
    bikeSignalL: THREE.BufferGeometry;
    bikeSignalR: THREE.BufferGeometry;
    bikeWheelBaked: THREE.BufferGeometry;
    plateBike: THREE.BufferGeometry;
    cargoBox: THREE.BufferGeometry;
    // Flagship Bus, Cargo Truck, Ambulance, Bicycle
    busShell: THREE.BufferGeometry;
    busGlass: THREE.BufferGeometry;
    busTrimBaked: THREE.BufferGeometry;
    busRouteBoardFront: THREE.BufferGeometry;
    busRouteBoardRear: THREE.BufferGeometry;
    busPlates: THREE.BufferGeometry;
    truckCab: THREE.BufferGeometry;
    truckGlass: THREE.BufferGeometry;
    truckCargo: THREE.BufferGeometry;
    truckTrimBaked: THREE.BufferGeometry;
    truckPlates: THREE.BufferGeometry;
    ambulanceShell: THREE.BufferGeometry;
    ambulanceGlass: THREE.BufferGeometry;
    ambulanceTrimBaked: THREE.BufferGeometry;
    ambulancePlates: THREE.BufferGeometry;
    sirenBox: THREE.BufferGeometry;
    bicycleWheelBaked: THREE.BufferGeometry;
    bicycleFrame: THREE.BufferGeometry;
    bicycleTrim: THREE.BufferGeometry;
  };

  constructor(detailLevel: DetailLevel = 'high') {
    this.detailLevel = detailLevel;

    // Flat-shaded high-contrast PBR materials (crisp edges catch sun vs deep shadow!)
    this.matVertexAuto = this.track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.52,
        metalness: 0.14,
        flatShading: true,
      }),
    );
    this.matVertexWheel = this.track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0.24,
        flatShading: true,
      }),
    );
    this.matGlass = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x162436,
        roughness: 0.14,
        metalness: 0.55,
        flatShading: true,
      }),
    );
    this.matBusGlass = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x172b42,
        roughness: 0.14,
        metalness: 0.45,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
        flatShading: true,
      }),
    );
    this.matHeadlightOff = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfff8dc,
        emissive: 0xffe8a3,
        emissiveIntensity: 0.45,
        roughness: 0.15,
        flatShading: true,
      }),
    );
    this.matTaillightOff = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xcc1818,
        emissive: 0xff2424,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        flatShading: true,
      }),
    );
    this.matDarkTrim = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1c2026,
        roughness: 0.72,
        flatShading: true,
      }),
    );
    this.matTaxiSign = this.track(
      new THREE.MeshStandardMaterial({
        map: this.makeTaxiSignTex(),
        emissive: 0xffc824,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        flatShading: true,
      }),
    );
    this.matBusBlue = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1662b8,
        roughness: 0.42,
        metalness: 0.14,
        flatShading: true,
      }),
    );
    this.matBusSignFront = this.track(
      new THREE.MeshBasicMaterial({
        map: this.makeBusRouteTex('01  BẾN THÀNH - CHỢ LỚN', 512, 96),
        toneMapped: false,
      }),
    );
    this.matBusSignRear = this.track(
      new THREE.MeshBasicMaterial({
        map: this.makeBusRouteTex('01', 160, 96),
        toneMapped: false,
      }),
    );
    this.matCargoWhite = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e7ec,
        roughness: 0.56,
        metalness: 0.16,
        flatShading: true,
      }),
    );
    this.matAmbulanceWhite = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf4f7fa,
        roughness: 0.36,
        metalness: 0.1,
        flatShading: true,
      }),
    );

    // Pre-bake every single vehicle geometry ONCE
    this.geo = {
      sedanPaintShell: this.track(this.buildSedanPaintGeo()),
      sedanGlass: this.track(this.buildSedanGlassGeo()),
      sedanTrimBaked: this.track(this.buildSedanTrimGeo()),
      sedanHeadlights: this.track(this.buildSedanHeadlightsGeo()),
      sedanTaillights: this.track(this.buildSedanTaillightsGeo()),
      sedanSignalL: this.track(this.buildSedanSignalGeo(1)),
      sedanSignalR: this.track(this.buildSedanSignalGeo(-1)),
      sedanPlates: this.track(this.buildDualPlatesGeo(0.46, 0.14, 0.46, 2.265, 0.54, -2.255)),
      taxiCheckers: this.track(this.buildTaxiCheckersGeo()),
      taxiRoofSign: this.track(box(0.56, 0.17, 0.24)),
      carWheelBaked: this.track(this.buildCarWheelGeo(0.33, 0.22, false)),
      heavyWheelBaked: this.track(this.buildCarWheelGeo(0.43, 0.28, true)),

      waveBodyPaint: this.track(this.buildWaveBodyPaintGeo()),
      waveTrimBaked: this.track(this.buildWaveTrimGeo()),
      visionBodyPaint: this.track(this.buildVisionBodyPaintGeo()),
      visionTrimBaked: this.track(this.buildVisionTrimGeo()),
      bikeForkPaint: this.track(this.buildBikeForkPaintGeo()),
      bikeForkTrim: this.track(this.buildBikeForkTrimGeo()),
      bikeHeadlight: this.track(this.buildBikeHeadlightGeo()),
      bikeTaillight: this.track(this.buildBikeTaillightGeo()),
      bikeSignalL: this.track(this.buildBikeSignalGeo(1)),
      bikeSignalR: this.track(this.buildBikeSignalGeo(-1)),
      bikeWheelBaked: this.track(this.buildBikeWheelGeo()),
      plateBike: this.track(this.buildSinglePlateGeo(0.21, 0.16)),
      cargoBox: this.track(this.buildShipperCargoBoxGeo()),

      busShell: this.track(this.buildBusShellGeo()),
      busGlass: this.track(this.buildBusGlassGeo()),
      busTrimBaked: this.track(this.buildBusTrimGeo()),
      busRouteBoardFront: this.track(box(1.94, 0.34, 0.06)),
      busRouteBoardRear: this.track(box(0.76, 0.32, 0.06)),
      busPlates: this.track(this.buildDualPlatesGeo(0.52, 0.16, 0.62, 4.92, 0.72, -4.92)),

      truckCab: this.track(this.buildTruckCabGeo()),
      truckGlass: this.track(this.buildTruckGlassGeo()),
      truckCargo: this.track(this.buildTruckCargoGeo()),
      truckTrimBaked: this.track(this.buildTruckTrimGeo()),
      truckPlates: this.track(this.buildDualPlatesGeo(0.5, 0.16, 0.56, 3.31, 0.66, -3.72)),

      ambulanceShell: this.track(this.buildAmbulanceShellGeo()),
      ambulanceGlass: this.track(this.buildAmbulanceGlassGeo()),
      ambulanceTrimBaked: this.track(this.buildAmbulanceTrimGeo()),
      ambulancePlates: this.track(this.buildDualPlatesGeo(0.48, 0.15, 0.52, 2.72, 0.62, -2.72)),
      sirenBox: this.track(box(0.54, 0.15, 0.24)),

      bicycleWheelBaked: this.track(this.buildBicycleWheelGeo()),
      bicycleFrame: this.track(this.buildBicycleFrameGeo()),
      bicycleTrim: this.track(this.buildBicycleTrimGeo()),
    };
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  setDetailLevel(level: DetailLevel) {
    if (this.detailLevel === level) return;
    this.detailLevel = level;
  }

  getPaintMaterial(colorHex: number, isHero = false): THREE.Material {
    const key = `${colorHex}|${isHero ? 1 : 0}`;
    const cached = this.paintCache.get(key);
    if (cached) return cached;
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: isHero ? 0.36 : 0.44,
        metalness: isHero ? 0.22 : 0.16,
        flatShading: true,
      }),
    );
    this.paintCache.set(key, mat);
    return mat;
  }

  getLicensePlateMaterial(top: string, bottom: string, isCommercialYellow = false): THREE.MeshStandardMaterial {
    const key = `${top}|${bottom}|${isCommercialYellow ? 1 : 0}`;
    const cached = this.plateCache.get(key);
    if (cached) return cached;

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = bottom ? 192 : 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = isCommercialYellow ? '#f5c227' : '#f4f6f8';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111418';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
    ctx.fillStyle = '#0e1116';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (bottom) {
      ctx.font = '800 62px "Be Vietnam Pro", monospace';
      ctx.fillText(top, c.width / 2, c.height * 0.31);
      ctx.font = '800 64px "Be Vietnam Pro", monospace';
      ctx.fillText(bottom, c.width / 2, c.height * 0.72);
    } else {
      ctx.font = '800 44px "Be Vietnam Pro", monospace';
      ctx.fillText(top, c.width / 2, c.height * 0.54);
    }
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, flatShading: true }));
    this.plateCache.set(key, mat);
    return mat;
  }

  private makeTaxiSignTex(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffcb1f';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#14171c';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 88);
    ctx.fillStyle = '#101214';
    ctx.font = '900 58px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 128, 52);
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private makeBusRouteTex(label: string, w: number, h: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#ffb81c';
    ctx.font = w > 256 ? '800 34px "Be Vietnam Pro", sans-serif' : '900 54px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 2);
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildDualPlatesGeo(w: number, h: number, fy: number, fz: number, ry: number, rz: number): THREE.BufferGeometry {
    const front = new THREE.PlaneGeometry(w, h);
    const rear = new THREE.PlaneGeometry(w, h);
    return bakePlainParts([
      { geo: front, pos: [0, fy, fz] },
      { geo: rear, pos: [0, ry, rz], rot: [0, Math.PI, 0] },
    ]);
  }

  private buildSinglePlateGeo(w: number, h: number): THREE.BufferGeometry {
    const p = new THREE.PlaneGeometry(w, h);
    p.rotateY(Math.PI);
    return p;
  }

  // =========================================================================
  // BLOCKY WHEELS (Car, Heavy Commercial Bus/Truck, Motorbike, Bicycle)
  // =========================================================================
  private buildCarWheelGeo(radius: number, width: number, isHeavy: boolean): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [];
    const segs = 12; // Crisp octagonal-12 blocky look!
    // Outer rubber tire
    parts.push({ geo: cyl(radius, radius, width, segs), color: 0x16191e, rot: [0, 0, Math.PI / 2] });
    // Tire tread ridges around circumference (crisp blocky tread notches!)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push({
        geo: box(width * 0.88, 0.025, 0.06),
        color: 0x0f1216,
        pos: [0, Math.cos(a) * (radius - 0.004), Math.sin(a) * (radius - 0.004)],
        rot: [a, 0, 0],
      });
    }
    // Recessed dark brake drum / inner wheel dish (clean 1.6cm step per layer — ZERO shimmer!)
    parts.push({ geo: cyl(radius * 0.66, radius * 0.66, width + 0.018, segs), color: 0x262b33, rot: [0, 0, Math.PI / 2] });
    // Crisp metallic outer alloy rim ring
    parts.push({ geo: cyl(radius * 0.60, radius * 0.60, width + 0.036, segs), color: isHeavy ? 0xadb8c4 : 0xd2dae2, rot: [0, 0, Math.PI / 2] });
    // Inner dark cavity for spoke contrast
    parts.push({ geo: cyl(radius * 0.47, radius * 0.47, width + 0.050, segs), color: 0x1b2028, rot: [0, 0, Math.PI / 2] });
    // Crisp 5 blocky spokes (cars) or 6 heavy lug bolts + hubcap (bus/truck)
    if (isHeavy) {
      parts.push({ geo: cyl(radius * 0.28, radius * 0.28, width + 0.072, 8), color: 0xc2ccd6, rot: [0, 0, Math.PI / 2] });
      parts.push({ geo: cyl(radius * 0.14, radius * 0.14, width + 0.088, 8), color: 0x333a44, rot: [0, 0, Math.PI / 2] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push({
          geo: box(width + 0.078, 0.045, 0.045),
          color: 0xe6edf4,
          pos: [0, Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36],
          rot: [a, 0, 0],
        });
      }
    } else {
      // Ventilated silver brake disc rotor & red performance brake caliper visible inside spokes!
      parts.push({ geo: cyl(radius * 0.42, radius * 0.42, width + 0.056, 10), color: 0xa6b2be, rot: [0, 0, Math.PI / 2] });
      parts.push({ geo: box(width + 0.060, 0.095, 0.065), color: 0xd62828, pos: [0, 0.04, -radius * 0.28] });
      // Crisp 5 twin-spoke machined alloy wheel spokes!
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const a1 = a - 0.13;
        const a2 = a + 0.13;
        parts.push({
          geo: box(width + 0.068, radius * 0.48, 0.032),
          color: 0xe2eaf2,
          pos: [0, Math.cos(a1) * radius * 0.27, Math.sin(a1) * radius * 0.27],
          rot: [a1, 0, 0],
        });
        parts.push({
          geo: box(width + 0.068, radius * 0.48, 0.032),
          color: 0xd0dae5,
          pos: [0, Math.cos(a2) * radius * 0.27, Math.sin(a2) * radius * 0.27],
          rot: [a2, 0, 0],
        });
      }
      parts.push({ geo: cyl(radius * 0.17, radius * 0.17, width + 0.078, 8), color: 0x9aa4b0, rot: [0, 0, Math.PI / 2] });
      parts.push({ geo: cyl(radius * 0.08, radius * 0.08, width + 0.092, 8), color: 0x1c2128, rot: [0, 0, Math.PI / 2] });
    }
    return bakeColoredParts(parts);
  }

  private buildBikeWheelGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [];
    const r = 0.285;
    const w = 0.105;
    // Blocky 12-sided tire + subtle blocky tread blocks
    parts.push({ geo: cyl(r, r, w, 12), color: 0x15181d, rot: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push({
        geo: box(w * 0.84, 0.018, 0.045),
        color: 0x0e1115,
        pos: [0, Math.cos(a) * (r - 0.003), Math.sin(a) * (r - 0.003)],
        rot: [a, 0, 0],
      });
    }
    // Crisp dark gunmetal rim + bright silver outer bead lip!
    parts.push({ geo: cyl(r * 0.74, r * 0.74, w + 0.014, 12), color: 0xd8e0e8, rot: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(r * 0.67, r * 0.67, w + 0.026, 12), color: 0x262d38, rot: [0, 0, Math.PI / 2] });
    // Deep dark inner wheel cutout
    parts.push({ geo: cyl(r * 0.56, r * 0.56, w + 0.036, 12), color: 0x151a22, rot: [0, 0, Math.PI / 2] });
    // 5 crisp blocky cast Y-spokes (Honda Wave/Vision cast alloy wheels!)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({
        geo: box(w + 0.048, r * 0.58, 0.030),
        color: 0xdbe3ec,
        pos: [0, Math.cos(a) * r * 0.29, Math.sin(a) * r * 0.29],
        rot: [a, 0, 0],
      });
    }
    // Center brake hub + axle nut
    parts.push({ geo: cyl(0.072, 0.072, w + 0.060, 8), color: 0x94a3b8, rot: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(0.028, 0.028, w + 0.074, 6), color: 0x262c34, rot: [0, 0, Math.PI / 2] });
    return bakeColoredParts(parts);
  }

  private buildBicycleWheelGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [];
    const r = 0.32;
    parts.push({ geo: cyl(r, r, 0.052, 12), color: 0x181b20, rot: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(r * 0.84, r * 0.84, 0.066, 12), color: 0xd2dae2, rot: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(r * 0.74, r * 0.74, 0.078, 12), color: 0x2a313a, rot: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      parts.push({ geo: box(0.045, r * 1.48, 0.016), color: 0xcbd5e1, rot: [a, 0, 0] });
    }
    parts.push({ geo: cyl(0.04, 0.04, 0.094, 8), color: 0x94a3b8, rot: [0, 0, Math.PI / 2] });
    return bakeColoredParts(parts);
  }

  // =========================================================================
  // 1. ULTRA-DETAILED BLOCKY SEDAN & TAXI MAI LINH
  // =========================================================================
  private buildSedanPaintGeo(): THREE.BufferGeometry {
    const parts: PlainGeoSpec[] = [
      // Main lower sculpted chassis body (strictly distinct widths so ZERO coplanar side faces!)
      { geo: box(1.80, 0.44, 1.56), pos: [0, 0.56, 0.02] },
      // Sleek tapered front hood & fender block
      { geo: box(1.76, 0.34, 1.16), pos: [0, 0.69, 1.60], rot: [0.04, 0, 0] },
      // Sculpted hood power-dome + twin aero hood ribs
      { geo: box(1.30, 0.065, 1.24), pos: [0, 0.88, 1.44], rot: [0.06, 0, 0] },
      { geo: box(0.14, 0.04, 1.16), pos: [0.56, 0.895, 1.44], rot: [0.06, 0, 0] },
      { geo: box(0.14, 0.04, 1.16), pos: [-0.56, 0.895, 1.44], rot: [0.06, 0, 0] },
      // Front sculpted bumper fascia + sporty corner air-curtain cheeks
      { geo: box(1.82, 0.28, 0.34), pos: [0, 0.49, 2.04] },
      { geo: box(0.24, 0.22, 0.14), pos: [0.80, 0.46, 2.16], rot: [0, 0.22, 0] },
      { geo: box(0.24, 0.22, 0.14), pos: [-0.80, 0.46, 2.16], rot: [0, -0.22, 0] },
      // Rear quarter haunches & trunk deck block
      { geo: box(1.78, 0.42, 0.96), pos: [0, 0.71, -1.70] },
      { geo: box(1.44, 0.06, 0.62), pos: [0, 0.93, -1.78], rot: [-0.04, 0, 0] },
      // Rear upper bumper fascia
      { geo: box(1.82, 0.28, 0.34), pos: [0, 0.49, -2.02] },
      // Sculpted upper fender beltline shoulders + lower door character crease
      { geo: box(1.86, 0.19, 4.18), pos: [0, 0.79, 0.02] },
      { geo: box(1.84, 0.08, 1.62), pos: [0, 0.45, 0.02] },
      // Muscular flared wheel arch eyebrows (front & rear, left & right)
      { geo: box(0.12, 0.14, 0.88), pos: [0.91, 0.71, 1.32] },
      { geo: box(0.12, 0.14, 0.88), pos: [-0.91, 0.71, 1.32] },
      { geo: box(0.12, 0.14, 0.88), pos: [0.91, 0.71, -1.26] },
      { geo: box(0.12, 0.14, 0.88), pos: [-0.91, 0.71, -1.26] },
      // Tapered aerodynamic cabin roof panel
      { geo: box(1.48, 0.10, 1.68), pos: [0, 1.40, -0.22] },
      { geo: box(1.34, 0.04, 1.46), pos: [0, 1.46, -0.22] },
      // Raked A-pillars (painted front roof posts)
      { geo: box(0.10, 0.56, 0.14), pos: [0.70, 1.12, 0.76], rot: [-0.48, 0, 0] },
      { geo: box(0.10, 0.56, 0.14), pos: [-0.70, 1.12, 0.76], rot: [-0.48, 0, 0] },
      // Swept C-pillars (painted rear fastback sail panels)
      { geo: box(0.13, 0.56, 0.30), pos: [0.71, 1.12, -1.16], rot: [0.48, 0, 0] },
      { geo: box(0.13, 0.56, 0.30), pos: [-0.71, 1.12, -1.16], rot: [0.48, 0, 0] },
      // Sporty aerodynamic wing mirror caps (left & right)
      { geo: box(0.23, 0.12, 0.16), pos: [0.99, 0.99, 0.58] },
      { geo: box(0.23, 0.12, 0.16), pos: [-0.99, 0.99, 0.58] },
    ];
    return bakePlainParts(parts);
  }

  private buildSedanGlassGeo(): THREE.BufferGeometry {
    const parts: PlainGeoSpec[] = [
      // Crisp sloped front windshield
      { geo: box(1.36, 0.54, 0.08), pos: [0, 1.12, 0.75], rot: [-0.48, 0, 0] },
      // Crisp sloped rear fastback window
      { geo: box(1.36, 0.54, 0.08), pos: [0, 1.12, -1.14], rot: [0.48, 0, 0] },
      // Recessed side cabin window core (left & right flush glass)
      { geo: box(1.44, 0.44, 1.56), pos: [0, 1.14, -0.20] },
      // Glossy black panoramic sunroof inset on roof!
      { geo: box(1.02, 0.03, 0.88), pos: [0, 1.48, -0.06] },
    ];
    return bakePlainParts(parts);
  }

  private buildSedanTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [
      // Dark underbody floor pan & recessed wheel well liners
      { geo: box(1.64, 0.16, 4.02), color: 0x16191f, pos: [0, 0.28, 0.0] },
      // Front & rear dark wheel well cavities
      { geo: box(1.72, 0.44, 0.82), color: 0x111419, pos: [0, 0.46, 1.32] },
      { geo: box(1.72, 0.44, 0.82), color: 0x111419, pos: [0, 0.46, -1.26] },
      // Sculpted sporty side rocker skirts + chrome lower side molding blade
      { geo: box(0.11, 0.13, 1.74), color: 0x1c2026, pos: [0.89, 0.30, 0.02] },
      { geo: box(0.11, 0.13, 1.74), color: 0x1c2026, pos: [-0.89, 0.30, 0.02] },
      { geo: box(0.05, 0.035, 1.54), color: 0xd0d8e0, pos: [0.92, 0.41, 0.02] },
      { geo: box(0.05, 0.035, 1.54), color: 0xd0d8e0, pos: [-0.92, 0.41, 0.02] },
      // B-pillar gloss black uprights + upper chrome window arch trim!
      { geo: box(0.06, 0.48, 0.14), color: 0x14171d, pos: [0.73, 1.14, -0.14] },
      { geo: box(0.06, 0.48, 0.14), color: 0x14171d, pos: [-0.73, 1.14, -0.14] },
      { geo: box(0.05, 0.035, 1.66), color: 0xdce4ec, pos: [0.74, 0.90, -0.18] },
      { geo: box(0.05, 0.035, 1.66), color: 0xdce4ec, pos: [-0.74, 0.90, -0.18] },
      { geo: box(0.05, 0.03, 1.48), color: 0xdce4ec, pos: [0.74, 1.36, -0.22] },
      { geo: box(0.05, 0.03, 1.48), color: 0xdce4ec, pos: [-0.74, 1.36, -0.22] },
      // 4 Chrome Door Handles + vertical door seam grooves
      { geo: box(0.07, 0.045, 0.18), color: 0xe2eaf2, pos: [0.92, 0.79, 0.16] },
      { geo: box(0.07, 0.045, 0.18), color: 0xe2eaf2, pos: [-0.92, 0.79, 0.16] },
      { geo: box(0.07, 0.045, 0.18), color: 0xe2eaf2, pos: [0.92, 0.79, -0.58] },
      { geo: box(0.07, 0.045, 0.18), color: 0xe2eaf2, pos: [-0.92, 0.79, -0.58] },
      // Wing mirror stalks & reflective mirror glass faces
      { geo: box(0.14, 0.06, 0.08), color: 0x1b2026, pos: [0.85, 0.95, 0.58] },
      { geo: box(0.14, 0.06, 0.08), color: 0x1b2026, pos: [-0.85, 0.95, 0.58] },
      { geo: box(0.18, 0.09, 0.03), color: 0xa4bed4, pos: [0.99, 0.99, 0.495] },
      { geo: box(0.18, 0.09, 0.03), color: 0xa4bed4, pos: [-0.99, 0.99, 0.495] },
      // Windshield wipers (2 crisp dark blades)
      { geo: box(0.56, 0.03, 0.03), color: 0x15181e, pos: [0.28, 0.92, 0.91], rot: [0, 0, -0.12] },
      { geo: box(0.54, 0.03, 0.03), color: 0x15181e, pos: [-0.30, 0.92, 0.91], rot: [0, 0, -0.10] },
      // Roof drip rails & shark-fin antenna
      { geo: box(0.05, 0.03, 1.56), color: 0x1c2026, pos: [0.64, 1.46, -0.22] },
      { geo: box(0.05, 0.03, 1.56), color: 0x1c2026, pos: [-0.64, 1.46, -0.22] },
      { geo: box(0.06, 0.10, 0.18), color: 0x1c2026, pos: [0, 1.50, -0.82], rot: [-0.22, 0, 0] },
      // Sporty matte-black ducktail trunk lip spoiler (crisp high-contrast rear silhouette!)
      { geo: box(1.64, 0.065, 0.15), color: 0x1a1e25, pos: [0, 0.95, -2.14], rot: [0.12, 0, 0] },
      // FRONT: Black grille bay + chrome surround + 4 horizontal chrome slats + emblem
      { geo: box(0.88, 0.25, 0.08), color: 0x12151a, pos: [0, 0.67, 2.20] },
      { geo: box(0.92, 0.03, 0.09), color: 0xe6edf4, pos: [0, 0.79, 2.21] },
      { geo: box(0.86, 0.026, 0.09), color: 0xdbe3ec, pos: [0, 0.73, 2.21] },
      { geo: box(0.84, 0.026, 0.09), color: 0xdbe3ec, pos: [0, 0.67, 2.21] },
      { geo: box(0.82, 0.026, 0.09), color: 0xdbe3ec, pos: [0, 0.61, 2.21] },
      { geo: box(0.18, 0.11, 0.10), color: 0xf4f8fc, pos: [0, 0.68, 2.225] },
      // Front lower intake grille + front chin splitter + recessed fog lamps & LED DRL L-bars
      { geo: box(1.24, 0.16, 0.08), color: 0x14171d, pos: [0, 0.39, 2.20] },
      { geo: box(1.88, 0.065, 0.26), color: 0x1a1e24, pos: [0, 0.27, 2.14] },
      { geo: box(0.24, 0.12, 0.07), color: 0x14171d, pos: [0.74, 0.42, 2.20] },
      { geo: box(0.24, 0.12, 0.07), color: 0x14171d, pos: [-0.74, 0.42, 2.20] },
      { geo: box(0.16, 0.055, 0.08), color: 0xf7f2d0, pos: [0.74, 0.42, 2.215] },
      { geo: box(0.16, 0.055, 0.08), color: 0xf7f2d0, pos: [-0.74, 0.42, 2.215] },
      // REAR: Full-width dark taillight housing + reverse lamps + chrome trunk bar + badge
      { geo: box(1.76, 0.20, 0.08), color: 0x181b22, pos: [0, 0.77, -2.19] },
      { geo: box(0.24, 0.055, 0.09), color: 0xeef5fb, pos: [0.48, 0.73, -2.21] },
      { geo: box(0.24, 0.055, 0.09), color: 0xeef5fb, pos: [-0.48, 0.73, -2.21] },
      { geo: box(1.18, 0.038, 0.08), color: 0xe2eaf2, pos: [0, 0.66, -2.20] },
      { geo: box(0.14, 0.08, 0.04), color: 0xf1f5f9, pos: [0, 0.87, -2.20] },
      // Recessed license plate surround
      { geo: box(0.58, 0.21, 0.03), color: 0x181c22, pos: [0, 0.54, -2.225] },
      // Rear lower dark sporty diffuser + 3 vertical aero fins + red reflectors + twin chrome exhaust tips
      { geo: box(1.84, 0.17, 0.24), color: 0x181c22, pos: [0, 0.31, -2.12] },
      { geo: box(0.04, 0.12, 0.08), color: 0x2a313c, pos: [0, 0.29, -2.22] },
      { geo: box(0.04, 0.12, 0.08), color: 0x2a313c, pos: [0.28, 0.29, -2.22] },
      { geo: box(0.04, 0.12, 0.08), color: 0x2a313c, pos: [-0.28, 0.29, -2.22] },
      { geo: box(0.28, 0.05, 0.06), color: 0xd92626, pos: [0.72, 0.42, -2.21] },
      { geo: box(0.28, 0.05, 0.06), color: 0xd92626, pos: [-0.72, 0.42, -2.21] },
      { geo: box(0.15, 0.095, 0.18), color: 0xd8e2ec, pos: [0.58, 0.28, -2.23] },
      { geo: box(0.15, 0.095, 0.18), color: 0xd8e2ec, pos: [-0.58, 0.28, -2.23] },
      { geo: box(0.10, 0.06, 0.04), color: 0x12151a, pos: [0.58, 0.28, -2.31] },
      { geo: box(0.10, 0.06, 0.04), color: 0x12151a, pos: [-0.58, 0.28, -2.31] },
    ];
    return bakeColoredParts(parts);
  }

  private buildTaxiCheckersGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [];
    for (let i = 0; i < 12; i++) {
      const z = -1.2 + i * 0.22;
      const col = i % 2 === 0 ? 0xf8fafc : 0x16191f;
      parts.push({ geo: box(0.03, 0.09, 0.20), color: col, pos: [0.92, 0.58, z] });
      parts.push({ geo: box(0.03, 0.09, 0.20), color: col, pos: [-0.92, 0.58, z] });
    }
    return bakeColoredParts(parts);
  }

  private buildSedanHeadlightsGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(0.38, 0.16, 0.09), pos: [0.66, 0.70, 2.21] },
      { geo: box(0.38, 0.16, 0.09), pos: [-0.66, 0.70, 2.21] },
    ]);
  }

  private buildSedanTaillightsGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(0.46, 0.14, 0.09), pos: [0.62, 0.79, -2.21] },
      { geo: box(0.46, 0.14, 0.09), pos: [-0.62, 0.79, -2.21] },
      { geo: box(0.76, 0.05, 0.08), pos: [0, 0.82, -2.21] }, // Connecting LED bar!
      { geo: box(0.34, 0.05, 0.06), pos: [0, 1.32, -1.04] }, // High-mount brake lamp
    ]);
  }

  private buildSedanSignalGeo(side: 1 | -1): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(0.14, 0.14, 0.10), pos: [side * 0.84, 0.70, 2.18] },
      { geo: box(0.14, 0.14, 0.10), pos: [side * 0.84, 0.79, -2.18] },
      { geo: box(0.12, 0.04, 0.06), pos: [side * 1.02, 0.99, 0.64] },
    ]);
  }

  // =========================================================================
  // 2. ULTRA-DETAILED BLOCKY HONDA WAVE 110 & VISION 110
  //    (Completely rebuilt: crisp stepped fairings, zero giant wedge apron,
  //     zero floating shock sticks, finned engine, muffler heat-shield, brake caliper!)
  // =========================================================================
  private buildWaveBodyPaintGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      // Sleek tapered front leg-shield fairing (two stepped blocks, properly angled!)
      { geo: box(0.40, 0.42, 0.16), pos: [0, 0.69, 0.44], rot: [-0.24, 0, 0] },
      // Side fairing wings wrapping around the front shield (classic Honda Wave silhouette!)
      { geo: box(0.08, 0.34, 0.24), pos: [0.20, 0.64, 0.38], rot: [-0.22, 0, 0] },
      { geo: box(0.08, 0.34, 0.24), pos: [-0.20, 0.64, 0.38], rot: [-0.22, 0, 0] },
      // Center step-through spine cover
      { geo: box(0.20, 0.14, 0.36), pos: [0, 0.52, 0.14], rot: [0.22, 0, 0] },
      // Mid-body side fairings under seat (stepped crisp panels)
      { geo: box(0.36, 0.26, 0.64), pos: [0, 0.64, -0.24], rot: [-0.08, 0, 0] },
      // Sporty upswept rear tail cowls (left & right)
      { geo: box(0.32, 0.20, 0.46), pos: [0, 0.74, -0.64], rot: [-0.16, 0, 0] },
      // Top rear tail cap behind seat
      { geo: box(0.24, 0.08, 0.20), pos: [0, 0.85, -0.76], rot: [-0.14, 0, 0] },
    ]);
  }

  private buildWaveTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [
      // Dark recessed inner knee-shield + ignition key switch + luggage hook
      { geo: box(0.34, 0.40, 0.10), color: 0x1c2026, pos: [0, 0.67, 0.35], rot: [-0.24, 0, 0] },
      { geo: box(0.06, 0.06, 0.06), color: 0x94a3b8, pos: [-0.09, 0.78, 0.31] }, // Ignition cylinder
      { geo: box(0.04, 0.06, 0.06), color: 0x333a44, pos: [0, 0.68, 0.29] }, // Grocery bag hook!
      // Dark tubular underbone frame spine & lower engine cradle
      { geo: box(0.18, 0.14, 0.76), color: 0x1a1e24, pos: [0, 0.44, 0.04] },
      // Detailed horizontal finned silver engine block + dark crankcase cover!
      { geo: box(0.26, 0.22, 0.34), color: 0x94a3b8, pos: [0, 0.34, 0.08] },
      { geo: box(0.29, 0.15, 0.24), color: 0x64748b, pos: [0, 0.32, -0.06] },
      // Engine cooling fins
      { geo: box(0.28, 0.025, 0.16), color: 0xcbd5e1, pos: [0, 0.40, 0.18] },
      { geo: box(0.28, 0.025, 0.16), color: 0xcbd5e1, pos: [0, 0.35, 0.18] },
      { geo: box(0.28, 0.025, 0.16), color: 0xcbd5e1, pos: [0, 0.30, 0.18] },
      // Rider footpeg bar & rubber grips (flush with rider shoes at x=±0.24, y=0.30, z=+0.02!)
      { geo: box(0.54, 0.045, 0.055), color: 0x1c2026, pos: [0, 0.29, 0.02] },
      { geo: box(0.10, 0.055, 0.075), color: 0x111418, pos: [0.24, 0.29, 0.02] },
      { geo: box(0.10, 0.055, 0.075), color: 0x111418, pos: [-0.24, 0.29, 0.02] },
      // Rear swingarm forks connecting frame to rear wheel hub (z=-0.62, y=0.285)
      { geo: box(0.05, 0.07, 0.56), color: 0x2a303a, pos: [0.11, 0.30, -0.36] },
      { geo: box(0.05, 0.07, 0.56), color: 0x2a303a, pos: [-0.11, 0.30, -0.36] },
      // Left-side enclosed black chain guard
      { geo: box(0.04, 0.14, 0.56), color: 0x191d24, pos: [0.135, 0.33, -0.35] },
      // Dual rear coil-over shock absorbers with iconic RED springs & silver caps!
      { geo: cyl(0.032, 0.032, 0.36, 8), color: 0xd42222, pos: [0.138, 0.49, -0.58], rot: [0.22, 0, 0] },
      { geo: cyl(0.032, 0.032, 0.36, 8), color: 0xd42222, pos: [-0.138, 0.49, -0.58], rot: [0.22, 0, 0] },
      { geo: cyl(0.020, 0.020, 0.40, 6), color: 0xe2e8f0, pos: [0.138, 0.49, -0.58], rot: [0.22, 0, 0] },
      { geo: cyl(0.020, 0.020, 0.40, 6), color: 0xe2e8f0, pos: [-0.138, 0.49, -0.58], rot: [0.22, 0, 0] },
      { geo: box(0.065, 0.06, 0.065), color: 0x1c2026, pos: [0.138, 0.65, -0.54] },
      { geo: box(0.065, 0.06, 0.065), color: 0x1c2026, pos: [-0.138, 0.65, -0.54] },
      // Kick-starter crank & rear passenger fold-out footpegs!
      { geo: box(0.04, 0.16, 0.04), color: 0xcbd5e1, pos: [-0.17, 0.36, -0.18], rot: [0.35, 0, 0] },
      { geo: box(0.09, 0.03, 0.04), color: 0x181c22, pos: [0.20, 0.36, -0.44] },
      { geo: box(0.09, 0.03, 0.04), color: 0x181c22, pos: [-0.20, 0.36, -0.44] },
      // Right-side exhaust pipe + angled blocky muffler + brushed silver heat-shield + chrome end-cone
      { geo: box(0.07, 0.07, 0.44), color: 0x3b424c, pos: [-0.15, 0.24, -0.10] },
      { geo: box(0.115, 0.125, 0.58), color: 0x1d2128, pos: [-0.17, 0.36, -0.48], rot: [-0.22, 0, 0] },
      { geo: box(0.032, 0.095, 0.42), color: 0xdbe3ec, pos: [-0.23, 0.36, -0.46], rot: [-0.22, 0, 0] },
      { geo: box(0.095, 0.095, 0.07), color: 0x94a3b8, pos: [-0.17, 0.43, -0.77], rot: [-0.22, 0, 0] },
      // Kickstand tucked on left side
      { geo: box(0.03, 0.03, 0.28), color: 0x181c22, pos: [0.15, 0.22, -0.18], rot: [0.15, 0.18, 0] },
      // Sculpted 2-level blocky ribbed leather seat with subtle stitch ribs!
      { geo: box(0.32, 0.11, 0.74), color: 0x1b1f26, pos: [0, 0.77, -0.26], rot: [-0.04, 0, 0] },
      { geo: box(0.28, 0.055, 0.42), color: 0x262c36, pos: [0, 0.835, -0.43] },
      { geo: box(0.33, 0.025, 0.70), color: 0x384152, pos: [0, 0.73, -0.26], rot: [-0.04, 0, 0] },
      // Chrome passenger grab rail (tay dắt inox) wrapping behind seat
      { geo: box(0.34, 0.042, 0.055), color: 0xe2eaf2, pos: [0, 0.87, -0.82] },
      { geo: box(0.042, 0.042, 0.28), color: 0xe2eaf2, pos: [0.155, 0.85, -0.69] },
      { geo: box(0.042, 0.042, 0.28), color: 0xe2eaf2, pos: [-0.155, 0.85, -0.69] },
      // Rear black mudflap / license plate fender + red reflector + white plate lamp
      { geo: box(0.24, 0.35, 0.05), color: 0x15181e, pos: [0, 0.56, -0.86], rot: [0.22, 0, 0] },
      { geo: box(0.09, 0.045, 0.035), color: 0xdc2626, pos: [0, 0.43, -0.89] },
      { geo: box(0.10, 0.03, 0.04), color: 0xf1f5f9, pos: [0, 0.70, -0.88] },
      // Front V-nose black grille insert + Honda wing silver badge + sporty side stripes!
      { geo: box(0.14, 0.24, 0.06), color: 0x181c22, pos: [0, 0.70, 0.52], rot: [-0.24, 0, 0] },
      { geo: box(0.10, 0.04, 0.07), color: 0xeef4fa, pos: [0, 0.78, 0.53], rot: [-0.24, 0, 0] },
      { geo: box(0.39, 0.05, 0.50), color: 0xf1f5f9, pos: [0, 0.67, -0.34], rot: [-0.12, 0, 0] },
      { geo: box(0.395, 0.025, 0.40), color: 0xf2b705, pos: [0, 0.635, -0.34], rot: [-0.12, 0, 0] },
    ];
    return bakeColoredParts(parts);
  }

  private buildVisionBodyPaintGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      // Classic Honda Vision wide sleek sculpted front apron
      { geo: box(0.46, 0.52, 0.24), pos: [0, 0.68, 0.48], rot: [-0.16, 0, 0] },
      { geo: box(0.36, 0.42, 0.08), pos: [0, 0.68, 0.59], rot: [-0.16, 0, 0] },
      // Lower front apron chin
      { geo: box(0.42, 0.20, 0.26), pos: [0, 0.38, 0.44] },
      // Side floorboard skirt fairings (left & right)
      { geo: box(0.46, 0.14, 0.56), pos: [0, 0.32, 0.08] },
      // Plump rear scooter body panels (housing under-seat storage cốp xe!)
      { geo: box(0.45, 0.36, 0.78), pos: [0, 0.62, -0.38], rot: [-0.05, 0, 0] },
      // Rear tail fairing
      { geo: box(0.36, 0.24, 0.28), pos: [0, 0.72, -0.76] },
    ]);
  }

  private buildVisionTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [
      // Dark inner front leg-shield & glovebox pocket + bag hook + smartkey dial
      { geo: box(0.42, 0.46, 0.10), color: 0x222730, pos: [0, 0.66, 0.34], rot: [-0.16, 0, 0] },
      { geo: box(0.14, 0.12, 0.06), color: 0x16191f, pos: [0.11, 0.68, 0.29] },
      { geo: box(0.06, 0.06, 0.06), color: 0x94a3b8, pos: [-0.11, 0.76, 0.29] },
      // Flat ribbed black rubber floorboard (feet rest flat at y=0.33, z=+0.14!)
      { geo: box(0.44, 0.06, 0.52), color: 0x1a1e24, pos: [0, 0.38, 0.10] },
      { geo: box(0.40, 0.015, 0.44), color: 0x2a303a, pos: [0, 0.415, 0.10] },
      // CVT transmission case (left) + airbox + blocky scooter muffler + silver heat shield (right)
      { geo: box(0.12, 0.18, 0.50), color: 0x64748b, pos: [0.15, 0.32, -0.44] },
      { geo: box(0.10, 0.16, 0.34), color: 0x1b2028, pos: [0.16, 0.46, -0.48] },
      { geo: box(0.11, 0.14, 0.48), color: 0x1e222a, pos: [-0.18, 0.34, -0.46], rot: [-0.12, 0, 0] },
      { geo: box(0.032, 0.095, 0.36), color: 0xcbd5e1, pos: [-0.24, 0.34, -0.46], rot: [-0.12, 0, 0] },
      // Rear red-spring monoshock
      { geo: cyl(0.030, 0.030, 0.32, 8), color: 0xd42222, pos: [0.12, 0.47, -0.58] },
      // Plush wide dark-espresso brown scooter seat with side piping!
      { geo: box(0.40, 0.12, 0.78), color: 0x2c201b, pos: [0, 0.80, -0.34] },
      { geo: box(0.41, 0.028, 0.74), color: 0x453229, pos: [0, 0.75, -0.34] },
      // Silver rear grab handle + chrome side emblem bars
      { geo: box(0.38, 0.05, 0.07), color: 0xdbe3ec, pos: [0, 0.85, -0.82] },
      { geo: box(0.05, 0.05, 0.28), color: 0xdbe3ec, pos: [0.18, 0.84, -0.68] },
      { geo: box(0.05, 0.05, 0.28), color: 0xdbe3ec, pos: [-0.18, 0.84, -0.68] },
      { geo: box(0.47, 0.032, 0.26), color: 0xdbe3ec, pos: [0, 0.67, -0.36] },
      // Front decorative dark V-tie panel + twin bright LED DRL strips + chrome emblem
      { geo: box(0.18, 0.38, 0.06), color: 0x1c2026, pos: [0, 0.68, 0.61], rot: [-0.16, 0, 0] },
      { geo: box(0.035, 0.26, 0.04), color: 0xf4f8fc, pos: [0.15, 0.67, 0.62], rot: [-0.16, 0, 0.12] },
      { geo: box(0.035, 0.26, 0.04), color: 0xf4f8fc, pos: [-0.15, 0.67, 0.62], rot: [-0.16, 0, -0.12] },
      { geo: box(0.08, 0.06, 0.07), color: 0xeef4fa, pos: [0, 0.78, 0.63] },
      // Rear mudflap + red reflector
      { geo: box(0.24, 0.34, 0.045), color: 0x16191f, pos: [0, 0.54, -0.84], rot: [0.22, 0, 0] },
      { geo: box(0.08, 0.04, 0.03), color: 0xdc2626, pos: [0, 0.43, -0.87] },
    ];
    return bakeColoredParts(parts);
  }

  private buildBikeForkPaintGeo(): THREE.BufferGeometry {
    // Local to frontFork group at z = +0.62
    return bakePlainParts([
      // Crisp blocky front mudguard arching over front wheel
      { geo: box(0.16, 0.08, 0.40), pos: [0, 0.60, 0.04], rot: [0.20, 0, 0] },
      { geo: box(0.15, 0.16, 0.14), pos: [0, 0.52, -0.14], rot: [-0.32, 0, 0] },
      // Sculpted blocky handlebar headlamp cowl
      { geo: box(0.36, 0.17, 0.22), pos: [0, 1.00, -0.10] },
      { geo: box(0.26, 0.07, 0.16), pos: [0, 1.10, -0.11] },
    ]);
  }

  private buildBikeForkTrimGeo(): THREE.BufferGeometry {
    // Local to frontFork group at z = +0.62!
    const parts: ColoredGeoSpec[] = [
      // Telescopic fork stanchions (chrome) & dark lower fork legs
      { geo: cyl(0.022, 0.022, 0.56, 8), color: 0xd0d8e2, pos: [0.095, 0.69, -0.09], rot: [-0.28, 0, 0] },
      { geo: cyl(0.022, 0.022, 0.56, 8), color: 0xd0d8e2, pos: [-0.095, 0.69, -0.09], rot: [-0.28, 0, 0] },
      { geo: cyl(0.030, 0.028, 0.30, 8), color: 0x262c34, pos: [0.095, 0.41, -0.01], rot: [-0.28, 0, 0] },
      { geo: cyl(0.030, 0.028, 0.30, 8), color: 0x262c34, pos: [-0.095, 0.41, -0.01], rot: [-0.28, 0, 0] },
      // Front disc brake rotor (silver) + gold brake caliper!
      { geo: cyl(0.125, 0.125, 0.02, 10), color: 0xcbd5e1, pos: [0.068, 0.285, 0.0], rot: [0, 0, Math.PI / 2] },
      { geo: box(0.045, 0.08, 0.07), color: 0xd99b1e, pos: [0.075, 0.34, -0.09] },
      // Handlebar center shaft + rubber hand grips at (x=±0.31, y=0.99, z=-0.18 -> world z=+0.44!)
      { geo: box(0.46, 0.04, 0.04), color: 0x242a32, pos: [0, 0.99, -0.17] },
      { geo: box(0.15, 0.055, 0.055), color: 0x12151a, pos: [0.30, 0.99, -0.18], rot: [0, 0.16, 0] },
      { geo: box(0.15, 0.055, 0.055), color: 0x12151a, pos: [-0.30, 0.99, -0.18], rot: [0, -0.16, 0] },
      // Silver brake lever (right side)
      { geo: box(0.12, 0.02, 0.025), color: 0xdbe3ec, pos: [-0.27, 0.98, -0.12], rot: [0, -0.25, 0] },
      // Dashboard speedometer visor facing rider
      { geo: box(0.24, 0.11, 0.06), color: 0x161a20, pos: [0, 1.04, -0.20], rot: [-0.4, 0, 0] },
      { geo: box(0.18, 0.07, 0.02), color: 0x2e4a62, pos: [0, 1.04, -0.22], rot: [-0.4, 0, 0] },
      // Twin blocky rearview mirrors on angled dark stalks
      { geo: box(0.025, 0.16, 0.025), color: 0x1c2026, pos: [0.22, 1.13, -0.14], rot: [0, 0, -0.28] },
      { geo: box(0.025, 0.16, 0.025), color: 0x1c2026, pos: [-0.22, 1.13, -0.14], rot: [0, 0, 0.28] },
      { geo: box(0.13, 0.08, 0.035), color: 0x181c22, pos: [0.29, 1.21, -0.15] },
      { geo: box(0.13, 0.08, 0.035), color: 0x181c22, pos: [-0.29, 1.21, -0.15] },
      { geo: box(0.10, 0.06, 0.015), color: 0x9fb8cc, pos: [0.29, 1.21, -0.17] },
      { geo: box(0.10, 0.06, 0.015), color: 0x9fb8cc, pos: [-0.29, 1.21, -0.17] },
    ];
    return bakeColoredParts(parts);
  }

  private buildBikeHeadlightGeo(): THREE.BufferGeometry {
    return bakePlainParts([{ geo: box(0.22, 0.12, 0.05), pos: [0, 1.00, 0.01] }]);
  }

  private buildBikeTaillightGeo(): THREE.BufferGeometry {
    return bakePlainParts([{ geo: box(0.16, 0.11, 0.07), pos: [0, 0.77, -0.89] }]);
  }

  private buildBikeSignalGeo(side: 1 | -1): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(0.08, 0.09, 0.06), pos: [side * 0.13, 0.76, -0.87] },
      { geo: box(0.07, 0.10, 0.06), pos: [side * 0.16, 0.76, 0.52] },
    ]);
  }

  private buildShipperCargoBoxGeo(): THREE.BufferGeometry {
    // Detailed shipper thermal delivery bag with top flap & reflective strip
    return bakePlainParts([
      { geo: box(0.46, 0.44, 0.44), pos: [0, 0, 0] },
      { geo: box(0.49, 0.09, 0.47), pos: [0, 0.21, 0] },
    ]);
  }

  // =========================================================================
  // 3. FLAGSHIP ULTRA-DETAILED BLOCKY SAIGON CITY BUS (Xe buýt 01 Bến Thành)
  // =========================================================================
  private buildBusShellGeo(): THREE.BufferGeometry {
    // Painted Saigon Transit Blue (#1662b8) structural upper/lower body shell
    return bakePlainParts([
      // Lower body side panels (below window beltline y = 1.26)
      { geo: box(2.44, 0.80, 9.72), pos: [0, 0.86, 0] },
      // Upper roof fascia cap (above windows y = 2.48..2.94)
      { geo: box(2.42, 0.46, 9.68), pos: [0, 2.71, 0] },
      // Front corner pillars (left & right)
      { geo: box(0.22, 1.32, 0.26), pos: [1.11, 1.90, 4.74] },
      { geo: box(0.22, 1.32, 0.26), pos: [-1.11, 1.90, 4.74] },
      // Rear corner pillars & rear engine bulkhead wall
      { geo: box(2.42, 1.32, 0.26), pos: [0, 1.90, -4.74] },
      // Roof bevel crown
      { geo: box(2.24, 0.10, 9.40), pos: [0, 2.98, 0] },
    ]);
  }

  private buildBusGlassGeo(): THREE.BufferGeometry {
    // Semi-transparent dark tinted glass recessed cleanly inside dark mullions!
    return bakePlainParts([
      // Huge panoramic front windshield
      { geo: box(2.06, 1.22, 0.06), pos: [0, 1.92, 4.79] },
      // Left-side continuous window band (framed into 7 bays by dark mullions!)
      { geo: box(0.06, 1.12, 8.76), pos: [1.16, 1.92, -0.02] },
      // Right-side window band (front + middle + rear bays around doors)
      { geo: box(0.06, 1.12, 8.76), pos: [-1.16, 1.92, -0.02] },
      // Rear upper window
      { geo: box(1.96, 0.72, 0.06), pos: [0, 2.16, -4.81] },
    ]);
  }

  private buildBusTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [];

    // 1. ICONIC SAIGON LIVERY: Pure crisp white upper-belt band + golden-yellow speed stripe (clean 2cm steps!)
    parts.push({ geo: box(2.48, 0.22, 9.76), color: 0xf1f5f9, pos: [0, 1.22, 0] });
    parts.push({ geo: box(2.50, 0.11, 9.78), color: 0xf2b705, pos: [0, 0.94, 0] });
    // White lower rocker accent
    parts.push({ geo: box(2.47, 0.16, 9.74), color: 0xe6edf4, pos: [0, 0.56, 0] });

    // 2. DARK UNDERBODY CHASSIS + RECESSED WHEEL ARCHES + HEAVY BUMPERS
    parts.push({ geo: box(2.24, 0.22, 9.48), color: 0x161a20, pos: [0, 0.36, 0] });
    for (const wz of [-3.1, 3.1]) {
      // Recessed wheel cavity strictly INSIDE body shell (zero protrusion through white rocker!)
      parts.push({ geo: box(2.38, 0.64, 1.18), color: 0x101318, pos: [0, 0.54, wz] });
      // Crisp dark rubber wheel-arch eyebrows outside body
      parts.push({ geo: box(0.08, 0.10, 1.24), color: 0x1e242c, pos: [1.26, 0.88, wz] });
      parts.push({ geo: box(0.08, 0.10, 1.24), color: 0x1e242c, pos: [-1.26, 0.88, wz] });
    }
    // Front & rear heavy black bumpers with yellow corner reflectors
    parts.push({ geo: box(2.52, 0.34, 0.24), color: 0x1c2128, pos: [0, 0.58, 4.82] });
    parts.push({ geo: box(2.52, 0.34, 0.24), color: 0x1c2128, pos: [0, 0.58, -4.82] });

    // 3. 7 INDIVIDUAL FRAMED SIDE WINDOWS PER SIDE (vertical mullions cleanly proud of recessed glass!)
    parts.push({ geo: box(0.07, 0.08, 8.92), color: 0x181c22, pos: [1.225, 1.36, -0.02] });
    parts.push({ geo: box(0.07, 0.08, 8.92), color: 0x181c22, pos: [-1.225, 1.36, -0.02] });
    parts.push({ geo: box(0.07, 0.08, 8.92), color: 0x181c22, pos: [1.225, 2.48, -0.02] });
    parts.push({ geo: box(0.07, 0.08, 8.92), color: 0x181c22, pos: [-1.225, 2.48, -0.02] });
    for (let i = 0; i <= 7; i++) {
      const z = -4.38 + i * 1.25;
      parts.push({ geo: box(0.09, 1.18, 0.12), color: 0x181c22, pos: [1.225, 1.92, z] });
      parts.push({ geo: box(0.09, 1.18, 0.12), color: 0x181c22, pos: [-1.225, 1.92, z] });
    }

    // 4. TWIN FOLDING PASSENGER DOORS ON RIGHT SIDE (-X) (clean 2cm stepped layers, ZERO Z-fighting!)
    for (const dz of [3.75, 0.0]) {
      // Door outer rubber frame
      parts.push({ geo: box(0.06, 1.96, 1.14), color: 0x1b2026, pos: [-1.24, 1.46, dz] });
      // Twin door leaves proud of frame
      parts.push({ geo: box(0.04, 0.82, 0.48), color: 0xe6edf4, pos: [-1.275, 0.90, dz - 0.27] });
      parts.push({ geo: box(0.04, 0.82, 0.48), color: 0xe6edf4, pos: [-1.275, 0.90, dz + 0.27] });
      // Yellow safety step stripe proud of door leaves
      parts.push({ geo: box(0.04, 0.09, 1.04), color: 0xf2b705, pos: [-1.295, 0.54, dz] });
      // Center vertical door split rubber seal
      parts.push({ geo: box(0.05, 1.92, 0.05), color: 0x111418, pos: [-1.295, 1.46, dz] });
    }

    // 5. VISIBLE BUS INTERIOR (rows of blue passenger seats, floor aisle, yellow handrails & driver cab!)
    parts.push({ geo: box(2.14, 0.10, 8.80), color: 0x333c48, pos: [0, 0.82, -0.10] }); // Interior floor
    for (let r = 0; r < 6; r++) {
      const sz = -3.6 + r * 1.18;
      // Left pair of seats (seat base + high backrest)
      parts.push({ geo: box(0.76, 0.34, 0.42), color: 0x1d4ed8, pos: [0.64, 1.16, sz] });
      parts.push({ geo: box(0.76, 0.58, 0.12), color: 0x1e40af, pos: [0.64, 1.54, sz - 0.16] });
      // Right pair of seats (skip center exit door)
      if (r !== 3) {
        parts.push({ geo: box(0.76, 0.34, 0.42), color: 0x1d4ed8, pos: [-0.64, 1.16, sz] });
        parts.push({ geo: box(0.76, 0.58, 0.12), color: 0x1e40af, pos: [-0.64, 1.54, sz - 0.16] });
      }
      // Yellow vertical grab poles
      parts.push({ geo: box(0.05, 1.65, 0.05), color: 0xf2b705, pos: [0.24, 1.72, sz] });
    }
    // Driver seat + steering wheel + dashboard inside front-left
    parts.push({ geo: box(0.56, 0.52, 0.48), color: 0x272e38, pos: [0.68, 1.38, 3.65] });
    parts.push({ geo: box(0.78, 0.38, 0.48), color: 0x1a1e24, pos: [0.68, 1.32, 4.34] });

    // 6. ROOF DETAIL: Dual slatted AC units + twin roof escape hatches + clearance marker lamps!
    for (const acZ of [-1.45, 1.55]) {
      parts.push({ geo: box(1.76, 0.30, 2.15), color: 0xeaf0f6, pos: [0, 3.16, acZ] });
      parts.push({ geo: box(1.52, 0.06, 1.82), color: 0x252c36, pos: [0, 3.31, acZ] }); // Dark top fan grille!
      parts.push({ geo: box(1.80, 0.10, 1.70), color: 0x38414e, pos: [0, 3.16, acZ] }); // Side cooling slats
    }
    // Roof emergency hatches (front & rear)
    parts.push({ geo: box(0.92, 0.10, 0.78), color: 0xdce4ec, pos: [0, 3.06, 3.65] });
    parts.push({ geo: box(0.92, 0.10, 0.78), color: 0xdce4ec, pos: [0, 3.06, -3.65] });
    // Clearance roof marker lights (amber front, red rear)
    for (const s of [-1, 1]) {
      parts.push({ geo: box(0.16, 0.09, 0.08), color: 0xffb81c, pos: [s * 0.98, 2.90, 4.86] });
      parts.push({ geo: box(0.16, 0.09, 0.08), color: 0xef233c, pos: [s * 0.98, 2.90, -4.86] });
    }

    // 7. FRONT FASCIA: Split windshield divider, dual wipers, rabbit-ear mirrors, quad headlights, grille!
    parts.push({ geo: box(0.08, 1.24, 0.10), color: 0x161a20, pos: [0, 1.92, 4.84] }); // Center windshield mullion
    // Dual front wipers
    parts.push({ geo: box(0.76, 0.05, 0.05), color: 0x12151a, pos: [0.46, 1.44, 4.88], rot: [0, 0, 0.16] });
    parts.push({ geo: box(0.76, 0.05, 0.05), color: 0x12151a, pos: [-0.46, 1.44, 4.88], rot: [0, 0, -0.16] });
    // Twin extended bus rabbit-ear side mirrors (left & right!)
    for (const s of [-1, 1]) {
      parts.push({ geo: box(0.32, 0.05, 0.05), color: 0x181c22, pos: [s * 1.32, 2.30, 4.82] });
      parts.push({ geo: box(0.05, 0.05, 0.34), color: 0x181c22, pos: [s * 1.46, 2.30, 4.98] });
      parts.push({ geo: box(0.16, 0.42, 0.10), color: 0x1a1e24, pos: [s * 1.46, 2.08, 5.12] });
      parts.push({ geo: box(0.12, 0.36, 0.03), color: 0x9fb8cc, pos: [s * 1.46, 2.08, 5.06] });
    }
    // Front lower black grille & chrome bar
    parts.push({ geo: box(1.16, 0.24, 0.08), color: 0x15191f, pos: [0, 0.92, 4.88] });
    parts.push({ geo: box(1.12, 0.04, 0.09), color: 0xdbe3ec, pos: [0, 0.96, 4.89] });
    // Quad front headlights + amber turn signals + lower fog lights
    for (const s of [-1, 1]) {
      parts.push({ geo: box(0.42, 0.22, 0.08), color: 0x15191f, pos: [s * 0.86, 0.92, 4.88] });
      parts.push({ geo: box(0.24, 0.16, 0.09), color: 0xfff8dc, pos: [s * 0.79, 0.92, 4.90] });
      parts.push({ geo: box(0.12, 0.16, 0.09), color: 0xff9f1c, pos: [s * 0.98, 0.92, 4.90] });
      parts.push({ geo: box(0.18, 0.10, 0.08), color: 0xfff0b3, pos: [s * 0.86, 0.58, 4.93] });
    }

    // 8. REAR ENGINE LOUVER GRILLE + STACKED VERTICAL TAIL LAMPS + EXHAUST
    parts.push({ geo: box(1.48, 0.62, 0.08), color: 0x1b212a, pos: [0, 1.18, -4.88] });
    for (let k = 0; k < 4; k++) {
      parts.push({ geo: box(1.38, 0.04, 0.09), color: 0x3b4452, pos: [0, 0.98 + k * 0.13, -4.90] });
    }
    for (const s of [-1, 1]) {
      parts.push({ geo: box(0.24, 0.56, 0.08), color: 0x14171c, pos: [s * 1.02, 1.18, -4.88] });
      parts.push({ geo: box(0.18, 0.22, 0.09), color: 0xe62222, pos: [s * 1.02, 1.32, -4.90] }); // Red brake
      parts.push({ geo: box(0.18, 0.14, 0.09), color: 0xffa619, pos: [s * 1.02, 1.13, -4.90] }); // Amber blinker
      parts.push({ geo: box(0.18, 0.11, 0.09), color: 0xeef4fa, pos: [s * 1.02, 0.98, -4.90] }); // Reverse white
    }
    // Exhaust pipe under rear-left
    parts.push({ geo: box(0.14, 0.12, 0.28), color: 0x64748b, pos: [0.78, 0.38, -4.90] });

    return bakeColoredParts(parts);
  }

  // =========================================================================
  // 4. ULTRA-DETAILED BLOCKY VIETNAMESE CARGO TRUCK (Xe tải thùng kín)
  // =========================================================================
  private buildTruckCabGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(2.14, 1.66, 1.88), pos: [0, 1.48, 2.28] },
      { geo: box(2.04, 0.14, 1.74), pos: [0, 2.36, 2.24] }, // Roof cap
      { geo: box(2.18, 0.24, 0.42), pos: [0, 0.80, 3.04] }, // Lower nose fascia
    ]);
  }

  private buildTruckGlassGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(1.94, 0.72, 0.08), pos: [0, 1.88, 3.22] },
      { geo: box(2.18, 0.62, 0.96), pos: [0, 1.88, 2.42] },
    ]);
  }

  private buildTruckCargoGeo(): THREE.BufferGeometry {
    // Crisp ribbed corrugated aluminum cargo box (positioned at y=1.88, z=-1.40)
    const parts: PlainGeoSpec[] = [{ geo: box(2.30, 2.18, 4.62), pos: [0, 0, 0] }];
    for (let i = -5; i <= 5; i++) {
      parts.push({ geo: box(2.35, 1.96, 0.09), pos: [0, 0, i * 0.40] });
    }
    return bakePlainParts(parts);
  }

  private buildTruckTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [
      // Dark steel ladder chassis rails spanning full length
      { geo: box(1.56, 0.26, 6.70), color: 0x1a1e24, pos: [0, 0.54, -0.25] },
      // Side underrun safety guard bars (left & right) + fuel tank + spare tire
      { geo: box(0.08, 0.10, 2.65), color: 0xcbd5e1, pos: [1.08, 0.48, -0.05] },
      { geo: box(0.08, 0.10, 2.65), color: 0xcbd5e1, pos: [-1.08, 0.48, -0.05] },
      { geo: box(0.42, 0.36, 0.96), color: 0x3b4452, pos: [0.84, 0.56, 0.22] }, // Fuel tank
      { geo: cyl(0.36, 0.36, 0.22, 10), color: 0x16191e, pos: [-0.82, 0.52, -0.35] }, // Spare wheel
      // Cab front sun visor + dual wipers
      { geo: box(2.12, 0.12, 0.30), color: 0x1c2128, pos: [0, 2.34, 3.28], rot: [0.22, 0, 0] },
      { geo: box(0.68, 0.04, 0.04), color: 0x14171c, pos: [0.42, 1.56, 3.27], rot: [0, 0, 0.14] },
      { geo: box(0.68, 0.04, 0.04), color: 0x14171c, pos: [-0.42, 1.56, 3.27], rot: [0, 0, -0.14] },
      // Heavy front chrome grille + dark bumper + headlights + fog lamps
      { geo: box(1.62, 0.44, 0.08), color: 0x181c22, pos: [0, 1.18, 3.23] },
      { geo: box(1.54, 0.05, 0.09), color: 0xdbe3ec, pos: [0, 1.30, 3.24] },
      { geo: box(1.54, 0.05, 0.09), color: 0xdbe3ec, pos: [0, 1.18, 3.24] },
      { geo: box(1.54, 0.05, 0.09), color: 0xdbe3ec, pos: [0, 1.06, 3.24] },
      { geo: box(2.26, 0.32, 0.28), color: 0x20252d, pos: [0, 0.58, 3.20] },
      { geo: box(0.32, 0.18, 0.09), color: 0xfff8dc, pos: [0.80, 0.74, 3.26] },
      { geo: box(0.32, 0.18, 0.09), color: 0xfff8dc, pos: [-0.80, 0.74, 3.26] },
      { geo: box(0.14, 0.18, 0.09), color: 0xffa619, pos: [1.00, 0.74, 3.26] },
      { geo: box(0.14, 0.18, 0.09), color: 0xffa619, pos: [-1.00, 0.74, 3.26] },
      // Wide bracketed truck mirrors (left & right)
      { geo: box(0.24, 0.04, 0.04), color: 0x181c22, pos: [1.18, 2.08, 3.04] },
      { geo: box(0.24, 0.04, 0.04), color: 0x181c22, pos: [-1.18, 2.08, 3.04] },
      { geo: box(0.14, 0.38, 0.08), color: 0x181c22, pos: [1.28, 1.88, 3.06] },
      { geo: box(0.14, 0.38, 0.08), color: 0x181c22, pos: [-1.28, 1.88, 3.06] },
      // Cargo box corner aluminum edge trim + rear double-door vertical locking rods
      { geo: box(2.38, 0.10, 4.70), color: 0x64748b, pos: [0, 2.96, -1.40] },
      { geo: box(2.38, 0.10, 4.70), color: 0x475569, pos: [0, 0.82, -1.40] },
      { geo: box(0.06, 2.02, 0.06), color: 0x94a3b8, pos: [0.24, 1.88, -3.73] },
      { geo: box(0.06, 2.02, 0.06), color: 0x94a3b8, pos: [-0.24, 1.88, -3.73] },
      // Rear underrun bumper + red-white warning reflectors + tail lamps + mudflaps
      { geo: box(2.26, 0.24, 0.18), color: 0x1b2028, pos: [0, 0.56, -3.66] },
      { geo: box(0.32, 0.14, 0.08), color: 0xe62222, pos: [0.84, 0.62, -3.74] },
      { geo: box(0.32, 0.14, 0.08), color: 0xe62222, pos: [-0.84, 0.62, -3.74] },
      { geo: box(0.16, 0.14, 0.08), color: 0xffa619, pos: [1.04, 0.62, -3.74] },
      { geo: box(0.16, 0.14, 0.08), color: 0xffa619, pos: [-1.04, 0.62, -3.74] },
      { geo: box(0.34, 0.34, 0.04), color: 0x14171c, pos: [1.02, 0.32, -2.92] },
      { geo: box(0.34, 0.34, 0.04), color: 0x14171c, pos: [-1.02, 0.32, -2.92] },
    ];
    return bakeColoredParts(parts);
  }

  // =========================================================================
  // 5. ULTRA-DETAILED BLOCKY AMBULANCE 115 (Xe cứu thương)
  // =========================================================================
  private buildAmbulanceShellGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      // Main high-roof medical van body
      { geo: box(2.04, 1.84, 4.18), pos: [0, 1.46, -0.52] },
      // Sloped van hood & front fenders
      { geo: box(2.02, 0.88, 1.24), pos: [0, 0.94, 2.02] },
      { geo: box(1.94, 0.16, 4.02), pos: [0, 2.44, -0.52] },
    ]);
  }

  private buildAmbulanceGlassGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(1.86, 0.78, 0.08), pos: [0, 1.84, 1.66], rot: [-0.26, 0, 0] },
      { geo: box(2.08, 0.64, 1.06), pos: [0, 1.84, 0.96] },
      { geo: box(1.76, 0.62, 0.08), pos: [0, 1.82, -2.62] },
    ]);
  }

  private buildAmbulanceTrimGeo(): THREE.BufferGeometry {
    const parts: ColoredGeoSpec[] = [
      // Dark chassis & recessed wheel wells
      { geo: box(1.92, 0.22, 5.12), color: 0x181c22, pos: [0, 0.38, 0] },
      { geo: box(2.04, 0.48, 0.92), color: 0x111419, pos: [0, 0.52, 1.56] },
      { geo: box(2.04, 0.48, 0.92), color: 0x111419, pos: [0, 0.52, -1.52] },
      // Bold crimson emergency waist stripe wrapping entire van!
      { geo: box(2.09, 0.24, 5.26), color: 0xd91c1c, pos: [0, 0.98, 0.02] },
      // High-visibility yellow safety stripe right beneath red stripe
      { geo: box(2.08, 0.09, 5.24), color: 0xf5c227, pos: [0, 0.81, 0.02] },
      // Large crisp Red Cross emblems on both sides & front hood!
      { geo: box(0.06, 0.66, 0.22), color: 0xd91c1c, pos: [1.04, 1.78, -0.95] },
      { geo: box(0.06, 0.22, 0.66), color: 0xd91c1c, pos: [1.04, 1.78, -0.95] },
      { geo: box(0.06, 0.66, 0.22), color: 0xd91c1c, pos: [-1.04, 1.78, -0.95] },
      { geo: box(0.06, 0.22, 0.66), color: 0xd91c1c, pos: [-1.04, 1.78, -0.95] },
      { geo: box(0.46, 0.05, 0.16), color: 0xd91c1c, pos: [0, 1.40, 2.12], rot: [0.12, 0, 0] },
      { geo: box(0.16, 0.05, 0.46), color: 0xd91c1c, pos: [0, 1.40, 2.12], rot: [0.12, 0, 0] },
      // Front bumper, chrome grille, headlights, mirrors
      { geo: box(2.08, 0.30, 0.22), color: 0x1c2128, pos: [0, 0.54, 2.62] },
      { geo: box(1.12, 0.32, 0.08), color: 0x1a1e24, pos: [0, 0.94, 2.66] },
      { geo: box(1.06, 0.05, 0.09), color: 0xdbe3ec, pos: [0, 1.00, 2.67] },
      { geo: box(1.06, 0.05, 0.09), color: 0xdbe3ec, pos: [0, 0.88, 2.67] },
      { geo: box(0.32, 0.20, 0.09), color: 0xfff8dc, pos: [0.76, 0.94, 2.66] },
      { geo: box(0.32, 0.20, 0.09), color: 0xfff8dc, pos: [-0.76, 0.94, 2.66] },
      { geo: box(0.18, 0.28, 0.10), color: 0x181c22, pos: [1.14, 1.62, 1.46] },
      { geo: box(0.18, 0.28, 0.10), color: 0x181c22, pos: [-1.14, 1.62, 1.46] },
      // Roof lightbar base mount
      { geo: box(1.24, 0.08, 0.32), color: 0x1e242c, pos: [0, 2.54, 0.95] },
      // Rear bumper step + vertical taillights + rear door split
      { geo: box(2.08, 0.24, 0.28), color: 0x262c34, pos: [0, 0.52, -2.66] },
      { geo: box(0.06, 1.66, 0.06), color: 0x181c22, pos: [0, 1.46, -2.63] },
      { geo: box(0.18, 0.44, 0.09), color: 0xe62222, pos: [0.90, 1.12, -2.64] },
      { geo: box(0.18, 0.44, 0.09), color: 0xe62222, pos: [-0.90, 1.12, -2.64] },
    ];
    return bakeColoredParts(parts);
  }

  // =========================================================================
  // 6. ULTRA-DETAILED BLOCKY VIETNAMESE BICYCLE (Xe đạp mini có giỏ)
  // =========================================================================
  private buildBicycleFrameGeo(): THREE.BufferGeometry {
    return bakePlainParts([
      { geo: box(0.05, 0.56, 0.05), pos: [0, 0.58, -0.14], rot: [-0.18, 0, 0] }, // Seat tube
      { geo: box(0.05, 0.58, 0.05), pos: [0, 0.56, 0.12], rot: [0.74, 0, 0] }, // Down tube
      { geo: box(0.05, 0.54, 0.05), pos: [0, 0.72, 0.08], rot: [Math.PI / 2, 0, 0] }, // Top tube
      { geo: box(0.05, 0.56, 0.05), pos: [0, 0.62, 0.44], rot: [-0.24, 0, 0] }, // Head tube & fork
      { geo: box(0.04, 0.44, 0.04), pos: [0.06, 0.46, -0.34], rot: [0.72, 0, 0] }, // Rear seatstays
      { geo: box(0.04, 0.44, 0.04), pos: [-0.06, 0.46, -0.34], rot: [0.72, 0, 0] },
      // Front & rear mudguards
      { geo: box(0.09, 0.04, 0.34), pos: [0, 0.66, 0.52] },
      { geo: box(0.09, 0.04, 0.34), pos: [0, 0.66, -0.52] },
    ]);
  }

  private buildBicycleTrimGeo(): THREE.BufferGeometry {
    return bakeColoredParts([
      // Handlebar + grips
      { geo: box(0.54, 0.04, 0.04), color: 0xcbd5e1, pos: [0, 0.94, 0.35] },
      { geo: box(0.11, 0.05, 0.05), color: 0x181c22, pos: [0.24, 0.94, 0.34] },
      { geo: box(0.11, 0.05, 0.05), color: 0x181c22, pos: [-0.24, 0.94, 0.34] },
      // Front wire basket (giỏ xe đạp!)
      { geo: box(0.28, 0.22, 0.22), color: 0x475569, pos: [0, 0.82, 0.54] },
      { geo: box(0.24, 0.18, 0.18), color: 0x262d38, pos: [0, 0.85, 0.54] },
      // Saddle & rear steel luggage rack (baga sau!)
      { geo: box(0.16, 0.08, 0.24), color: 0x241f1d, pos: [0, 0.89, -0.20] },
      { geo: box(0.18, 0.04, 0.42), color: 0xcbd5e1, pos: [0, 0.72, -0.52] },
      // Chain guard & pedals
      { geo: box(0.05, 0.14, 0.42), color: 0x334155, pos: [-0.07, 0.34, -0.30] },
      { geo: box(0.32, 0.04, 0.06), color: 0x1a1e24, pos: [0, 0.32, -0.06] },
    ]);
  }

  // =========================================================================
  // PUBLIC VEHICLE BUILDERS
  // =========================================================================

  /** Clone an existing geometry, optionally translate/colorize it, and strip extras for merging. */
  private prepGeoForMerge(
    src: THREE.BufferGeometry,
    tintHex: number | null,
    offsetZ = 0,
    offsetY = 0,
  ): THREE.BufferGeometry {
    const g = src.index ? src.toNonIndexed() : src.clone();
    if (offsetY !== 0 || offsetZ !== 0) g.translate(0, offsetY, offsetZ);
    const count = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (tintHex !== null || !g.attributes.color) {
      _col.setHex(tintHex ?? 0xffffff);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = _col.r;
        colors[i * 3 + 1] = _col.g;
        colors[i * 3 + 2] = _col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') {
        g.deleteAttribute(k);
      }
    }
    return g;
  }

  private getNpcSedanBakedGeo(colorHex: number, isTaxi: boolean): THREE.BufferGeometry {
    const key = `sedan|${isTaxi ? 0x117a37 : colorHex}|${isTaxi ? 1 : 0}`;
    const existing = this.npcBodyCache.get(key);
    if (existing) return existing;
    const parts: THREE.BufferGeometry[] = [
      this.prepGeoForMerge(this.geo.sedanPaintShell, isTaxi ? 0x117a37 : colorHex),
      this.prepGeoForMerge(this.geo.sedanTrimBaked, null),
      this.prepGeoForMerge(this.geo.sedanHeadlights, 0xfff8dc),
      this.prepGeoForMerge(this.geo.sedanTaillights, 0xdc1e1e),
    ];
    if (isTaxi) {
      parts.push(
        this.prepGeoForMerge(this.geo.taxiCheckers, null),
        this.prepGeoForMerge(this.geo.taxiRoofSign, 0xfacc15, -0.22, 1.54),
      );
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) throw new Error('getNpcSedanBakedGeo merge failed');
    merged.computeBoundingSphere();
    this.disposables.push(merged);
    this.npcBodyCache.set(key, merged);
    return merged;
  }

  private getNpcBikeBakedGeo(kind: 'wave110' | 'vision110', colorHex: number, cargoBoxColor: number | null): THREE.BufferGeometry {
    const key = `bike|${kind}|${colorHex}|${cargoBoxColor ?? -1}`;
    const existing = this.npcBodyCache.get(key);
    if (existing) return existing;
    const isScooter = kind === 'vision110';
    const parts: THREE.BufferGeometry[] = [
      this.prepGeoForMerge(isScooter ? this.geo.visionBodyPaint : this.geo.waveBodyPaint, colorHex),
      this.prepGeoForMerge(isScooter ? this.geo.visionTrimBaked : this.geo.waveTrimBaked, null),
      this.prepGeoForMerge(this.geo.bikeForkPaint, colorHex, 0.62, 0),
      this.prepGeoForMerge(this.geo.bikeForkTrim, null, 0.62, 0),
      this.prepGeoForMerge(this.geo.bikeHeadlight, 0xfff8dc, 0.62, 0),
      this.prepGeoForMerge(this.geo.bikeTaillight, 0xdc1e1e),
    ];
    if (cargoBoxColor) {
      parts.push(this.prepGeoForMerge(this.geo.cargoBox, cargoBoxColor, -0.62, 1.08));
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) throw new Error('getNpcBikeBakedGeo merge failed');
    merged.computeBoundingSphere();
    this.disposables.push(merged);
    this.npcBodyCache.set(key, merged);
    return merged;
  }

  /** Build ultra-detailed crisp blocky Sedan or Taxi Mai Linh (hero ~10 DC, NPC batched ~6 DC!). */
  buildSedan(opts: { colorHex: number; isHero?: boolean; isTaxi?: boolean; castShadow?: boolean; plateText?: string }): BuiltVehicleParts {
    const g = new THREE.Group();
    const cast = Boolean(opts.castShadow);

    const wheels: THREE.Object3D[] = [];
    const wheelCoords: [number, number][] = [
      [0.84, 1.32],
      [-0.84, 1.32],
      [0.84, -1.26],
      [-0.84, -1.26],
    ];

    if (!opts.isHero) {
      // ULTRA-FAST NPC PATH: 1 merged vertex-colored body mesh + 1 glass + 1 plates + 4 wheels!
      const baked = new THREE.Mesh(this.getNpcSedanBakedGeo(opts.colorHex, Boolean(opts.isTaxi)), this.matVertexAuto);
      baked.castShadow = cast;
      baked.receiveShadow = true;
      g.add(baked);
      g.add(new THREE.Mesh(this.geo.sedanGlass, this.matGlass));
      const plateMat = this.getLicensePlateMaterial(opts.plateText ?? (opts.isTaxi ? '51H-642.19' : '30K-862.19'), '', Boolean(opts.isTaxi));
      g.add(new THREE.Mesh(this.geo.sedanPlates, plateMat));
      for (const [wx, wz] of wheelCoords) {
        const wm = new THREE.Mesh(this.geo.carWheelBaked, this.matVertexWheel);
        wm.position.set(wx, 0.33, wz);
        wheels.push(wm);
        g.add(wm);
      }
      return { group: g, wheels, headlightMats: [], brakeLightMats: [], signalLeftMats: [], signalRightMats: [] };
    }

    const paint = this.getPaintMaterial(opts.isTaxi ? 0x117a37 : opts.colorHex, opts.isHero);

    const body = new THREE.Mesh(this.geo.sedanPaintShell, paint);
    body.castShadow = cast;
    body.receiveShadow = true;
    g.add(body);

    const glass = new THREE.Mesh(this.geo.sedanGlass, this.matGlass);
    g.add(glass);

    const trim = new THREE.Mesh(this.geo.sedanTrimBaked, this.matVertexAuto);
    trim.castShadow = cast;
    g.add(trim);

    const hlMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xfff3c4, emissiveIntensity: 0.4, roughness: 0.15, flatShading: true });
    const brkMat = new THREE.MeshStandardMaterial({ color: 0xcc1818, emissive: 0xff1e1e, emissiveIntensity: 0.45, roughness: 0.2, flatShading: true });
    const sigLMat = new THREE.MeshStandardMaterial({ color: 0x995a0e, emissive: 0xffa800, emissiveIntensity: 0, flatShading: true });
    const sigRMat = new THREE.MeshStandardMaterial({ color: 0x995a0e, emissive: 0xffa800, emissiveIntensity: 0, flatShading: true });
    this.disposables.push(hlMat, brkMat, sigLMat, sigRMat);

    g.add(new THREE.Mesh(this.geo.sedanHeadlights, hlMat));
    g.add(new THREE.Mesh(this.geo.sedanTaillights, brkMat));
    g.add(new THREE.Mesh(this.geo.sedanSignalL, sigLMat));
    g.add(new THREE.Mesh(this.geo.sedanSignalR, sigRMat));

    const plateMat = this.getLicensePlateMaterial(opts.plateText ?? (opts.isTaxi ? '51H-642.19' : '30K-862.19'), '', Boolean(opts.isTaxi));
    g.add(new THREE.Mesh(this.geo.sedanPlates, plateMat));

    if (opts.isTaxi) {
      g.add(new THREE.Mesh(this.geo.taxiCheckers, this.matVertexAuto));
      const sign = new THREE.Mesh(this.geo.taxiRoofSign, this.matTaxiSign);
      sign.position.set(0, 1.54, -0.22);
      g.add(sign);
    }

    for (const [wx, wz] of wheelCoords) {
      const wm = new THREE.Mesh(this.geo.carWheelBaked, this.matVertexWheel);
      wm.position.set(wx, 0.33, wz);
      wheels.push(wm);
      g.add(wm);
    }

    return {
      group: g,
      wheels,
      headlightMats: [hlMat],
      brakeLightMats: [brkMat],
      signalLeftMats: [sigLMat],
      signalRightMats: [sigRMat],
    };
  }

  /** Build ultra-detailed crisp blocky Honda Wave 110 or Vision 110 (hero ~9 DC, NPC batched 4 DC!). */
  buildMotorbike(opts: {
    kind: 'wave110' | 'vision110';
    colorHex: number;
    isHero?: boolean;
    castShadow?: boolean;
    cargoBoxColor?: number | null;
    plateTop?: string;
    plateBottom?: string;
  }): BuiltVehicleParts {
    const g = new THREE.Group();
    const isScooter = opts.kind === 'vision110';
    const cast = Boolean(opts.castShadow);
    const wheels: THREE.Object3D[] = [];

    if (!opts.isHero) {
      // ULTRA-FAST NPC PATH: 1 merged vertex-colored bike+fork+cargo mesh + 2 wheels + 1 license plate = 4 DC!
      const baked = new THREE.Mesh(
        this.getNpcBikeBakedGeo(opts.kind, opts.colorHex, opts.cargoBoxColor ?? null),
        this.matVertexAuto,
      );
      baked.castShadow = cast;
      baked.receiveShadow = true;
      g.add(baked);

      const rearW = new THREE.Mesh(this.geo.bikeWheelBaked, this.matVertexWheel);
      rearW.position.set(0, 0.285, -0.62);
      const frontW = new THREE.Mesh(this.geo.bikeWheelBaked, this.matVertexWheel);
      frontW.position.set(0, 0.285, 0.62);
      wheels.push(rearW, frontW);
      g.add(rearW, frontW);

      const plateMat = this.getLicensePlateMaterial(opts.plateTop ?? '59-D1', opts.plateBottom ?? '682.45', false);
      const plate = new THREE.Mesh(this.geo.plateBike, plateMat);
      plate.position.set(0, 0.56, -0.925);
      plate.rotation.x = 0.22;
      g.add(plate);

      return { group: g, wheels, headlightMats: [], brakeLightMats: [], signalLeftMats: [], signalRightMats: [] };
    }

    const paint = this.getPaintMaterial(opts.colorHex, opts.isHero);

    const body = new THREE.Mesh(isScooter ? this.geo.visionBodyPaint : this.geo.waveBodyPaint, paint);
    body.castShadow = cast;
    body.receiveShadow = true;
    g.add(body);

    const trim = new THREE.Mesh(isScooter ? this.geo.visionTrimBaked : this.geo.waveTrimBaked, this.matVertexAuto);
    trim.castShadow = cast;
    g.add(trim);

    const rearW = new THREE.Mesh(this.geo.bikeWheelBaked, this.matVertexWheel);
    rearW.position.set(0, 0.285, -0.62);
    wheels.push(rearW);
    g.add(rearW);

    const fork = new THREE.Group();
    fork.position.set(0, 0, 0.62);

    const frontW = new THREE.Mesh(this.geo.bikeWheelBaked, this.matVertexWheel);
    frontW.position.set(0, 0.285, 0);
    wheels.push(frontW);
    fork.add(frontW);

    const fPaint = new THREE.Mesh(this.geo.bikeForkPaint, paint);
    fPaint.castShadow = cast;
    fork.add(fPaint);
    fork.add(new THREE.Mesh(this.geo.bikeForkTrim, this.matVertexAuto));

    const hlMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xfff4c2, emissiveIntensity: 0.45, flatShading: true });
    const brkMat = new THREE.MeshStandardMaterial({ color: 0xcc1818, emissive: 0xff1e1e, emissiveIntensity: 0.45, flatShading: true });
    const sigLMat = new THREE.MeshStandardMaterial({ color: 0xb06810, emissive: 0xffa800, emissiveIntensity: 0, flatShading: true });
    const sigRMat = new THREE.MeshStandardMaterial({ color: 0xb06810, emissive: 0xffa800, emissiveIntensity: 0, flatShading: true });
    this.disposables.push(hlMat, brkMat, sigLMat, sigRMat);

    fork.add(new THREE.Mesh(this.geo.bikeHeadlight, hlMat));
    g.add(fork);

    g.add(new THREE.Mesh(this.geo.bikeTaillight, brkMat));
    g.add(new THREE.Mesh(this.geo.bikeSignalL, sigLMat));
    g.add(new THREE.Mesh(this.geo.bikeSignalR, sigRMat));

    const plateMat = this.getLicensePlateMaterial(opts.plateTop ?? '59-D1', opts.plateBottom ?? '682.45', false);
    const plate = new THREE.Mesh(this.geo.plateBike, plateMat);
    plate.position.set(0, 0.56, -0.925);
    plate.rotation.x = 0.22;
    g.add(plate);

    if (opts.cargoBoxColor) {
      const boxMesh = new THREE.Mesh(this.geo.cargoBox, this.getPaintMaterial(opts.cargoBoxColor, false));
      boxMesh.position.set(0, 1.08, -0.62);
      g.add(boxMesh);
    }

    return {
      group: g,
      wheels,
      frontFork: fork,
      headlightMats: [hlMat],
      brakeLightMats: [brkMat],
      signalLeftMats: [sigLMat],
      signalRightMats: [sigRMat],
    };
  }

  /** Build Flagship Ultra-Detailed Saigon City Bus (~10 draw calls!). */
  buildBus(castShadow = false): BuiltVehicleParts {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(this.geo.busShell, this.matBusBlue);
    shell.castShadow = castShadow;
    shell.receiveShadow = true;
    g.add(shell);

    const trim = new THREE.Mesh(this.geo.busTrimBaked, this.matVertexAuto);
    trim.castShadow = castShadow;
    g.add(trim);

    // Translucent tinted glass rendered AFTER opaque seats/interior
    const glass = new THREE.Mesh(this.geo.busGlass, this.matBusGlass);
    glass.renderOrder = 2;
    g.add(glass);

    const routeFront = new THREE.Mesh(this.geo.busRouteBoardFront, this.matBusSignFront);
    routeFront.position.set(0, 2.72, 4.86);
    g.add(routeFront);

    const routeRear = new THREE.Mesh(this.geo.busRouteBoardRear, this.matBusSignRear);
    routeRear.position.set(0, 2.72, -4.86);
    routeRear.rotation.y = Math.PI;
    g.add(routeRear);

    const busPlateMat = this.getLicensePlateMaterial('51B-284.61', '', true);
    g.add(new THREE.Mesh(this.geo.busPlates, busPlateMat));

    const wheels: THREE.Object3D[] = [];
    for (const wz of [-3.1, 3.1]) {
      for (const wx of [-1.18, 1.18]) {
        const w = new THREE.Mesh(this.geo.heavyWheelBaked, this.matVertexWheel);
        w.position.set(wx, 0.43, wz);
        wheels.push(w);
        g.add(w);
      }
    }
    return { group: g, wheels, headlightMats: [], brakeLightMats: [], signalLeftMats: [], signalRightMats: [] };
  }

  /** Build Ultra-Detailed Blocky Cargo Truck (~9 draw calls!). */
  buildTruck(colorHex: number, castShadow = false): BuiltVehicleParts {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(this.geo.truckCab, this.getPaintMaterial(colorHex, false));
    cab.castShadow = castShadow;
    cab.receiveShadow = true;
    g.add(cab);

    g.add(new THREE.Mesh(this.geo.truckGlass, this.matGlass));

    const trim = new THREE.Mesh(this.geo.truckTrimBaked, this.matVertexAuto);
    trim.castShadow = castShadow;
    g.add(trim);

    const cargo = new THREE.Mesh(this.geo.truckCargo, this.matCargoWhite);
    cargo.position.set(0, 1.88, -1.40);
    cargo.castShadow = castShadow;
    cargo.receiveShadow = true;
    g.add(cargo);

    const plateMat = this.getLicensePlateMaterial('51C-419.82', '', true);
    g.add(new THREE.Mesh(this.geo.truckPlates, plateMat));

    const wheels: THREE.Object3D[] = [];
    for (const wz of [-2.4, 2.35]) {
      for (const wx of [-1.06, 1.06]) {
        const w = new THREE.Mesh(this.geo.heavyWheelBaked, this.matVertexWheel);
        w.scale.setScalar(0.95);
        w.position.set(wx, 0.41, wz);
        wheels.push(w);
        g.add(w);
      }
    }
    return { group: g, wheels, headlightMats: [], brakeLightMats: [], signalLeftMats: [], signalRightMats: [] };
  }

  /** Build Ultra-Detailed Blocky Ambulance 115 (~10 draw calls!). */
  buildAmbulance(castShadow = false): BuiltVehicleParts {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geo.ambulanceShell, this.matAmbulanceWhite);
    body.castShadow = castShadow;
    body.receiveShadow = true;
    g.add(body);
    g.add(new THREE.Mesh(this.geo.ambulanceGlass, this.matGlass));
    g.add(new THREE.Mesh(this.geo.ambulanceTrimBaked, this.matVertexAuto));

    const plateMat = this.getLicensePlateMaterial('51B-115.09', '', false);
    g.add(new THREE.Mesh(this.geo.ambulancePlates, plateMat));

    const sirenRed = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1e1e, emissiveIntensity: 2.5, flatShading: true });
    const sirenBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x2563eb, emissiveIntensity: 0.1, flatShading: true });
    this.disposables.push(sirenRed, sirenBlue);

    const l1 = new THREE.Mesh(this.geo.sirenBox, sirenRed);
    l1.position.set(0.32, 2.62, 0.95);
    const l2 = new THREE.Mesh(this.geo.sirenBox, sirenBlue);
    l2.position.set(-0.32, 2.62, 0.95);
    g.add(l1, l2);

    const wheels: THREE.Object3D[] = [];
    for (const wz of [-1.52, 1.56]) {
      for (const wx of [-0.96, 0.96]) {
        const w = new THREE.Mesh(this.geo.carWheelBaked, this.matVertexWheel);
        w.scale.setScalar(1.08);
        w.position.set(wx, 0.36, wz);
        wheels.push(w);
        g.add(w);
      }
    }
    return {
      group: g,
      wheels,
      headlightMats: [],
      brakeLightMats: [],
      signalLeftMats: [],
      signalRightMats: [],
      sirenRed,
      sirenBlue,
    };
  }

  /** Build Ultra-Detailed Blocky Bicycle (~4 draw calls!). */
  buildBicycle(colorHex: number): BuiltVehicleParts {
    const g = new THREE.Group();
    const paint = this.getPaintMaterial(colorHex, false);
    const wheels: THREE.Object3D[] = [];
    for (const wz of [-0.52, 0.52]) {
      const w = new THREE.Mesh(this.geo.bicycleWheelBaked, this.matVertexWheel);
      w.position.set(0, 0.32, wz);
      wheels.push(w);
      g.add(w);
    }
    g.add(new THREE.Mesh(this.geo.bicycleFrame, paint));
    g.add(new THREE.Mesh(this.geo.bicycleTrim, this.matVertexAuto));
    return { group: g, wheels, headlightMats: [], brakeLightMats: [], signalLeftMats: [], signalRightMats: [] };
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.paintCache.clear();
    this.plateCache.clear();
    this.npcBodyCache.clear();
  }
}
