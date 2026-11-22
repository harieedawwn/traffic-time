import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shared Geometry & Material Pool for Ultra-Detailed Crisp Blocky / Voxel-Craft 3D Humans & Dogs.
 * Every pedestrian & motorbike rider features crisp flat-shaded voxel anatomy with connected joints
 * (zero floating spheres or blobby capsules!), detailed facial features (eyes, eyebrows, nose,
 * layered hair, optional khẩu trang face mask, layered half-face helmet w/ racing stripe & tinted
 * visor, or stepped nón lá), jacket collar/zipper/belt/backpack, cuffed trousers & two-tone sneakers.
 * Per-segment vertex-color baking keeps every rider to 3 draw calls and every walker to 6 draw calls!
 */
export interface ArticulatedHumanRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  forearmL: THREE.Group;
  armR: THREE.Group;
  forearmR: THREE.Group;
  legL: THREE.Group;
  shinL: THREE.Group;
  legR: THREE.Group;
  shinR: THREE.Group;
}

export interface ArticulatedDogRig {
  root: THREE.Group;
  body: THREE.Group;
  tail: THREE.Group;
  legFL: THREE.Group;
  legFR: THREE.Group;
  legBL: THREE.Group;
  legBR: THREE.Group;
}

export interface HumanBuildOptions {
  pose: 'walk' | 'rideMotorbike' | 'rideScooter' | 'rideBicycle';
  shirtColor: number;
  pantsColor: number;
  skinTone?: number;
  hairColor?: number;
  helmetColor?: number | null;
  conicalHat?: boolean;
  faceMask?: boolean;
  backpackColor?: number | null;
  heightScale?: number;
  castShadow?: boolean;
}

interface ColoredPart {
  geo: THREE.BufferGeometry;
  color: number;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

const SKIN_TONES = [0xdba782, 0xd19a74, 0xe4b896, 0xc78f68];
const SHOE_COLORS = [0x1c2128, 0x2f3b4c, 0xc9302c, 0x3b2f26];

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function darkenHex(hex: number, factor = 0.78): number {
  _c.setHex(hex);
  _c.multiplyScalar(factor);
  return _c.getHex();
}

function lightenHex(hex: number, factor = 1.18): number {
  _c.setHex(hex);
  _c.r = Math.min(1, _c.r * factor);
  _c.g = Math.min(1, _c.g * factor);
  _c.b = Math.min(1, _c.b * factor);
  return _c.getHex();
}

function bakeParts(parts: ColoredPart[]): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  for (const pt of parts) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    pt.geo.dispose();
    _p.set(pt.pos?.[0] ?? 0, pt.pos?.[1] ?? 0, pt.pos?.[2] ?? 0);
    _e.set(pt.rot?.[0] ?? 0, pt.rot?.[1] ?? 0, pt.rot?.[2] ?? 0);
    _q.setFromEuler(_e);
    _s.set(pt.scale?.[0] ?? 1, pt.scale?.[1] ?? 1, pt.scale?.[2] ?? 1);
    _m4.compose(_p, _q, _s);
    g.applyMatrix4(_m4);
    g.computeVertexNormals();
    const count = g.attributes.position.count;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    _c.setHex(pt.color);
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = _c.r;
      cols[i * 3 + 1] = _c.g;
      cols[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') {
        g.deleteAttribute(k);
      }
    }
    list.push(g);
  }
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  if (!merged) throw new Error('HumanBuilder bakeParts failed');
  merged.computeBoundingSphere();
  return merged;
}

export class HumanAssetPool {
  private disposables: { dispose: () => void }[] = [];
  private bakedCache = new Map<string, THREE.BufferGeometry>();

  readonly matHuman: THREE.MeshStandardMaterial;
  readonly matFur: THREE.MeshStandardMaterial;

