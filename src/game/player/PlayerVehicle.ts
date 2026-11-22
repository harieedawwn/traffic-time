import * as THREE from 'three';
import type { VehicleState } from '../../kit/vehicles/dynamics';
import { MIRROR_RESOLUTIONS, type DetailLevel, type MirrorQuality } from '../graphics/GraphicsSettings';
import { animateHumanRide, type ArticulatedHumanRig, type HumanAssetPool } from '../models/HumanBuilder';
import type { VehicleAssetPool } from '../models/VehicleBuilder';
import type { HeadlightMode, VehicleId } from '../types';

export interface MirrorRig {
  camera: THREE.PerspectiveCamera;
  target: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

/**
 * Hero Player Vehicle built with sculpted PBR clearcoat VehicleAssetPool + articulated 3D Vietnamese rider
 * + detailed FPV cockpit with live CanvasTexture cluster & configurable real render-to-texture mirrors.
 * Coordinate convention: +Z forward, +Y up, +X LEFT (driver seat in car), -X RIGHT.
 */
export class PlayerVehicle {
  readonly root = new THREE.Group();
  readonly bodyTilt = new THREE.Group();
  private exteriorGroup = new THREE.Group();
  private cockpitGroup = new THREE.Group();
  private vehicleId: VehicleId;

  // Animated exterior & interior parts
  private wheels: THREE.Object3D[] = [];
  private frontFork: THREE.Object3D | null = null;
  private riderRig: ArticulatedHumanRig | null = null;
  private steeringWheel: THREE.Object3D | null = null;
  private bikeHandlebarFpv: THREE.Object3D | null = null;
  private wipers: THREE.Object3D[] = [];

  // Lights
  private headlightSpot: THREE.SpotLight;
  private headlightTarget = new THREE.Object3D();
  private headlightMats: THREE.MeshStandardMaterial[] = [];
  private brakeLightMats: THREE.MeshStandardMaterial[] = [];
  private signalLeftMats: THREE.MeshStandardMaterial[] = [];
  private signalRightMats: THREE.MeshStandardMaterial[] = [];

  // Live Canvas instrument cluster (FPV speedometer / tachometer / signals)
  private dashCanvas = document.createElement('canvas');
  private dashCtx: CanvasRenderingContext2D;
  private dashTex: THREE.CanvasTexture;
  private lastDashDraw = 0;

  // Real render-to-texture rearview mirrors
  readonly mirrors: MirrorRig[] = [];
  private mirrorRoundRobin = 0;
  private frameCounter = 0;
  private mirrorsDirty = true;
  private mirrorQuality: MirrorQuality;
  private disposables: { dispose: () => void }[] = [];

  constructor(
    vehicleId: VehicleId,
    vehiclePool: VehicleAssetPool,
    humanPool: HumanAssetPool,
    castShadow: boolean,
    mirrorQuality: MirrorQuality,
    detailLevel: DetailLevel,
  ) {
    this.vehicleId = vehicleId;
    this.mirrorQuality = mirrorQuality;
    this.root.name = `player-${vehicleId}`;
    this.root.add(this.bodyTilt);
    this.bodyTilt.add(this.exteriorGroup);
    this.bodyTilt.add(this.cockpitGroup);

    this.dashCanvas.width = 512;
    this.dashCanvas.height = 256;
    this.dashCtx = this.dashCanvas.getContext('2d')!;
    this.dashTex = this.track(new THREE.CanvasTexture(this.dashCanvas));
    this.dashTex.colorSpace = THREE.SRGBColorSpace;

    // Real SpotLight headlight
    this.headlightSpot = new THREE.SpotLight(0xfff5dc, 0, 56, Math.PI / 5, 0.45, 1.25);
    this.headlightSpot.position.set(0, 0.85, vehicleId === 'sedan' ? 2.15 : 0.85);
    this.headlightTarget.position.set(0, 0.1, 24);
    this.bodyTilt.add(this.headlightSpot);
    this.bodyTilt.add(this.headlightTarget);
    this.headlightSpot.target = this.headlightTarget;

    // Soft oval contact shadow for crisp grounding under all lighting conditions
    const shW = vehicleId === 'sedan' ? 2.04 : 0.78;
    const shL = vehicleId === 'sedan' ? 4.48 : 1.88;
    const shadowTex = this.track(this.makeSoftShadowTexture());
    const shadowDisc = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(shW, shL)),
      this.track(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      ),
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.064;
    this.root.add(shadowDisc);

