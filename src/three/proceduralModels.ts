import * as THREE from 'three';

function addContactShadow(
  group: THREE.Group,
  shadowMap: THREE.Texture,
  width: number,
  depth: number
): void {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  group.add(mesh);
}

/**
 * Composite 10-part CotoLiv express delivery motorcycle.
 * Local forward axis: +Z (aligned cleanly with yaw atan2(dx, dz)).
 * Pivot: bottom-center (y = 0 at tire contact patch).
 */
export function createCourierMotoGroup(
  shadowMap: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CourierMoto';

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x161c1a,
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd1dbd6,
    roughness: 0.24,
    metalness: 0.85,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f5c41,
    roughness: 0.34,
    metalness: 0.42,
  });
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x117a55,
    roughness: 0.38,
    metalness: 0.12,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xd89f38,
    roughness: 0.28,
    metalness: 0.78,
  });
  const riderSuitMat = new THREE.MeshStandardMaterial({
    color: 0x1b2924,
    roughness: 0.74,
    metalness: 0.05,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f4,
    roughness: 0.22,
    metalness: 0.15,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffd97d,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff4545,
    emissive: 0xe62222,
    emissiveIntensity: 1.8,
    roughness: 0.25,
  });

  addContactShadow(group, shadowMap, 2.2, 3.4);

  // Front & rear tires + metallic rims
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 12);
  rimGeo.rotateZ(Math.PI / 2);

  for (const zPos of [0.82, -0.78]) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(0, 0.42, zPos);
    tire.castShadow = true;
    group.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(0, 0.42, zPos);
    group.add(rim);
  }

  // Main body chassis & engine cowling
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 1.7), chassisMat);
  chassis.position.set(0, 0.74, 0.04);
  chassis.castShadow = true;
  group.add(chassis);

  // Front fork + windscreen fairing
  const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.34), chassisMat);
  fairing.position.set(0, 1.12, 0.68);
  fairing.rotation.x = -0.22;
  fairing.castShadow = true;
  group.add(fairing);

  const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.92, 8), rimMat);
  handlebars.rotation.z = Math.PI / 2;
  handlebars.position.set(0, 1.38, 0.54);
  group.add(handlebars);

  // Glowing LED Headlight & Red Taillight
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.12), headlightMat);
  headlight.position.set(0, 1.14, 0.88);
  group.add(headlight);

  const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), taillightMat);
  taillight.position.set(0, 0.9, -0.84);
  group.add(taillight);

  // Insulated CotoLiv Parcel Delivery Box + Gold Trim Latch
  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.74, 0.86), boxMat);
  cargoBox.position.set(0, 1.34, -0.58);
  cargoBox.castShadow = true;
  group.add(cargoBox);

  const boxLidTrim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.9), goldAccentMat);
  boxLidTrim.position.set(0, 1.66, -0.58);
  group.add(boxLidTrim);

  // Rider torso + safety helmet
  const riderTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.68, 12), riderSuitMat);
  riderTorso.position.set(0, 1.36, 0.1);
  riderTorso.rotation.x = 0.16;
  riderTorso.castShadow = true;
  group.add(riderTorso);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), helmetMat);
  helmet.position.set(0, 1.84, 0.18);
  helmet.castShadow = true;
  group.add(helmet);

  return group;
}

/**
 * Composite 10-part CotoLiv refrigerated delivery van.
 * Local forward axis: +Z. Pivot: y = 0.
 */
export function createCourierVanGroup(shadowMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CourierVan';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7f5,
    roughness: 0.34,
    metalness: 0.14,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x0f5c41,
    roughness: 0.36,
    metalness: 0.22,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd89f38,
    roughness: 0.26,
    metalness: 0.75,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1a2e2a,
    roughness: 0.12,
    metalness: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171d1b,
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcfdad4,
    roughness: 0.25,
    metalness: 0.85,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffd97d,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff4545,
    emissive: 0xe62222,
    emissiveIntensity: 1.8,
    roughness: 0.25,
  });

  addContactShadow(group, shadowMap, 2.8, 4.4);

  // Cargo compartment
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.32, 2.3), bodyMat);
  cargo.position.set(0, 1.06, -0.32);
  cargo.castShadow = true;
  group.add(cargo);

  // CotoLiv emerald branding band + gold roof accent
  const brandBand = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.36, 2.26), stripeMat);
  brandBand.position.set(0, 0.84, -0.32);
  group.add(brandBand);

  const roofUnit = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.2, 0.9), goldMat);
  roofUnit.position.set(0, 1.82, 0.05);
  group.add(roofUnit);

  // Forward cab + sloped windshield
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.96, 1.05), bodyMat);
  cab.position.set(0, 0.88, 1.24);
  cab.castShadow = true;
  group.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.48, 0.14), glassMat);
  windshield.position.set(0, 1.22, 1.54);
  windshield.rotation.x = -0.38;
  group.add(windshield);

  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 0.18), stripeMat);
  frontBumper.position.set(0, 0.44, 1.78);
  group.add(frontBumper);

  // Headlights & Taillights
  for (const xPos of [-0.48, 0.48]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.1), headlightMat);
    hl.position.set(xPos, 0.72, 1.78);
    group.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.08), taillightMat);
    tl.position.set(xPos, 0.78, -1.48);
    group.add(tl);
  }

  // 4 wheels with rims
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.26, 10);
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wz] of [
    [-0.72, 1.12],
    [0.72, 1.12],
    [-0.72, -0.88],
    [0.72, -0.88],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, 0.38, wz);
    group.add(rim);
  }

  return group;
}