  constructor() {
    this.matHuman = this.track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    this.matFur = this.track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.02,
        flatShading: true,
      }),
    );
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private getOrBake(key: string, builder: () => ColoredPart[]): THREE.BufferGeometry {
    const cached = this.bakedCache.get(key);
    if (cached) return cached;
    const geo = this.track(bakeParts(builder()));
    this.bakedCache.set(key, geo);
    return geo;
  }

  /**
   * Build an ultra-detailed crisp blocky / voxel-craft 3D human (+Z forward, +Y up, +X left).
   * Connected blocky shoulders/elbows/hips/knees, detailed facial features, helmet/nón lá,
   * jacket collar/zipper/belt/backpack, cuffed trousers & two-tone sneakers!
   */
  buildHuman(opts: HumanBuildOptions): ArticulatedHumanRig {
    const skin = opts.skinTone ?? SKIN_TONES[Math.abs(opts.shirtColor) % SKIN_TONES.length];
    const hair = opts.hairColor ?? 0x18171c;
    const shoe = SHOE_COLORS[Math.abs(opts.pantsColor + opts.shirtColor) % SHOE_COLORS.length];
    const isRiding = opts.pose !== 'walk';
    const handColor = isRiding && opts.pose !== 'rideBicycle' ? 0x1a1e24 : skin; // Riding gloves!
    const shirtDark = darkenHex(opts.shirtColor, 0.76);
    const shirtLight = lightenHex(opts.shirtColor, 1.15);
    const pantsDark = darkenHex(opts.pantsColor, 0.78);
    const cast = Boolean(opts.castShadow);

    // 1. Torso + Pelvis + Belt + Jacket Collar/Zipper/Pocket + Optional Detailed Backpack
    const torsoKey = `v2-torso|${opts.shirtColor}|${opts.pantsColor}|${skin}|${opts.backpackColor ?? 'none'}|${isRiding ? 1 : 0}`;
    const torsoGeo = this.getOrBake(torsoKey, () => {
      const parts: ColoredPart[] = [
        // Pelvis & hips block (connects seamlessly to legs!)
        { geo: box(0.32, 0.14, 0.21), color: opts.pantsColor, pos: [0, 0.02, 0] },
        // Leather belt + metallic silver belt buckle
        { geo: box(0.335, 0.048, 0.225), color: 0x1a1817, pos: [0, 0.095, 0] },
        { geo: box(0.065, 0.042, 0.025), color: 0xcbd5e1, pos: [0, 0.095, 0.112] },
        // Lower jacket hem & waist
        { geo: box(0.34, 0.16, 0.22), color: opts.shirtColor, pos: [0, 0.18, 0] },
        // Broad athletic chest & upper shoulders (connects flush to upper arms!)
        { geo: box(0.39, 0.26, 0.235), color: opts.shirtColor, pos: [0, 0.36, 0] },
        // Shoulder yoke accent panels (crisp visual contrast!)
        { geo: box(0.405, 0.075, 0.24), color: shirtDark, pos: [0, 0.455, 0] },
        // Front vertical dark jacket zipper + silver slider + inner white tee V-neck
        { geo: box(0.026, 0.34, 0.018), color: 0x1b2028, pos: [0, 0.30, 0.116] },
        { geo: box(0.085, 0.075, 0.03), color: 0xedf2f7, pos: [0, 0.455, 0.108] },
        // Jacket standing collar around neck
        { geo: box(0.18, 0.06, 0.17), color: shirtDark, pos: [0, 0.495, -0.005] },
        // Left chest pocket + flap
        { geo: box(0.085, 0.085, 0.02), color: shirtDark, pos: [0.10, 0.37, 0.118] },
        { geo: box(0.09, 0.025, 0.024), color: shirtLight, pos: [0.10, 0.405, 0.12] },
        // Back jacket seam + reflective horizontal safety strip for VN riders!
        { geo: box(0.33, 0.038, 0.018), color: isRiding ? 0xdce6f0 : shirtDark, pos: [0, 0.33, -0.118] },
        // Sculpted neck column
        { geo: box(0.105, 0.09, 0.105), color: skin, pos: [0, 0.54, 0] },
      ];

      if (opts.backpackColor) {
        const bpDark = darkenHex(opts.backpackColor, 0.72);
        // Main backpack volume + lower zippered pocket + top handle + shoulder straps wrapping chest!
        parts.push(
          { geo: box(0.28, 0.34, 0.13), color: opts.backpackColor, pos: [0, 0.32, -0.18] },
          { geo: box(0.23, 0.13, 0.045), color: bpDark, pos: [0, 0.22, -0.255] },
          { geo: box(0.24, 0.032, 0.02), color: 0xe2e8f0, pos: [0, 0.28, -0.27] }, // Reflective stripe
          { geo: box(0.08, 0.035, 0.03), color: 0x1a1e24, pos: [0, 0.505, -0.16] }, // Top loop handle
          // Twin black shoulder straps over shoulders & down front chest
          { geo: box(0.042, 0.045, 0.27), color: 0x1e242c, pos: [0.12, 0.495, -0.02] },
          { geo: box(0.042, 0.045, 0.27), color: 0x1e242c, pos: [-0.12, 0.495, -0.02] },
          { geo: box(0.042, 0.30, 0.025), color: 0x1e242c, pos: [0.12, 0.34, 0.122] },
          { geo: box(0.042, 0.30, 0.025), color: 0x1e242c, pos: [-0.12, 0.34, 0.122] },
        );
      }
      return parts;
    });

    // 2. Detailed Blocky Head + Crisp Face (Eyes, Brows, Nose, Ears) + Hair / Helmet / Nón Lá / Khẩu Trang
    const headKey = `v2-head|${skin}|${hair}|${opts.helmetColor ?? 'no'}|${opts.conicalHat ? 1 : 0}|${opts.faceMask ? 1 : 0}`;
    const headGeo = this.getOrBake(headKey, () => {
      const parts: ColoredPart[] = [
        // Main crisp blocky head + slightly tapered jaw
        { geo: box(0.205, 0.215, 0.21), color: skin, pos: [0, 0.115, 0] },
        { geo: box(0.175, 0.045, 0.185), color: skin, pos: [0, 0.015, 0.006] },
        // Left & right ears
        { geo: box(0.028, 0.055, 0.04), color: darkenHex(skin, 0.92), pos: [0.11, 0.11, -0.01] },
        { geo: box(0.028, 0.055, 0.04), color: darkenHex(skin, 0.92), pos: [-0.11, 0.11, -0.01] },
        // Crisp expressive blocky eyes (white sclera + dark pupils + eyebrows!)
        { geo: box(0.044, 0.028, 0.014), color: 0xf8fafc, pos: [0.048, 0.132, 0.104] },
        { geo: box(0.044, 0.028, 0.014), color: 0xf8fafc, pos: [-0.048, 0.132, 0.104] },
        { geo: box(0.022, 0.022, 0.018), color: 0x14171c, pos: [0.046, 0.132, 0.107] },
        { geo: box(0.022, 0.022, 0.018), color: 0x14171c, pos: [-0.046, 0.132, 0.107] },
        { geo: box(0.052, 0.016, 0.016), color: hair, pos: [0.048, 0.158, 0.106] },
        { geo: box(0.052, 0.016, 0.016), color: hair, pos: [-0.048, 0.158, 0.106] },
        // Nose bridge
        { geo: box(0.028, 0.036, 0.026), color: darkenHex(skin, 0.91), pos: [0, 0.105, 0.112] },
        // Back & side hair base (always visible under helmet or alone!)
        { geo: box(0.215, 0.13, 0.10), color: hair, pos: [0, 0.13, -0.068] },
        { geo: box(0.218, 0.065, 0.15), color: hair, pos: [0, 0.18, -0.02] },
      ];

      // Mouth (if not wearing medical face mask) or Vietnamese light-blue medical face mask (khẩu trang)
      if (opts.faceMask) {
        parts.push(
          { geo: box(0.165, 0.082, 0.038), color: 0x9cd3f5, pos: [0, 0.062, 0.102] },
          { geo: box(0.15, 0.012, 0.042), color: 0x6ab4e6, pos: [0, 0.072, 0.104] }, // Mask pleat line
          { geo: box(0.15, 0.012, 0.042), color: 0x6ab4e6, pos: [0, 0.048, 0.104] },
          // White ear-loop straps
          { geo: box(0.012, 0.012, 0.11), color: 0xf1f5f9, pos: [0.106, 0.088, 0.048] },
          { geo: box(0.012, 0.012, 0.11), color: 0xf1f5f9, pos: [-0.106, 0.088, 0.048] },
        );
      } else {
        parts.push({ geo: box(0.056, 0.014, 0.014), color: 0xa66558, pos: [0, 0.056, 0.104] });
      }

      if (opts.helmetColor != null) {
        // Layered crisp blocky Vietnamese half-face helmet (mũ bảo hiểm nửa đầu!)
        const hCol = opts.helmetColor;
        const hDark = darkenHex(hCol, 0.72);
        parts.push(
          // Outer domed 2-tier blocky helmet shell
          { geo: box(0.265, 0.135, 0.275), color: hCol, pos: [0, 0.195, -0.005] },
          { geo: box(0.225, 0.06, 0.235), color: hCol, pos: [0, 0.275, -0.005] },
          // Rear neck protector shell
          { geo: box(0.24, 0.085, 0.085), color: hDark, pos: [0, 0.125, -0.102] },
          // Contrasting white/silver sporty center racing stripe on top & rear!
          { geo: box(0.052, 0.068, 0.245), color: 0xf1f5f9, pos: [0, 0.276, -0.005] },
          { geo: box(0.052, 0.145, 0.025), color: 0xf1f5f9, pos: [0, 0.195, -0.138] },
          // Thick black rubber protective rim around helmet edge
          { geo: box(0.275, 0.026, 0.285), color: 0x16191f, pos: [0, 0.132, -0.004] },
          // Front protruding helmet peak visor + dark tinted half-visor shield
          { geo: box(0.22, 0.022, 0.075), color: 0x181c22, pos: [0, 0.165, 0.155], rot: [0.16, 0, 0] },
          { geo: box(0.235, 0.068, 0.025), color: 0x203244, pos: [0, 0.126, 0.142] },
          // Black chin strap running down cheeks
          { geo: box(0.018, 0.12, 0.024), color: 0x181c22, pos: [0.105, 0.065, 0.02] },
          { geo: box(0.018, 0.12, 0.024), color: 0x181c22, pos: [-0.105, 0.065, 0.02] },
        );
      } else if (opts.conicalHat) {
        // 4-tier stepped voxel Nón Lá (iconic Vietnamese conical palm-leaf hat!)
        parts.push(
          { geo: box(0.50, 0.032, 0.50), color: 0xd9c282, pos: [0, 0.215, 0] },
          { geo: box(0.38, 0.055, 0.38), color: 0xe3cf94, pos: [0, 0.255, 0] },
          { geo: box(0.25, 0.055, 0.25), color: 0xd9c282, pos: [0, 0.305, 0] },
          { geo: box(0.12, 0.052, 0.12), color: 0xccb372, pos: [0, 0.352, 0] },
          // Red silk chin ribbon
          { geo: box(0.014, 0.16, 0.018), color: 0xc81e1e, pos: [0.108, 0.13, 0.02] },
          { geo: box(0.014, 0.16, 0.018), color: 0xc81e1e, pos: [-0.108, 0.13, 0.02] },
        );
      } else {
        // Styled layered blocky haircut (crown + front swoop bangs!)
        parts.push(
          { geo: box(0.222, 0.062, 0.225), color: hair, pos: [0, 0.228, -0.004] },
          { geo: box(0.18, 0.038, 0.065), color: hair, pos: [0.015, 0.198, 0.095] },
        );
      }
      return parts;
    });

    // 3. Upper Arm (pivot at shoulder = y:0, overlaps torso smoothly!)
    const upperArmKey = `v2-uarm|${opts.shirtColor}|${shirtDark}`;
    const upperArmGeo = this.getOrBake(upperArmKey, () => [
      // Rounded-feel boxy shoulder cap overlapping torso socket cleanly
      { geo: box(0.122, 0.12, 0.126), color: shirtDark, pos: [0, -0.015, 0] },
      // Main upper sleeve extending down to elbow at y = -0.31
      { geo: box(0.108, 0.26, 0.112), color: opts.shirtColor, pos: [0, -0.175, 0] },
    ]);

    // 4. Forearm + Wrist Cuff + Gloved/Skin Blocky Hand (pivot at elbow = y:0!)
    const forearmKey = `v2-farm|${opts.shirtColor}|${handColor}|${isRiding ? 1 : 0}`;
    const forearmGeo = this.getOrBake(forearmKey, () => [
      // Elbow overlap cuff
      { geo: box(0.102, 0.09, 0.104), color: opts.shirtColor, pos: [0, -0.02, 0] },
      // Forearm sleeve
      { geo: box(0.094, 0.20, 0.096), color: opts.shirtColor, pos: [0, -0.145, 0] },
      // Dark ribbed jacket cuff at wrist
      { geo: box(0.098, 0.036, 0.10), color: shirtDark, pos: [0, -0.252, 0] },
      // Blocky hand / riding glove gripping cleanly!
      { geo: box(0.078, 0.095, 0.092), color: handColor, pos: [0, -0.312, 0.01] },
    ]);

    // 5. Thigh (pivot at hip = y:0, extends to knee at y = -0.39)
    const thighKey = `v2-thigh|${opts.pantsColor}`;
    const thighGeo = this.getOrBake(thighKey, () => [
      { geo: box(0.142, 0.12, 0.148), color: opts.pantsColor, pos: [0, -0.02, 0] },
      { geo: box(0.132, 0.34, 0.142), color: opts.pantsColor, pos: [0, -0.22, 0] },
      // Side cargo/jean crease stripe
      { geo: box(0.138, 0.28, 0.025), color: pantsDark, pos: [0, -0.22, 0] },
    ]);

    // 6. Shin + Rolled Ankle Cuff + Detailed Two-Tone Chunky Sneaker (pivot at knee = y:0!)
    const shinKey = `v2-shin|${opts.pantsColor}|${shoe}`;
    const shinGeo = this.getOrBake(shinKey, () => [
      // Knee overlap block
      { geo: box(0.126, 0.10, 0.132), color: opts.pantsColor, pos: [0, -0.02, 0] },
      // Lower pant leg
      { geo: box(0.114, 0.25, 0.122), color: opts.pantsColor, pos: [0, -0.175, 0] },
      // Rolled denim cuff
      { geo: box(0.120, 0.034, 0.128), color: pantsDark, pos: [0, -0.30, 0] },
      // Sneaker upper body + tongue + white side accent
      { geo: box(0.114, 0.074, 0.22), color: shoe, pos: [0, -0.345, 0.042] },
      { geo: box(0.118, 0.024, 0.11), color: 0xe2e8f0, pos: [0, -0.345, 0.03] },
      // Crisp thick white rubber sneaker outsole!
      { geo: box(0.122, 0.030, 0.232), color: 0xf1f5f9, pos: [0, -0.388, 0.044] },
    ]);

    // Assemble articulated rig hierarchy
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.set(0, 0.80, 0);
    root.add(hips);

    const torso = new THREE.Group();
    torso.position.set(0, 0.05, 0);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.matHuman);
    torsoMesh.castShadow = cast;
    torsoMesh.receiveShadow = true;
    torso.add(torsoMesh);
    hips.add(torso);

    const head = new THREE.Group();
    head.position.set(0, 0.57, 0);
    const headMesh = new THREE.Mesh(headGeo, this.matHuman);
    headMesh.castShadow = cast;
    head.add(headMesh);
    torso.add(head);

    const makeArm = (side: 1 | -1) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.225, 0.435, 0);
      const uMesh = new THREE.Mesh(upperArmGeo, this.matHuman);
      uMesh.castShadow = cast;
      arm.add(uMesh);
      const fore = new THREE.Group();
      fore.position.set(0, -0.30, 0);
      const fMesh = new THREE.Mesh(forearmGeo, this.matHuman);
      fMesh.castShadow = cast;
      fore.add(fMesh);
      arm.add(fore);
      torso.add(arm);
      return { arm, fore };
    };
    const leftA = makeArm(1);
    const rightA = makeArm(-1);

    const makeLeg = (side: 1 | -1) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.098, 0.01, 0);
      const tMesh = new THREE.Mesh(thighGeo, this.matHuman);
      tMesh.castShadow = cast;
      leg.add(tMesh);
      const shin = new THREE.Group();
      shin.position.set(0, -0.38, 0);
      const sMesh = new THREE.Mesh(shinGeo, this.matHuman);
      sMesh.castShadow = cast;
      shin.add(sMesh);
      leg.add(shin);
      hips.add(leg);
      return { leg, shin };
    };
    const leftL = makeLeg(1);
    const rightL = makeLeg(-1);

    const rig: ArticulatedHumanRig = {
      root,
      hips,
      torso,
      head,
      armL: leftA.arm,
      forearmL: leftA.fore,
      armR: rightA.arm,
      forearmR: rightA.fore,
      legL: leftL.leg,
      shinL: leftL.shin,
      legR: rightL.leg,
      shinR: rightL.shin,
    };

    // Apply exact ergonomic seated pose aligned to Wave 110 / Vision 110 / Bicycle!
    if (opts.pose === 'rideMotorbike') {
      hips.position.set(0, 0.80, -0.22);
      torso.rotation.x = 0.18;
      head.rotation.x = -0.14;
      // Gloved hands land dead-center on Wave 110 handlebar grips (±0.30, 0.99, +0.44)!
      rig.armL.rotation.set(-1.12, 0, 0.13);
      rig.armR.rotation.set(-1.12, 0, -0.13);
      rig.forearmL.rotation.set(-0.28, 0, 0);
      rig.forearmR.rotation.set(-0.28, 0, 0);
      // Sneakers planted squarely on Wave 110 footpegs (±0.24, 0.29, +0.02)!
      rig.legL.rotation.set(-1.08, 0, 0.24);
      rig.legR.rotation.set(-1.08, 0, -0.24);
      rig.shinL.rotation.set(1.34, 0, -0.14);
      rig.shinR.rotation.set(1.34, 0, 0.14);
    } else if (opts.pose === 'rideScooter') {
      hips.position.set(0, 0.85, -0.24);
      torso.rotation.x = 0.12;
      head.rotation.x = -0.09;
      rig.armL.rotation.set(-1.06, 0, 0.12);
      rig.armR.rotation.set(-1.06, 0, -0.12);
      rig.forearmL.rotation.set(-0.26, 0, 0);
      rig.forearmR.rotation.set(-0.26, 0, 0);
      // Knees neatly together, feet flat on Vision 110 floorboard!
      rig.legL.rotation.set(-1.26, 0, 0.06);
      rig.legR.rotation.set(-1.26, 0, -0.06);
      rig.shinL.rotation.set(1.22, 0, -0.04);
      rig.shinR.rotation.set(1.22, 0, 0.04);
    } else if (opts.pose === 'rideBicycle') {
      hips.position.set(0, 0.90, -0.20);
      torso.rotation.x = 0.24;
      head.rotation.x = -0.18;
      rig.armL.rotation.set(-1.16, 0, 0.08);
      rig.armR.rotation.set(-1.16, 0, -0.08);
      rig.forearmL.rotation.set(-0.22, 0, 0);
      rig.forearmR.rotation.set(-0.22, 0, 0);
      rig.legL.rotation.set(-0.92, 0, 0.06);
      rig.legR.rotation.set(-0.56, 0, -0.06);
      rig.shinL.rotation.set(1.06, 0, 0);
      rig.shinR.rotation.set(0.66, 0, 0);
    }

    // PRO OPTIMIZATION: Collapse seated NPC riders (who do not animate limbs) into 1 single draw call!
    if (opts.pose !== 'walk' && !cast) {
      const staticRiderKey = `v2-static-rider|${opts.pose}|${torsoKey}|${headKey}|${opts.pantsColor}|${shoe}`;
      let mergedRider = this.bakedCache.get(staticRiderKey);
      if (!mergedRider) {
        root.updateMatrixWorld(true);
        const limbGeos: THREE.BufferGeometry[] = [];
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const g = obj.geometry.clone();
            g.applyMatrix4(obj.matrixWorld);
            limbGeos.push(g);
          }
        });
        const merged = mergeGeometries(limbGeos, false);
        for (const g of limbGeos) g.dispose();
        if (merged) {
          merged.computeBoundingSphere();
          mergedRider = this.track(merged);
          this.bakedCache.set(staticRiderKey, mergedRider);
        }
      }
      if (mergedRider) {
        const collapsedRoot = new THREE.Group();
        const singleMesh = new THREE.Mesh(mergedRider, this.matHuman);
        singleMesh.receiveShadow = true;
        collapsedRoot.add(singleMesh);
        if (opts.heightScale && opts.heightScale !== 1) {
          collapsedRoot.scale.setScalar(opts.heightScale);
        }
        return { ...rig, root: collapsedRoot };
      }
    }

    if (opts.heightScale && opts.heightScale !== 1) {
      root.scale.setScalar(opts.heightScale);
    }
    return rig;
  }

  /**
   * Build an ultra-detailed crisp blocky Vietnamese Street Dog (Chó cỏ / Shiba style!).
   */
  buildDog(furColor: number, castShadow = false): ArticulatedDogRig {
    const belly = 0xeee1cc;
    const earColor = darkenHex(furColor, 0.72);
    const bodyKey = `v2-dog-body|${furColor}`;
    const bodyGeo = this.getOrBake(bodyKey, () => [
      // Main blocky dog body + cream underbelly & chest tuft
      { geo: box(0.24, 0.23, 0.56), color: furColor, pos: [0, 0, 0] },
      { geo: box(0.20, 0.14, 0.42), color: belly, pos: [0, -0.055, 0.06] },
      // Red leather collar + shiny gold pet tag!
      { geo: box(0.21, 0.20, 0.06), color: 0xc81e1e, pos: [0, 0.04, 0.27] },
      { geo: box(0.04, 0.045, 0.02), color: 0xf5c227, pos: [0, -0.075, 0.30] },
      // Blocky head + snout + cute black nose + white eyes w/ dark pupils + perky ears!
      { geo: box(0.20, 0.19, 0.20), color: furColor, pos: [0, 0.14, 0.36] },
      { geo: box(0.11, 0.095, 0.12), color: belly, pos: [0, 0.10, 0.48] },
      { geo: box(0.055, 0.04, 0.035), color: 0x16191f, pos: [0, 0.125, 0.545] }, // Wet nose!
      { geo: box(0.038, 0.032, 0.016), color: 0xf8fafc, pos: [0.056, 0.17, 0.46] },
      { geo: box(0.038, 0.032, 0.016), color: 0xf8fafc, pos: [-0.056, 0.17, 0.46] },
      { geo: box(0.022, 0.024, 0.02), color: 0x14171c, pos: [0.056, 0.17, 0.464] },
      { geo: box(0.022, 0.024, 0.02), color: 0x14171c, pos: [-0.056, 0.17, 0.464] },
      // Perky pointed ears
      { geo: box(0.055, 0.09, 0.055), color: earColor, pos: [0.072, 0.265, 0.34], rot: [0, 0, -0.16] },
      { geo: box(0.055, 0.09, 0.055), color: earColor, pos: [-0.072, 0.265, 0.34], rot: [0, 0, 0.16] },
    ]);

    const legKey = `v2-dog-leg|${furColor}`;
    const legGeo = this.getOrBake(legKey, () => [
      { geo: box(0.075, 0.21, 0.082), color: furColor, pos: [0, -0.105, 0] },
      { geo: box(0.082, 0.055, 0.105), color: belly, pos: [0, -0.225, 0.015] }, // Cream paw!
    ]);

    const tailKey = `v2-dog-tail|${furColor}`;
    const tailGeo = this.getOrBake(tailKey, () => [
      { geo: box(0.065, 0.16, 0.068), color: furColor, pos: [0, 0.06, -0.05], rot: [-0.55, 0, 0] },
      { geo: box(0.06, 0.09, 0.065), color: belly, pos: [0, 0.15, -0.09], rot: [0.25, 0, 0] },
    ]);

    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.set(0, 0.33, 0);
    const bMesh = new THREE.Mesh(bodyGeo, this.matFur);
    bMesh.castShadow = castShadow;
    body.add(bMesh);
    root.add(body);

    const tail = new THREE.Group();
    tail.position.set(0, 0.06, -0.27);
    tail.add(new THREE.Mesh(tailGeo, this.matFur));
    body.add(tail);

    const mkLeg = (x: number, z: number) => {
      const lg = new THREE.Group();
      lg.position.set(x, -0.08, z);
      const lm = new THREE.Mesh(legGeo, this.matFur);
      lm.castShadow = castShadow;
      lg.add(lm);
      body.add(lg);
      return lg;
    };

    return {
      root,
      body,
      tail,
      legFL: mkLeg(0.078, 0.19),
      legFR: mkLeg(-0.078, 0.19),
      legBL: mkLeg(0.078, -0.19),
      legBR: mkLeg(-0.078, -0.19),
    };
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.bakedCache.clear();
  }
}