    if (vehicleId === 'sedan') {
      const built = vehiclePool.buildSedan({
        colorHex: 0xdce2e8,
        isHero: true,
        castShadow,
        plateText: '30K-862.19',
      });
      this.exteriorGroup.add(built.group);
      this.wheels = built.wheels;
      this.headlightMats = built.headlightMats;
      this.brakeLightMats = built.brakeLightMats;
      this.signalLeftMats = built.signalLeftMats;
      this.signalRightMats = built.signalRightMats;
      this.buildSedanCockpit(detailLevel);
    } else {
      const isScooter = vehicleId === 'vision110';
      const built = vehiclePool.buildMotorbike({
        kind: vehicleId,
        colorHex: isScooter ? 0xebe8df : 0xb81d18,
        isHero: true,
        castShadow,
        plateTop: isScooter ? '59-X3' : '59-D1',
        plateBottom: isScooter ? '419.08' : '682.45',
      });
      this.exteriorGroup.add(built.group);
      this.wheels = built.wheels;
      this.frontFork = built.frontFork ?? null;
      this.headlightMats = built.headlightMats;
      this.brakeLightMats = built.brakeLightMats;
      this.signalLeftMats = built.signalLeftMats;
      this.signalRightMats = built.signalRightMats;

      // 14-part Articulated 3D Vietnamese Rider with half-face helmet, visor & commuter backpack
      this.riderRig = humanPool.buildHuman({
        pose: isScooter ? 'rideScooter' : 'rideMotorbike',
        shirtColor: isScooter ? 0x2a455e : 0x2b4a3e,
        pantsColor: 0x222c38,
        helmetColor: isScooter ? 0x334155 : 0x1d4e89,
        backpackColor: isScooter ? 0x3b4252 : 0x1e293b,
        faceMask: true,
        castShadow,
      });
      this.exteriorGroup.add(this.riderRig.root);
      this.buildMotorbikeCockpit(vehicleId);
    }

    this.drawDashboard(
      {
        x: 0,
        z: 0,
        heading: 0,
        yawRate: 0,
        speed: 0,
        steerAngle: 0,
        lean: 0,
        pitch: 0,
        gear: 1,
        rpm: 1100,
        wheelSpin: 0,
        braking: false,
      },
      0,
      false,
      false,
    );

    this.cockpitGroup.visible = false;
  }

