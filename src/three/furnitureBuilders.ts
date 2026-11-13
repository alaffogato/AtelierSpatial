import * as THREE from 'three';
import { ColorScheme, StyleDefinition } from '../types/design';

export interface StyleMaterialSet {
  wood: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  sofa: THREE.MeshStandardMaterial;
  accentFabric: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  shade: THREE.MeshStandardMaterial;
  artwork: THREE.MeshStandardMaterial;
  screen: THREE.MeshStandardMaterial;
}

function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const w = Math.max(0.05, width - radius * 2);
  const d = Math.max(0.05, depth - radius * 2);
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;

  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + d - radius);
  shape.quadraticCurveTo(x, y + d, x + radius, y + d);
  shape.lineTo(x + w - radius, y + d);
  shape.quadraticCurveTo(x + w, y + d, x + w, y + d - radius);
  shape.lineTo(x + w, y + radius);
  shape.quadraticCurveTo(x + w, y, x + w - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, height - radius * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: radius,
    bevelThickness: radius,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const minY = geo.boundingBox ? geo.boundingBox.min.y : 0;
  geo.translate(0, -minY, 0); // Bottom-center pivot at y=0
  return geo;
}

export function createFurnitureMaterials(
  style: StyleDefinition,
  scheme: ColorScheme,
  artworkTexture: THREE.Texture,
): StyleMaterialSet {
  return {
    wood: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.woodHex),
      roughness: style.woodRoughness,
      metalness: 0.04,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.metalHex),
      roughness: style.metalRoughness,
      metalness: style.metalness,
    }),
    sofa: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.sofaHex),
      roughness: style.id === 'industrial' ? 0.42 : 0.88,
      metalness: 0.02,
    }),
    accentFabric: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.accentHex),
      roughness: 0.85,
      metalness: 0.02,
    }),
    ceramic: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.wallHex),
      roughness: 0.28,
      metalness: 0.05,
    }),
    stone: new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.trimHex),
      roughness: 0.38,
      metalness: 0.05,
    }),
    foliage: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4B6A47'),
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    shade: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F5EFE2'),
      emissive: new THREE.Color('#FFCF86'),
      emissiveIntensity: 0.35,
      roughness: 0.85,
    }),
    artwork: new THREE.MeshStandardMaterial({
      map: artworkTexture,
      roughness: 0.55,
      metalness: 0.02,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#191B1E'),
      roughness: 0.16,
      metalness: 0.2,
    }),
  };
}

function enableShadows(group: THREE.Object3D, cast = true, receive = true) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

/**
 * Multi-part Sofa Group (11 parts, bottom-center grounded at y = 0)
 */
export function buildSofaGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SofaGroup';

  // 4 Tapered legs
  const legGeo = new THREE.CylinderGeometry(0.028, 0.018, 0.16, 10);
  const legOffsets: [number, number][] = [
    [-1.08, -0.36],
    [1.08, -0.36],
    [-1.08, 0.36],
    [1.08, 0.36],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, mats.wood);
    leg.position.set(lx, 0.08, lz);
    group.add(leg);
  }

  // Timber base plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.08, 0.88), mats.wood);
  plinth.position.set(0, 0.2, 0);
  group.add(plinth);

  // 3 Seat cushions (ExtrudeGeometry with beveled edges)
  const seatGeo = createRoundedBoxGeometry(0.68, 0.18, 0.78, 0.03);
  [-0.7, 0, 0.7].forEach((cx) => {
    const seat = new THREE.Mesh(seatGeo, mats.sofa);
    seat.position.set(cx, 0.24, 0.04);
    group.add(seat);
  });

  // Backrest frame + 3 cushions
  const backFrame = new THREE.Mesh(createRoundedBoxGeometry(2.34, 0.44, 0.18, 0.025), mats.sofa);
  backFrame.position.set(0, 0.24, -0.36);
  group.add(backFrame);

  const backCushionGeo = createRoundedBoxGeometry(0.66, 0.34, 0.16, 0.035);
  [-0.7, 0, 0.7].forEach((cx) => {
    const cushion = new THREE.Mesh(backCushionGeo, mats.sofa);
    cushion.position.set(cx, 0.41, -0.24);
    cushion.rotation.x = -0.14;
    group.add(cushion);
  });

  // 2 Armrests
  const armGeo = createRoundedBoxGeometry(0.18, 0.36, 0.88, 0.03);
  [-1.09, 1.09].forEach((ax) => {
    const arm = new THREE.Mesh(armGeo, mats.sofa);
    arm.position.set(ax, 0.24, 0);
    group.add(arm);
  });

  // 2 Accent Throw Pillows
  const pillowGeo = createRoundedBoxGeometry(0.34, 0.28, 0.11, 0.035);
  const p1 = new THREE.Mesh(pillowGeo, mats.accentFabric);
  p1.position.set(-0.84, 0.42, -0.11);
  p1.rotation.set(-0.22, 0.32, 0.08);
  group.add(p1);

  const p2 = new THREE.Mesh(pillowGeo, mats.accentFabric);
  p2.position.set(0.84, 0.42, -0.11);
  p2.rotation.set(-0.22, -0.32, -0.08);
  group.add(p2);

  enableShadows(group);
  return group;
}

