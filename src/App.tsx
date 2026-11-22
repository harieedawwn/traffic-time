import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeSignMesh } from './kit/traffic/vnSigns';
import { makeSignalPole, SignalController } from './kit/traffic/signalController';
import { asphaltTexture } from './kit/world/textures';

/** Màn hình tạm (Asset Lab). Gemini: THAY THẾ file này bằng game thật theo docs/. */
export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight); renderer.shadowMap.enabled = true; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa9c7de);
    const cam = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 500); cam.position.set(6, 4, 10); cam.lookAt(0, 2, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(10, 20, 8); sun.castShadow = true; scene.add(sun);
    const tex = asphaltTexture(); tex.repeat.set(10, 10);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    (['P.127', 'P.123a', 'W.224', 'R.122', 'S.RIGHT_ON_RED'] as const).forEach((c, i) => { const s = makeSignMesh(c, { speed: 50 }); s.position.set(-4 + i * 1.6, 0, 0); scene.add(s); });
    const pole = makeSignalPole(); pole.group.position.set(5, 0, -2); scene.add(pole.group);
    const ctl = new SignalController([{ id: 'N', group: 0 }, { id: 'E', group: 1 }]);
    const clock = new THREE.Clock(); let raf = 0;
    const loop = () => { const dt = clock.getDelta(); ctl.update(dt); pole.heads.forEach(h => h.set(ctl.lightFor('N'), ctl.countdownFor('N'))); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(raf); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
