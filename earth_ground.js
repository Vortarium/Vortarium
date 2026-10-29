// Tier 3: 3D ground layer (procedural detail terrain, fog, trees, buildings) + Tier 2 geopolitical labels
const COL = { hut:0xb8895a, gather:0x8a6d3b, well:0x6b7b8c, granary:0xd8b04a, shrine:0xc94f4f, workshop:0x7a6a5a, market:0xe0a030, barracks:0x7c3030 };
const hv = (x, y) => { const h = Math.imul(x * 374761393 + y * 668265263, 1274126177); return ((h ^ h >>> 13) >>> 0) / 4294967296; };
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return hv(xi, yi) * (1 - u) * (1 - v) + hv(xi + 1, yi) * u * (1 - v) + hv(xi, yi + 1) * (1 - u) * v + hv(xi + 1, yi + 1) * u * v; };
const fb = (x, y) => vn(x, y) * .5 + vn(x * 2, y * 2) * .25 + vn(x * 4, y * 4) * .125 + vn(x * 8, y * 8) * .0625;
export function initGround(C) {
  const { THREE, world, W, H, BIOMES, empire, s, getDist, setDist, cam, marks, play, ui, getOthers, getRuins } = C, SUB = 3, R = 40, SEG = 2, FOREST = [12, 13, 21, 22, 23];
  const mk = (tag, id) => { const c = document.createElement(tag); c.id = id; document.body.insertBefore(c, document.getElementById("hud")); return c; };
  const g = mk("canvas", "ground"), o = mk("canvas", "geo"), hint = mk("div", "ghint"), ox = o.getContext("2d"), info = document.getElementById("info");
  empire.ex ||= 6; const cx0 = empire.spawn.x * SUB + 1, cy0 = empire.spawn.y * SUB + 1;
  const wrapX = x => ((x % W) + W) % W, clY = y => Math.max(0, Math.min(H - 1, y)), cell = (tx, ty) => clY(Math.floor(ty / SUB)) * W + wrapX(Math.floor(tx / SUB));
  // ---- terrain functions: coarse world cells + local procedural detail ----
  const E = (x, y) => world.e[clY(y) * W + wrapX(x)];
  const elev = (ax, ay) => { const fx = ax / SUB - .5, fy = ay / SUB - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0; return E(x0, y0) * (1 - u) * (1 - v) + E(x0 + 1, y0) * u * (1 - v) + E(x0, y0 + 1) * (1 - u) * v + E(x0 + 1, y0 + 1) * u * v; };
  const Hh = (ax, ay) => { const e = elev(ax, ay); if (e <= 0) return Math.max(-1.5, e / 2500); return Math.pow(e / 1000, .8) * .9 + (fb(ax * .4, ay * .4) - .4) * (Math.min(1, e / 2500) + .15) * 1.8 + .03; };
  const bio = (ax, ay) => { const wx = ax + (vn(ax * .6, ay * .6) - .5) * 1.6, wy = ay + (vn(ax * .6 + 50, ay * .6 + 50) - .5) * 1.6; return world.b[cell(wx, wy)]; };
  // ---- three.js scene ----
  const renderer = new THREE.WebGLRenderer({ canvas: g, antialias: true }), gs = new THREE.Scene(), gc = new THREE.PerspectiveCamera(50, 1, .1, 300);
  gs.background = new THREE.Color(0x9cc4e4); gs.fog = new THREE.Fog(0x9cc4e4, 28, 75);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.1); sun.position.set(20, 30, 10); gs.add(sun, new THREE.HemisphereLight(0xcfe6ff, 0x4a5a3a, .7));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a7fb8, transparent: true, opacity: .78, roughness: .3 })); water.position.y = .02; gs.add(water);
  const fit = () => { renderer.setSize(innerWidth, innerHeight); o.width = innerWidth; o.height = innerHeight; gc.aspect = innerWidth / innerHeight; gc.updateProjectionMatrix(); }; fit(); addEventListener("resize", fit);
  let terrain, builtEx = -1, trees, tp = [], bgrp, sig = "", gdist = 16; const tgt = new THREE.Vector3();
  function buildTerrain() {
    if (terrain) { gs.remove(terrain); terrain.geometry.dispose(); }
    const geo = new THREE.PlaneGeometry(2 * R, 2 * R, 2 * R * SEG, 2 * R * SEG).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), ax = cx0 + x, ay = cy0 + z, h = Hh(ax, ay), c = BIOMES[bio(ax, ay)].rgb || [90, 90, 90], d = Math.hypot(x, z), sh = (.8 + fb(ax * 1.3, ay * 1.3) * .4) / 255;
      let r = c[0] * sh, gg = c[1] * sh, bb = c[2] * sh, y = h;
      if (h > 5.5) { const k = Math.min(1, (h - 5.5) / 1.5); r += (1 - r) * k; gg += (1 - gg) * k; bb += (1 - bb) * k; }
      if (d > empire.ex) { const f = Math.min(1, (d - empire.ex) / 1.5); r += (.62 - r) * f; gg += (.68 - gg) * f; bb += (.74 - bb) * f; y += Math.max(0, 1.4 + fb(ax * .5, ay * .5) * .8 - h) * f; } // thick fog layer
      p.setY(i, y); col.set([r, gg, bb], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); gs.add(terrain); builtEx = empire.ex; buildTrees();
  }
  function buildTrees() {
    if (trees) gs.remove(trees); tp = [];
    for (let tx = -R; tx < R; tx++) for (let tz = -R; tz < R; tz++) { if (Math.hypot(tx, tz) > empire.ex) continue; const ax = cx0 + tx, ay = cy0 + tz, b = bio(ax, ay); if (!FOREST.includes(b)) continue;
      for (let k = 0; k < 3; k++) if (hv(ax * 7 + k, ay * 5) > .45 && tp.length < 2400) { const x = tx + hv(ax, ay + k * 17) - .5, z = tz + hv(ax + k * 31, ay) - .5, y = Hh(cx0 + x, cy0 + z); if (y > .04) tp.push([x, y, z, b, hv(k, ax * 3 + ay)]); } }
    trees = new THREE.InstancedMesh(new THREE.ConeGeometry(.16, .7, 5).translate(0, .35, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), Math.max(1, tp.length)); trees.count = tp.length;
    const c = new THREE.Color(); tp.forEach((t, i) => trees.setColorAt(i, c.set(t[3] === 12 ? 0x1d4a35 : t[3] === 13 ? 0x3f7d3a : 0x16692f).offsetHSL(0, 0, (t[4] - .5) * .1))); gs.add(trees);
  }
  const dm = new THREE.Object3D();
  const sway = t => { tp.forEach((q, i) => { dm.position.set(q[0], q[1], q[2]); dm.rotation.set(Math.cos(t / 700 + q[4] * 9) * .05, 0, Math.sin(t / 600 + q[4] * 20) * .07); dm.scale.setScalar(.8 + q[4] * .5); dm.updateMatrix(); trees.setMatrixAt(i, dm.matrix); }); trees.instanceMatrix.needsUpdate = true; };
  function buildStuff() {
    if (bgrp) gs.remove(bgrp); bgrp = new THREE.Group();
    const add = (x, z, color, sc = 1, tall = 0) => { const y = Hh(cx0 + x, cy0 + z), hh = .45 * sc + tall, base = new THREE.Mesh(new THREE.BoxGeometry(.55 * sc, hh, .55 * sc), new THREE.MeshStandardMaterial({ color })), roof = new THREE.Mesh(new THREE.ConeGeometry(.5 * sc, .35 * sc, 4), new THREE.MeshStandardMaterial({ color: 0x5a3a28 })); base.position.set(x, y + hh / 2, z); roof.position.set(x, y + hh + .17 * sc, z); roof.rotation.y = Math.PI / 4; bgrp.add(base, roof); };
    const flag = (x, z, color) => { const y = Hh(cx0 + x, cy0 + z), pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.3), new THREE.MeshStandardMaterial({ color: 0xdddddd })), fl = new THREE.Mesh(new THREE.BoxGeometry(.4, .24, .02), new THREE.MeshStandardMaterial({ color })); pole.position.set(x, y + .65, z); fl.position.set(x + .2, y + 1.15, z); bgrp.add(pole, fl); };
    add(0, 0, 0xf0e6d0, 1.6, .6); flag(0, 0, 0xffd54f);
    s.pl.forEach(p => add(p.x - cx0, p.y - cy0, COL[p.t] || 0x999999)); let k = 0;
    for (const [type, cnt] of Object.entries(s.b)) for (let n = 0; n < cnt - s.pl.filter(p => p.t === type).length; n++) { let x, z, tr = 0; do { k++; const a = k * 2.399, r = Math.sqrt(k) * 1.5; x = Math.round(Math.cos(a) * r); z = Math.round(Math.sin(a) * r); } while (Hh(cx0 + x, cy0 + z) <= .03 && ++tr < 40); add(x, z, COL[type] || 0x999999); }
    const vis = (sp, f) => { const x = sp.x * SUB + 1 - cx0, z = sp.y * SUB + 1 - cy0; if (Math.hypot(x, z) <= empire.ex) f(x, z); };
    getOthers().forEach(u => vis(u.spawn, (x, z) => { add(x, z, 0xeeeeee, 1.3); flag(x, z, 0xffffff); })); getRuins().forEach(u => vis(u.spawn, (x, z) => add(x, z, 0x55504a, 1.1)));
    gs.add(bgrp);
  }
  // ---- input ----
  const ray = new THREE.Raycaster(); let drag = null, moved = 0;
  g.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; };
  g.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; tgt.x = Math.max(-R + 6, Math.min(R - 6, tgt.x - dx * gdist * .0018)); tgt.z = Math.max(-R + 6, Math.min(R - 6, tgt.z - dy * gdist * .0026)); moved += Math.abs(dx) + Math.abs(dy); drag = { x: e.clientX, y: e.clientY }; };
  g.onwheel = e => { gdist = Math.max(5, Math.min(34, gdist + e.deltaY * .02)); if (e.deltaY > 0 && gdist >= 34) { setDist(3.4); gdist = 16; } };
  addEventListener("keydown", e => { if (e.key === "Escape") ui.sel = null; });
  g.onpointerup = e => {
    drag = null; if (moved > 5 || !terrain) return; ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, gc); const h = ray.intersectObject(terrain)[0]; if (!h) return;
    const tx = cx0 + Math.round(h.point.x), ty = cy0 + Math.round(h.point.z), d = Math.hypot(tx - cx0, ty - cy0), i = cell(tx, ty);
    if (ui.sel) { if (d <= empire.ex && world.b[i] > 7 && Hh(tx, ty) > .03 && !s.pl.some(p => p.x === tx && p.y === ty) && !(tx === cx0 && ty === cy0)) { if (ui.place(ui.sel, tx, ty)) ui.sel = null; } else alert("Pick an explored, empty land tile."); return; }
    if (d > empire.ex) { if (d <= empire.ex + 2 && s.coin >= 15) { s.coin -= 15; empire.ex = Math.ceil(d); play("army3"); } else if (d <= empire.ex + 2) alert("Exploring costs 15 coin."); return; }
    const ru = getRuins().find(r => r.spawn.x * SUB + 1 === tx && r.spawn.y * SUB + 1 === ty); if (ru) { info.hidden = false; info.innerHTML = `<h3>Ruins of ${ru.name}</h3>An empire of the ${ru.era || "Tribal"} era that ${ru.reason || "collapsed"}.<br>You piece together fragments of its history.`; return; }
    const el = Math.round(elev(tx, ty)), la = 90 - ty / SUB * 180 / H;
    info.hidden = false; info.innerHTML = `<h3>${BIOMES[bio(tx, ty)][0]}</h3>Tile ~37 km wide (~1,370 km²)<br>${el > 0 ? "Elevation" : "Depth"}: ${Math.abs(el)} m<br>Mean temp: ${(31 - 52 * Math.pow(Math.abs(la) / 90, 1.4) - Math.max(0, el) / 1000 * 6.5).toFixed(1)} °C<br>Rainfall index: ${world.m[i]}%<br>Distance from capital: ${(d * 37).toFixed(0)} km`;
  };
  // ---- frame loop ----
  (function loop(t) {
    requestAnimationFrame(loop); const dist = getDist(), on = dist < 2.6; g.classList.toggle("on", on); ox.clearRect(0, 0, o.width, o.height);
    hint.style.display = on && ui.sel ? "block" : "none"; if (ui.sel) hint.textContent = `Placing ${ui.sel}: click an explored land tile (Esc cancels)`;
    if (on) {
      if (builtEx !== empire.ex || !terrain) buildTerrain(); const sg = JSON.stringify([s.b, s.pl.length, empire.ex, getOthers().length, getRuins().length]); if (sg !== sig) { sig = sg; buildStuff(); }
      sway(t); water.position.y = .02 + Math.sin(t / 900) * .01; gc.position.set(tgt.x, gdist * .75, tgt.z + gdist * .65); gc.lookAt(tgt.x, 0, tgt.z); renderer.render(gs, gc);
    } else if (dist < 4) { // Tier 2: borders + names
      for (const m of marks.children) { const p = m.getWorldPosition(m.position.clone()); if (p.clone().normalize().dot(cam.position.clone().normalize()) < .25) continue; const v = p.project(cam), x = (v.x + 1) / 2 * o.width, y = (1 - v.y) / 2 * o.height, u = m.userData, r = 18 + Math.sqrt(u.pop) * 2.2;
        ox.strokeStyle = u.me ? "#ffd54f" : "#fff"; ox.fillStyle = u.me ? "rgba(255,213,79,.18)" : "rgba(255,255,255,.1)"; ox.lineWidth = 2; ox.beginPath(); ox.arc(x, y, r, 0, 7); ox.fill(); ox.stroke();
        ox.fillStyle = "#fff"; ox.font = "500 14px Roboto,sans-serif"; ox.textAlign = "center"; ox.fillText(u.name, x, y - r - 8); ox.font = "12px Roboto,sans-serif"; ox.fillText(`pop ${u.pop}` + (u.me ? ` · ${s.coin | 0} coin · army ${s.army}` : ""), x, y + r + 16); }
    }
  })(0);
}