  private track<T extends { dispose: () => void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  setMirrorQuality(quality: MirrorQuality) {
    if (this.mirrorQuality === quality) return;
    this.mirrorQuality = quality;
    const spec = MIRROR_RESOLUTIONS[quality];
    for (const m of this.mirrors) {
      if (quality === 'off') {
        m.mat.map = null;
        m.mat.color.setHex(0x3a4450);
        m.mat.needsUpdate = true;
      } else {
        m.target.setSize(spec.width, spec.height);
        m.mat.map = m.target.texture;
        m.mat.color.setHex(0xffffff);
        m.mat.needsUpdate = true;
      }
    }
    this.mirrorsDirty = true;
  }

  private makeSoftShadowTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 128);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps;
      ctx.fillStyle = 'rgba(10, 12, 14, 0.068)';
      ctx.beginPath();
      ctx.ellipse(32, 64, 28 * t, 58 * t, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private makeLeatherGrainTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#202429';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 650; i++) {
      const x = (i * 37) % 128;
      const y = (i * 71) % 128;
      ctx.fillStyle = i % 2 === 0 ? '#272c33' : '#191c20';
      ctx.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Crisp flat-colored GPS navigation infotainment texture for Sedan FPV center console (zero gradients). */
  private makeGpsScreenTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 144;
    const ctx = c.getContext('2d')!;
    // Flat dark slate nav background
    ctx.fillStyle = '#141c24';
    ctx.fillRect(0, 0, 256, 144);
    // City block grid
    ctx.fillStyle = '#1e2a36';
    ctx.fillRect(10, 26, 62, 42);
    ctx.fillRect(88, 26, 78, 42);
    ctx.fillRect(182, 26, 64, 42);
    ctx.fillRect(10, 82, 62, 50);
    ctx.fillRect(88, 82, 78, 50);
    ctx.fillRect(182, 82, 64, 50);
    // Secondary streets
    ctx.fillStyle = '#2d3b4a';
    ctx.fillRect(72, 22, 16, 118);
    ctx.fillRect(166, 22, 16, 118);
    ctx.fillRect(0, 68, 256, 14);
    // Highlighted active blue GPS route
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(123, 24, 10, 114);
    ctx.fillRect(123, 70, 52, 10);
    // Top flat status bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 22);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(8, 7, 8, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 11px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GPS • ĐẠI LỘ TRUNG TÂM', 22, 15);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('50 km/h', 248, 15);
    // Player directional chevron
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(128, 92);
    ctx.lineTo(138, 114);
    ctx.lineTo(128, 108);
    ctx.lineTo(118, 114);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createMirror(
    w: number,
    h: number,
    pos: THREE.Vector3,
    rotY: number,
    camPos: THREE.Vector3,
    camYawRad: number,
    camPitchRad = -0.04,
  ) {
    const spec = MIRROR_RESOLUTIONS[this.mirrorQuality];
    const rtW = Math.max(64, spec.width || 160);
    const rtH = Math.max(32, spec.height || 80);
    const rt = this.track(new THREE.WebGLRenderTarget(rtW, rtH, { depthBuffer: true, stencilBuffer: false }));
    const geo = this.track(new THREE.PlaneGeometry(w, h));
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i));
    }
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        map: this.mirrorQuality === 'off' ? null : rt.texture,
        color: this.mirrorQuality === 'off' ? 0x3a4450 : 0xffffff,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;

    const frame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.022, h + 0.022, 0.016)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x1a1e23, roughness: 0.45, metalness: 0.25 })),
    );
    frame.position.z = -0.011;
    mesh.add(frame);
    this.cockpitGroup.add(mesh);

    const cam = new THREE.PerspectiveCamera(50, w / h, 0.25, 160);
    cam.position.copy(camPos);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(camPitchRad, camYawRad, 0);
    this.bodyTilt.add(cam);

    this.mirrors.push({ camera: cam, target: rt, mesh, mat });
  }

  private buildMotorbikeCockpit(kind: 'wave110' | 'vision110') {
    const isScooter = kind === 'vision110';
    const paintHex = isScooter ? 0xebe8df : 0xb81d18;
    const paintMat = this.track(
      new THREE.MeshPhysicalMaterial({ color: paintHex, roughness: 0.26, metalness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.14 }),
    );
    const darkMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.72 }));
    const gloveMat = this.track(new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.82 }));
    const jacketMat = this.track(new THREE.MeshStandardMaterial({ color: isScooter ? 0x2a455e : 0x2b4a3e, roughness: 0.86 }));
    const chromeMat = this.track(new THREE.MeshStandardMaterial({ color: 0xd8e0e8, roughness: 0.18, metalness: 0.92 }));

    const hGroup = new THREE.Group();
    hGroup.position.set(0, 1.15, 0.44);

    const cowl = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.46, 0.12, 0.22)), paintMat);
    cowl.position.set(0, 0.0, 0.06);
    cowl.rotation.x = -0.35;
    hGroup.add(cowl);

    // Metallic gauge bezel around live speedometer
    const bezel = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.265, 0.14, 0.025)), darkMat);
    bezel.position.set(0, 0.086, 0.024);
    bezel.rotation.x = -0.48;
    hGroup.add(bezel);

    const dialPlane = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.24, 0.12)),
      this.track(new THREE.MeshBasicMaterial({ map: this.dashTex })),
    );
    dialPlane.position.set(0, 0.088, 0.01);
    dialPlane.rotation.y = Math.PI;
    dialPlane.rotation.x = 0.48;
    hGroup.add(dialPlane);

    const bar = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 12)), darkMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.0, -0.04);
    hGroup.add(bar);

    for (const sx of [-1, 1]) {
      const grip = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 12)), darkMat);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(sx * 0.34, 0.0, -0.04);
      hGroup.add(grip);

      const lever = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.14, 0.014, 0.018)), chromeMat);
      lever.position.set(sx * 0.28, 0.0, 0.035);
      lever.rotation.y = -sx * 0.18;
      hGroup.add(lever);

      // Articulated gloved hand + thumb + jacketed forearm
      const palm = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.038, 0.065, 5, 10)), gloveMat);
      palm.rotation.z = Math.PI / 2;
      palm.position.set(sx * 0.33, 0.018, -0.042);
      hGroup.add(palm);

      const thumb = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.015, 0.035, 4, 6)), gloveMat);
      thumb.position.set(sx * 0.275, 0.035, -0.028);
      thumb.rotation.z = sx * 0.5;
      hGroup.add(thumb);

      const forearm = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.045, 0.28, 5, 10)), jacketMat);
      forearm.position.set(sx * 0.28, -0.035, -0.19);
      forearm.rotation.x = Math.PI / 2 + 0.22;
      forearm.rotation.z = -sx * 0.18;
      hGroup.add(forearm);

      // Mirror stalk mounted behind glass plane
      const stalk = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.007, 0.008, 0.19, 8)), chromeMat);
      stalk.position.set(sx * 0.26, 0.1, 0.05);
      stalk.rotation.z = -sx * 0.52;
      hGroup.add(stalk);

      // Handlebar control switch pods (turn/horn on left +X, kill/starter on right -X)
      const switchPod = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.055, 0.052, 0.056)), darkMat);
      switchPod.position.set(sx * 0.23, 0.004, -0.04);
      hGroup.add(switchPod);
      const switchBtn = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.018, 0.016, 0.016)),
        this.track(new THREE.MeshStandardMaterial({ color: sx < 0 ? 0xdc2626 : 0xf59e0b, roughness: 0.4 })),
      );
      switchBtn.position.set(sx * 0.23, 0.014, -0.068);
      hGroup.add(switchBtn);
    }

    // Front hydraulic brake-fluid master cylinder reservoir on right handlebar (-X)
    const brakeRes = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.052, 0.036, 0.042)), darkMat);
    brakeRes.position.set(-0.24, 0.042, 0.004);
    hGroup.add(brakeRes);
    const sightDot = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8)), chromeMat);
    sightDot.rotation.x = Math.PI / 2;
    sightDot.position.set(-0.24, 0.042, -0.018);
    hGroup.add(sightDot);

    // Ignition keyhole bezel + key fob mounted below handlebar center
    const keyBezel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 10)), chromeMat);
    keyBezel.rotation.x = Math.PI / 2 - 0.35;
    keyBezel.position.set(-0.075, -0.068, -0.052);
    hGroup.add(keyBezel);
    const keyHead = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.028, 0.038, 0.01)), darkMat);
    keyHead.position.set(-0.075, -0.082, -0.072);
    keyHead.rotation.x = -0.35;
    hGroup.add(keyHead);

    this.bikeHandlebarFpv = hGroup;
    this.cockpitGroup.add(hGroup);

    this.createMirror(0.145, 0.088, new THREE.Vector3(0.34, 1.31, 0.43), Math.PI - 0.22, new THREE.Vector3(0.42, 1.31, 0.3), -0.16, -0.03);
    this.createMirror(0.145, 0.088, new THREE.Vector3(-0.34, 1.31, 0.43), Math.PI + 0.22, new THREE.Vector3(-0.42, 1.31, 0.3), 0.16, -0.03);

    const helmetRim = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.76, 0.032, 0.04)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x161a20, roughness: 0.85 })),
    );
    helmetRim.position.set(0, 1.638, 0.26);
    this.cockpitGroup.add(helmetRim);
  }

  private buildSedanCockpit(detailLevel: DetailLevel) {
    const leatherTex = this.track(this.makeLeatherGrainTexture());
    const dashMat = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: leatherTex, roughness: 0.84 }));
    const trimMat = this.track(new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.48, metalness: 0.25 }));
    const chromeMat = this.track(new THREE.MeshStandardMaterial({ color: 0xd0d7de, roughness: 0.2, metalness: 0.88 }));
    const pillarMat = this.track(new THREE.MeshStandardMaterial({ color: 0xa8a49c, roughness: 0.88 }));
    const hoodMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xdce2e8,
        roughness: 0.22,
        metalness: 0.38,
        clearcoat: detailLevel === 'low' ? 0 : 0.94,
        clearcoatRoughness: 0.12,
      }),
    );

    const hood = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.64, 0.12, 1.32)), hoodMat);
    hood.position.set(0, 0.89, 1.66);
    hood.rotation.x = 0.03;
    this.cockpitGroup.add(hood);
    // Twin sculpted aerodynamic power-bulge creases visible along hood
    for (const sx of [-1, 1]) {
      const crease = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.11, 0.035, 1.18)), hoodMat);
      crease.position.set(sx * 0.52, 0.96, 1.62);
      crease.rotation.x = 0.03;
      crease.rotation.y = -sx * 0.04;
      this.cockpitGroup.add(crease);
    }

    const dash = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.68, 0.3, 0.56)), dashMat);
    dash.position.set(0, 0.72, 0.76);
    this.cockpitGroup.add(dash);

    // Metallic trim strip across taplo
    const dashTrim = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.62, 0.018, 0.02)), chromeMat);
    dashTrim.position.set(0, 0.86, 0.485);
    this.cockpitGroup.add(dashTrim);

    // Open 3-piece sun-visor binnacle shroud
    const binnacleTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.4, 0.022, 0.18)), trimMat);
    binnacleTop.position.set(0.38, 1.055, 0.64);
    this.cockpitGroup.add(binnacleTop);
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.024, 0.17, 0.18)), trimMat);
      cheek.position.set(0.38 + sx * 0.19, 0.97, 0.64);
      this.cockpitGroup.add(cheek);
    }
    const binnacleBack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.4, 0.18, 0.024)), dashMat);
    binnacleBack.position.set(0.38, 0.97, 0.71);
    this.cockpitGroup.add(binnacleBack);

    const cluster = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.35, 0.15)),
      this.track(new THREE.MeshBasicMaterial({ map: this.dashTex })),
    );
    cluster.position.set(0.38, 0.97, 0.625);
    cluster.rotation.y = Math.PI;
    cluster.rotation.x = 0.08;
    this.cockpitGroup.add(cluster);

    // Center GPS Navigation Infotainment Tablet with crisp flat map display
    const centerScreenBezel = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.255, 0.145, 0.034)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.34, metalness: 0.25 })),
    );
    centerScreenBezel.position.set(-0.02, 0.94, 0.59);
    this.cockpitGroup.add(centerScreenBezel);

    const gpsTex = this.track(this.makeGpsScreenTexture());
    const gpsPlane = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.23, 0.122)),
      this.track(new THREE.MeshBasicMaterial({ map: gpsTex })),
    );
    gpsPlane.position.set(-0.02, 0.94, 0.571);
    gpsPlane.rotation.y = Math.PI;
    this.cockpitGroup.add(gpsPlane);

    // Twin center AC vents + silver toggles below infotainment screen
    const ventMat = this.track(new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.65 }));
    for (const vx of [-0.085, 0.045]) {
      const vent = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.044, 0.018)), ventMat);
      vent.position.set(vx, 0.815, 0.482);
      this.cockpitGroup.add(vent);
      const toggle = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.016, 0.014, 0.022)), chromeMat);
      toggle.position.set(vx, 0.815, 0.478);
      this.cockpitGroup.add(toggle);
    }

    // Left-hand Steering Wheel with chrome accent & center emblem
    const swGroup = new THREE.Group();
    swGroup.position.set(0.38, 0.92, 0.44);
    swGroup.rotation.x = 0.28;
    const rim = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.168, 0.018, 12, 32)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.72 })),
    );
    swGroup.add(rim);
    const hub = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.052, 0.052, 0.032, 16)), trimMat);
    hub.rotation.x = Math.PI / 2;
    swGroup.add(hub);
    const emblem = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.036, 12)), chromeMat);
    emblem.rotation.x = Math.PI / 2;
    swGroup.add(emblem);
    for (const ang of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const spoke = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.024, 0.145, 0.018)), trimMat);
      spoke.position.set(Math.sin(ang) * 0.076, -Math.cos(ang) * 0.076, 0);
      spoke.rotation.z = ang;
      swGroup.add(spoke);
    }
    const topMark = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.02, 0.022, 0.04)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.45 })),
    );
    topMark.position.set(0, 0.168, 0);
    swGroup.add(topMark);
    this.steeringWheel = swGroup;
    this.cockpitGroup.add(swGroup);

    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.066, 0.72, 0.075)), pillarMat);
      pillar.position.set(sx * 0.75, 1.24, 0.68);
      pillar.rotation.x = -0.58;
      pillar.rotation.z = sx * 0.15;
      this.cockpitGroup.add(pillar);

      const doorTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.09, 0.22, 1.15)), dashMat);
      doorTop.position.set(sx * 0.82, 0.78, 0.28);
      this.cockpitGroup.add(doorTop);
    }
    const roofHeader = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.48, 0.08, 0.24)), pillarMat);
    roofHeader.position.set(0, 1.54, 0.42);
    this.cockpitGroup.add(roofHeader);

    // Rearview mirror mounting stalk + subtle dark sun-visor strip
    const mirrorStalk = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.008, 0.01, 0.11, 8)), trimMat);
    mirrorStalk.position.set(0, 1.49, 0.51);
    mirrorStalk.rotation.x = 0.25;
    this.cockpitGroup.add(mirrorStalk);

    for (const wx of [0.22, -0.35]) {
      const wPivot = new THREE.Group();
      wPivot.position.set(wx, 0.91, 1.02);
      const blade = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.55, 0.016, 0.016)),
        this.track(new THREE.MeshStandardMaterial({ color: 0x111214 })),
      );
      blade.position.set(0.24, 0.025, 0);
      wPivot.add(blade);
      this.wipers.push(wPivot);
      this.cockpitGroup.add(wPivot);
    }

    this.createMirror(0.23, 0.066, new THREE.Vector3(0.0, 1.43, 0.52), Math.PI - 0.14, new THREE.Vector3(0, 1.38, -0.35), 0, -0.03);
    this.createMirror(0.16, 0.1, new THREE.Vector3(0.88, 1.01, 0.68), Math.PI - 0.3, new THREE.Vector3(0.98, 1.02, 0.48), -0.18, -0.04);
    this.createMirror(0.16, 0.1, new THREE.Vector3(-0.82, 1.02, 1.08), Math.PI + 0.34, new THREE.Vector3(-0.98, 1.02, 0.48), 0.18, -0.04);
  }

  setFpvMode(isFpv: boolean) {
    const entering = isFpv && !this.cockpitGroup.visible;
    this.cockpitGroup.visible = isFpv;
    this.exteriorGroup.visible = !isFpv;
    if (entering) {
      this.mirrorsDirty = true;
      this.lastDashDraw = -1;
    }
  }

  update(
    state: VehicleState,
    elevationY: number,
    headlight: HeadlightMode,
    sigLeft: boolean,
    sigRight: boolean,
    isRaining: boolean,
    elapsedSec: number,
    isFpv: boolean,
  ) {
    this.root.position.set(state.x, elevationY, state.z);
    this.root.rotation.y = state.heading;
    this.bodyTilt.rotation.z = state.lean;
    this.bodyTilt.rotation.x = state.pitch;

    for (const w of this.wheels) w.rotation.x = state.wheelSpin;
    if (this.frontFork) this.frontFork.rotation.y = -state.steerAngle;
    if (this.riderRig && !isFpv) {
      animateHumanRide(this.riderRig, state.steerAngle, state.speed, elapsedSec);
    }
    if (this.bikeHandlebarFpv) this.bikeHandlebarFpv.rotation.y = -state.steerAngle * 0.85;
    if (this.steeringWheel) this.steeringWheel.rotation.z = state.steerAngle * 4.2;

    if (this.wipers.length) {
      const sweep = isRaining ? (Math.sin(elapsedSec * 4.5) * 0.5 + 0.5) * 1.15 : 0.05;
      for (const wp of this.wipers) wp.rotation.z = sweep;
    }

    this.headlightSpot.intensity = headlight === 0 ? 0 : headlight === 1 ? 26 : 54;
    this.headlightSpot.distance = headlight === 2 ? 78 : 46;
    this.headlightTarget.position.y = headlight === 2 ? 0.55 : -0.35;
    for (const m of this.headlightMats) m.emissiveIntensity = headlight === 0 ? 0.15 : headlight === 1 ? 1.8 : 3.2;

    for (const m of this.brakeLightMats) m.emissiveIntensity = state.braking ? 2.6 : 0.22;

    const blink = Math.floor(elapsedSec * 3.2) % 2 === 0;
    for (const m of this.signalLeftMats) m.emissiveIntensity = sigLeft && blink ? 2.6 : 0;
    for (const m of this.signalRightMats) m.emissiveIntensity = sigRight && blink ? 2.6 : 0;

    if (isFpv && (this.lastDashDraw < 0 || elapsedSec - this.lastDashDraw > 0.065)) {
      this.lastDashDraw = elapsedSec;
      this.drawDashboard(state, headlight, sigLeft && blink, sigRight && blink);
    }
  }

  renderMirrors(renderer: THREE.WebGLRenderer, scene: THREE.Scene, isFpv: boolean, isSoftwareGl: boolean) {
    if (!isFpv || !this.mirrors.length || this.mirrorQuality === 'off') return;
    this.root.updateMatrixWorld(true);

    const prevVis = this.cockpitGroup.visible;
    const prevTarget = renderer.getRenderTarget();

    if (this.mirrorsDirty) {
      this.mirrorsDirty = false;
      this.cockpitGroup.visible = false;
      for (const m of this.mirrors) {
        renderer.setRenderTarget(m.target);
        renderer.render(scene, m.camera);
      }
      renderer.setRenderTarget(prevTarget);
      this.cockpitGroup.visible = prevVis;
      return;
    }

    const spec = MIRROR_RESOLUTIONS[this.mirrorQuality];
    const interval = isSoftwareGl ? spec.intervalSw : spec.intervalGpu;
    this.frameCounter++;
    if (this.frameCounter % interval !== 0) return;

    const m = this.mirrors[this.mirrorRoundRobin % this.mirrors.length];
    this.mirrorRoundRobin++;

    this.cockpitGroup.visible = false;
    renderer.setRenderTarget(m.target);
    renderer.render(scene, m.camera);
    renderer.setRenderTarget(prevTarget);
    this.cockpitGroup.visible = prevVis;
  }

  private drawDashboard(state: VehicleState, headlight: HeadlightMode, leftBlink: boolean, rightBlink: boolean) {
    const ctx = this.dashCtx;
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, 512, 256);

    if (this.vehicleId === 'sedan') {
      this.drawGauge(ctx, 130, 132, 92, state.rpm / 7000, 'RPM', `${Math.round(state.rpm)}`);
      this.drawGauge(ctx, 382, 132, 92, kmh / 180, 'km/h', `${kmh}`);
      ctx.fillStyle = '#1b222a';
      ctx.fillRect(228, 86, 56, 86);
      ctx.fillStyle = '#f4f2ec';
      ctx.font = '700 38px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.gear < 0 ? 'R' : state.gear === 0 ? 'N' : `D${state.gear}`, 256, 132);
    } else {
      this.drawGauge(ctx, 175, 132, 94, kmh / 120, 'km/h', `${kmh}`);
      ctx.fillStyle = '#1c2b28';
      ctx.fillRect(298, 66, 174, 128);
      ctx.fillStyle = '#d9f2e6';
      ctx.font = '700 44px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.vehicleId === 'vision110' ? 'CVT' : state.gear < 0 ? 'R' : `Số ${state.gear}`, 385, 124);
      ctx.font = '600 22px "Be Vietnam Pro", sans-serif';
      ctx.fillText(`${Math.round(state.rpm)} RPM`, 385, 168);
    }

    ctx.font = '700 26px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = leftBlink ? '#22c55e' : '#263038';
    ctx.fillText('TRÁI', 194, 34);
    ctx.fillStyle = rightBlink ? '#22c55e' : '#263038';
    ctx.fillText('PHẢI', 318, 34);
    ctx.fillStyle = headlight === 2 ? '#3b82f6' : headlight === 1 ? '#22c55e' : '#263038';
    ctx.fillText(headlight === 2 ? 'PHA' : headlight === 1 ? 'CỐT' : 'ĐÈN', 256, 34);

    this.dashTex.needsUpdate = true;
  }

  private drawGauge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, unit: string, valText: string) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#171c22';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3d4652';
    ctx.stroke();

    const startA = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = startA + (i / 10) * sweep;
      ctx.strokeStyle = i >= 8 ? '#dc2626' : '#cbd5e1';
      ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
      ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
      ctx.stroke();
    }

    const clamped = Math.max(0, Math.min(1, frac));
    const na = startA + clamped * sweep;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 18), cy + Math.sin(na) * (r - 18));
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 28px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(valText, cx, cy + 44);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px "Be Vietnam Pro", sans-serif';
    ctx.fillText(unit, cx, cy + 68);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
