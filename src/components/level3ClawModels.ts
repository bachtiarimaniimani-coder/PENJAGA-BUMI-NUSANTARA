import * as THREE from 'three';

function createLabelTexture(
  bg: string,
  accent: string,
  title: string,
  subtitle?: string
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, c.width, 18);
  ctx.fillRect(0, c.height - 18, c.width, 18);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, c.width / 2, subtitle ? 54 : 64);

  if (subtitle) {
    ctx.fillStyle = '#334155';
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, c.width / 2, 88);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createKraftTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#c48f5a';
  ctx.fillRect(0, 0, 256, 256);

  // Corrugated horizontal ribs
  for (let y = 0; y < 256; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? 'rgba(120, 53, 15, 0.14)' : 'rgba(255, 237, 213, 0.1)';
    ctx.fillRect(0, y, 256, 4);
  }

  // Packing tape strip across top
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, 108, 256, 40);

  // Stencil mark
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 34, 160, 54);
  ctx.fillStyle = '#451a03';
  ctx.font = '900 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KARDUS', 128, 61);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCanvasClothTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#f5f0e1';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle woven linen grid
  ctx.strokeStyle = 'rgba(161, 138, 102, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 256; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Green eco badge on tote bag
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(128, 128, 56, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TOTE', 128, 114);
  ctx.fillText('KAIN', 128, 144);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 1. Ban Mobil Bekas Layak Pakai (ID 1 / specIndex 0)
 */
function buildUsedTire(): THREE.Group {
  const g = new THREE.Group();
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.88,
    metalness: 0.06,
  });
  const treadMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.92,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.24,
    metalness: 0.88,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.78,
  });

  const tireBody = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.165, 16, 28), rubberMat);
  g.add(tireBody);

  // Sidewall detail rings
  [-0.12, 0.12].forEach((zOff) => {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 8, 24), treadMat);
    rib.position.z = zOff;
    g.add(rib);
  });

  // 12 outer tread lugs
  const lugGeo = new THREE.BoxGeometry(0.11, 0.06, 0.26);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, treadMat);
    lug.position.set(Math.cos(ang) * 0.56, Math.sin(ang) * 0.56, 0);
    lug.rotation.z = ang + Math.PI / 2;
    g.add(lug);
  }

  // Steel wheel rim & spokes
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 18), rimMat);
  rim.rotation.x = Math.PI / 2;
  const centerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12), hubMat);
  centerHub.rotation.x = Math.PI / 2;
  g.add(rim, centerHub);

  // 5 wheel lug bolts
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.27, 8);
  for (let b = 0; b < 5; b++) {
    const ang = (b / 5) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, rimMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0);
    g.add(bolt);
  }

  g.rotation.set(0.18, 0.42, 0);
  return g;
}

/**
 * 2. Kantong Belanja Kain / Tote Bag (ID 2 / specIndex 1)
 */
function buildCanvasToteBag(clothTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();

  const clothMat = new THREE.MeshStandardMaterial({
    map: clothTex,
    roughness: 0.9,
    metalness: 0.02,
  });
  const greenTrimMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.85,
    metalness: 0.05,
  });
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0xbef264,
    roughness: 0.88,
  });

  // Main canvas pouch
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.28), clothMat);
  body.position.y = -0.08;
  // Reinforced green bottom seam
  const baseSeam = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.14, 0.31), greenTrimMat);
  baseSeam.position.y = -0.39;
  // Top cuff hem
  const topHem = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.3), greenTrimMat);
  topHem.position.y = 0.25;
  // Outer utility pocket
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.04), pocketMat);
  pocket.position.set(0, -0.2, 0.155);
  g.add(body, baseSeam, topHem, pocket);

  // Two arched cloth handles made via TubeGeometry
  [-0.1, 0.1].forEach((zOff) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, 0.26, zOff),
      new THREE.Vector3(-0.17, 0.56, zOff),
      new THREE.Vector3(0, 0.64, zOff),
      new THREE.Vector3(0.17, 0.56, zOff),
      new THREE.Vector3(0.2, 0.26, zOff),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.032, 8, false), greenTrimMat);
    g.add(handle);
  });

  g.rotation.y = 0.25;
  return g;
}

