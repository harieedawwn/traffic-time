import type { NpcAgent } from '../traffic/TrafficManager';
import type { RoadGraph } from '../world/RoadGraph';
import type { SignalIntersection } from '../world/WorldBuilder';

/**
 * Crisp Flat-Color Canvas 2D Rotating Minimap.
 * - Dual-layer road casing (dark curb outline + slate asphalt + gold median)
 * - Live traffic signal status dots, NPC vehicles, scenario destination beacon,
 *   forward vision cone, and high-contrast Compass North ('B') badge.
 */
export function drawMinimap(
  canvas: HTMLCanvasElement,
  graph: RoadGraph,
  signals: SignalIntersection[],
  npcs: NpcAgent[],
  playerX: number,
  playerZ: number,
  playerHeading: number,
  waypoint: { x: number; z: number } | null,
  expanded: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.56;
  const scale = expanded ? 0.92 : 1.12;

  // Flat deep urban map backdrop + subtle block grid
  ctx.fillStyle = '#12161c';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(cx, cy);

  const sinH = Math.sin(playerHeading);
  const cosH = Math.cos(playerHeading);
  const toScreenX = (wx: number, wz: number) => (-(wx - playerX) * cosH + (wz - playerZ) * sinH) * scale;
  const toScreenY = (wx: number, wz: number) => -((wx - playerX) * sinH + (wz - playerZ) * cosH) * scale;

  // 1a. Road dark casing outline (makes intersections super crisp!)
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#090c10';
  for (let i = 0; i < graph.computedEdges.length; i++) {
    const ce = graph.computedEdges[i];
    ctx.lineWidth = Math.max(7, ce.totalWidth * scale + 3.5);
    ctx.beginPath();
    ctx.moveTo(toScreenX(ce.ax, ce.az), toScreenY(ce.ax, ce.az));
    ctx.lineTo(toScreenX(ce.bx, ce.bz), toScreenY(ce.bx, ce.bz));
    ctx.stroke();
  }

  // 1b. Road asphalt surface + yellow medians
  for (let i = 0; i < graph.computedEdges.length; i++) {
    const ce = graph.computedEdges[i];
    const x0 = toScreenX(ce.ax, ce.az);
    const y0 = toScreenY(ce.ax, ce.az);
    const x1 = toScreenX(ce.bx, ce.bz);
    const y1 = toScreenY(ce.bx, ce.bz);

    ctx.strokeStyle = ce.edge.style === 'alley' ? '#3d4652' : '#535f6e';
    ctx.lineWidth = Math.max(4, ce.totalWidth * scale);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    if (ce.edge.hasMedian) {
      ctx.strokeStyle = '#d4a62a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // 2. Roundabouts
  for (let i = 0; i < graph.data.nodes.length; i++) {
    const node = graph.data.nodes[i];
    if (node.kind === 'roundabout') {
      const rx = toScreenX(node.x, node.z);
      const ry = toScreenY(node.x, node.z);
      const r = (node.roundaboutRadius ?? 20) * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, r + 6.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#535f6e';
      ctx.fill();
      ctx.strokeStyle = '#090c10';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rx, ry, r * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = '#2f6a3c';
      ctx.fill();
      ctx.strokeStyle = '#d61f2c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // 3. Traffic Signal Live Status Dots
  const app = Math.abs(cosH) >= Math.abs(sinH) ? (cosH > 0 ? 'N' : 'S') : sinH > 0 ? 'W' : 'E';
  for (let i = 0; i < signals.length; i++) {
    const sig = signals[i];
    const sx = toScreenX(sig.node.x, sig.node.z);
    const sy = toScreenY(sig.node.x, sig.node.z);
    if (Math.abs(sx) > w * 0.62 || Math.abs(sy) > h * 0.62) continue;
    const light = sig.controller.lightFor(app);
    ctx.fillStyle = light === 'green' ? '#22c55e' : light === 'yellow' || light === 'flashing' ? '#f5be0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(sx, sy, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // 4. NPCs
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const nx = toScreenX(npc.x, npc.z);
    const ny = toScreenY(npc.x, npc.z);
    if (Math.abs(nx) > w * 0.58 || Math.abs(ny) > h * 0.58) continue;
    ctx.fillStyle = npc.kind === 'ambulance' ? '#ef4444' : npc.kind === 'bus' || npc.kind === 'truck' ? '#38bdf8' : '#dbe3ec';
    const rad = npc.kind === 'bus' || npc.kind === 'truck' ? 3.4 : npc.kind === 'ambulance' ? 4.2 : 2.1;
    ctx.beginPath();
    ctx.arc(nx, ny, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Scenario Destination Waypoint
  if (waypoint) {
    const wx = toScreenX(waypoint.x, waypoint.z);
    const wy = toScreenY(waypoint.x, waypoint.z);
    const maxR = Math.min(w, h) * 0.42;
    const distPx = Math.hypot(wx, wy);
    const tx = distPx > maxR ? (wx / distPx) * maxR : wx;
    const ty = distPx > maxR ? (wy / distPx) * maxR : wy;

    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 6. Subtle Forward View Cone + Bold Player Arrow
  ctx.fillStyle = 'rgba(245, 190, 11, 0.14)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, -40);
  ctx.lineTo(20, -40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f5be0b';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0d1117';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.restore();

  // Crisp Compass North Badge ('B' = Bắc)
  const nDirX = -sinH;
  const nDirY = cosH;
  const compX = cx + nDirX * (Math.min(w, h) * 0.43);
  const compY = cy + nDirY * (Math.min(w, h) * 0.43);
  ctx.fillStyle = '#d61f2c';
  ctx.fillRect(compX - 9, compY - 9, 18, 18);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(compX - 9, compY - 9, 18, 18);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 10px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', compX, compY + 0.5);
}
