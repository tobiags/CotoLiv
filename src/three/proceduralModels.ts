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