/**
 * Multi-part Coffee Table Group with Tray, Ceramic Vase, & Books
 */
export function buildCoffeeTableGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CoffeeTableGroup';

  const legGeo = new THREE.CylinderGeometry(0.022, 0.016, 0.34, 10);
  const legPos: [number, number][] = [
    [-0.5, -0.26],
    [0.5, -0.26],
    [-0.5, 0.26],
    [0.5, 0.26],
  ];
  for (const [x, z] of legPos) {
    const leg = new THREE.Mesh(legGeo, mats.metal);
    leg.position.set(x, 0.17, z);
    group.add(leg);
  }

  // Lower shelf stretcher
  const stretcher = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.02, 0.48), mats.wood);
  stretcher.position.set(0, 0.12, 0);
  group.add(stretcher);

  // Beveled stone/wood tabletop
  const top = new THREE.Mesh(createRoundedBoxGeometry(1.24, 0.055, 0.68, 0.015), mats.stone);
  top.position.set(0, 0.34, 0);
  group.add(top);

  // Decorative wooden tray
  const tray = new THREE.Mesh(createRoundedBoxGeometry(0.36, 0.025, 0.26, 0.008), mats.wood);
  tray.position.set(-0.22, 0.395, 0.02);
  group.add(tray);

  // Sculptural ceramic vessel (LatheGeometry)
  const vasePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.055, 0),
    new THREE.Vector2(0.075, 0.08),
    new THREE.Vector2(0.045, 0.16),
    new THREE.Vector2(0.032, 0.21),
    new THREE.Vector2(0.042, 0.23),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePoints, 18), mats.ceramic);
  vase.position.set(-0.24, 0.42, 0.02);
  group.add(vase);

  // Art book stack
  const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.18), mats.accentFabric);
  book1.position.set(0.24, 0.409, -0.04);
  book1.rotation.y = 0.14;
  group.add(book1);

  const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.022, 0.16), mats.ceramic);
  book2.position.set(0.24, 0.434, -0.04);
  book2.rotation.y = -0.08;
  group.add(book2);

  enableShadows(group);
  return group;
}

/**
 * Multi-part Lounge Chair + Side Table Group
 */
export function buildLoungeChairGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LoungeChairGroup';

  // Angled timber leg frames
  const legGeo = new THREE.BoxGeometry(0.045, 0.36, 0.045);
  const corners: [number, number][] = [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ];
  for (const [x, z] of corners) {
    const leg = new THREE.Mesh(legGeo, mats.wood);
    leg.position.set(x, 0.18, z);
    group.add(leg);
  }

  // Armrest bars
  [-0.34, 0.34].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.72), mats.wood);
    arm.position.set(ax, 0.52, 0);
    group.add(arm);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.045), mats.wood);
    post.position.set(ax, 0.43, 0.32);
    group.add(post);
  });

  // Seat cushion
  const seat = new THREE.Mesh(createRoundedBoxGeometry(0.64, 0.13, 0.66, 0.025), mats.accentFabric);
  seat.position.set(0, 0.34, 0.02);
  seat.rotation.x = -0.08;
  group.add(seat);

  // Backrest cushion
  const back = new THREE.Mesh(createRoundedBoxGeometry(0.62, 0.44, 0.13, 0.025), mats.accentFabric);
  back.position.set(0, 0.58, -0.27);
  back.rotation.x = -0.24;
  group.add(back);

  // Companion round side table offset to the right
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.03, 18), mats.metal);
  tableBase.position.set(0.66, 0.015, -0.1);
  group.add(tableBase);

  const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 12), mats.metal);
  tablePedestal.position.set(0.66, 0.255, -0.1);
  group.add(tablePedestal);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 24), mats.wood);
  tableTop.position.set(0.66, 0.5, -0.1);
  group.add(tableTop);

  enableShadows(group);
  return group;
}