/** Animate crisp natural bipedal walking gait (phase in radians, carryingCart for street vendors). */
export function animateHumanWalk(rig: ArticulatedHumanRig, phase: number, carryingCart = false) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);

  rig.hips.position.y = 0.80 + Math.abs(c) * 0.028;
  rig.torso.rotation.y = s * 0.09;
  rig.torso.rotation.x = carryingCart ? 0.14 : 0.04;

  rig.legL.rotation.x = s * 0.52;
  rig.legR.rotation.x = -s * 0.52;
  rig.shinL.rotation.x = Math.max(0, -c * 0.62);
  rig.shinR.rotation.x = Math.max(0, c * 0.62);

  if (carryingCart) {
    rig.armL.rotation.x = -0.82;
    rig.armR.rotation.x = -0.82;
    rig.forearmL.rotation.x = -0.35;
    rig.forearmR.rotation.x = -0.35;
  } else {
    rig.armL.rotation.x = -s * 0.44;
    rig.armR.rotation.x = s * 0.44;
    rig.forearmL.rotation.x = -0.22 - Math.max(0, s * 0.24);
    rig.forearmR.rotation.x = -0.22 - Math.max(0, -s * 0.24);
  }
}

/** Animate motorbike/scooter rider subtly leaning & tracking handlebars. */
export function animateHumanRide(rig: ArticulatedHumanRig, steerAngle: number, speedMps: number, elapsedSec = 0) {
  const leanFactor = Math.min(1, Math.abs(speedMps) / 10);
  const vib = Math.sin(elapsedSec * 16) * 0.004 * (0.3 + leanFactor * 0.7);
  rig.torso.rotation.z = -steerAngle * 0.22 * leanFactor;
  rig.torso.position.y = 0.05 + vib;
  rig.head.rotation.y = steerAngle * 0.35;
  rig.armL.rotation.y = steerAngle * 0.24;
  rig.armR.rotation.y = steerAngle * 0.24;
}

/** Animate trotting/running blocky street dog. */
export function animateDogRun(rig: ArticulatedDogRig, phase: number) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  rig.body.position.y = 0.33 + Math.abs(c) * 0.026;
  rig.legFL.rotation.x = s * 0.62;
  rig.legBR.rotation.x = s * 0.62;
  rig.legFR.rotation.x = -s * 0.62;
  rig.legBL.rotation.x = -s * 0.62;
  rig.tail.rotation.z = Math.sin(phase * 2.2) * 0.34;
}