/**
 * 3. Botol Minum Isi Ulang / Tumbler (ID 3 / specIndex 2)
 */
function buildTumblerBottle(labelTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();

  const bodyPts = [
    new THREE.Vector2(0.0, -0.44),
    new THREE.Vector2(0.2, -0.44),
    new THREE.Vector2(0.23, -0.38),
    new THREE.Vector2(0.25, 0.22),
    new THREE.Vector2(0.21, 0.32),
    new THREE.Vector2(0.18, 0.36),
  ];
  const flaskMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.26,
    metalness: 0.62,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.15,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.45,
    metalness: 0.1,
  });

  const flask = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 24), flaskMat);
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.21, 0.1, 20), steelMat);
  baseRing.position.y = -0.4;
  const labelBand = new THREE.Mesh(new THREE.CylinderGeometry(0.254, 0.248, 0.28, 24, 1, true), bandMat);
  labelBand.position.y = -0.04;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.21, 0.16, 20), capMat);
  lid.position.y = 0.42;
  const carryLoop = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.024, 8, 16), steelMat);
  carryLoop.position.y = 0.56;

  g.add(flask, baseRing, labelBand, lid, carryLoop);
  g.rotation.z = 0.12;
  return g;
}

/**
 * 4. Kaleng Minuman Penyok (ID 4 / specIndex 3)
 */
function buildDentedCan(labelTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();

  // Crumpled / pinched aluminum can profile
  const canPts = [
    new THREE.Vector2(0.0, -0.4),
    new THREE.Vector2(0.22, -0.4),
    new THREE.Vector2(0.27, -0.34),
    new THREE.Vector2(0.26, -0.14),
    new THREE.Vector2(0.16, 0.0), // squeezed dent waist
    new THREE.Vector2(0.24, 0.16),
    new THREE.Vector2(0.26, 0.34),
    new THREE.Vector2(0.22, 0.41),
    new THREE.Vector2(0.0, 0.41),
  ];
  const aluMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.9,
  });
  const wrapMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.32,
    metalness: 0.45,
  });

  const canMesh = new THREE.Mesh(new THREE.LatheGeometry(canPts, 20), aluMat);
  // Dent crease band
  const bandPts = [
    new THREE.Vector2(0.268, -0.22),
    new THREE.Vector2(0.172, 0.0),
    new THREE.Vector2(0.255, 0.22),
  ];
  const bandMesh = new THREE.Mesh(new THREE.LatheGeometry(bandPts, 20), wrapMat);
  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 20), aluMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 0.41;
  const pullTab = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 12), aluMat);
  pullTab.rotation.x = Math.PI / 2;
  pullTab.position.set(0.04, 0.43, 0);

  g.add(canMesh, bandMesh, topRim, pullTab);
  g.rotation.set(0.1, 0, -0.18);
  return g;
}

/**
 * 5. Botol Kaca Bekas Sirup (Bersih) (ID 5 / specIndex 4)
 */
function buildGlassSyrupBottle(labelTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();

  const glassPts = [
    new THREE.Vector2(0.0, -0.46),
    new THREE.Vector2(0.22, -0.46),
    new THREE.Vector2(0.24, -0.4),
    new THREE.Vector2(0.24, 0.04),
    new THREE.Vector2(0.14, 0.18),
    new THREE.Vector2(0.095, 0.42),
    new THREE.Vector2(0.12, 0.46),
    new THREE.Vector2(0.09, 0.46),
  ];
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x0f766e,
    emissiveIntensity: 0.18,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.82,
  });
  const innerHighlightMat = new THREE.MeshStandardMaterial({
    color: 0x99f6e4,
    roughness: 0.15,
    transparent: true,
    opacity: 0.35,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.32,
    metalness: 0.1,
  });
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.6,
  });

  const bottleMesh = new THREE.Mesh(new THREE.LatheGeometry(glassPts, 24), glassMat);
  const innerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.42, 16),
    innerHighlightMat
  );
  innerCore.position.y = -0.18;
  const labelWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.246, 0.246, 0.28, 24, 1, true),
    labelMat
  );
  labelWrap.position.y = -0.18;
  const screwCap = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.12, 16), capMat);
  screwCap.position.y = 0.5;

  g.add(bottleMesh, innerCore, labelWrap, screwCap);
  g.rotation.z = 0.08;
  return g;
}