/**
 * Multi-part Media Credenza + Wall Gallery Art Group
 */
export function buildCredenzaGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CredenzaGroup';

  // 4 Tapered legs
  const legGeo = new THREE.CylinderGeometry(0.024, 0.015, 0.2, 10);
  const legCoords: [number, number][] = [
    [-0.95, -0.16],
    [0.95, -0.16],
    [-0.95, 0.16],
    [0.95, 0.16],
  ];
  for (const [x, z] of legCoords) {
    const leg = new THREE.Mesh(legGeo, mats.metal);
    leg.position.set(x, 0.1, z);
    group.add(leg);
  }

  // Cabinet body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.46, 0.44), mats.wood);
  body.position.set(0, 0.43, 0);
  group.add(body);

  // 4 Cabinet door faces + vertical metal pulls
  [-0.76, -0.255, 0.255, 0.76].forEach((dx, idx) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.42, 0.02), mats.wood);
    door.position.set(dx, 0.43, 0.225);
    group.add(door);

    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.12, 0.025), mats.metal);
    pull.position.set(dx + (idx % 2 === 0 ? 0.19 : -0.19), 0.43, 0.242);
    group.add(pull);
  });

  // Tabletop decorative sculptural bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.07, 0.08, 18), mats.ceramic);
  bowl.position.set(-0.72, 0.7, 0);
  group.add(bowl);

  // Wall-mounted / console-resting gallery frame artwork
  const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.24, 0.04), mats.wood);
  frameOuter.position.set(0.18, 1.56, -0.16);
  group.add(frameOuter);

  const canvasPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.16), mats.artwork);
  canvasPlane.position.set(0.18, 1.56, -0.138);
  group.add(canvasPlane);

  // Slim architectural frame screen / TV beside art
  const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.03), mats.metal);
  tvFrame.position.set(-0.56, 1.28, -0.17);
  group.add(tvFrame);

  const tvPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.52), mats.screen);
  tvPanel.position.set(-0.56, 1.28, -0.153);
  group.add(tvPanel);

  enableShadows(group);
  return group;
}

/**
 * Multi-part Floor Lamp Group with Emissive Drum Shade
 */
export function buildFloorLampGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'FloorLampGroup';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 24), mats.metal);
  base.position.set(0, 0.015, 0);
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 1.62, 12), mats.metal);
  stem.position.set(0, 0.83, 0);
  group.add(stem);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 10), mats.metal);
  arm.position.set(0.14, 1.62, 0);
  arm.rotation.z = Math.PI / 2 - 0.18;
  group.add(arm);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.24, 0.28, 24, 1, true),
    mats.shade,
  );
  shade.material.side = THREE.DoubleSide;
  shade.position.set(0.28, 1.56, 0);
  group.add(shade);

  const topCap = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.19, 24), mats.metal);
  topCap.rotation.x = -Math.PI / 2;
  topCap.position.set(0.28, 1.7, 0);
  group.add(topCap);

  enableShadows(group);
  return group;
}

/**
 * Multi-part Architectural Indoor Plant Group (Planter + Trunk + Layered Foliage)
 */