/**
 * Composite 9-part Origin Logistics Hub ("D'où vient le colis").
 * Pivot: bottom-center (y = 0).
 */
export function createOriginHubGroup(shadowMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'OriginHub';

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xcfd6d1,
    roughness: 0.85,
    metalness: 0.05,
  });
  const hallMat = new THREE.MeshStandardMaterial({
    color: 0xf0f3f0,
    roughness: 0.62,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0f4c36,
    roughness: 0.38,
    metalness: 0.28,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d46,
    roughness: 0.35,
    metalness: 0.76,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xc9934c,
    roughness: 0.78,
    metalness: 0.04,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  addContactShadow(group, shadowMap, 6.2, 6.2);

  // Stepped concrete foundation
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.34, 4.2), plinthMat);
  plinth.position.y = 0.17;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Main dispatch hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 2.8), hallMat);
  hall.position.set(0, 1.44, -0.35);
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // Architectural roof fascia
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.32, 3.2), roofMat);
  roof.position.set(0, 2.66, -0.35);
  roof.castShadow = true;
  group.add(roof);

  // Cantilevered loading canopy + steel pillars
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.16, 1.35), roofMat);
  canopy.position.set(0, 1.86, 1.5);
  canopy.castShadow = true;
  group.add(canopy);

  for (const px of [-1.45, 1.45]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.52, 8), steelMat);
    pillar.position.set(px, 1.1, 1.95);
    group.add(pillar);
  }

  // Stacked dispatch parcel crates
  const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.65), crateMat);
  crate1.position.set(-0.65, 0.61, 1.45);
  group.add(crate1);

  const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), crateMat);
  crate2.position.set(0.05, 0.56, 1.52);
  group.add(crate2);

  // Rooftop beacon mast + glowing emerald orb
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 8), steelMat);
  mast.position.set(0, 3.9, -0.35);
  group.add(mast);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), beaconMat);
  orb.position.set(0, 5.1, -0.35);
  orb.name = 'BeaconOrb';
  group.add(orb);

  return group;
}

/**
 * Composite 8-part Destination Landmark Pavilion.
 * Pivot: bottom-center (y = 0).
 */
export function createDestinationLandmarkGroup(
  shadowMap: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DestinationLandmark';

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x222c28,
    roughness: 0.72,
    metalness: 0.15,
  });
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xeae8e0,
    roughness: 0.55,
    metalness: 0.08,
  });
  const atriumGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1d3b34,
    roughness: 0.14,
    metalness: 0.72,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a13b,
    roughness: 0.26,
    metalness: 0.82,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xf7c96b,
    emissive: 0xd99426,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  addContactShadow(group, shadowMap, 5.8, 5.8);

  // Octagonal architectural terrace plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.55, 0.4, 8), plinthMat);
  plinth.position.y = 0.2;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Lower pavilion core
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.7, 2.9), towerMat);
  lower.position.y = 1.25;
  lower.castShadow = true;
  group.add(lower);

  // Recessed glass atrium level
  const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.85, 2.55), atriumGlassMat);
  glassBand.position.y = 2.52;
  group.add(glassBand);

  // Upper cantilevered crown
  const crown = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.42, 3.1), plinthMat);
  crown.position.y = 3.16;
  crown.castShadow = true;
  group.add(crown);

  // Gold destination collar trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.12, 3.22), goldMat);
  trim.position.y = 3.38;
  group.add(trim);

  // Destination beacon spire + glowing ring & diamond finial
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.3, 8), goldMat);
  spire.position.y = 4.55;
  group.add(spire);

  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), beaconMat);
  finial.position.y = 5.85;
  finial.name = 'BeaconOrb';
  group.add(finial);

  return group;
}

/**
 * Composite 5-part Waypoint Relay Monument (e.g. Carrefour Étoile Rouge / Ganhi).
 * Pivot: bottom-center (y = 0).
 */
export function createWaypointPylonGroup(
  shadowMap: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WaypointPylon';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xd9ded9,
    roughness: 0.78,
    metalness: 0.05,
  });
  const emeraldMat = new THREE.MeshStandardMaterial({
    color: 0x0f6b4b,
    roughness: 0.34,
    metalness: 0.35,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x5eead4,
    emissive: 0x10b981,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  addContactShadow(group, shadowMap, 3.6, 3.6);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.35, 16), stoneMat);
  base.position.y = 0.175;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 2.4, 12), stoneMat);
  column.position.y = 1.55;
  column.castShadow = true;
  group.add(column);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.1, 10, 20), emeraldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 2.65;
  group.add(collar);

  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowMat);
  cap.position.y = 3.2;
  cap.name = 'BeaconOrb';
  group.add(cap);

  return group;
}