/**
 * 6. Kardus & Kertas Pembungkus Rusak (ID 6 / specIndex 5)
 */
function buildDamagedCardboard(kraftTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();

  const kraftMat = new THREE.MeshStandardMaterial({
    map: kraftTex,
    roughness: 0.86,
    metalness: 0.02,
  });
  const flapMat = new THREE.MeshStandardMaterial({
    color: 0xb47d49,
    roughness: 0.9,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.92,
  });
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.45,
  });

  // Slightly squashed carton box
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 0.54), kraftMat);
  box.position.y = -0.14;

  // Torn/bent open upper flaps
  const flapLeft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.52), flapMat);
  flapLeft.position.set(-0.32, 0.18, 0);
  flapLeft.rotation.z = 0.62;

  const flapRight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.52), flapMat);
  flapRight.position.set(0.34, 0.16, 0);
  flapRight.rotation.z = -0.48;

  // Crumpled paper & scrap sheet sticking out
  const paper1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.34), paperMat);
  paper1.position.set(-0.06, 0.16, 0.04);
  paper1.rotation.set(0.25, 0.35, -0.18);

  const paper2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), paperMat);
  paper2.position.set(0.14, 0.24, -0.04);

  const looseTape = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.03), tapeMat);
  looseTape.position.set(0.12, 0.02, 0.28);
  looseTape.rotation.z = -0.35;

  g.add(box, flapLeft, flapRight, paper1, paper2, looseTape);
  g.rotation.set(0.12, 0.32, -0.06);
  return g;
}

export interface Level3GrippedItemRig {
  container: THREE.Group;
  models: THREE.Group[];
  setActiveSpec: (specIndex: number) => void;
  dispose: () => void;
}

export function createLevel3GrippedItemRig(): Level3GrippedItemRig {
  const container = new THREE.Group();

  const clothTex = createCanvasClothTexture();
  const tumblerTex = createLabelTexture('#ecfeff', '#0891b2', 'TUMBLER', 'ISI ULANG');
  const canTex = createLabelTexture('#fef3c7', '#ef4444', 'SODA', 'KALENG');
  const syrupTex = createLabelTexture('#fff1f2', '#e11d48', 'SIRUP', 'BOTOL KACA');
  const kraftTex = createKraftTexture();

  const textures = [clothTex, tumblerTex, canTex, syrupTex, kraftTex];

  // Ordered strictly by specIndex 0..5 matching LEVEL_3_CLAW_ITEMS
  const models: THREE.Group[] = [
    buildUsedTire(),
    buildCanvasToteBag(clothTex),
    buildTumblerBottle(tumblerTex),
    buildDentedCan(canTex),
    buildGlassSyrupBottle(syrupTex),
    buildDamagedCardboard(kraftTex),
  ];

  models.forEach((m, idx) => {
    m.visible = idx === 0;
    container.add(m);
  });

  let activeIdx = 0;
  const setActiveSpec = (specIndex: number) => {
    const safeIdx = Math.max(0, Math.min(models.length - 1, specIndex));
    if (safeIdx === activeIdx && models[safeIdx]?.visible) return;
    activeIdx = safeIdx;
    models.forEach((m, i) => {
      m.visible = i === safeIdx;
    });
  };

  const dispose = () => {
    textures.forEach((t) => t.dispose());
    models.forEach((m) => {
      m.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    });
  };

  return { container, models, setActiveSpec, dispose };
}