export function buildPlantGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlantGroup';

  // Ceramic tapered planter
  const potPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.14, 0),
    new THREE.Vector2(0.2, 0.34),
    new THREE.Vector2(0.18, 0.36),
    new THREE.Vector2(0.15, 0.34),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPoints, 20), mats.ceramic);
  group.add(pot);

  // Dark soil disc
  const soilMat = new THREE.MeshStandardMaterial({ color: '#2B231D', roughness: 0.95 });
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), soilMat);
  soil.position.set(0, 0.31, 0);
  group.add(soil);

  // Main trunk + 2 secondary branches
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5A4634', roughness: 0.85 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.92, 8), trunkMat);
  trunk.position.set(0, 0.76, 0);
  trunk.rotation.z = 0.04;
  group.add(trunk);

  const branch1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.45, 7), trunkMat);
  branch1.position.set(0.11, 0.95, 0.04);
  branch1.rotation.z = -0.45;
  group.add(branch1);

  const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.42, 7), trunkMat);
  branch2.position.set(-0.1, 1.05, -0.05);
  branch2.rotation.z = 0.42;
  group.add(branch2);

  // Layered leaf clusters
  const leafGeo = new THREE.SphereGeometry(0.12, 10, 8);
  leafGeo.scale(1.2, 0.45, 0.85);
  const leafPositions: [number, number, number, number][] = [
    [0, 1.32, 0, 0],
    [0.2, 1.15, 0.08, 0.4],
    [-0.18, 1.24, -0.08, -0.5],
    [0.08, 1.26, -0.16, 0.9],
    [-0.08, 1.12, 0.16, -0.8],
    [0.14, 1.38, 0.06, 0.2],
    [-0.12, 1.36, 0.04, -0.3],
  ];
  for (const [lx, ly, lz, rot] of leafPositions) {
    const leaf = new THREE.Mesh(leafGeo, mats.foliage);
    leaf.position.set(lx, ly, lz);
    leaf.rotation.set(0.2, rot, 0.15);
    group.add(leaf);
  }

  enableShadows(group);
  return group;
}

/**
 * Multi-part Dining Table + 4 Chairs Group (for larger / Open Living-Dining rooms)
 */
export function buildDiningSetGroup(mats: StyleMaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DiningSetGroup';

  // Dining table
  const tTop = new THREE.Mesh(createRoundedBoxGeometry(1.56, 0.045, 0.92, 0.015), mats.wood);
  tTop.position.set(0, 0.72, 0);
  group.add(tTop);

  const legGeo = new THREE.CylinderGeometry(0.026, 0.018, 0.72, 10);
  [
    [-0.64, -0.34],
    [0.64, -0.34],
    [-0.64, 0.34],
    [0.64, 0.34],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, mats.wood);
    leg.position.set(lx, 0.36, lz);
    group.add(leg);
  });

  // Centerpiece bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.06, 16), mats.ceramic);
  bowl.position.set(0, 0.79, 0);
  group.add(bowl);

  // 4 Dining Chairs
  const chairOffsets: [number, number, number][] = [
    [-0.38, -0.6, 0],
    [0.38, -0.6, 0],
    [-0.38, 0.6, Math.PI],
    [0.38, 0.6, Math.PI],
  ];

  const cLegGeo = new THREE.CylinderGeometry(0.015, 0.012, 0.44, 8);
  const cSeatGeo = createRoundedBoxGeometry(0.42, 0.04, 0.42, 0.015);
  const cBackGeo = createRoundedBoxGeometry(0.42, 0.34, 0.04, 0.012);

  for (const [cx, cz, rotY] of chairOffsets) {
    const chair = new THREE.Group();
    [
      [-0.17, -0.17],
      [0.17, -0.17],
      [-0.17, 0.17],
      [0.17, 0.17],
    ].forEach(([lx, lz]) => {
      const cl = new THREE.Mesh(cLegGeo, mats.wood);
      cl.position.set(lx, 0.22, lz);
      chair.add(cl);
    });
    const cs = new THREE.Mesh(cSeatGeo, mats.sofa);
    cs.position.set(0, 0.44, 0);
    chair.add(cs);

    const cb = new THREE.Mesh(cBackGeo, mats.wood);
    cb.position.set(0, 0.61, -0.19);
    chair.add(cb);

    chair.position.set(cx, 0, cz);
    chair.rotation.y = rotY;
    group.add(chair);
  }

  enableShadows(group);
  return group;
}
