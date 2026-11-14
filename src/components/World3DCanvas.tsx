import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LEVEL_4_CITIZENS, LEVEL_5_ZONES, LEVEL_6_ISLANDS } from '../game/blueprintData';
import {
  findNearestCitizenIndex,
  LEVEL_6_TOWER_POSITIONS,
  LEVEL_6_INTERACT_RADIUS,
  detectTowerTouchTrigger,
  computeMobileLevel3CameraSpec,
  computeMobileLevel2CameraSpec,
  resolveSplitTouchSlot,
} from '../game/rules';
import { createLevel3GrippedItemRig } from './level3ClawModels';

export interface Level2VisualState {
  assembledLetters: string[];
  targetLength: number;
  targetWord: string;
  phase: 'anagram' | 'numeracy';
}

export interface World3DProps {
  page: 'splash' | 'setup' | 'arena' | 'result';
  currentLevel: number; // 1..6 (Player 1)
  p2CurrentLevel?: number; // 1..6 (Player 2 independent level in 2P mode)
  level1IntroPhase?: 'looking' | 'narration' | 'core_game';
  prologueActive: boolean;
  prologueStage: number; // 1..3
  avatarGender: 'male' | 'female';
  avatar2Gender?: 'male' | 'female';
  avatarCostume: 'batik' | 'pramuka' | 'rompi';
  playerName: string;
  player2Name?: string;
  gameMode: 'solo' | 'split' | 'webrtc';
  ecoHealth: number;
  cameraShakeTrigger: number;
  p2CameraShakeTrigger?: number;
  clawX: number; // -1 to 1 for Level 3 (Player 1)
  clawGrabbing: boolean;
  clawItemIndex?: number; // specIndex 0..5 for Level 3 (Player 1)
  clawPhase?: 'claw' | 'numeracy';
  p2ClawX?: number; // -1 to 1 for Level 3 (Player 2)
  p2ClawGrabbing?: boolean;
  p2ClawItemIndex?: number; // specIndex 0..5 for Level 3 (Player 2)
  p2ClawPhase?: 'claw' | 'numeracy';
  level2Visual?: Level2VisualState;
  p2Level2Visual?: Level2VisualState;
  p1DialogOpen?: boolean;
  p2DialogOpen?: boolean;
  playerPosRef: React.MutableRefObject<{
    x: number;
    z: number;
    rotY: number;
    moving: boolean;
    jumping: boolean;
  }>;
  player2PosRef: React.MutableRefObject<{
    x: number;
    z: number;
    rotY: number;
    moving: boolean;
    jumping?: boolean;
  }>;
  completedCitizens: number[];
  completedZones: number[];
  completedIslands: number[];
  p2CompletedCitizens?: number[];
  p2CompletedZones?: number[];
  p2CompletedIslands?: number[];
  l4Positions?: [number, number][];
  l5Positions?: [number, number][];
  onNearbyCitizenChange?: (citizenIndex: number | null) => void;
  onP2NearbyCitizenChange?: (citizenIndex: number | null) => void;
  onNearbyZoneChange?: (zoneIndex: number | null) => void;
  onP2NearbyZoneChange?: (zoneIndex: number | null) => void;
  onNearbyIslandChange?: (islandIndex: number | null) => void;
  onP2NearbyIslandChange?: (islandIndex: number | null) => void;
  onIslandTouch?: (islandIndex: number) => void;
  onP2IslandTouch?: (islandIndex: number) => void;
  onNpcInteract?: (npcIndex: number, playerSlot: 1 | 2, level: 4 | 5 | 6) => void;
}

/**
 * Creates a single shared Color Atlas Texture (Section VI.1 Draw Call Optimization)
 */
function createSharedColorAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const palette = [
    '#22c55e', '#10b981', '#15803d', '#4d7c0f', // foliage greens
    '#854d0e', '#713f12', '#a16207', '#ca8a04', // teak wood & soil
    '#334155', '#475569', '#64748b', '#94a3b8', // city asphalt & stone
    '#38bdf8', '#0284c7', '#facc15', '#ef4444', // water, sun, accents
  ];
  palette.forEach((hex, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    ctx.fillStyle = hex;
    ctx.fillRect(col * 16, row * 16, 16, 16);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Creates a crisp 3D billboard Sprite nameplate floating above a blocky avatar's head.
 */
function createFloatingNameTag(
  initialText: string,
  theme: 'emerald' | 'sky' | 'amber'
): {
  sprite: THREE.Sprite;
  updateText: (nextText: string) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.9, 0.72, 1);
  sprite.position.set(0, 2.55, 0);
  sprite.renderOrder = 12;

  let currentRendered = '';

  const updateText = (nextText: string) => {
    const clean = (nextText || 'Penjaga Bumi').trim();
    if (clean === currentRendered) return;
    currentRendered = clean;

    const fontSpec = '900 32px "Plus Jakarta Sans", sans-serif';
    ctx.font = fontSpec;
    const measuredWidth = ctx.measureText(clean).width;
    const nextWidth = Math.max(360, Math.ceil(measuredWidth) + 96);
    if (canvas.width !== nextWidth) {
      canvas.width = nextWidth;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const borderStroke =
      theme === 'emerald' ? '#34d399' : theme === 'sky' ? '#38bdf8' : '#fbbf24';
    const bgFill =
      theme === 'emerald'
        ? 'rgba(6, 78, 59, 0.94)'
        : theme === 'sky'
        ? 'rgba(12, 74, 110, 0.94)'
        : 'rgba(69, 26, 3, 0.94)';

    // Pill background
    const x = 20;
    const y = 18;
    const w = canvas.width - 40;
    const h = 76;
    const r = 24;

    ctx.fillStyle = bgFill;
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Pointer triangle at bottom center
    ctx.fillStyle = borderStroke;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 14, y + h);
    ctx.lineTo(canvas.width / 2 + 14, y + h);
    ctx.lineTo(canvas.width / 2, y + h + 16);
    ctx.closePath();
    ctx.fill();

    // Full Untruncated Name Text
    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.fillText(clean, canvas.width / 2, y + h / 2 + 2);
    ctx.shadowBlur = 0;

    const spriteHeight = 0.68;
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);
    sprite.userData.nameTagAspect = aspect;

    tex.needsUpdate = true;
  };

  updateText(initialText);
  return { sprite, updateText };
}

/**
 * Creates a 3D billboard sign/label sprite with dynamic canvas width so long location names
 * (e.g., "RUANG BACA DAN TAMAN LITERASI 3R") and bin/zone/island labels are 100% complete and never clipped.
 */
function createBinLabelSprite(
  label: string,
  bgHex: string,
  borderHex: string,
  scaleHeight = 0.68,
  alwaysOnTop = true
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSpec = '900 32px "Plus Jakarta Sans", sans-serif';
  ctx.font = fontSpec;
  const textWidth = ctx.measureText(label).width;

  canvas.width = Math.max(260, Math.ceil(textWidth) + 88);
  canvas.height = 96;

  // Re-apply context state after resizing canvas
  ctx.fillStyle = bgHex;
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 4;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: !alwaysOnTop,
    })
  );
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(scaleHeight * aspect, scaleHeight, 1);
  sprite.renderOrder = alwaysOnTop ? 8 : 4;
  return sprite;
}

/**
 * Builds a procedural 6+ part Low-Poly Blocky Modular Avatar (Section V.1):
 * 1 Cube Head + Peci/Jilbab + 1 Torso Block (Batik/Pramuka/Rompi) + 2 Arm Blocks + 2 Leg Blocks + Contact Shadow + Floating Name Tag
 */
function createBlockyAvatar(
  gender: 'male' | 'female',
  costume: 'batik' | 'pramuka' | 'rompi',
  accentColor?: number,
  nameTagTheme: 'emerald' | 'sky' | 'amber' = 'emerald',
  initialName?: string
): {
  group: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  headGroup: THREE.Group;
  peciMesh: THREE.Mesh;
  jilbabMesh: THREE.Mesh;
  torsoMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  heroRing: THREE.Mesh;
  updateNameTag?: (name: string) => void;
  nameTagSprite?: THREE.Sprite;
} {
  const group = new THREE.Group();

  // Contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.65, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  // High-contrast glowing hero floor ring (shown in 2P Split Mode so main characters never fade into scenery)
  const heroRingGeo = new THREE.RingGeometry(0.74, 1.04, 24);
  heroRingGeo.rotateX(-Math.PI / 2);
  const heroRingColor =
    nameTagTheme === 'emerald' ? 0x34d399 : nameTagTheme === 'sky' ? 0x38bdf8 : 0xfbbf24;
  const heroRingMat = new THREE.MeshBasicMaterial({
    color: heroRingColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const heroRing = new THREE.Mesh(heroRingGeo, heroRingMat);
  heroRing.position.y = 0.05;
  heroRing.visible = false;
  group.add(heroRing);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf6c99e, roughness: 0.65, metalness: 0.05 });
  const torsoColor =
    accentColor ??
    (costume === 'rompi' ? 0x10b981 : costume === 'pramuka' ? 0x92400e : 0x0284c7);
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.45, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: costume === 'pramuka' ? 0x451a03 : 0x1e293b,
    roughness: 0.7,
    metalness: 0.05,
  });

  // Legs
  const legGeo = new THREE.BoxGeometry(0.28, 0.65, 0.28);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.18, 0.325, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.18, 0.325, 0);
  group.add(leftLeg, rightLeg);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.68, 0.78, 0.38);
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(0, 1.02, 0);
  group.add(torso);

  // Badge sash accent on torso
  const sashGeo = new THREE.BoxGeometry(0.7, 0.16, 0.4);
  const sashMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.3 });
  const sash = new THREE.Mesh(sashGeo, sashMat);
  sash.position.set(0, 1.05, 0);
  group.add(sash);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.24, 0.68, 0.24);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.48, 1.0, 0);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.48, 1.0, 0);
  group.add(leftArm, rightArm);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.68, 0);
  const headGeo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headGroup.add(headMesh);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 0.04, 0.28);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.12, 0.04, 0.28);
  headGroup.add(leftEye, rightEye);

  // Headgear: Both created so gender can toggle dynamically
  const peciMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const peciGeo = new THREE.BoxGeometry(0.6, 0.22, 0.6);
  const peciMesh = new THREE.Mesh(peciGeo, peciMat);
  peciMesh.position.set(0, 0.32, 0);
  peciMesh.visible = gender === 'male';
  headGroup.add(peciMesh);

  const jilbabMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });
  const jilbabMesh = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.62, 0.62), jilbabMat);
  jilbabMesh.position.set(0, 0.02, -0.03);
  jilbabMesh.visible = gender === 'female';
  headGroup.add(jilbabMesh);

  group.add(headGroup);

  let updateNameTag: ((name: string) => void) | undefined;
  let nameTagSprite: THREE.Sprite | undefined;
  if (initialName) {
    const tag = createFloatingNameTag(initialName, nameTagTheme);
    group.add(tag.sprite);
    updateNameTag = tag.updateText;
    nameTagSprite = tag.sprite;
  }

  return {
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    headGroup,
    peciMesh,
    jilbabMesh,
    torsoMat,
    pantsMat,
    heroRing,
    updateNameTag,
    nameTagSprite,
  };
}

export const World3DCanvas: React.FC<World3DProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<World3DProps>(props);
  propsRef.current = props;

  const lastNearestCitizenRef = useRef<number | null>(null);
  const lastP2NearestCitizenRef = useRef<number | null>(null);
  const lastNearestZoneRef = useRef<number | null>(null);
  const lastP2NearestZoneRef = useRef<number | null>(null);
  const lastNearestIslandRef = useRef<number | null>(null);
  const lastP2NearestIslandRef = useRef<number | null>(null);
  const lastTouchIslandRef = useRef<number | null>(null);
  const lastP2TouchIslandRef = useRef<number | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL Detection (threejs skill standard)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL Context Lost Recovery
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.setSize(
        container.clientWidth || window.innerWidth,
        container.clientHeight || window.innerHeight
      );
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b222c);
    scene.fog = new THREE.FogExp2(0x0b222c, 0.015);

    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 220);
    camera.position.set(0, 14, 24);
    camera.lookAt(0, 1, 0);

    const camera2 = new THREE.PerspectiveCamera(50, width / 2 / height, 0.1, 220);
    camera2.position.set(2, 14, 24);
    camera2.lookAt(2, 1, 0);
    const camTargetPos2 = new THREE.Vector3(2, 14, 24);
    const camLookTarget2 = new THREE.Vector3(2, 1, 0);
    const currentLook2 = new THREE.Vector3(2, 1, 0);

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    dirLight.position.set(18, 28, 16);
    if (!isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0005;
    }
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x34d399, 0.55);
    rimLight.position.set(-16, 12, -14);
    scene.add(rimLight);

    // Shared Color Atlas
    const sharedAtlas = createSharedColorAtlas();

    // Base Terrain Platform & Water Ring
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const oceanGeo = new THREE.CylinderGeometry(52, 52, 1.2, 32);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.25,
      metalness: 0.15,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.y = -1.2;
    worldGroup.add(ocean);

    const islandGeo = new THREE.CylinderGeometry(28, 31, 1.6, 24);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.8,
      metalness: 0.05,
    });
    const islandBase = new THREE.Mesh(islandGeo, islandMat);
    islandBase.position.y = -0.8;
    worldGroup.add(islandBase);

    // Road / Courtyard Cross
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const roadNS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 44), roadMat);
    roadNS.position.y = 0.03;
    const roadEW = new THREE.Mesh(new THREE.BoxGeometry(44, 0.06, 4.2), roadMat);
    roadEW.position.y = 0.03;
    worldGroup.add(roadNS, roadEW);

    // Spawn Point & Checkpoint Pad
    const checkpointGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.12, 16);
    const checkpointMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.5,
      roughness: 0.25,
    });
    const checkpointPad = new THREE.Mesh(checkpointGeo, checkpointMat);
    checkpointPad.position.set(0, 0.06, 0);
    worldGroup.add(checkpointPad);

    // School Building Landmark in North Sector
    const schoolGroup = new THREE.Group();
    schoolGroup.position.set(0, 0, -14);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const schoolBody = new THREE.Mesh(new THREE.BoxGeometry(11, 3.8, 5), wallMat);
    schoolBody.position.y = 1.9;
    const schoolRoof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.4, 4), roofMat);
    schoolRoof.position.y = 4.9;
    schoolRoof.rotation.y = Math.PI / 4;
    const flagpole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.2 })
    );
    flagpole.position.set(0, 3, 4.2);
    const flagRed = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    flagRed.position.set(0.55, 5.7, 4.2);
    const flagWhite = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    flagWhite.position.set(0.55, 5.35, 4.2);
    schoolGroup.add(schoolBody, schoolRoof, flagpole, flagRed, flagWhite);
    worldGroup.add(schoolGroup);

    // InstancedMesh 40 Blocky Trees
    const treeCount = 40;
    const trunkGeo = new THREE.BoxGeometry(0.45, 1.6, 0.45);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 });
    const crownGeo = new THREE.BoxGeometry(1.75, 1.9, 1.75);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });

    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crownInstanced = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);

    const dummy = new THREE.Object3D();
    const leafColors = [0x22c55e, 0x10b981, 0x15803d, 0x65a30d];
    const colorScratch = new THREE.Color();
    const treeMeta: { tx: number; tz: number; scale: number; rotY: number }[] = [];

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 11 + (i % 4) * 3.8;
      let tx = Math.cos(angle) * radius;
      let tz = Math.sin(angle) * radius;
      if (Math.abs(tx) < 3.5) tx += tx >= 0 ? 4 : -4;
      if (Math.abs(tz) < 3.5) tz += tz >= 0 ? 4 : -4;

      const scale = 0.85 + (i % 3) * 0.16;
      const rotY = (i * 0.7) % Math.PI;
      treeMeta.push({ tx, tz, scale, rotY });

      dummy.position.set(tx, 0.8 * scale, tz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunkInstanced.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, 2.15 * scale, tz);
      dummy.updateMatrix();
      crownInstanced.setMatrixAt(i, dummy.matrix);

      colorScratch.setHex(leafColors[i % leafColors.length]);
      crownInstanced.setColorAt(i, colorScratch);
    }
    trunkInstanced.instanceMatrix.needsUpdate = true;
    crownInstanced.instanceMatrix.needsUpdate = true;
    if (crownInstanced.instanceColor) crownInstanced.instanceColor.needsUpdate = true;
    trunkInstanced.computeBoundingSphere();
    crownInstanced.computeBoundingSphere();
    worldGroup.add(trunkInstanced, crownInstanced);

    let lastTreeClearKey = '';
    const updateInstancedTrees = (clearSpots: [number, number][]) => {
      const nextKey = clearSpots.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('|');
      if (nextKey === lastTreeClearKey) return;
      lastTreeClearKey = nextKey;

      for (let i = 0; i < treeMeta.length; i++) {
        const { tx, tz, scale, rotY } = treeMeta[i];
        const blocked = clearSpots.some(([cx, cz]) => Math.hypot(tx - cx, tz - cz) < 4.5);
        const effScale = blocked ? 0.0001 : scale;

        dummy.position.set(tx, blocked ? -10 : 0.8 * scale, tz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(effScale);
        dummy.updateMatrix();
        trunkInstanced.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tx, blocked ? -10 : 2.15 * scale, tz);
        dummy.updateMatrix();
        crownInstanced.setMatrixAt(i, dummy.matrix);
      }
      trunkInstanced.instanceMatrix.needsUpdate = true;
      crownInstanced.instanceMatrix.needsUpdate = true;
    };

    // Player 1 Avatar (with 3D Floating Nameplate above head)
    const player1Avatar = createBlockyAvatar(
      propsRef.current.avatarGender,
      propsRef.current.avatarCostume,
      undefined,
      'emerald',
      propsRef.current.playerName || 'Pemain 1'
    );
    scene.add(player1Avatar.group);

    // Player 2 Avatar (with 3D Floating Nameplate above head)
    const player2Avatar = createBlockyAvatar(
      propsRef.current.avatar2Gender || 'female',
      propsRef.current.avatarCostume,
      0x0284c7,
      'sky',
      propsRef.current.player2Name || 'Pemain 2'
    );
    player2Avatar.group.position.set(2.2, 0, 1.2);
    scene.add(player2Avatar.group);

    // Level 1 Sub-group: Rumah Asri Nusantara + Halaman Depan Rumah Penuh Sampah Berserakan
    const level1Group = new THREE.Group();

    // 1. Rumah Asri Nusantara (Lokasi Rumah Level 1)
    const houseGroup = new THREE.Group();
    houseGroup.position.set(0, 0, -5.2);

    const houseWallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 });
    const houseTrimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const houseRoofMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5 });
    const glassWinMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.3,
    });

    const houseBody = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.5, 4.8), houseWallMat);
    houseBody.position.y = 1.75;
    const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.5, 4), houseRoofMat);
    houseRoof.position.y = 4.75;
    houseRoof.rotation.y = Math.PI / 4;

    // Front Porch (Teras Rumah) & Pillars
    const porchFloor = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.22, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 })
    );
    porchFloor.position.set(0, 0.11, 2.8);
    const porchCanopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 2.0), houseRoofMat);
    porchCanopy.position.set(0, 2.75, 2.8);
    const pillarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.24), houseTrimMat);
    pillarLeft.position.set(-1.85, 1.35, 3.5);
    const pillarRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.24), houseTrimMat);
    pillarRight.position.set(1.85, 1.35, 3.5);

    // Wooden Front Door & Windows
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.16), houseTrimMat);
    frontDoor.position.set(0, 1.25, 2.42);
    const leftWindow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.16), glassWinMat);
    leftWindow.position.set(-2.6, 1.85, 2.42);
    const rightWindow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.16), glassWinMat);
    rightWindow.position.set(2.6, 1.85, 2.42);

    // Front Yard Wooden Fences
    const fenceLeft = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 0.18), houseTrimMat);
    fenceLeft.position.set(-4.2, 0.42, 4.6);
    const fenceRight = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 0.18), houseTrimMat);
    fenceRight.position.set(4.2, 0.42, 4.6);

    const houseSign = createBinLabelSprite(
      'HALAMAN DEPAN RUMAH ASRI NUSANTARA',
      '#451a03',
      '#fbbf24',
      0.82,
      true
    );
    houseSign.position.set(0, 5.85, 1.5);

    houseGroup.add(
      houseBody,
      houseRoof,
      porchFloor,
      porchCanopy,
      pillarLeft,
      pillarRight,
      frontDoor,
      leftWindow,
      rightWindow,
      fenceLeft,
      fenceRight,
      houseSign
    );
    level1Group.add(houseGroup);

    // 2. Banyak Sampah Berserakan di Halaman Depan Rumah (16 Objek Sampah Tercecer)
    const scatteredTrashSpecs: {
      pos: [number, number, number];
      rot: [number, number, number];
      color: number;
      kind: 'bottle' | 'bag' | 'can' | 'banana' | 'box' | 'leaf';
    }[] = [
      { pos: [-2.4, 0.18, -0.6], rot: [1.4, 0.4, 0.8], color: 0x38bdf8, kind: 'bottle' },
      { pos: [-1.1, 0.22, 0.2], rot: [0.2, 0.9, 0.3], color: 0x60a5fa, kind: 'bag' },
      { pos: [0.3, 0.16, -0.8], rot: [1.5, 0.2, 1.1], color: 0xef4444, kind: 'can' },
      { pos: [1.6, 0.15, -0.2], rot: [0.1, 1.2, 0.2], color: 0xfacc15, kind: 'banana' },
      { pos: [2.5, 0.22, 0.5], rot: [0.3, 0.5, 0.4], color: 0xf8fafc, kind: 'bag' },
      { pos: [-1.8, 0.18, 1.2], rot: [1.5, 1.1, 0.5], color: 0xf97316, kind: 'can' },
      { pos: [-0.4, 0.14, 1.0], rot: [0.1, 0.7, 0.1], color: 0x84cc16, kind: 'leaf' },
      { pos: [0.9, 0.18, 1.3], rot: [1.4, 0.8, 0.2], color: 0x0ea5e9, kind: 'bottle' },
      { pos: [-2.9, 0.2, 0.8], rot: [0.2, 0.4, 0.1], color: 0xd97706, kind: 'box' },
      { pos: [2.1, 0.16, -1.1], rot: [1.4, 0.3, 0.9], color: 0x22c55e, kind: 'bottle' },
      { pos: [-0.7, 0.16, -1.4], rot: [0.2, 1.5, 0.2], color: 0xfacc15, kind: 'banana' },
      { pos: [1.3, 0.2, 0.4], rot: [0.1, 0.6, 0.2], color: 0xa855f7, kind: 'bag' },
      { pos: [-1.5, 0.15, -1.3], rot: [1.5, 0.2, 0.7], color: 0xdc2626, kind: 'can' },
      { pos: [0.2, 0.15, 0.1], rot: [1.4, 1.0, 0.4], color: 0x38bdf8, kind: 'bottle' },
      { pos: [-2.2, 0.14, 1.7], rot: [0.1, 0.9, 0.1], color: 0x65a30d, kind: 'leaf' },
      { pos: [1.9, 0.18, 1.6], rot: [1.4, 0.5, 0.6], color: 0xfef08a, kind: 'box' },
    ];

    scatteredTrashSpecs.forEach((t) => {
      let geo: THREE.BufferGeometry;
      if (t.kind === 'bottle' || t.kind === 'can') {
        geo = new THREE.CylinderGeometry(0.18, 0.18, 0.58, 10);
      } else if (t.kind === 'bag') {
        geo = new THREE.DodecahedronGeometry(0.28, 0);
      } else if (t.kind === 'banana') {
        geo = new THREE.BoxGeometry(0.48, 0.12, 0.22);
      } else if (t.kind === 'leaf') {
        geo = new THREE.BoxGeometry(0.42, 0.08, 0.36);
      } else {
        geo = new THREE.BoxGeometry(0.46, 0.28, 0.38);
      }
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.4, metalness: 0.1 })
      );
      mesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
      mesh.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
      level1Group.add(mesh);
    });

    // 3. 3 Tong Sampah di Sisi Halaman Rumah (ORGANIK, ANORGANIK, B3)
    const binSpecs: {
      pos: [number, number, number];
      color: number;
      label: string;
      bgHex: string;
      borderHex: string;
    }[] = [
      {
        pos: [-3.9, 0.75, -0.5],
        color: 0x22c55e,
        label: 'ORGANIK',
        bgHex: '#052e16',
        borderHex: '#4ade80',
      },
      {
        pos: [-3.9, 0.75, 1.1],
        color: 0x0ea5e9,
        label: 'ANORGANIK',
        bgHex: '#082f49',
        borderHex: '#38bdf8',
      },
      {
        pos: [3.9, 0.75, 0.3],
        color: 0xef4444,
        label: 'B3',
        bgHex: '#4c0519',
        borderHex: '#fb7185',
      },
    ];
    binSpecs.forEach((b) => {
      const binMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.48, 1.45, 16),
        new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.35, metalness: 0.15 })
      );
      binMesh.position.set(b.pos[0], b.pos[1], b.pos[2]);

      const lidMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.14, 16),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      lidMesh.position.set(b.pos[0], b.pos[1] + 0.76, b.pos[2] - 0.12);
      lidMesh.rotation.x = -0.3;

      const labelSprite = createBinLabelSprite(b.label, b.bgHex, b.borderHex, 0.56, true);
      labelSprite.position.set(b.pos[0], b.pos[1] + 1.25, b.pos[2]);

      level1Group.add(binMesh, lidMesh, labelSprite);
    });

    // FloatingTrashGroup kept as a subtle yard indicator
    const floatingTrashGroup = new THREE.Group();
    floatingTrashGroup.position.set(0, 2.2, 0.2);
    level1Group.add(floatingTrashGroup);
    scene.add(level1Group);

    // Level 2 Sub-group: Ruang Baca dan Taman Literasi 3R (Paviliun Baca, Rak Buku, Meja Balok Kata & Totem 3R)
    const level2Group = new THREE.Group();

    const l2PavilionFloor = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.28, 5.6),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
    );
    l2PavilionFloor.position.set(0, 0.14, -2.2);
    level2Group.add(l2PavilionFloor);

    const l2Sign = createBinLabelSprite(
      'RUANG BACA DAN TAMAN LITERASI 3R',
      '#064e3b',
      '#fbbf24',
      0.72,
      true
    );
    l2Sign.position.set(0, 4.95, -4.8);
    level2Group.add(l2Sign);

    // Left & Right Bookshelves filled with colorful 3R books
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    [-3.4, 3.4].forEach((sx) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.65), shelfMat);
      shelf.position.set(sx, 1.35, -3.8);
      level2Group.add(shelf);
    });

    // Central Study Workbench with 3D Sculpted Wooden Letter Display Rack
    const studyTable = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.85, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 })
    );
    studyTable.position.set(0, 0.48, -1.55);
    level2Group.add(studyTable);

    const l2LetterRackGroup = new THREE.Group();
    l2LetterRackGroup.position.set(0, 0.92, -1.5);
    level2Group.add(l2LetterRackGroup);

    const rackPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(5.55, 0.16, 1.15),
      new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.65 })
    );
    rackPlinth.position.set(0, 0.08, 0);
    const rackLedge = new THREE.Mesh(
      new THREE.BoxGeometry(5.25, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 })
    );
    rackLedge.position.set(0, 0.22, 0.04);
    const rackBrassRail = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.72, roughness: 0.24 })
    );
    rackBrassRail.position.set(0, 0.25, 0.44);
    l2LetterRackGroup.add(rackPlinth, rackLedge, rackBrassRail);

    // Side Stage Pillars with Golden Finials framing the 3D Letters
    const rackPillarMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    const rackCollarMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.2 });
    const rackFinialMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.75, roughness: 0.2 });
    [-2.74, 2.74].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.22), rackPillarMat);
      post.position.set(px, 0.84, 0.04);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.28), rackCollarMat);
      collar.position.set(px, 1.56, 0.04);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), rackFinialMat);
      finial.position.set(px, 1.74, 0.04);
      l2LetterRackGroup.add(post, collar, finial);
    });

    // Dynamic Status Banner Sprite above the 3D Letter Rack
    const l2BannerCanvas = document.createElement('canvas');
    l2BannerCanvas.width = 768;
    l2BannerCanvas.height = 112;
    const l2BannerCtx = l2BannerCanvas.getContext('2d')!;
    const l2BannerTex = new THREE.CanvasTexture(l2BannerCanvas);
    l2BannerTex.colorSpace = THREE.SRGBColorSpace;
    const l2BannerSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: l2BannerTex, transparent: true, depthTest: false })
    );
    l2BannerSprite.scale.set(4.5, 0.66, 1);
    l2BannerSprite.position.set(0, 2.02, 0.05);
    l2BannerSprite.renderOrder = 10;
    l2LetterRackGroup.add(l2BannerSprite);

    let lastL2BannerKey = '';
    const updateL2Banner = (text: string, isComplete: boolean) => {
      const key = `${text}|${isComplete ? 1 : 0}`;
      if (key === lastL2BannerKey) return;
      lastL2BannerKey = key;

      l2BannerCtx.clearRect(0, 0, l2BannerCanvas.width, l2BannerCanvas.height);
      l2BannerCtx.fillStyle = isComplete ? 'rgba(6, 78, 59, 0.94)' : 'rgba(15, 23, 42, 0.92)';
      l2BannerCtx.strokeStyle = isComplete ? '#34d399' : '#fbbf24';
      l2BannerCtx.lineWidth = 6;
      l2BannerCtx.beginPath();
      l2BannerCtx.roundRect(12, 12, l2BannerCanvas.width - 24, l2BannerCanvas.height - 24, 24);
      l2BannerCtx.fill();
      l2BannerCtx.stroke();

      l2BannerCtx.fillStyle = isComplete ? '#fef08a' : '#ffffff';
      l2BannerCtx.font = '900 34px "Plus Jakarta Sans", sans-serif';
      l2BannerCtx.textAlign = 'center';
      l2BannerCtx.textBaseline = 'middle';
      l2BannerCtx.fillText(text, l2BannerCanvas.width / 2, l2BannerCanvas.height / 2 + 2);
      l2BannerTex.needsUpdate = true;
    };
    updateL2Banner('SUSUNAN HURUF 3D (0/6)', false);

    // Cached Crisp 3D Letter Face Textures (Zero-GC inside render loop)
    const l2LetterTexCache = new Map<string, THREE.CanvasTexture>();
    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const getL2LetterTexture = (letter: string, isComplete: boolean): THREE.CanvasTexture => {
      const clean = (letter || '?').toUpperCase().slice(0, 1);
      const cacheKey = `${clean}_${isComplete ? 'ok' : 'build'}`;
      const existing = l2LetterTexCache.get(cacheKey);
      if (existing) return existing;

      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const g = c.getContext('2d')!;

      // Warm parchment/wood face (or luminous emerald-gold when word is completed)
      const grad = g.createLinearGradient(0, 0, 0, 256);
      if (isComplete) {
        grad.addColorStop(0, '#ecfdf5');
        grad.addColorStop(1, '#a7f3d0');
      } else {
        grad.addColorStop(0, '#fef3c7');
        grad.addColorStop(1, '#fde68a');
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);

      // Inner carved bezel border
      g.strokeStyle = isComplete ? '#059669' : '#b45309';
      g.lineWidth = 14;
      g.strokeRect(10, 10, 236, 236);

      g.strokeStyle = isComplete ? '#34d399' : '#f59e0b';
      g.lineWidth = 4;
      g.strokeRect(24, 24, 208, 208);

      // 3D Embossed Letter Shadow + Bold Glyph
      g.font = '900 164px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = isComplete ? 'rgba(6, 78, 59, 0.25)' : 'rgba(120, 53, 15, 0.28)';
      g.fillText(clean, 132, 138);

      g.fillStyle = isComplete ? '#064e3b' : '#451a03';
      g.fillText(clean, 128, 132);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      l2LetterTexCache.set(cacheKey, tex);
      return tex;
    };

    // Pre-allocate 7 Composite 3D Letter Block Slots on the Table Stand
    const L2_MAX_SLOTS = 7;
    const l2SlotNodes: {
      root: THREE.Group;
      emptyGroup: THREE.Group;
      filledGroup: THREE.Group;
      faceMat: THREE.MeshStandardMaterial;
      trimMat: THREE.MeshStandardMaterial;
      glowPadMat: THREE.MeshStandardMaterial;
      lastChar: string;
      popStart: number;
    }[] = [];

    const l2BodyGeo = new THREE.BoxGeometry(0.62, 0.8, 0.26);
    const l2CapGeo = new THREE.BoxGeometry(0.66, 0.08, 0.3);
    const l2SideGeo = new THREE.BoxGeometry(0.05, 0.72, 0.28);
    const l2FaceGeo = new THREE.BoxGeometry(0.54, 0.66, 0.06);
    const l2GlowPadGeo = new THREE.BoxGeometry(0.56, 0.05, 0.22);
    const l2EmptyPadGeo = new THREE.BoxGeometry(0.58, 0.74, 0.14);
    const l2EmptyBarGeo = new THREE.BoxGeometry(0.6, 0.06, 0.16);
    const l2WoodBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.08,
    });
    const l2EmptyPadMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    const l2EmptyGuideMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.65,
    });

    for (let sIdx = 0; sIdx < L2_MAX_SLOTS; sIdx++) {
      const root = new THREE.Group();
      root.position.set(0, 0.74, 0.04);
      root.rotation.x = -0.08;

      // Empty slot guide
      const emptyGroup = new THREE.Group();
      const ePad = new THREE.Mesh(l2EmptyPadGeo, l2EmptyPadMat);
      const eTop = new THREE.Mesh(l2EmptyBarGeo, l2EmptyGuideMat);
      eTop.position.set(0, 0.36, 0);
      const eBot = new THREE.Mesh(l2EmptyBarGeo, l2EmptyGuideMat);
      eBot.position.set(0, -0.36, 0);
      emptyGroup.add(ePad, eTop, eBot);

      // Filled 3D wooden letter block (5-part composite Group)
      const filledGroup = new THREE.Group();
      filledGroup.visible = false;
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.25,
        roughness: 0.28,
        metalness: 0.35,
      });
      const glowPadMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      });
      const faceMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getL2LetterTexture('K', false),
        roughness: 0.32,
        metalness: 0.05,
      });

      const bodyMesh = new THREE.Mesh(l2BodyGeo, l2WoodBodyMat);
      const topCap = new THREE.Mesh(l2CapGeo, trimMat);
      topCap.position.set(0, 0.4, 0);
      const botCap = new THREE.Mesh(l2CapGeo, trimMat);
      botCap.position.set(0, -0.4, 0);
      const leftRail = new THREE.Mesh(l2SideGeo, trimMat);
      leftRail.position.set(-0.31, 0, 0);
      const rightRail = new THREE.Mesh(l2SideGeo, trimMat);
      rightRail.position.set(0.31, 0, 0);
      const faceMesh = new THREE.Mesh(l2FaceGeo, faceMat);
      faceMesh.position.set(0, 0, 0.14);
      const glowPad = new THREE.Mesh(l2GlowPadGeo, glowPadMat);
      glowPad.position.set(0, -0.46, 0);

      filledGroup.add(bodyMesh, topCap, botCap, leftRail, rightRail, faceMesh, glowPad);
      root.add(emptyGroup, filledGroup);
      l2LetterRackGroup.add(root);

      l2SlotNodes.push({
        root,
        emptyGroup,
        filledGroup,
        faceMat,
        trimMat,
        glowPadMat,
        lastChar: '',
        popStart: -10,
      });
    }

    // 3D Active Slot Aiming Pointer & Beam above the next empty letter slot on the workbench
    const l2ActiveSlotGroup = new THREE.Group();
    const l2AimPointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.32, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.75,
        roughness: 0.25,
        metalness: 0.4,
      })
    );
    l2AimPointer.rotation.x = Math.PI;
    l2AimPointer.position.set(0, 1.48, 0.04);
    const l2AimBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.14, 0.72, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    l2AimBeam.position.set(0, 1.08, 0.04);
    const l2AimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.34, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    l2AimRing.rotation.x = -Math.PI / 2;
    l2AimRing.position.set(0, 0.3, 0.14);
    l2ActiveSlotGroup.add(l2AimPointer, l2AimBeam, l2AimRing);
    l2LetterRackGroup.add(l2ActiveSlotGroup);

    // 3 Giant 3R Concept Pedestals around the Reading Garden
    const l2PillarSpecs: {
      pos: [number, number, number];
      mobilePos: [number, number, number];
      color: number;
      label: string;
      bgHex: string;
      borderHex: string;
    }[] = [
      {
        pos: [-3.95, 0.85, -1.6],
        mobilePos: [-2.15, 0.46, -0.05],
        color: 0x10b981,
        label: 'REDUCE',
        bgHex: '#052e16',
        borderHex: '#34d399',
      },
      {
        pos: [3.95, 0.85, -3.4],
        mobilePos: [0, 0.46, -0.05],
        color: 0xf59e0b,
        label: 'REUSE',
        bgHex: '#451a03',
        borderHex: '#fbbf24',
      },
      {
        pos: [3.95, 0.85, -1.1],
        mobilePos: [2.15, 0.46, -0.05],
        color: 0x0ea5e9,
        label: 'RECYCLE',
        bgHex: '#082f49',
        borderHex: '#38bdf8',
      },
    ];
    const l2PedestalNodes: {
      blockMesh: THREE.Mesh;
      sp: THREE.Sprite;
      desktopPos: [number, number, number];
      mobilePos: [number, number, number];
    }[] = [];
    l2PillarSpecs.forEach((p) => {
      const blockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 1.05, 1.05),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.35, metalness: 0.15 })
      );
      blockMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      const sp = createBinLabelSprite(p.label, p.bgHex, p.borderHex, 0.5, true);
      sp.position.set(p.pos[0], p.pos[1] + 0.95, p.pos[2]);
      level2Group.add(blockMesh, sp);
      l2PedestalNodes.push({
        blockMesh,
        sp,
        desktopPos: p.pos,
        mobilePos: p.mobilePos,
      });
    });
    scene.add(level2Group);

    // Level 3 Sub-group: Gudang Logistik & Mesin Capit 3R (Gantry Rail, 3 Prongs, Conveyor & 3 Chutes)
    const level3Group = new THREE.Group();
    const warehouseFloor = new THREE.Mesh(
      new THREE.BoxGeometry(9.8, 0.24, 6.4),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 })
    );
    warehouseFloor.position.set(0, 0.12, -2.0);

    // Warehouse back bay wall so gripped 3D objects stand out cleanly against industrial steel backdrop
    const warehouseBackWall = new THREE.Mesh(
      new THREE.BoxGeometry(9.8, 5.1, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x2a3950, roughness: 0.7, metalness: 0.22 })
    );
    warehouseBackWall.position.set(0, 2.55, -4.15);
    const hazardTrim = new THREE.Mesh(
      new THREE.BoxGeometry(9.8, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.2 })
    );
    hazardTrim.position.set(0, 0.35, -4.1);
    level3Group.add(warehouseFloor, warehouseBackWall, hazardTrim);

    [-3.8, -1.3, 1.3, 3.8].forEach((rx) => {
      const wallRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 4.9, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 })
      );
      wallRib.position.set(rx, 2.5, -3.96);
      level3Group.add(wallRib);
    });

    const railBeam = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.32, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
    );
    railBeam.position.set(0, 4.6, -2.6);
    const leftGantryPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 4.6, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 })
    );
    leftGantryPillar.position.set(-4.2, 2.3, -2.6);
    const rightGantryPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 4.6, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 })
    );
    rightGantryPillar.position.set(4.2, 2.3, -2.6);
    const l3Sign = createBinLabelSprite(
      'GUDANG LOGISTIK & MESIN CAPIT 3R',
      '#0f172a',
      '#38bdf8',
      0.66,
      true
    );
    l3Sign.position.set(0, 4.98, -2.28);
    level3Group.add(railBeam, leftGantryPillar, rightGantryPillar, l3Sign);

    const clawAssembly = new THREE.Group();
    clawAssembly.position.set(0, 3.65, -2.6);

    const trolleyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.28, 0.58),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.55, roughness: 0.3 })
    );
    trolleyMesh.position.y = 0.95;

    const cableMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
    );
    cableMesh.position.y = 0.45;

    const hubMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.32, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.65, roughness: 0.25 })
    );
    const hubCapMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.5,
    });
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 8, 20), hubCapMat);
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = -0.14;

    clawAssembly.add(trolleyMesh, cableMesh, hubMesh, hubRing);

    // 3 articulated curved gripper prongs that physically clasp around the gripped 3D item
    const steelProngMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.86,
      roughness: 0.18,
    });
    const rubberTipMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.65,
      metalness: 0.1,
    });
    const clawProngs: THREE.Group[] = [];
    for (let p = 0; p < 3; p++) {
      const ang = (p / 3) * Math.PI * 2 + Math.PI / 6;
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(Math.cos(ang) * 0.34, -0.1, Math.sin(ang) * 0.34);
      pivotGroup.rotation.y = -ang;

      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.13), steelProngMat);
      upperArm.position.set(0.14, -0.22, 0);
      upperArm.rotation.z = 0.45;

      const lowerFinger = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.48, 0.11), steelProngMat);
      lowerFinger.position.set(0.14, -0.62, 0);
      lowerFinger.rotation.z = -0.58;

      const gripPad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.13), rubberTipMat);
      gripPad.position.set(0.02, -0.8, 0);
      gripPad.rotation.z = -0.58;

      pivotGroup.add(upperArm, lowerFinger, gripPad);
      pivotGroup.rotation.z = -0.14;
      clawProngs.push(pivotGroup);
      clawAssembly.add(pivotGroup);
    }

    // Vertical 3D Aiming Laser Beam & Target Ring under the claw so mobile players clearly see which 3R chute is targeted
    const clawAimBeamMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const clawAimBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.22, 2.35, 16, 1, true),
      clawAimBeamMat
    );
    clawAimBeam.position.set(0, -1.62, 0);

    const clawTargetRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const clawTargetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 24),
      clawTargetRingMat
    );
    clawTargetRing.rotation.x = -Math.PI / 2;
    clawTargetRing.position.set(0, -2.38, 0);

    // Attach the 6 realistic 3D gripped item rigs inside the claw jaws
    const level3Rig = createLevel3GrippedItemRig();
    level3Rig.container.position.set(0, -0.82, 0);
    level3Rig.container.scale.setScalar(1.08);
    clawAssembly.add(clawAimBeam, clawTargetRing, level3Rig.container);
    level3Group.add(clawAssembly);

    // 3 Target Chutes in Gudang Logistik (REDUCE, REUSE, RECYCLE)
    const l3ChuteSpecs: {
      pos: [number, number, number];
      color: number;
      label: string;
      bgHex: string;
      borderHex: string;
    }[] = [
      {
        pos: [-2.8, 0.68, -2.6],
        color: 0x10b981,
        label: 'REDUCE',
        bgHex: '#052e16',
        borderHex: '#34d399',
      },
      {
        pos: [0, 0.68, -2.6],
        color: 0xf59e0b,
        label: 'REUSE',
        bgHex: '#451a03',
        borderHex: '#fbbf24',
      },
      {
        pos: [2.8, 0.68, -2.6],
        color: 0x0ea5e9,
        label: 'RECYCLE',
        bgHex: '#082f49',
        borderHex: '#38bdf8',
      },
    ];
    const chuteGlowMats: THREE.MeshBasicMaterial[] = [];
    l3ChuteSpecs.forEach((ch) => {
      const chuteMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.62, 1.12, 1.35),
        new THREE.MeshStandardMaterial({ color: ch.color, roughness: 0.35, metalness: 0.2 })
      );
      chuteMesh.position.set(ch.pos[0], ch.pos[1], ch.pos[2]);

      const hopperMouth = new THREE.Mesh(
        new THREE.BoxGeometry(1.32, 0.14, 1.08),
        new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.85, metalness: 0.1 })
      );
      hopperMouth.position.set(ch.pos[0], ch.pos[1] + 0.52, ch.pos[2]);

      const glowMat = new THREE.MeshBasicMaterial({
        color: ch.color,
        transparent: true,
        opacity: 0.25,
      });
      chuteGlowMats.push(glowMat);
      const glowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.08, 1.48), glowMat);
      glowFrame.position.set(ch.pos[0], 0.26, ch.pos[2]);

      const sp = createBinLabelSprite(ch.label, ch.bgHex, ch.borderHex, 0.56, true);
      sp.position.set(ch.pos[0], ch.pos[1] + 0.1, ch.pos[2] + 0.76);
      level3Group.add(chuteMesh, hopperMouth, glowFrame, sp);
    });

    // Warehouse Crates & Items on Conveyor Side
    [-3.6, -2.1, 2.1, 3.6].forEach((cx, idx) => {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.55, 0.65),
        new THREE.MeshStandardMaterial({
          color: idx % 2 === 0 ? 0xd97706 : 0x38bdf8,
          roughness: 0.5,
        })
      );
      crate.position.set(cx, 0.52, -0.4);
      level3Group.add(crate);
    });
    scene.add(level3Group);

    // Level 4 Sub-group: Pendopo Alun-Alun Kampung & 5 Citizen NPCs with Proximity Rings
    const level4Group = new THREE.Group();
    const l4PlazaFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.8, 0.16, 24),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 })
    );
    l4PlazaFloor.position.set(0, 0.08, -2.5);
    const l4PendopoRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.8, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 })
    );
    l4PendopoRoof.position.set(0, 3.4, -3.2);
    l4PendopoRoof.rotation.y = Math.PI / 4;
    const l4Sign = createBinLabelSprite(
      'KAWASAN PEMUKIMAN & FASILITAS PUBLIK KOTA',
      '#451a03',
      '#fbbf24',
      0.82,
      true
    );
    l4Sign.position.set(0, 5.05, -3.2);
    level4Group.add(l4PlazaFloor, l4PendopoRoof, l4Sign);
    [
      [-1.9, -4.8],
      [1.9, -4.8],
      [-1.9, -1.6],
      [1.9, -1.6],
    ].forEach(([px, pz]) => {
      const pCol = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 2.5, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
      );
      pCol.position.set(px, 1.25, pz);
      level4Group.add(pCol);
    });

    const citizenAnchors: THREE.Group[] = [];
    const citizenRings: THREE.Mesh[] = [];
    const citizenBeacons: THREE.Mesh[] = [];
    const citizenInteractBadges: THREE.Sprite[] = [];
    const citizenClickTargets: THREE.Object3D[] = [];
    const l4DefaultPositions: [number, number][] = LEVEL_4_CITIZENS.map((c) => c.position);

    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 280;
    badgeCanvas.height = 80;
    const bCtx = badgeCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = '#0f172a';
      bCtx.strokeStyle = '#fbbf24';
      bCtx.lineWidth = 6;
      bCtx.beginPath();
      bCtx.roundRect(6, 6, 268, 68, 18);
      bCtx.fill();
      bCtx.stroke();
      bCtx.fillStyle = '#fbbf24';
      bCtx.fillRect(18, 18, 44, 44);
      bCtx.fillStyle = '#0f172a';
      bCtx.font = '900 28px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('E', 40, 41);
      bCtx.fillStyle = '#ffffff';
      bCtx.font = '800 21px sans-serif';
      bCtx.textAlign = 'left';
      bCtx.fillText('KETUK / [E]', 74, 41);
    }
    const l4InteractBadgeTex = new THREE.CanvasTexture(badgeCanvas);
    l4InteractBadgeTex.colorSpace = THREE.SRGBColorSpace;
    const l4InteractBadgeMat = new THREE.SpriteMaterial({
      map: l4InteractBadgeTex,
      transparent: true,
      depthTest: false,
    });

    const npcHitGeo = new THREE.CylinderGeometry(1.65, 1.65, 4.4, 12);
    const npcHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const tagCitizenHierarchy = (root: THREE.Object3D, citizenIdx: number) => {
      root.userData.citizenIdx = citizenIdx;
      root.traverse((child) => {
        child.userData.citizenIdx = citizenIdx;
      });
    };

    LEVEL_4_CITIZENS.forEach((cit, idx) => {
      const anchor = new THREE.Group();
      anchor.position.set(cit.position[0], 0, cit.position[1]);
      citizenAnchors.push(anchor);
      level4Group.add(anchor);

      const npc = createBlockyAvatar(
        idx % 2 === 0 ? 'male' : 'female',
        'batik',
        parseInt(cit.radarColor.replace('#', '0x'), 16),
        'amber',
        cit.npcName
      );
      npc.group.position.set(0, 0, 0);
      tagCitizenHierarchy(npc.group, idx);
      anchor.add(npc.group);

      const hitMesh = new THREE.Mesh(npcHitGeo, npcHitMat);
      hitMesh.position.set(0, 2.1, 0);
      hitMesh.userData.citizenIdx = idx;
      anchor.add(hitMesh);

      const ringGeo = new THREE.RingGeometry(1.3, 1.75, 28);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: parseInt(cit.radarColor.replace('#', '0x'), 16),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0.08, 0);
      ring.userData.citizenIdx = idx;
      citizenRings.push(ring);
      anchor.add(ring);

      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: parseInt(cit.radarColor.replace('#', '0x'), 16),
          emissive: parseInt(cit.radarColor.replace('#', '0x'), 16),
          emissiveIntensity: 0.65,
          roughness: 0.3,
        })
      );
      beacon.position.set(0, 3.15, 0);
      beacon.userData.citizenIdx = idx;
      citizenBeacons.push(beacon);
      anchor.add(beacon);

      const badge = new THREE.Sprite(l4InteractBadgeMat);
      badge.scale.set(2.45, 0.72, 1);
      badge.position.set(0, 3.85, 0);
      badge.visible = false;
      badge.userData.citizenIdx = idx;
      citizenInteractBadges.push(badge);
      anchor.add(badge);

      citizenClickTargets.push(hitMesh, npc.group, beacon);
    });
    scene.add(level4Group);

    // Level 5 Sub-group: 5 Ecosystems Village & 5 Interactive Guardian NPCs (Dynamic Randomized Anchors)
    const level5Group = new THREE.Group();
    const l5MainSign = createBinLabelSprite(
      '5 EKOSISTEM DESA: BUKIT, SUNGAI, SAWAH, PANTAI & TAMAN',
      '#064e3b',
      '#fbbf24',
      0.84,
      true
    );
    l5MainSign.position.set(0, 5.4, -14.5);
    level5Group.add(l5MainSign);

    const zoneAnchors: THREE.Group[] = [];
    const zoneRings: THREE.Mesh[] = [];
    const zoneBeacons: THREE.Mesh[] = [];
    const zoneInteractBadges: THREE.Sprite[] = [];
    const zoneClickTargets: THREE.Object3D[] = [];
    const l5DefaultPositions: [number, number][] = LEVEL_5_ZONES.map((z) => z.position);

    const tagZoneHierarchy = (root: THREE.Object3D, zoneIdx: number) => {
      root.userData.zoneIdx = zoneIdx;
      root.traverse((child) => {
        child.userData.zoneIdx = zoneIdx;
      });
    };

    const l5MicroConfigs: { label: string; bg: string; fg: string }[] = [
      { label: '1. LERENG BUKIT HIJAU', bg: '#052e16', fg: '#4ade80' },
      { label: '2. PINGGIR SUNGAI DESA', bg: '#082f49', fg: '#38bdf8' },
      { label: '3. KEBUN & SAWAH DESA', bg: '#365314', fg: '#bef264' },
      { label: '4. PANTAI & HUTAN BAKAU', bg: '#431407', fg: '#fb923c' },
      { label: '5. TAMAN & KOLAM KAMPUNG', bg: '#500724', fg: '#f472b6' },
    ];

    LEVEL_5_ZONES.forEach((zone, idx) => {
      const anchor = new THREE.Group();
      anchor.position.set(zone.position[0], 0, zone.position[1]);
      zoneAnchors.push(anchor);
      level5Group.add(anchor);

      // Compact thematic ecosystem micro-diorama behind each Guardian NPC
      const propGroup = new THREE.Group();
      propGroup.position.set(0, 0, -2.25);
      if (idx === 0) {
        const mound = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 1.35, 2.1),
          new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 })
        );
        mound.position.y = 0.675;
        const trunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 1.1, 0.32),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
        );
        trunk.position.set(0.55, 1.85, 0);
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 1.4, 5),
          new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 })
        );
        crown.position.set(0.55, 2.75, 0);
        propGroup.add(mound, trunk, crown);
      } else if (idx === 1) {
        const riverBed = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.32, 2.2),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 })
        );
        riverBed.position.y = 0.16;
        const bank = new THREE.Mesh(
          new THREE.BoxGeometry(3.7, 0.24, 2.5),
          new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 })
        );
        bank.position.y = 0.12;
        propGroup.add(bank, riverBed);
      } else if (idx === 2) {
        const paddyBase = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.36, 2.2),
          new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.7 })
        );
        paddyBase.position.y = 0.18;
        propGroup.add(paddyBase);
        for (let r = -1; r <= 1; r++) {
          const stalk = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.72, 1.6),
            new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.65 })
          );
          stalk.position.set(r * 0.9, 0.7, 0);
          propGroup.add(stalk);
        }
      } else if (idx === 3) {
        const sand = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.3, 1.3),
          new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
        );
        sand.position.set(0, 0.15, 0.45);
        const sea = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.24, 1.1),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2 })
        );
        sea.position.set(0, 0.12, -0.65);
        const mangroveStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.26, 1.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 })
        );
        mangroveStem.position.set(-0.6, 0.75, 0.2);
        const mangroveLeaf = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.68, 0),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 })
        );
        mangroveLeaf.position.set(-0.6, 1.55, 0.2);
        propGroup.add(sand, sea, mangroveStem, mangroveLeaf);
      } else {
        const lawn = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.28, 2.2),
          new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 })
        );
        lawn.position.y = 0.14;
        const pond = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.95, 0.32, 16),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 })
        );
        pond.position.set(0.4, 0.18, 0);
        const flower = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.48, 0.55),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.55 })
        );
        flower.position.set(-0.95, 0.52, 0.2);
        propGroup.add(lawn, pond, flower);
      }
      const mCfg = l5MicroConfigs[idx] || l5MicroConfigs[0];
      const zoneSign = createBinLabelSprite(mCfg.label, mCfg.bg, mCfg.fg, 0.54, true);
      zoneSign.position.set(0, idx === 0 ? 3.5 : 2.35, 0);
      propGroup.add(zoneSign);
      anchor.add(propGroup);

      const npc = createBlockyAvatar(
        idx === 1 || idx === 3 ? 'female' : 'male',
        idx === 0 ? 'rompi' : idx === 1 ? 'batik' : 'pramuka',
        parseInt(zone.radarColor.replace('#', '0x'), 16),
        'amber',
        zone.npcName
      );
      npc.group.position.set(0, 0, 0);
      tagZoneHierarchy(npc.group, idx);
      anchor.add(npc.group);

      const hitMesh = new THREE.Mesh(npcHitGeo, npcHitMat);
      hitMesh.position.set(0, 2.1, 0);
      hitMesh.userData.zoneIdx = idx;
      anchor.add(hitMesh);

      const ringGeo = new THREE.RingGeometry(1.3, 1.75, 28);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: parseInt(zone.radarColor.replace('#', '0x'), 16),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0.08, 0);
      ring.userData.zoneIdx = idx;
      zoneRings.push(ring);
      anchor.add(ring);

      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: parseInt(zone.radarColor.replace('#', '0x'), 16),
          emissive: parseInt(zone.radarColor.replace('#', '0x'), 16),
          emissiveIntensity: 0.65,
          roughness: 0.3,
        })
      );
      beacon.position.set(0, 3.15, 0);
      beacon.userData.zoneIdx = idx;
      zoneBeacons.push(beacon);
      anchor.add(beacon);

      const badge = new THREE.Sprite(l4InteractBadgeMat);
      badge.scale.set(2.45, 0.72, 1);
      badge.position.set(0, 3.85, 0);
      badge.visible = false;
      badge.userData.zoneIdx = idx;
      zoneInteractBadges.push(badge);
      anchor.add(badge);

      zoneClickTargets.push(hitMesh, npc.group, beacon);
    });
    scene.add(level5Group);

    // Level 6 Pre-Level 3D Nusantara Map Opening Diorama (Used in 'looking' & 'narration')
    const level6IntroMapGroup = new THREE.Group();
    level6IntroMapGroup.visible = false;

    const l6FallbackCanvas = document.createElement('canvas');
    l6FallbackCanvas.width = 1024;
    l6FallbackCanvas.height = 600;
    const l6fCtx = l6FallbackCanvas.getContext('2d');
    if (l6fCtx) {
      const seaGrad = l6fCtx.createLinearGradient(0, 0, 1024, 600);
      seaGrad.addColorStop(0, '#0284c7');
      seaGrad.addColorStop(0.5, '#0369a1');
      seaGrad.addColorStop(1, '#0c4a6e');
      l6fCtx.fillStyle = seaGrad;
      l6fCtx.fillRect(0, 0, 1024, 600);
      // Grid lines
      l6fCtx.strokeStyle = 'rgba(186, 230, 253, 0.18)';
      l6fCtx.lineWidth = 2;
      for (let gx = 64; gx < 1024; gx += 96) {
        l6fCtx.beginPath();
        l6fCtx.moveTo(gx, 0);
        l6fCtx.lineTo(gx, 600);
        l6fCtx.stroke();
      }
      for (let gy = 64; gy < 600; gy += 96) {
        l6fCtx.beginPath();
        l6fCtx.moveTo(0, gy);
        l6fCtx.lineTo(1024, gy);
        l6fCtx.stroke();
      }
      // Stylized Nusantara archipelago landmasses as instant fallback while external map loads
      l6fCtx.fillStyle = '#22c55e';
      l6fCtx.strokeStyle = '#bef264';
      l6fCtx.lineWidth = 4;
      const drawIslandShape = (pts: [number, number][]) => {
        l6fCtx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? l6fCtx.moveTo(x, y) : l6fCtx.lineTo(x, y)));
        l6fCtx.closePath();
        l6fCtx.fill();
        l6fCtx.stroke();
      };
      // Sumatra
      drawIslandShape([[95, 115], [160, 145], [225, 240], [260, 325], [220, 345], [150, 260], [85, 160]]);
      // Jawa
      drawIslandShape([[265, 372], [440, 388], [465, 420], [320, 418], [255, 398]]);
      // Kalimantan
      drawIslandShape([[350, 140], [490, 130], [525, 225], [475, 305], [370, 295], [335, 215]]);
      // Sulawesi
      drawIslandShape([[555, 175], [645, 170], [625, 235], [655, 310], [585, 315], [565, 245]]);
      // Bali & Nusa Tenggara
      drawIslandShape([[490, 415], [645, 425], [635, 452], [485, 438]]);
      // Papua
      drawIslandShape([[745, 215], [890, 235], [955, 335], [885, 375], [790, 325], [730, 270]]);
    }
    const l6MapFallbackTex = new THREE.CanvasTexture(l6FallbackCanvas);
    l6MapFallbackTex.colorSpace = THREE.SRGBColorSpace;
    let l6LoadedMapTex: THREE.Texture | null = null;

    const l6MapMat = new THREE.MeshStandardMaterial({
      map: l6MapFallbackTex,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.08,
    });

    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    texLoader.load(
      'https://i.imgur.com/h53bahE.png',
      (loadedTex) => {
        if (unmounted) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = 4;
        l6LoadedMapTex = loadedTex;
        l6MapMat.map = loadedTex;
        l6MapMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep crisp procedural Nusantara fallback texture on offline/blocked network
      }
    );

    const l6MapBoard = new THREE.Mesh(
      new THREE.BoxGeometry(31.2, 0.44, 18.6),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 })
    );
    l6MapBoard.position.set(0, 0.22, 0);
    const l6MapRimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const l6MapRim = new THREE.Mesh(new THREE.BoxGeometry(31.55, 0.12, 18.95), l6MapRimMat);
    l6MapRim.position.set(0, 0.40, 0);

    const l6MapSurface = new THREE.Mesh(new THREE.PlaneGeometry(30.0, 17.5), l6MapMat);
    l6MapSurface.rotation.x = -Math.PI / 2;
    l6MapSurface.position.set(0, 0.54, 0);

    const l6AshVeilMat = new THREE.MeshBasicMaterial({
      color: 0x6b7280,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const l6AshVeil = new THREE.Mesh(new THREE.PlaneGeometry(30.02, 17.52), l6AshVeilMat);
    l6AshVeil.rotation.x = -Math.PI / 2;
    l6AshVeil.position.set(0, 0.546, 0);
    level6IntroMapGroup.add(l6MapBoard, l6MapRim, l6MapSurface, l6AshVeil);

    // 5 Pulsing Red Emergency Beacons aligned onto the 5 red dots on https://i.imgur.com/h53bahE.png
    const l6IntroBeaconCoords: [number, number, string][] = [
      [-8.5, 0.35, 'SUMATRA'],
      [-4.4, 2.35, 'JAWA'],
      [-1.4, -0.95, 'KALIMANTAN'],
      [0.85, 3.05, 'BALI & NT'],
      [10.0, 0.25, 'PAPUA'],
    ];
    const l6IntroBeacons: {
      group: THREE.Group;
      halo: THREE.Mesh;
      beam: THREE.Mesh;
      orb: THREE.Mesh;
    }[] = [];

    l6IntroBeaconCoords.forEach(([bx, bz, label]) => {
      const bg = new THREE.Group();
      bg.position.set(bx, 0.56, bz);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 0.14, 16),
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xdc2626,
          emissiveIntensity: 0.85,
          roughness: 0.25,
        })
      );
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.05, 24),
        new THREE.MeshBasicMaterial({
          color: 0xf87171,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.04;

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.42, 4.8, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beam.position.y = 2.4;

      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        new THREE.MeshStandardMaterial({
          color: 0xfca5a5,
          emissive: 0xef4444,
          emissiveIntensity: 1.2,
          roughness: 0.2,
        })
      );
      orb.position.y = 1.65;

      const tag = createBinLabelSprite(label, '#450a0a', '#f87171', 0.44, true);
      tag.position.set(0, 2.75, 0);

      bg.add(disc, halo, beam, orb, tag);
      l6IntroBeacons.push({ group: bg, halo, beam, orb });
      level6IntroMapGroup.add(bg);
    });

    // 3D Jagged Earth Cracks on the Map for Beat 2 ("Tanah Retak, Warna Kelabu, Gemuruh Bumi")
    const l6IntroCrackGroup = new THREE.Group();
    l6IntroCrackGroup.visible = false;
    const l6IntroCrackDarkMat = new THREE.MeshBasicMaterial({ color: 0x0b0f17 });
    const l6IntroCrackGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xd97706,
      emissiveIntensity: 1.15,
      roughness: 0.25,
    });
    const l6CrackPolylines: [number, number][][] = [
      [[-11.8, -2.4], [-10.4, -1.3], [-9.6, -0.7], [-8.5, 0.4], [-7.2, 1.2]],
      [[-9.6, -0.7], [-9.2, -1.9], [-8.6, -2.8]],
      [[-5.8, 4.4], [-4.5, 3.7], [-3.2, 3.8], [-1.7, 3.2], [-0.4, 3.9]],
      [[-3.2, 3.8], [-2.5, 2.3], [-1.9, 1.1]],
      [[-3.1, -3.5], [-2.2, -2.6], [-1.4, -2.1], [-0.3, -1.2], [0.9, -2.0]],
      [[0.9, 4.7], [1.8, 4.1], [2.9, 4.4], [4.2, 3.6], [5.4, 4.1]],
      [[6.8, -1.1], [8.3, 0.1], [9.6, 0.6], [10.8, 0.5], [12.1, 1.6]],
      [[10.8, 0.5], [10.2, -0.9], [9.5, -1.9]],
    ];
    l6CrackPolylines.forEach((poly) => {
      for (let s = 0; s < poly.length - 1; s++) {
        const [x1, z1] = poly[s];
        const [x2, z2] = poly[s + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.hypot(dx, dz);
        const mx = (x1 + x2) * 0.5;
        const mz = (z1 + z2) * 0.5;
        const angle = Math.atan2(dx, dz);
        const taper = 1 - s * 0.14;

        const cg = new THREE.Group();
        cg.position.set(mx, 0.556, mz);
        cg.rotation.y = angle;
        const glowSeam = new THREE.Mesh(
          new THREE.BoxGeometry(0.18 * taper, 0.025, segLen * 1.03),
          l6IntroCrackGlowMat
        );
        const darkSeam = new THREE.Mesh(
          new THREE.BoxGeometry(0.10 * taper, 0.04, segLen * 1.01),
          l6IntroCrackDarkMat
        );
        darkSeam.position.y = 0.012;
        cg.add(glowSeam, darkSeam);
        l6IntroCrackGroup.add(cg);
      }
    });
    level6IntroMapGroup.add(l6IntroCrackGroup);
    scene.add(level6IntroMapGroup);

    // Level 6 Core Game Sub-group: 5 Interactive Menara Radar + Central Nusantara Core + Light Network
    const level6Group = new THREE.Group();
    const l6FloorRing = new THREE.Mesh(
      new THREE.RingGeometry(10.5, 16.2, 36),
      new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.14,
      })
    );
    l6FloorRing.rotation.x = -Math.PI / 2;
    l6FloorRing.position.set(0, 0.04, 0);
    level6Group.add(l6FloorRing);

    // Central Nusantara Sanctuary at (0, 0) where all 5 Menara Radar beams converge
    const centerPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.45, 0.36, 8),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.35,
      })
    );
    centerPedestal.position.set(0, 0.18, 0);
    const centerCoreOrbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.25,
    });
    const centerCoreOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), centerCoreOrbMat);
    centerCoreOrb.position.set(0, 1.75, 0);

    const centerCoreHaloMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const centerCoreHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.065, 10, 28),
      centerCoreHaloMat
    );
    centerCoreHalo.position.set(0, 1.75, 0);

    const centerSkyBeamMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const centerSkyBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.92, 14.0, 16, 1, true),
      centerSkyBeamMat
    );
    centerSkyBeam.position.set(0, 7.2, 0);

    const centerLabel = createBinLabelSprite(
      'PUSAT CAHAYA NUSANTARA',
      '#064e3b',
      '#34d399',
      0.58,
      true
    );
    centerLabel.position.set(0, 3.45, 0);
    level6Group.add(centerPedestal, centerCoreOrb, centerCoreHalo, centerSkyBeam, centerLabel);

    const towerAnchors: THREE.Group[] = [];
    const towerDishes: THREE.Group[] = [];
    const towerBeacons: THREE.Mesh[] = [];
    const towerBeams: THREE.Mesh[] = [];
    const towerRings: THREE.Mesh[] = [];
    const towerBadges: THREE.Sprite[] = [];
    const towerClickTargets: THREE.Object3D[] = [];
    const centerLinkBeams: THREE.Mesh[] = [];
    const perimeterLinkBeams: THREE.Mesh[] = [];
    const centerLinkMotes: THREE.Mesh[] = [];

    const l6HitGeo = new THREE.CylinderGeometry(1.85, 1.85, 5.4, 12);
    const l6HitMat = new THREE.MeshBasicMaterial({ visible: false });
    const l6PylonMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.45,
    });
    const l6BaseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.2,
    });
    const l6DishMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.5,
    });

    const tagIslandHierarchy = (root: THREE.Object3D, islandIdx: number) => {
      root.userData.islandIdx = islandIdx;
      root.traverse((child) => {
        child.userData.islandIdx = islandIdx;
      });
    };

    const _beamUp = new THREE.Vector3(0, 1, 0);
    const createBeamBetween = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      radius: number,
      mat: THREE.MeshBasicMaterial
    ): THREE.Mesh => {
      const start = new THREE.Vector3(ax, ay, az);
      const end = new THREE.Vector3(bx, by, bz);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10, 1, true), mat);
      mesh.position.copy(start).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(_beamUp, dir.clone().normalize());
      return mesh;
    };

    LEVEL_6_ISLANDS.forEach((isl, idx) => {
      const [tx, tz] = LEVEL_6_TOWER_POSITIONS[idx] ?? isl.coords;
      const anchor = new THREE.Group();
      anchor.position.set(tx, 0, tz);
      towerAnchors.push(anchor);
      level6Group.add(anchor);

      // Foundation & Menara Radar Lattice Pylon
      const basePad = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.58, 0.28, 8), l6BaseMat);
      basePad.position.y = 0.14;
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.46, 3.2, 6), l6PylonMat);
      pylon.position.y = 1.74;
      const collarLow = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.16, 8), l6DishMat);
      collarLow.position.y = 1.45;
      const collarHigh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.16, 8), l6DishMat);
      collarHigh.position.y = 2.75;

      // Rotating Radar Dish
      const dishPivot = new THREE.Group();
      dishPivot.position.set(0, 3.05, 0);
      const dishBowl = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.45, 12, 1, true), l6DishMat);
      dishBowl.rotation.x = Math.PI * 0.35;
      const dishRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), l6DishMat);
      dishRod.rotation.x = Math.PI * 0.35;
      dishRod.position.set(0, 0.08, 0.22);
      dishPivot.add(dishBowl, dishRod);
      towerDishes.push(dishPivot);

      // Top Strobe Beacon Dome (Red Alarm -> Emerald Glow)
      const beaconMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 12),
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xdc2626,
          emissiveIntensity: 1.0,
          roughness: 0.18,
        })
      );
      beaconMesh.position.y = 3.85;
      towerBeacons.push(beaconMesh);

      // Vertical Hazard/Emerald Aura Beam
      const beamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.62, 5.6, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beamMesh.position.y = 3.1;
      towerBeams.push(beamMesh);

      // Ground Radar Pulse Ring
      const tRingGeo = new THREE.RingGeometry(1.55, 2.02, 28);
      tRingGeo.rotateX(-Math.PI / 2);
      const tRing = new THREE.Mesh(
        tRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      tRing.position.y = 0.09;
      towerRings.push(tRing);

      // Floating [KETUK / E] Prompt Sprite
      const badge = new THREE.Sprite(l4InteractBadgeMat);
      badge.scale.set(2.55, 0.74, 1);
      badge.position.set(0, 4.55, 0);
      badge.visible = false;
      towerBadges.push(badge);

      // Island & Detailed Region Label
      const shortPart = isl.shortRegion.split('(')[0].trim();
      const islLabel = createBinLabelSprite(
        `MENARA ${isl.islandName.toUpperCase()} · ${shortPart}`,
        '#0f172a',
        '#fbbf24',
        0.54,
        true
      );
      islLabel.position.set(0, 5.25, 0);

      // Invisible Raycast Target Hitbox
      const hitMesh = new THREE.Mesh(l6HitGeo, l6HitMat);
      hitMesh.position.set(0, 2.7, 0);

      anchor.add(
        basePad,
        pylon,
        collarLow,
        collarHigh,
        dishPivot,
        beaconMesh,
        beamMesh,
        tRing,
        badge,
        islLabel,
        hitMesh
      );
      tagIslandHierarchy(anchor, idx);
      towerClickTargets.push(hitMesh, pylon, beaconMesh, dishPivot);

      // Connected Light Beam from this tower's top to the Central Core Orb (0, 1.75, 0)
      const cLinkMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cLinkBeam = createBeamBetween(tx, 3.85, tz, 0, 1.75, 0, 0.14, cLinkMat);
      cLinkBeam.visible = false;
      centerLinkBeams.push(cLinkBeam);
      level6Group.add(cLinkBeam);

      // Perimeter Beam connecting tower idx to tower (idx + 1) % 5
      const nextPos = LEVEL_6_TOWER_POSITIONS[(idx + 1) % LEVEL_6_TOWER_POSITIONS.length];
      const pLinkMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const pLinkBeam = createBeamBetween(tx, 3.85, tz, nextPos[0], 3.85, nextPos[1], 0.11, pLinkMat);
      pLinkBeam.visible = false;
      perimeterLinkBeams.push(pLinkBeam);
      level6Group.add(pLinkBeam);

      // Animated streaming energy mote along each tower -> center beam
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      mote.visible = false;
      centerLinkMotes.push(mote);
      level6Group.add(mote);
    });
    scene.add(level6Group);

    // =========================================================================
    // SINEMATIK PROLOG 3 BABAK:
    // • Babak 1: Kamera Melayang di Atas Panorama Nusantara (Pemandangan Gunung & Sungai)
    // • Babak 2: Kamera Menukik Tajam, Tanah Retak, Warna Kelabu, Gemuruh Bumi
    // • Babak 3: Kamera Mengorbit ke Karakter Murid, Tunas Hijau Bercahaya Turun
    // =========================================================================
    const prologueWorldGroup = new THREE.Group();
    prologueWorldGroup.visible = false;
    scene.add(prologueWorldGroup);

    // --- Shared Mountain & River Materials (Dynamic across Babak 1, 2, 3) ---
    const mtnFootMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.78,
      metalness: 0.05,
    });
    const mtnMidMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.72,
      metalness: 0.06,
    });
    const mtnPeakMat = new THREE.MeshStandardMaterial({
      color: 0x065f46,
      roughness: 0.68,
      metalness: 0.08,
    });
    const mtnCraterMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.55,
      metalness: 0.1,
    });
    const riverWaterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.38,
      roughness: 0.14,
      metalness: 0.25,
    });
    const riverBankMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.82,
      metalness: 0.04,
    });
    const riverRippleMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.85,
    });

    // 1. PEGUNUNGAN NUSANTARA MENJULANG (3 Puncak Gunung + Perbukitan Sisi Lembah)
    const mountainsGroup = new THREE.Group();
    // Gunung Utama Tengah (Mount Nusantara — framed cleanly below top HUD)
    const centralFoot = new THREE.Mesh(new THREE.ConeGeometry(7.2, 4.4, 8), mtnFootMat);
    centralFoot.position.set(0, 2.2, -17.5);
    const centralMid = new THREE.Mesh(new THREE.ConeGeometry(6.0, 7.6, 7), mtnMidMat);
    centralMid.position.set(0, 3.8, -17.2);
    const centralPeak = new THREE.Mesh(new THREE.ConeGeometry(3.8, 10.2, 7), mtnPeakMat);
    centralPeak.position.set(0, 5.1, -17.0);
    const centralCrater = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.7, 0.75, 7),
      mtnCraterMat
    );
    centralCrater.position.set(0, 9.9, -17.0);
    mountainsGroup.add(centralFoot, centralMid, centralPeak, centralCrater);

    // Gunung Kembar Barat (West Mountain)
    const westFoot = new THREE.Mesh(new THREE.ConeGeometry(7.4, 4.2, 7), mtnFootMat);
    westFoot.position.set(-12.2, 2.1, -15.8);
    westFoot.rotation.y = 0.4;
    const westPeak = new THREE.Mesh(new THREE.ConeGeometry(5.6, 8.6, 7), mtnMidMat);
    westPeak.position.set(-12.2, 4.3, -15.8);
    westPeak.rotation.y = 0.8;
    const westTop = new THREE.Mesh(new THREE.ConeGeometry(3.2, 9.6, 7), mtnPeakMat);
    westTop.position.set(-12.2, 4.8, -15.8);
    mountainsGroup.add(westFoot, westPeak, westTop);

    // Gunung Kembar Timur (East Mountain)
    const eastFoot = new THREE.Mesh(new THREE.ConeGeometry(7.6, 4.2, 7), mtnFootMat);
    eastFoot.position.set(12.2, 2.1, -15.6);
    eastFoot.rotation.y = -0.35;
    const eastPeak = new THREE.Mesh(new THREE.ConeGeometry(5.8, 8.8, 7), mtnMidMat);
    eastPeak.position.set(12.2, 4.4, -15.6);
    eastPeak.rotation.y = -0.7;
    const eastTop = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9.8, 7), mtnPeakMat);
    eastTop.position.set(12.2, 4.9, -15.6);
    mountainsGroup.add(eastFoot, eastPeak, eastTop);

    // Perbukitan Sisi Kiri & Kanan (Placed wide on outer flanks so center River Valley is 100% open!)
    const valleyHillSpecs: [number, number, number, number][] = [
      [-15.5, -5.5, 5.2, 3.8],
      [15.5, -5.2, 5.4, 4.0],
      [-18.0, 1.0, 5.2, 3.5],
      [18.0, 1.2, 5.2, 3.6],
    ];
    valleyHillSpecs.forEach(([hx, hz, hr, hh], idx) => {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(hr, hh, 6),
        idx % 2 === 0 ? mtnFootMat : mtnMidMat
      );
      hill.position.set(hx, hh / 2, hz);
      hill.rotation.y = idx * 0.6;
      mountainsGroup.add(hill);
    });
    prologueWorldGroup.add(mountainsGroup);

    // 2. AIR TERJUN PEGUNUNGAN & SUNGAI MENGALIR JERNIH (Waterfall & Wide Winding River)
    const riverSystemGroup = new THREE.Group();
    // Air Terjun dari Lereng Gunung Tengah (Cascading Mountain Waterfall)
    const waterfallStream = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 7.8, 0.75),
      riverWaterMat
    );
    waterfallStream.position.set(0, 3.4, -11.4);
    waterfallStream.rotation.x = -0.42;
    riverSystemGroup.add(waterfallStream);

    // Laguna Hulu Air Terjun (Waterfall Plunge Pool)
    const plungePool = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.5, 0.24, 24),
      riverWaterMat
    );
    plungePool.position.set(0, 0.12, -9.2);
    riverSystemGroup.add(plungePool);

    // Buih Air Terjun (Animated Waterfall Foam Spheres)
    const waterfallFoamMeshes: THREE.Mesh[] = [];
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    for (let f = 0; f < 9; f++) {
      const foam = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 + (f % 3) * 0.12, 10, 10),
        foamMat
      );
      foam.position.set(-1.8 + f * 0.45, 0.3, -9.4 + (f % 2) * 0.35);
      waterfallFoamMeshes.push(foam);
      riverSystemGroup.add(foam);
    }

    // Alur Sungai Berkelok Lebar & Jelas (Wide Winding S-Curve River across the Open Valley)
    const riverCurveWaypoints: [number, number, number][] = [
      [0, -9.2, 6.2],
      [-0.5, -7.2, 6.0],
      [-1.4, -5.2, 5.8],
      [-2.6, -3.4, 5.6],
      [-3.0, -1.6, 5.6],
      [-1.8, 0.2, 5.8],
      [0.4, 2.2, 6.0],
      [2.4, 4.2, 6.2],
      [3.0, 6.4, 6.4],
      [2.0, 8.8, 6.6],
      [0.4, 11.5, 7.0],
      [-0.8, 14.5, 7.4],
      [0, 18.0, 8.0],
    ];

    riverCurveWaypoints.forEach(([rx, rz, rw], idx) => {
      // Golden-lime riverbanks on left and right
      const bankGeo = new THREE.CylinderGeometry(rw * 0.68, rw * 0.75, 0.16, 18);
      const bankMesh = new THREE.Mesh(bankGeo, riverBankMat);
      bankMesh.position.set(rx, 0.04, rz);
      riverSystemGroup.add(bankMesh);

      // Glowing turquoise river water surface
      const waterSeg = new THREE.Mesh(
        new THREE.CylinderGeometry(rw * 0.56, rw * 0.58, 0.22, 20),
        riverWaterMat
      );
      waterSeg.position.set(rx, 0.10 + (idx % 2) * 0.003, rz);
      riverSystemGroup.add(waterSeg);
    });

    // Batu-Batu Sungai Alami di Tepian Sungai (Natural Riverbank Boulders)
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.08,
    });
    riverCurveWaypoints.forEach(([rx, rz, rw], idx) => {
      if (idx % 2 === 0 && idx < 10) {
        const leftRock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.45 + (idx % 3) * 0.14, 0),
          rockMat
        );
        leftRock.position.set(rx - rw * 0.62, 0.24, rz);
        leftRock.rotation.set(idx * 0.4, idx * 0.8, 0);
        const rightRock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.42 + ((idx + 1) % 3) * 0.14, 0),
          rockMat
        );
        rightRock.position.set(rx + rw * 0.62, 0.24, rz + 0.35);
        rightRock.rotation.set(idx * 0.5, idx * 0.3, 0);
        riverSystemGroup.add(leftRock, rightRock);
      }
    });

    // Riak Aliran Air Sungai (Animated Flowing Water Ripples moving downstream)
    const riverRippleMeshes: THREE.Mesh[] = [];
    for (let r = 0; r < 22; r++) {
      const ripple = new THREE.Mesh(
        new THREE.BoxGeometry(0.65 + (r % 3) * 0.28, 0.05, 1.55),
        riverRippleMat
      );
      riverRippleMeshes.push(ripple);
      riverSystemGroup.add(ripple);
    }
    prologueWorldGroup.add(riverSystemGroup);

    // --- BABAK 1 SUB-GROUP: Awan Putih & Pepohonan Lembah Sungai ---
    const prologueBabak1HarmonyGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.02,
    });
    const prologueClouds: THREE.Group[] = [];
    const cloudSpecs: [number, number, number, number][] = [
      [-6.8, 7.2, -13.5, 0.95],
      [6.8, 7.4, -13.2, 0.95],
      [-15.8, 7.6, -12.5, 0.9],
      [15.8, 7.5, -12.5, 0.9],
    ];
    cloudSpecs.forEach(([cx, cy, cz, cs]) => {
      const cg = new THREE.Group();
      const cMain = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), cloudMat);
      const cLeft = new THREE.Mesh(new THREE.SphereGeometry(0.82, 10, 8), cloudMat);
      cLeft.position.set(-0.9, -0.12, 0.1);
      const cRight = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), cloudMat);
      cRight.position.set(0.9, -0.1, -0.1);
      cg.add(cMain, cLeft, cRight);
      cg.position.set(cx, cy, cz);
      cg.scale.setScalar(cs);
      prologueClouds.push(cg);
      prologueBabak1HarmonyGroup.add(cg);
    });

    // Pohon Cemara & Tropis di Tepian Luar Lembah Sungai (Placed along outer banks so River is 100% clear)
    const valleyTreePositions: [number, number, number][] = [
      [-7.2, -6.5, 1.15],
      [-7.8, -3.2, 1.1],
      [-7.4, 0.2, 1.15],
      [-6.5, 3.5, 1.0],
      [5.8, -6.2, 1.15],
      [6.2, -2.8, 1.1],
      [6.8, 0.8, 1.15],
      [7.4, 4.2, 1.05],
      [-9.8, -1.5, 1.25],
      [9.5, -1.2, 1.2],
    ];
    const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 });
    const pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });
    valleyTreePositions.forEach(([tx, tz, ts]) => {
      const tg = new THREE.Group();
      const trk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.2, 7), pineTrunkMat);
      trk.position.y = 0.6;
      const cr1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), pineLeafMat);
      cr1.position.y = 1.6;
      const cr2 = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.5, 7), pineLeafMat);
      cr2.position.y = 2.5;
      tg.add(trk, cr1, cr2);
      tg.position.set(tx, 0, tz);
      tg.scale.setScalar(ts);
      prologueBabak1HarmonyGroup.add(tg);
    });
    prologueWorldGroup.add(prologueBabak1HarmonyGroup);

    // --- BABAK 2 SUB-GROUP: Tanah Retak, Warna Kelabu, Pohon Ditebang & Sampah Mencemari Sungai ---
    const prologueBabak2CrisisGroup = new THREE.Group();
    prologueBabak2CrisisGroup.visible = false;

    // 1. Retakan Tanah Bercabang (High-Contrast Cracked Earth Fissures across the Open Valley Floor)
    const crackDarkMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const crackGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.2,
      roughness: 0.25,
    });
    const brokenSlabMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      roughness: 0.92,
      metalness: 0.05,
    });

    const fissureSpecs: {
      pos: [number, number, number];
      rotY: number;
      len: number;
      width: number;
    }[] = [
      { pos: [-5.8, 0.10, -4.5], rotY: 0.38, len: 7.4, width: 0.65 },
      { pos: [-5.2, 0.10, -1.2], rotY: -0.58, len: 6.2, width: 0.55 },
      { pos: [-6.4, 0.10, 1.8], rotY: 0.72, len: 5.8, width: 0.52 },
      { pos: [3.6, 0.10, -4.8], rotY: -0.35, len: 7.6, width: 0.68 },
      { pos: [4.2, 0.10, -1.4], rotY: 0.64, len: 6.4, width: 0.56 },
      { pos: [5.6, 0.10, 1.6], rotY: -0.75, len: 5.8, width: 0.52 },
      { pos: [-1.5, 0.10, -5.8], rotY: 0.22, len: 6.5, width: 0.58 },
      { pos: [1.2, 0.10, -2.5], rotY: -0.28, len: 6.2, width: 0.56 },
      { pos: [-8.2, 0.10, -3.2], rotY: 0.52, len: 5.8, width: 0.5 },
      { pos: [7.8, 0.10, -3.0], rotY: -0.48, len: 5.8, width: 0.5 },
    ];

    fissureSpecs.forEach((f, idx) => {
      const fg = new THREE.Group();
      fg.position.set(f.pos[0], f.pos[1], f.pos[2]);
      fg.rotation.y = f.rotY;

      // Glowing seismic fault edge beneath crack
      const faultGlow = new THREE.Mesh(
        new THREE.BoxGeometry(f.width * 1.65, 0.07, f.len * 1.05),
        crackGlowMat
      );
      faultGlow.position.y = 0.02;
      // Dark chasm center
      const chasmCore = new THREE.Mesh(
        new THREE.BoxGeometry(f.width, 0.11, f.len),
        crackDarkMat
      );
      chasmCore.position.y = 0.05;
      // Tilted fractured earth slabs flanking the crack
      const leftSlab = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.15, f.len * 0.85),
        brokenSlabMat
      );
      leftSlab.position.set(-f.width * 0.88, 0.05, 0);
      leftSlab.rotation.z = 0.2;
      const rightSlab = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.15, f.len * 0.82),
        brokenSlabMat
      );
      rightSlab.position.set(f.width * 0.88, 0.05, 0);
      rightSlab.rotation.z = -0.18;

      fg.add(faultGlow, chasmCore, leftSlab, rightSlab);

      // Secondary branching crack
      if (idx % 2 === 0) {
        const branchGlow = new THREE.Mesh(
          new THREE.BoxGeometry(f.width * 1.1, 0.06, f.len * 0.6),
          crackGlowMat
        );
        branchGlow.position.set(f.width * 1.45, 0.02, 0.4);
        branchGlow.rotation.y = 0.78;
        const branchCore = new THREE.Mesh(
          new THREE.BoxGeometry(f.width * 0.68, 0.10, f.len * 0.56),
          crackDarkMat
        );
        branchCore.position.set(f.width * 1.45, 0.05, 0.4);
        branchCore.rotation.y = 0.78;
        fg.add(branchGlow, branchCore);
      }

      prologueBabak2CrisisGroup.add(fg);
    });

    // 2. Pohon-Pohon Ditebang Sembarangan (Felled Tree Stumps & Fallen Logs)
    const stumpBarkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const stumpRingMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.65 });
    valleyTreePositions.forEach(([tx, tz], idx) => {
      const sg = new THREE.Group();
      sg.position.set(tx, 0, tz);
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.48, 0.58, 8),
        stumpBarkMat
      );
      stump.position.y = 0.29;
      const cutTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8),
        stumpRingMat
      );
      cutTop.position.y = 0.59;
      sg.add(stump, cutTop);

      // Fallen timber trunk next to the stump
      if (idx % 2 === 0) {
        const fallenLog = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.34, 2.3, 8),
          stumpBarkMat
        );
        fallenLog.position.set(0.95, 0.28, 0.35);
        fallenLog.rotation.z = Math.PI / 2;
        fallenLog.rotation.y = idx * 0.5;
        sg.add(fallenLog);
      }
      prologueBabak2CrisisGroup.add(sg);
    });

    // 3. Tumpukan Sampah Plastik & Tong Limbah Mencemari Sungai (Plastic Piles & Toxic Drums)
    const crisisTrashColors = [0xef4444, 0x3b82f6, 0xfacc15, 0xa855f7, 0xf97316, 0xe2e8f0];
    const crisisTrashCoords: [number, number, number][] = [
      [-2.4, 0.28, -3.5],
      [-2.8, 0.26, -1.5],
      [-1.6, 0.28, 0.5],
      [0.6, 0.26, 2.2],
      [-4.5, 0.24, -2.2],
      [-4.8, 0.3, -1.6],
      [2.8, 0.24, -2.5],
      [3.2, 0.32, -1.9],
      [-3.6, 0.25, 0.8],
      [2.2, 0.25, 0.6],
      [0.0, 0.26, -5.2],
      [-1.4, 0.26, -6.0],
    ];
    crisisTrashCoords.forEach(([px, py, pz], idx) => {
      const bag = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.38 + (idx % 3) * 0.1, 0),
        new THREE.MeshStandardMaterial({
          color: crisisTrashColors[idx % crisisTrashColors.length],
          roughness: 0.4,
        })
      );
      bag.position.set(px, py, pz);
      bag.rotation.set(idx * 0.6, idx * 0.9, idx * 0.4);
      prologueBabak2CrisisGroup.add(bag);
    });

    // Kepulan Asap Kelabu Polusi di Langit Belakang (High Background Smoke so foreground Cracked Earth is 100% clear)
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      transparent: true,
      opacity: 0.52,
      roughness: 0.9,
    });
    const crisisSmokePuffs: THREE.Mesh[] = [];
    for (let s = 0; s < 8; s++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.45 + (s % 3) * 0.18, 10, 10),
        smokeMat
      );
      puff.position.set(
        -9.0 + s * 2.6,
        5.5 + (s % 3) * 1.2,
        -9.5 - (s % 2) * 2.0
      );
      crisisSmokePuffs.push(puff);
      prologueBabak2CrisisGroup.add(puff);
    }
    prologueWorldGroup.add(prologueBabak2CrisisGroup);

    // --- BABAK 3 SUB-GROUP: Karakter Murid & Tunas Hijau Bercahaya Turun dari Langit ---
    const prologueBabak3HeroGroup = new THREE.Group();
    prologueBabak3HeroGroup.visible = false;

    // 1. Panggung Lingkaran Amanah Zamrud di Bawah Kaki Murid (Sacred Emerald Restoration Pad)
    const heroPadBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.6, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: 0x065f46,
        emissive: 0x059669,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    heroPadBase.position.set(0, 0.09, 0.5);
    prologueBabak3HeroGroup.add(heroPadBase);

    const heroAuraRings: THREE.Mesh[] = [];
    [1.55, 2.25, 3.05].forEach((rad, idx) => {
      const rGeo = new THREE.RingGeometry(rad, rad + 0.14, 36);
      rGeo.rotateX(-Math.PI / 2);
      const rMesh = new THREE.Mesh(
        rGeo,
        new THREE.MeshBasicMaterial({
          color: idx % 2 === 0 ? 0x34d399 : 0xfacc15,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      rMesh.position.set(0, 0.2 + idx * 0.01, 0.5);
      heroAuraRings.push(rMesh);
      prologueBabak3HeroGroup.add(rMesh);
    });

    // Tiang Pancaran Cahaya Langit Lembut (Soft Celestial Light Beam behind Sprout)
    const skyBeamMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const skyLightBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.55, 8.5, 24, 1, true),
      skyBeamMat
    );
    skyLightBeam.position.set(0, 4.25, 0.5);
    prologueBabak3HeroGroup.add(skyLightBeam);

    // Cincin Gelombang Cahaya Turun (3 Cascading Light Rings visibly moving DOWNWARD)
    const descendingLightRings: THREE.Mesh[] = [];
    for (let dr = 0; dr < 3; dr++) {
      const dRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.75 + dr * 0.16, 0.032, 10, 32),
        new THREE.MeshBasicMaterial({
          color: dr % 2 === 0 ? 0x4ade80 : 0xfacc15,
          transparent: true,
          opacity: 0.85,
        })
      );
      dRing.rotation.x = Math.PI / 2;
      dRing.position.set(0, 4.0, 0.5);
      descendingLightRings.push(dRing);
      prologueBabak3HeroGroup.add(dRing);
    }

    // 2. TUNAS HIJAU BERCAHAYA (Multi-Part Sculpted 3D Glowing Emerald Sprout Descending)
    const glowingSproutAssembly = new THREE.Group();
    glowingSproutAssembly.position.set(0, 3.2, 0.5);

    // PointLight memancarkan cahaya hijau-emas ke wajah karakter murid
    const sproutPointLight = new THREE.PointLight(0x34d399, 3.8, 12);
    sproutPointLight.position.set(0, 0.2, 0);
    glowingSproutAssembly.add(sproutPointLight);

    // Inti Benih Cahaya Emas-Zamrud (Luminous Golden-Emerald Seed Core)
    const seedCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.15,
      })
    );
    const seedHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    );
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.032, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.92 })
    );
    glowingSproutAssembly.add(seedCore, seedHalo, haloRing);

    // Batang Tunas Hijau Zamrud (Glowing Emerald Stem)
    const sproutStemMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x22c55e,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    const sproutLeafMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x4ade80,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    });
    const sproutVeinMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const sproutStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.095, 0.82, 12),
      sproutStemMat
    );
    sproutStem.position.set(0, 0.42, 0);
    glowingSproutAssembly.add(sproutStem);

    // Daun Kiri & Daun Kanan Tunas Hijau Bercahaya (Sculpted Symmetrical Leaves + Golden Veins)
    const leftLeafGroup = new THREE.Group();
    leftLeafGroup.position.set(-0.36, 0.76, 0);
    leftLeafGroup.rotation.z = 0.48;
    const leftLeafBlade = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 14, 12),
      sproutLeafMat
    );
    leftLeafBlade.scale.set(1.38, 0.24, 0.74);
    const leftLeafVein = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.055, 0.065),
      sproutVeinMat
    );
    leftLeafVein.position.y = 0.06;
    leftLeafGroup.add(leftLeafBlade, leftLeafVein);

    const rightLeafGroup = new THREE.Group();
    rightLeafGroup.position.set(0.36, 0.76, 0);
    rightLeafGroup.rotation.z = -0.48;
    const rightLeafBlade = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 14, 12),
      sproutLeafMat
    );
    rightLeafBlade.scale.set(1.38, 0.24, 0.74);
    const rightLeafVein = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.055, 0.065),
      sproutVeinMat
    );
    rightLeafVein.position.y = 0.06;
    rightLeafGroup.add(rightLeafBlade, rightLeafVein);

    // Kuncup Pucuk Tunas Tengah (Central Glowing Shoot Bud)
    const centerBud = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.36, 10),
      new THREE.MeshStandardMaterial({
        color: 0x86efac,
        emissive: 0x22c55e,
        emissiveIntensity: 1.1,
        roughness: 0.15,
      })
    );
    centerBud.position.set(0, 0.96, 0);

    glowingSproutAssembly.add(leftLeafGroup, rightLeafGroup, centerBud);
    prologueBabak3HeroGroup.add(glowingSproutAssembly);

    // Partikel Cahaya Zamrud & Emas Berkilau (16 Floating Light Motes around Student & Sprout)
    const sproutMotes: THREE.Mesh[] = [];
    for (let m = 0; m < 16; m++) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.065 + (m % 3) * 0.02, 8, 8),
        new THREE.MeshBasicMaterial({
          color: m % 2 === 0 ? 0x4ade80 : 0xfde047,
        })
      );
      sproutMotes.push(mote);
      prologueBabak3HeroGroup.add(mote);
    }
    prologueWorldGroup.add(prologueBabak3HeroGroup);

    // Pre-allocate scratch vectors for Zero-GC loop & 2P framing solver
    const camTargetPos = new THREE.Vector3(0, 14, 24);
    const camLookTarget = new THREE.Vector3(0, 1, 0);
    const currentLook = new THREE.Vector3(0, 1, 0);
    const _fitOffset = new THREE.Vector3();
    const _fitProj = new THREE.Vector3();
    const _fitCamSpace = new THREE.Vector3();
    const _fitSamples = Array.from({ length: 8 }, () => new THREE.Vector3());
    const skyColorHarmony = new THREE.Color(0x0284c7);
    const skyColorCrisis = new THREE.Color(0x334155);
    const skyColorHero = new THREE.Color(0x064e3b);
    const defaultSkyColor = new THREE.Color(0x0b222c);
    const l6MapColorVibrant = new THREE.Color(0xffffff);
    const l6MapColorAshGray = new THREE.Color(0x7c8591);
    const l6IslandCrisisGray = new THREE.Color(0x475569);
    const l6IslandVibrant = new THREE.Color(0x16a34a);
    const l6OceanCrisisGray = new THREE.Color(0x1e293b);
    const l6OceanVibrant = new THREE.Color(0x0284c7);

    const clock = new THREE.Clock();
    let frameId = 0;
    let unmounted = false;
    let shakeRemaining = 0;
    let lastShakeSeed = 0;
    let shakeRemaining2 = 0;
    let lastShakeSeed2 = 0;
    let wasSplitArena = false;
    let wasL1HouseIntro = false;
    let lastLookingLevel = 0;
    let lookingPhaseStartTime = 0;
    let lastPrologueStage = 0;
    let prologueStageStartTime = 0;
    let wasL6MapTheme = false;

    // Software WebGL Paced Loop Helper
    function afterDraw(cb: () => void) {
      frameId = window.setTimeout(cb, 200);
    }

    /**
     * Adjusts camera position & lookAt (Zero-GC) so BOTH main characters (P1 & P2, head-to-toe + nameplate)
     * remain strictly inside the unobstructed safe NDC bounds [safeMinX..safeMaxX, safeMinY..safeMaxY]
     * of the active split viewport regardless of how far apart or toward either split border they move.
     */
    function fitSplitCameraToBothPlayers(
      cam: THREE.PerspectiveCamera,
      pos: THREE.Vector3,
      look: THREE.Vector3,
      p1x: number,
      p1y: number,
      p1z: number,
      p2x: number,
      p2y: number,
      p2z: number,
      safeMinX: number,
      safeMaxX: number,
      safeMinY: number,
      safeMaxY: number
    ) {
      const midX = (p1x + p2x) * 0.5;
      const midZ = (p1z + p2z) * 0.5;
      const safeW = Math.max(0.25, safeMaxX - safeMinX);
      const safeH = Math.max(0.25, safeMaxY - safeMinY);
      const safeCx = (safeMinX + safeMaxX) * 0.5;
      const safeCy = (safeMinY + safeMaxY) * 0.5;

      _fitSamples[0].set(p1x - 0.75, p1y + 0.08, p1z);
      _fitSamples[1].set(p1x + 0.75, p1y + 0.08, p1z);
      _fitSamples[2].set(p1x - 0.75, p1y + 2.85, p1z);
      _fitSamples[3].set(p1x + 0.75, p1y + 2.85, p1z);
      _fitSamples[4].set(p2x - 0.75, p2y + 0.08, p2z);
      _fitSamples[5].set(p2x + 0.75, p2y + 0.08, p2z);
      _fitSamples[6].set(p2x - 0.75, p2y + 2.85, p2z);
      _fitSamples[7].set(p2x + 0.75, p2y + 2.85, p2z);

      for (let iter = 0; iter < 8; iter++) {
        cam.position.copy(pos);
        cam.lookAt(look);
        cam.updateMatrixWorld(true);

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let anyBehind = false;

        for (let i = 0; i < 8; i++) {
          _fitCamSpace.copy(_fitSamples[i]).applyMatrix4(cam.matrixWorldInverse);
          if (_fitCamSpace.z > -0.6) {
            anyBehind = true;
          }
          _fitProj.copy(_fitSamples[i]).project(cam);
          if (_fitProj.x < minX) minX = _fitProj.x;
          if (_fitProj.x > maxX) maxX = _fitProj.x;
          if (_fitProj.y < minY) minY = _fitProj.y;
          if (_fitProj.y > maxY) maxY = _fitProj.y;
        }

        const inside =
          !anyBehind &&
          minX >= safeMinX &&
          maxX <= safeMaxX &&
          minY >= safeMinY &&
          maxY <= safeMaxY;
        if (inside) {
          return;
        }

        _fitOffset.copy(pos).sub(look);

        // Shift lookAt strongly toward midpoint so neither player drifts into a split edge or UI deck
        look.x += (midX - look.x) * 0.85;
        look.z += (midZ - look.z) * 0.85;

        const reqLeft = Math.max(0.01, safeCx - minX) / (safeW * 0.45);
        const reqRight = Math.max(0.01, maxX - safeCx) / (safeW * 0.45);
        const reqBot = Math.max(0.01, safeCy - minY) / (safeH * 0.45);
        const reqTop = Math.max(0.01, maxY - safeCy) / (safeH * 0.45);
        const zoomFactor = anyBehind
          ? 1.45
          : Math.min(2.1, Math.max(1.06, reqLeft, reqRight, reqBot, reqTop));

        if (zoomFactor > 1.01) {
          _fitOffset.multiplyScalar(zoomFactor);
          const maxDist = 74;
          if (_fitOffset.length() > maxDist) {
            _fitOffset.setLength(maxDist);
          }
          // Ensure gentle elevation as camera pulls back so terrain & avatars stay readable
          const minYOff = Math.min(24, _fitOffset.length() * 0.45);
          if (_fitOffset.y < minYOff) {
            _fitOffset.y = minYOff;
          }
        }

        pos.copy(look).add(_fitOffset);
      }
    }

    /**
     * Computes camera target position & lookAt for a specific player's world state.
     * In 2P Split Mode, tracks 100% of player position without horizontal drift and blends smoothly
     * with partner position so both main characters stay cleanly framed.
     */
    function computePlayerCamera(
      level: number,
      px: number,
      pz: number,
      elapsed: number,
      outPos: THREE.Vector3,
      outLook: THREE.Vector3,
      isSplit: boolean,
      qx = px,
      qz = pz
    ) {
      if (isSplit) {
        const sep = Math.hypot(px - qx, pz - qz);
        const wOwn = sep <= 5 ? 0.65 : 0.65 - 0.15 * Math.min(1, (sep - 5) / 18);
        const fx = px * wOwn + qx * (1 - wOwn);
        const fz = pz * wOwn + qz * (1 - wOwn);

        switch (level) {
          case 1:
            outPos.set(fx * 0.75, 5.4, Math.max(fz, 3.0) + 6.6);
            outLook.set(fx * 0.85, 1.35, Math.min(fz, 1.2) - 1.4);
            break;
          case 2:
            outPos.set(fx * 0.75, 5.6, Math.max(fz, 3.0) + 6.6);
            outLook.set(fx * 0.85, 1.4, Math.min(fz, 1.2) - 1.6);
            break;
          case 3:
            outPos.set(fx * 0.75, 5.6, Math.max(fz, 3.0) + 7.4);
            outLook.set(fx * 0.85, 1.75, Math.min(fz, 0.8) - 1.8);
            break;
          case 4:
            outPos.set(fx + 3.0, 9.5, fz + 10.2);
            outLook.set(fx, 1.15, fz - 0.4);
            break;
          case 5:
            outPos.set(fx + 2.0, 9.0, fz + 10.0);
            outLook.set(fx, 1.2, fz - 0.8);
            break;
          case 6:
            outPos.set(fx + Math.sin(elapsed * 0.12) * 2.0, 14.5, fz + 11.0);
            outLook.set(fx * 0.9, 1.0, fz * 0.9 - 0.5);
            break;
          default:
            outPos.set(fx, 8.5, fz + 10.0);
            outLook.set(fx, 1.2, fz);
        }
        return;
      }

      // 1P / Mode Kelas Camera Choreography
      switch (level) {
        case 1:
          outPos.set(px * 0.5, 3.4, pz + 4.8);
          outLook.set(px * 0.3, 1.3, -2.8);
          break;
        case 2:
          outPos.set(px * 0.14, 3.65, 5.65);
          outLook.set(0, 1.82, -1.55);
          break;
        case 3:
          outPos.set(0, 3.95, 7.35);
          outLook.set(0, 2.35, -2.55);
          break;
        case 4:
          outPos.set(px + 6.5, 9.2, pz + 10.5);
          outLook.set(px, 1.1, pz - 1.0);
          break;
        case 5:
          outPos.set(px * 0.78 + 3.0, 8.6, pz + 10.2);
          outLook.set(px * 0.7, 1.35, pz - 1.8);
          break;
        case 6:
          outPos.set(px * 0.68 + 3.2, 11.2, pz + 11.8);
          outLook.set(px * 0.65, 1.4, pz - 1.2);
          break;
        default:
          outPos.set(0, 14, 24);
          outLook.set(0, 1, 0);
      }
    }

    const p1ClawAnim = { x: 0, dropT: 0 };
    const p2ClawAnim = { x: 0, dropT: 0 };

    function syncLevel3ClawVisual(
      animState: { x: number; dropT: number },
      targetNormX: number,
      isDropping: boolean,
      specIndex: number,
      phase: 'claw' | 'numeracy',
      dtVal: number,
      elapsedVal: number
    ) {
      const targetWorldX = targetNormX * 3.5; // -0.8 -> -2.8, 0 -> 0, +0.8 -> +2.8 (aligned to chutes)
      const xLerp = isSoftwareGl ? 0.55 : Math.min(1, dtVal * 11);
      animState.x += (targetWorldX - animState.x) * xLerp;

      const targetDrop = phase === 'numeracy' ? 1 : isDropping ? 1 : 0;
      const dropLerp = isSoftwareGl ? 0.55 : Math.min(1, dtVal * 12);
      animState.dropT += (targetDrop - animState.dropT) * dropLerp;

      clawAssembly.position.x = animState.x;
      clawAssembly.position.y = 3.65;

      // Keep prongs closed around gripped item until player clicks Jatuhkan
      const openFrac = phase === 'numeracy' ? 0.65 : animState.dropT;
      clawProngs.forEach((pivot) => {
        pivot.rotation.z = -0.14 + openFrac * 0.68;
      });

      chuteGlowMats.forEach((mat, cIdx) => {
        const chuteX = l3ChuteSpecs[cIdx].pos[0];
        mat.opacity = Math.abs(animState.x - chuteX) < 1.05 ? 0.94 : 0.22;
      });

      const activeColorHex =
        animState.x < -1.2 ? 0x10b981 : animState.x > 1.2 ? 0x0ea5e9 : 0xf59e0b;
      clawAimBeamMat.color.setHex(activeColorHex);
      clawTargetRingMat.color.setHex(activeColorHex);
      const isPhoneView = window.innerWidth < 768;
      const isPortraitPhone = isPhoneView && window.innerWidth < window.innerHeight;
      level3Group.scale.set(1, isPortraitPhone ? 1.24 : 1, isPhoneView ? 1.08 : 1);
      clawAimBeam.visible = phase === 'claw';
      clawTargetRing.visible = phase === 'claw';
      clawAimBeamMat.opacity =
        (isPhoneView ? 0.46 : 0.24) + Math.sin(elapsedVal * 6.0) * 0.08;
      clawTargetRing.scale.setScalar(1.0 + Math.sin(elapsedVal * 6.5) * 0.08);

      if (phase === 'claw') {
        level3Rig.setActiveSpec(specIndex);
        level3Rig.container.visible = animState.dropT < 0.94;
        level3Rig.container.scale.setScalar(isPhoneView ? 1.42 : 1.08);
        level3Rig.container.position.y = -0.82 - animState.dropT * 1.55;
        level3Rig.container.rotation.y = elapsedVal * 0.75;
      } else {
        level3Rig.container.visible = false;
      }
    }

    function syncLevel4Visuals(
      completedList: readonly number[],
      nearbyIdx: number | null,
      elapsedVal: number
    ) {
      LEVEL_4_CITIZENS.forEach((cit, idx) => {
        const done = completedList.includes(idx);
        const isNear = nearbyIdx === idx && !done;
        const ring = citizenRings[idx];
        const beacon = citizenBeacons[idx];
        const badge = citizenInteractBadges[idx];
        const baseHex = parseInt(cit.radarColor.replace('#', '0x'), 16);

        if (ring) {
          const rMat = ring.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(done ? 0x10b981 : isNear ? 0xfacc15 : baseHex);
          const pulse = isNear
            ? 1.18 + Math.sin(elapsedVal * 7.5) * 0.14
            : done
            ? 0.95
            : 1.0 + Math.sin(elapsedVal * 3.0 + idx) * 0.08;
          ring.scale.setScalar(pulse);
        }

        if (beacon) {
          const bMat = beacon.material as THREE.MeshStandardMaterial;
          bMat.color.setHex(done ? 0x10b981 : isNear ? 0xfacc15 : baseHex);
          bMat.emissive.setHex(done ? 0x059669 : isNear ? 0xf59e0b : baseHex);
          bMat.emissiveIntensity = isNear ? 1.1 : done ? 0.45 : 0.65;
          beacon.rotation.y = elapsedVal * (isNear ? 3.2 : 1.5);
          beacon.position.y = 3.15 + Math.sin(elapsedVal * 3.2 + idx) * 0.16;
          beacon.scale.setScalar(isNear ? 1.25 : done ? 0.72 : 1.0);
        }

        if (badge) {
          badge.visible = isNear;
          badge.position.y = 3.9 + Math.sin(elapsedVal * 5.0) * 0.1;
        }
      });
    }

    function syncLevel5Visuals(
      completedList: readonly number[],
      nearbyIdx: number | null,
      elapsedVal: number
    ) {
      LEVEL_5_ZONES.forEach((zone, idx) => {
        const done = completedList.includes(idx);
        const isNear = nearbyIdx === idx && !done;
        const ring = zoneRings[idx];
        const beacon = zoneBeacons[idx];
        const badge = zoneInteractBadges[idx];
        const baseHex = parseInt(zone.radarColor.replace('#', '0x'), 16);

        if (ring) {
          const rMat = ring.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(done ? 0x10b981 : isNear ? 0xfacc15 : baseHex);
          const pulse = isNear
            ? 1.18 + Math.sin(elapsedVal * 7.5) * 0.14
            : done
            ? 0.95
            : 1.0 + Math.sin(elapsedVal * 3.0 + idx) * 0.08;
          ring.scale.setScalar(pulse);
        }

        if (beacon) {
          const bMat = beacon.material as THREE.MeshStandardMaterial;
          bMat.color.setHex(done ? 0x10b981 : isNear ? 0xfacc15 : baseHex);
          bMat.emissive.setHex(done ? 0x059669 : isNear ? 0xf59e0b : baseHex);
          bMat.emissiveIntensity = isNear ? 1.1 : done ? 0.45 : 0.65;
          beacon.rotation.y = elapsedVal * (isNear ? 3.2 : 1.5);
          beacon.position.y = 3.15 + Math.sin(elapsedVal * 3.2 + idx) * 0.16;
          beacon.scale.setScalar(isNear ? 1.25 : done ? 0.72 : 1.0);
        }

        if (badge) {
          badge.visible = isNear;
          badge.position.y = 3.9 + Math.sin(elapsedVal * 5.0) * 0.1;
        }
      });
    }

    function syncLevel6Visuals(
      completedList: readonly number[],
      nearbyIdx: number | null,
      elapsedVal: number
    ) {
      const allSolved = completedList.length >= LEVEL_6_ISLANDS.length;

      LEVEL_6_ISLANDS.forEach((isl, idx) => {
        const done = completedList.includes(idx);
        const isNear = nearbyIdx === idx && !done;
        const dish = towerDishes[idx];
        const beacon = towerBeacons[idx];
        const beam = towerBeams[idx];
        const ring = towerRings[idx];
        const badge = towerBadges[idx];

        if (dish) {
          dish.rotation.y = elapsedVal * (done ? 1.4 : 2.6) + idx * 1.1;
        }

        if (beacon) {
          const bMat = beacon.material as THREE.MeshStandardMaterial;
          if (done) {
            // Hijau yang bersinar indah
            const shimmer = 1.05 + Math.sin(elapsedVal * 3.4 + idx) * 0.25;
            bMat.color.setHex(0x34d399);
            bMat.emissive.setHex(0x10b981);
            bMat.emissiveIntensity = shimmer;
            beacon.scale.setScalar(1.08 + Math.sin(elapsedVal * 3.0 + idx) * 0.08);
          } else {
            // Kedap-kedip merah bahaya (atau kuning terang saat dekat)
            const alarmBlink = 0.5 + 0.5 * Math.sin(elapsedVal * 9.0 + idx * 0.9);
            bMat.color.setHex(isNear ? 0xfacc15 : alarmBlink > 0.45 ? 0xfef2f2 : 0xef4444);
            bMat.emissive.setHex(isNear ? 0xf59e0b : 0xdc2626);
            bMat.emissiveIntensity = 0.35 + alarmBlink * 1.35;
            beacon.scale.setScalar(0.92 + alarmBlink * 0.32);
          }
        }

        if (beam) {
          const beamMat = beam.material as THREE.MeshBasicMaterial;
          if (done) {
            beamMat.color.setHex(0x34d399);
            beamMat.opacity = 0.28 + Math.sin(elapsedVal * 2.8 + idx) * 0.1;
            beam.scale.set(1.0, 1.15, 1.0);
          } else {
            const alarmPulse = 0.5 + 0.5 * Math.sin(elapsedVal * 9.0 + idx * 0.9);
            beamMat.color.setHex(isNear ? 0xfbbf24 : 0xef4444);
            beamMat.opacity = 0.16 + alarmPulse * 0.48;
            beam.scale.set(0.85 + alarmPulse * 0.35, 0.95 + alarmPulse * 0.25, 0.85 + alarmPulse * 0.35);
          }
        }

        if (ring) {
          const rMat = ring.material as THREE.MeshBasicMaterial;
          if (done) {
            rMat.color.setHex(0x10b981);
            rMat.opacity = 0.72;
            ring.scale.setScalar(1.05 + Math.sin(elapsedVal * 2.5 + idx) * 0.06);
          } else {
            const pulse = 0.95 + Math.sin(elapsedVal * 6.5 + idx) * 0.24;
            rMat.color.setHex(isNear ? 0xfacc15 : 0xef4444);
            rMat.opacity = isNear ? 0.95 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(elapsedVal * 8.5 + idx));
            ring.scale.setScalar(pulse);
          }
        }

        if (badge) {
          badge.visible = isNear;
          badge.position.y = 4.55 + Math.sin(elapsedVal * 5.0) * 0.12;
        }

        const cBeam = centerLinkBeams[idx];
        const pBeam = perimeterLinkBeams[idx];
        const mote = centerLinkMotes[idx];
        if (cBeam) {
          cBeam.visible = allSolved;
          if (allSolved) {
            (cBeam.material as THREE.MeshBasicMaterial).opacity =
              0.68 + Math.sin(elapsedVal * 4.5 + idx) * 0.24;
          }
        }
        if (pBeam) {
          pBeam.visible = allSolved;
          if (allSolved) {
            (pBeam.material as THREE.MeshBasicMaterial).opacity =
              0.55 + Math.sin(elapsedVal * 4.0 - idx) * 0.22;
          }
        }
        if (mote) {
          mote.visible = allSolved;
          if (allSolved) {
            const [tx, tz] = LEVEL_6_TOWER_POSITIONS[idx] ?? isl.coords;
            const streamT = (elapsedVal * 0.72 + idx * 0.2) % 1;
            mote.position.set(
              tx * (1 - streamT),
              3.85 + (1.75 - 3.85) * streamT,
              tz * (1 - streamT)
            );
          }
        }
      });

      centerCoreOrb.rotation.y = elapsedVal * (allSolved ? 2.4 : 0.7);
      centerCoreHalo.rotation.x = Math.PI / 3 + Math.sin(elapsedVal * 1.8) * 0.35;
      centerCoreHalo.rotation.y = -elapsedVal * (allSolved ? 2.1 : 0.6);

      if (allSolved) {
        centerCoreOrbMat.color.setHex(0x6ee7b7);
        centerCoreOrbMat.emissive.setHex(0x10b981);
        centerCoreOrbMat.emissiveIntensity = 1.45 + Math.sin(elapsedVal * 5.0) * 0.35;
        centerCoreOrb.scale.setScalar(1.32 + Math.sin(elapsedVal * 4.2) * 0.1);
        centerCoreHaloMat.color.setHex(0xfde047);
        centerCoreHaloMat.emissive.setHex(0xf59e0b);
        centerSkyBeamMat.color.setHex(0x34d399);
        centerSkyBeamMat.opacity = 0.62 + Math.sin(elapsedVal * 4.5) * 0.18;
        centerSkyBeam.scale.set(1.6, 1.0, 1.6);
      } else {
        const frac = completedList.length / LEVEL_6_ISLANDS.length;
        centerCoreOrbMat.color.setHex(frac > 0 ? 0x34d399 : 0x38bdf8);
        centerCoreOrbMat.emissive.setHex(frac > 0 ? 0x059669 : 0x0284c7);
        centerCoreOrbMat.emissiveIntensity = 0.45 + frac * 0.45;
        centerCoreOrb.scale.setScalar(0.95 + frac * 0.2);
        centerCoreHaloMat.color.setHex(0x38bdf8);
        centerCoreHaloMat.emissive.setHex(0x0284c7);
        centerSkyBeamMat.opacity = 0.08 + frac * 0.12;
        centerSkyBeam.scale.set(0.85, 1.0, 0.85);
      }
    }

    function syncLevel2Visuals(l2v: Level2VisualState | undefined, elapsedVal: number) {
      const isPhoneView = typeof window !== 'undefined' && window.innerWidth < 768;
      const isPortraitPhone = isPhoneView && window.innerHeight > window.innerWidth;
      level2Group.scale.set(1, isPortraitPhone ? 1.18 : 1, isPhoneView ? 1.05 : 1);
      l2Sign.position.set(0, isPhoneView ? 4.15 : 4.95, isPhoneView ? -2.8 : -4.8);

      for (let pIdx = 0; pIdx < l2PedestalNodes.length; pIdx++) {
        const pNode = l2PedestalNodes[pIdx];
        const targetCoord = isPhoneView ? pNode.mobilePos : pNode.desktopPos;
        const pScale = isPhoneView ? 0.68 : 1.0;
        pNode.blockMesh.position.set(targetCoord[0], targetCoord[1], targetCoord[2]);
        pNode.blockMesh.scale.setScalar(pScale);
        pNode.sp.position.set(
          targetCoord[0],
          targetCoord[1] + (isPhoneView ? 0.66 : 0.95),
          targetCoord[2]
        );
      }

      const targetLen = Math.min(L2_MAX_SLOTS, Math.max(1, l2v?.targetLength ?? 6));
      const assembled = l2v?.assembledLetters ?? [];
      const isComplete = l2v?.phase === 'numeracy';
      const slotSpacing = 0.72;
      const startX = -((targetLen - 1) * slotSpacing) / 2;

      updateL2Banner(
        isComplete
          ? `✨ ${l2v?.targetWord || 'KATA'} TERBENTUK! ✨`
          : `BALOK HURUF 3D (${assembled.length}/${targetLen})`,
        isComplete
      );

      if (!isComplete && assembled.length < targetLen) {
        l2ActiveSlotGroup.visible = true;
        l2ActiveSlotGroup.position.x = startX + assembled.length * slotSpacing;
        l2AimPointer.position.y = 1.48 + Math.sin(elapsedVal * 6.0) * 0.08;
        l2AimRing.scale.setScalar(1.0 + Math.sin(elapsedVal * 5.5) * 0.1);
      } else {
        l2ActiveSlotGroup.visible = false;
      }

      for (let i = 0; i < L2_MAX_SLOTS; i++) {
        const node = l2SlotNodes[i];
        if (i >= targetLen) {
          node.root.visible = false;
          continue;
        }
        node.root.visible = true;
        node.root.position.x = startX + i * slotSpacing;

        const ch = (assembled[i] || '').toUpperCase();
        if (!ch) {
          node.emptyGroup.visible = true;
          node.filledGroup.visible = false;
          node.lastChar = '';
        } else {
          node.emptyGroup.visible = false;
          node.filledGroup.visible = true;
          const texKey = `${ch}_${isComplete ? '1' : '0'}`;
          if (node.lastChar !== texKey) {
            if (!node.lastChar.startsWith(`${ch}_`)) {
              node.popStart = elapsedVal;
            }
            node.lastChar = texKey;
            node.faceMat.map = getL2LetterTexture(ch, isComplete);
            node.faceMat.needsUpdate = true;
          }

          node.trimMat.color.setHex(isComplete ? 0x10b981 : 0xfbbf24);
          node.trimMat.emissive.setHex(isComplete ? 0x059669 : 0xd97706);
          node.glowPadMat.color.setHex(isComplete ? 0x34d399 : 0xf59e0b);
          node.glowPadMat.emissive.setHex(isComplete ? 0x10b981 : 0xf59e0b);

          const popAge = elapsedVal - node.popStart;
          if (popAge >= 0 && popAge < 0.36) {
            const p = popAge / 0.36;
            const scalePop = 0.65 + Math.sin(p * Math.PI) * 0.25 + p * 0.35;
            node.filledGroup.scale.setScalar(scalePop);
            node.filledGroup.position.y = (1 - p) * 0.32;
          } else {
            node.filledGroup.scale.setScalar(1);
            node.filledGroup.position.y = isComplete
              ? Math.sin(elapsedVal * 3.4 + i * 0.5) * 0.055
              : 0;
          }
        }
      }
    }

    // Independent per-viewport touch camera state (Slot 1 = Left/1P, Slot 2 = Right in 2P Split Mode)
    interface SlotTouchCameraState {
      touchPoints: Map<number, { x: number; y: number }>;
      zoomScale: number;
      panX: number;
      panZ: number;
      lastPinchDist: number | null;
      lastLevel: number;
      lastTapAt: number;
      gestureMovedSinceDown: boolean;
    }

    const createSlotTouchCameraState = (): SlotTouchCameraState => ({
      touchPoints: new Map<number, { x: number; y: number }>(),
      zoomScale: 1.0,
      panX: 0,
      panZ: 0,
      lastPinchDist: null,
      lastLevel: -1,
      lastTapAt: 0,
      gestureMovedSinceDown: false,
    });

    const slot1Touch = createSlotTouchCameraState();
    const slot2Touch = createSlotTouchCameraState();
    const pointerSlotMap = new Map<number, 1 | 2>();
    let lastMobilePage = '';
    let lastMobilePrologue = false;

    const resetSlotTouchCameraState = (st: SlotTouchCameraState, nextLevel: number) => {
      st.lastLevel = nextLevel;
      st.zoomScale = 1.0;
      st.panX = 0;
      st.panZ = 0;
      st.lastPinchDist = null;
      st.touchPoints.clear();
    };

    const applySlotCameraAdjust = (
      st: SlotTouchCameraState,
      pos: THREE.Vector3,
      look: THREE.Vector3,
      allowTouchAdjust: boolean
    ) => {
      if (!allowTouchAdjust) return;
      if (
        st.zoomScale === 1.0 &&
        Math.abs(st.panX) < 0.001 &&
        Math.abs(st.panZ) < 0.001
      ) {
        return;
      }
      look.x += st.panX;
      look.z += st.panZ;
      pos.x += st.panX;
      pos.z += st.panZ;
      if (st.zoomScale !== 1.0) {
        const ox = pos.x - look.x;
        const oy = pos.y - look.y;
        const oz = pos.z - look.z;
        pos.set(
          look.x + ox * st.zoomScale,
          Math.max(2.1, look.y + oy * st.zoomScale),
          look.z + oz * st.zoomScale
        );
      }
    };

    function animate() {
      if (unmounted) return;
      if (document.hidden) {
        frameId = window.setTimeout(animate, 250);
        return;
      }

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const cur = propsRef.current;
      const p2Lv = cur.p2CurrentLevel ?? cur.currentLevel;

      if (cur.page !== lastMobilePage || cur.prologueActive !== lastMobilePrologue) {
        lastMobilePage = cur.page;
        lastMobilePrologue = cur.prologueActive;
        resetSlotTouchCameraState(slot1Touch, cur.currentLevel);
        resetSlotTouchCameraState(slot2Touch, p2Lv);
        pointerSlotMap.clear();
      } else {
        if (cur.currentLevel !== slot1Touch.lastLevel) {
          resetSlotTouchCameraState(slot1Touch, cur.currentLevel);
        }
        if (p2Lv !== slot2Touch.lastLevel) {
          resetSlotTouchCameraState(slot2Touch, p2Lv);
        }
      }

      // Trigger independent camera shake per player slot
      if (cur.cameraShakeTrigger !== lastShakeSeed) {
        lastShakeSeed = cur.cameraShakeTrigger;
        shakeRemaining = 0.26;
      }
      if ((cur.p2CameraShakeTrigger ?? 0) !== lastShakeSeed2) {
        lastShakeSeed2 = cur.p2CameraShakeTrigger ?? 0;
        shakeRemaining2 = 0.26;
      }

      // Dynamically sync avatar headgear & nameplates from login state
      player1Avatar.peciMesh.visible = cur.avatarGender === 'male';
      player1Avatar.jilbabMesh.visible = cur.avatarGender === 'female';
      player1Avatar.updateNameTag?.(
        cur.gameMode === 'split'
          ? `P1: ${cur.playerName || 'Pemain 1'}`
          : cur.playerName || 'Penjaga Cilik'
      );

      const p2Gender = cur.avatar2Gender || 'female';
      player2Avatar.peciMesh.visible = p2Gender === 'male';
      player2Avatar.jilbabMesh.visible = p2Gender === 'female';
      player2Avatar.updateNameTag?.(
        cur.gameMode === 'split'
          ? `P2: ${cur.player2Name || 'Pemain 2'}`
          : 'Rekan Penjaga'
      );

      // Animate floating 3D trash indicator in Level 1
      floatingTrashGroup.position.y = 3.2 + Math.sin(elapsed * 3.2) * 0.22;
      floatingTrashGroup.rotation.y = elapsed * 1.1;

      // Update island atmosphere color based on Eco-Health
      const healthRatio = Math.min(1, Math.max(0, (cur.ecoHealth - 20) / 80));
      islandMat.color.lerpColors(new THREE.Color(0x4b5563), new THREE.Color(0x16a34a), healthRatio);

      // Update Player 1 Position & Walk/Idle/Jump Animation (smooth radial clamp inside island)
      const p1 = cur.playerPosRef.current;
      const p1Rad = Math.hypot(p1.x, p1.z);
      if (p1Rad > 25) {
        const s = 25 / p1Rad;
        p1.x *= s;
        p1.z *= s;
      }
      player1Avatar.group.position.x = p1.x;
      player1Avatar.group.position.z = p1.z;
      player1Avatar.group.rotation.y = p1.rotY;
      player1Avatar.heroRing.visible = cur.gameMode === 'split' && cur.page === 'arena' && !cur.prologueActive;

      if (p1.jumping) {
        player1Avatar.group.position.y = Math.abs(Math.sin(elapsed * 8)) * 1.1;
        player1Avatar.leftLeg.rotation.x = -0.45;
        player1Avatar.rightLeg.rotation.x = 0.45;
      } else if (p1.moving) {
        player1Avatar.group.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.08;
        const swing = Math.sin(elapsed * 10) * 0.55;
        player1Avatar.leftArm.rotation.x = swing;
        player1Avatar.rightArm.rotation.x = -swing;
        player1Avatar.leftLeg.rotation.x = -swing;
        player1Avatar.rightLeg.rotation.x = swing;
      } else {
        player1Avatar.group.position.y = 0;
        const breathe = Math.sin(elapsed * 2.5) * 0.04;
        player1Avatar.leftArm.rotation.x = breathe;
        player1Avatar.rightArm.rotation.x = -breathe;
        player1Avatar.leftLeg.rotation.x = 0;
        player1Avatar.rightLeg.rotation.x = 0;
      }

      // Update Player 2 Position & Walk/Idle/Jump Animation
      const p2 = cur.player2PosRef.current;
      player2Avatar.heroRing.visible = cur.gameMode === 'split' && cur.page === 'arena' && !cur.prologueActive;
      if (cur.gameMode === 'split') {
        const p2Rad = Math.hypot(p2.x, p2.z);
        if (p2Rad > 25) {
          const s2 = 25 / p2Rad;
          p2.x *= s2;
          p2.z *= s2;
        }
        player2Avatar.group.position.x = p2.x;
        player2Avatar.group.position.z = p2.z;
        player2Avatar.group.rotation.y = p2.rotY;

        if (p2.jumping) {
          player2Avatar.group.position.y = Math.abs(Math.sin(elapsed * 8)) * 1.1;
          player2Avatar.leftLeg.rotation.x = -0.45;
          player2Avatar.rightLeg.rotation.x = 0.45;
        } else if (p2.moving) {
          player2Avatar.group.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.08;
          const swing2 = Math.sin(elapsed * 10) * 0.55;
          player2Avatar.leftArm.rotation.x = swing2;
          player2Avatar.rightArm.rotation.x = -swing2;
          player2Avatar.leftLeg.rotation.x = -swing2;
          player2Avatar.rightLeg.rotation.x = swing2;
        } else {
          player2Avatar.group.position.y = 0;
          const breathe2 = Math.sin(elapsed * 2.5 + 1.2) * 0.04;
          player2Avatar.leftArm.rotation.x = breathe2;
          player2Avatar.rightArm.rotation.x = -breathe2;
          player2Avatar.leftLeg.rotation.x = 0;
          player2Avatar.rightLeg.rotation.x = 0;
        }
      } else {
        const patrolAngle = elapsed * 0.4;
        player2Avatar.group.position.set(
          Math.cos(patrolAngle) * 4.5,
          0,
          Math.sin(patrolAngle) * 4.5
        );
        player2Avatar.group.rotation.y = -patrolAngle;
      }

      // Sync randomized Level 4 & Level 5 NPC anchor coordinates
      const activeL4Positions =
        cur.l4Positions && cur.l4Positions.length === LEVEL_4_CITIZENS.length
          ? cur.l4Positions
          : l4DefaultPositions;
      for (let i = 0; i < citizenAnchors.length; i++) {
        const [ax, az] = activeL4Positions[i] || l4DefaultPositions[i];
        citizenAnchors[i].position.set(ax, 0, az);
      }

      const activeL5Positions =
        cur.l5Positions && cur.l5Positions.length === LEVEL_5_ZONES.length
          ? cur.l5Positions
          : l5DefaultPositions;
      for (let i = 0; i < zoneAnchors.length; i++) {
        const [ax, az] = activeL5Positions[i] || l5DefaultPositions[i];
        zoneAnchors[i].position.set(ax, 0, az);
      }

      // Level 4 Proximity Detection for Player 1
      const inArena = cur.page === 'arena' && !cur.prologueActive;
      if (inArena && cur.currentLevel === 4 && cur.onNearbyCitizenChange) {
        const foundIdx = findNearestCitizenIndex(p1.x, p1.z, activeL4Positions);
        if (foundIdx !== lastNearestCitizenRef.current) {
          lastNearestCitizenRef.current = foundIdx;
          cur.onNearbyCitizenChange(foundIdx);
        }
      } else if (lastNearestCitizenRef.current !== null && cur.onNearbyCitizenChange) {
        lastNearestCitizenRef.current = null;
        cur.onNearbyCitizenChange(null);
      }

      // Level 4 Proximity Detection for Player 2 (independent in 2P mode)
      const p2Level = cur.p2CurrentLevel ?? cur.currentLevel;
      if (
        inArena &&
        cur.gameMode === 'split' &&
        p2Level === 4 &&
        cur.onP2NearbyCitizenChange
      ) {
        const foundP2Idx = findNearestCitizenIndex(p2.x, p2.z, activeL4Positions);
        if (foundP2Idx !== lastP2NearestCitizenRef.current) {
          lastP2NearestCitizenRef.current = foundP2Idx;
          cur.onP2NearbyCitizenChange(foundP2Idx);
        }
      } else if (lastP2NearestCitizenRef.current !== null && cur.onP2NearbyCitizenChange) {
        lastP2NearestCitizenRef.current = null;
        cur.onP2NearbyCitizenChange(null);
      }

      // Level 5 Proximity Detection for Player 1
      if (inArena && cur.currentLevel === 5 && cur.onNearbyZoneChange) {
        const foundZoneIdx = findNearestCitizenIndex(p1.x, p1.z, activeL5Positions);
        if (foundZoneIdx !== lastNearestZoneRef.current) {
          lastNearestZoneRef.current = foundZoneIdx;
          cur.onNearbyZoneChange(foundZoneIdx);
        }
      } else if (lastNearestZoneRef.current !== null && cur.onNearbyZoneChange) {
        lastNearestZoneRef.current = null;
        cur.onNearbyZoneChange(null);
      }

      // Level 5 Proximity Detection for Player 2 (independent in 2P mode)
      if (
        inArena &&
        cur.gameMode === 'split' &&
        p2Level === 5 &&
        cur.onP2NearbyZoneChange
      ) {
        const foundP2ZoneIdx = findNearestCitizenIndex(p2.x, p2.z, activeL5Positions);
        if (foundP2ZoneIdx !== lastP2NearestZoneRef.current) {
          lastP2NearestZoneRef.current = foundP2ZoneIdx;
          cur.onP2NearbyZoneChange(foundP2ZoneIdx);
        }
      } else if (lastP2NearestZoneRef.current !== null && cur.onP2NearbyZoneChange) {
        lastP2NearestZoneRef.current = null;
        cur.onP2NearbyZoneChange(null);
      }

      // Level 6 Proximity & Physical Touch Detection for Player 1
      if (inArena && cur.level1IntroPhase === 'core_game' && cur.currentLevel === 6) {
        if (cur.onNearbyIslandChange) {
          const foundIslandIdx = findNearestCitizenIndex(
            p1.x,
            p1.z,
            LEVEL_6_TOWER_POSITIONS,
            LEVEL_6_INTERACT_RADIUS
          );
          if (foundIslandIdx !== lastNearestIslandRef.current) {
            lastNearestIslandRef.current = foundIslandIdx;
            cur.onNearbyIslandChange(foundIslandIdx);
          }
        }
        if (cur.onIslandTouch) {
          const touchRes = detectTowerTouchTrigger(
            p1.x,
            p1.z,
            lastTouchIslandRef.current,
            cur.completedIslands
          );
          lastTouchIslandRef.current = touchRes.nextLastTouchedIdx;
          if (touchRes.triggeredIdx !== null) {
            cur.onIslandTouch(touchRes.triggeredIdx);
          }
        }
      } else {
        if (lastNearestIslandRef.current !== null && cur.onNearbyIslandChange) {
          lastNearestIslandRef.current = null;
          cur.onNearbyIslandChange(null);
        }
        lastTouchIslandRef.current = null;
      }

      // Level 6 Proximity & Physical Touch Detection for Player 2 (independent in 2P mode)
      if (
        inArena &&
        cur.level1IntroPhase === 'core_game' &&
        cur.gameMode === 'split' &&
        p2Level === 6
      ) {
        if (cur.onP2NearbyIslandChange) {
          const foundP2IslandIdx = findNearestCitizenIndex(
            p2.x,
            p2.z,
            LEVEL_6_TOWER_POSITIONS,
            LEVEL_6_INTERACT_RADIUS
          );
          if (foundP2IslandIdx !== lastP2NearestIslandRef.current) {
            lastP2NearestIslandRef.current = foundP2IslandIdx;
            cur.onP2NearbyIslandChange(foundP2IslandIdx);
          }
        }
        if (cur.onP2IslandTouch) {
          const touchRes2 = detectTowerTouchTrigger(
            p2.x,
            p2.z,
            lastP2TouchIslandRef.current,
            cur.p2CompletedIslands ?? []
          );
          lastP2TouchIslandRef.current = touchRes2.nextLastTouchedIdx;
          if (touchRes2.triggeredIdx !== null) {
            cur.onP2IslandTouch(touchRes2.triggeredIdx);
          }
        }
      } else {
        if (lastP2NearestIslandRef.current !== null && cur.onP2NearbyIslandChange) {
          lastP2NearestIslandRef.current = null;
          cur.onP2NearbyIslandChange(null);
        }
        lastP2TouchIslandRef.current = null;
      }

      const isPreLevelNarration =
        inArena && cur.level1IntroPhase !== 'core_game';

      // Hide general school building during Prologue and during Pre-Level Location Intro so each level's own 3D environment shines
      schoolGroup.visible = !cur.prologueActive && !isPreLevelNarration;
      roadNS.visible = !cur.prologueActive && !(isPreLevelNarration && cur.currentLevel === 6);
      roadEW.visible = !cur.prologueActive && !(isPreLevelNarration && cur.currentLevel === 6);
      checkpointPad.visible = !cur.prologueActive && !(isPreLevelNarration && cur.currentLevel === 6);
      const isMobileLv2 =
        inArena && cur.currentLevel === 2 && typeof window !== 'undefined' && window.innerWidth < 768;
      trunkInstanced.visible =
        !cur.prologueActive &&
        !(isPreLevelNarration && cur.currentLevel === 6) &&
        !(inArena && cur.currentLevel === 3) &&
        !isMobileLv2;
      crownInstanced.visible =
        !cur.prologueActive &&
        !(isPreLevelNarration && cur.currentLevel === 6) &&
        !(inArena && cur.currentLevel === 3) &&
        !isMobileLv2;
      prologueWorldGroup.visible = cur.prologueActive;
      level6IntroMapGroup.visible = isPreLevelNarration && cur.currentLevel === 6;

      const clearSpots: [number, number][] = [];
      if (inArena && (cur.currentLevel === 4 || (cur.gameMode === 'split' && cur.p2CurrentLevel === 4))) {
        activeL4Positions.forEach((p) => clearSpots.push(p));
      }
      if (inArena && (cur.currentLevel === 5 || (cur.gameMode === 'split' && cur.p2CurrentLevel === 5))) {
        activeL5Positions.forEach((p) => {
          clearSpots.push(p);
          clearSpots.push([p[0], p[1] - 2.1]);
        });
      }
      if (inArena && (cur.currentLevel === 6 || (cur.gameMode === 'split' && cur.p2CurrentLevel === 6))) {
        clearSpots.push([0, 0]);
        LEVEL_6_TOWER_POSITIONS.forEach((p) => clearSpots.push(p));
      }
      updateInstancedTrees(clearSpots);

      if (!cur.prologueActive && !(isPreLevelNarration && cur.currentLevel === 6) && (lastPrologueStage !== 0 || wasL6MapTheme)) {
        lastPrologueStage = 0;
        wasL6MapTheme = false;
        scene.background = defaultSkyColor;
        (scene.fog as THREE.FogExp2).color.copy(defaultSkyColor);
        oceanMat.color.setHex(0x0284c7);
        if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = true;
        if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = true;
      }

      if (isPreLevelNarration) {
        // =====================================================================
        // ALUR PRA-LEVEL (LEVEL 1..6) — SATU LAYAR TENGAH PENUH (TERMASUK MODE 2P)
        // =====================================================================
        wasSplitArena = false;
        camera.fov = 50;
        camera2.fov = 50;
        camera.clearViewOffset();
        camera2.clearViewOffset();
        renderer.setScissorTest(false);

        level1Group.visible = cur.currentLevel === 1;
        level1Group.position.set(0, 0, 0);
        level2Group.visible = cur.currentLevel === 2;
        level3Group.visible = cur.currentLevel === 3;
        level4Group.visible = cur.currentLevel === 4;
        level5Group.visible = cur.currentLevel === 5;
        level6Group.visible = false;

        if (level2Group.visible) {
          const targetLen = L2_MAX_SLOTS - 1;
          const slotSpacing = 0.72;
          const startX = -((targetLen - 1) * slotSpacing) / 2;
          updateL2Banner('BALOK HURUF 3D (0/6)', false);
          for (let i = 0; i < L2_MAX_SLOTS; i++) {
            const node = l2SlotNodes[i];
            node.root.visible = i < targetLen;
            node.root.position.x = startX + i * slotSpacing;
            node.emptyGroup.visible = true;
            node.filledGroup.visible = false;
            node.lastChar = '';
          }
        }
        if (level3Group.visible) {
          syncLevel3ClawVisual(
            p1ClawAnim,
            Math.sin(elapsed * 0.95) * 0.55,
            false,
            cur.clawItemIndex ?? 0,
            'claw',
            dt,
            elapsed
          );
        }

        if (cur.currentLevel === 6) {
          // ===================================================================
          // PEMBUKAAN LEVEL 6: PENAMPAKAN PETA NUSANTARA 3D (1 LAYAR PENUH SEBELUM SPLIT)
          // 1) 0..2.8s   : Kamera Melayang di Atas Panorama Peta
          // 2) 2.8..5.4s : Kamera Menukik Tajam, Tanah Retak, Warna Kelabu, Gemuruh Bumi
          // 3) 5.4..12s+ : Kamera Mengorbit ke Titik-Titik Merah Satu Per Satu
          // ===================================================================
          wasL6MapTheme = true;
          player1Avatar.group.visible = false;
          player2Avatar.group.visible = false;

          if (!wasL1HouseIntro || lastLookingLevel !== 6) {
            wasL1HouseIntro = true;
            lastLookingLevel = 6;
            lookingPhaseStartTime = elapsed;
            camera.position.set(-6.0, 17.5, 19.5);
            currentLook.set(0, 0.5, 0);
          }

          const l6IntroElapsed = Math.max(0, elapsed - lookingPhaseStartTime);

          if (cur.level1IntroPhase === 'looking') {
            if (l6IntroElapsed < 2.8) {
              // Beat 1: Panorama Peta Cerah dari Atas
              const panT = l6IntroElapsed / 2.8;
              l6IntroCrackGroup.visible = false;
              l6AshVeilMat.opacity = 0;
              l6MapRimMat.color.setHex(0x38bdf8);
              l6MapRimMat.emissive.setHex(0x0284c7);
              scene.background = skyColorHarmony;
              (scene.fog as THREE.FogExp2).color.copy(skyColorHarmony);
              oceanMat.color.copy(l6OceanVibrant);
              islandMat.color.copy(l6IslandVibrant);
              l6MapMat.color.copy(l6MapColorVibrant);

              camTargetPos.set(-6.0 + panT * 12.0, 16.5 - panT * 1.2, 18.5 - panT * 2.0);
              camLookTarget.set(-1.5 + panT * 3.0, 0.55, 0);
            } else if (l6IntroElapsed < 5.4) {
              // Beat 2: Menukik Tajam, Tanah Retak, Warna Kelabu, Gemuruh Bumi
              const diveT = Math.min(1, (l6IntroElapsed - 2.8) / 1.45);
              const easeDive = 1 - Math.pow(1 - diveT, 3);
              l6IntroCrackGroup.visible = true;
              l6IntroCrackGlowMat.emissiveIntensity = 1.15 + Math.sin(elapsed * 9.0) * 0.45;
              l6AshVeilMat.opacity = 0.48 * easeDive;
              l6MapRimMat.color.setHex(0x64748b);
              l6MapRimMat.emissive.setHex(0x334155);
              scene.background = skyColorCrisis;
              (scene.fog as THREE.FogExp2).color.copy(skyColorCrisis);
              oceanMat.color.lerpColors(l6OceanVibrant, l6OceanCrisisGray, easeDive);
              islandMat.color.lerpColors(l6IslandVibrant, l6IslandCrisisGray, easeDive);
              l6MapMat.color.lerpColors(l6MapColorVibrant, l6MapColorAshGray, easeDive);

              camTargetPos.set(
                (1 - easeDive) * 4.5,
                15.3 - easeDive * 8.4,
                16.5 - easeDive * 6.5
              );
              camLookTarget.set(0, 0.55, 0.4);
              shakeRemaining = 0.25;
            } else {
              // Beat 3: Kamera Mengorbit ke Titik-Titik Merah Satu Per Satu (5 titik)
              l6IntroCrackGroup.visible = true;
              l6IntroCrackGlowMat.emissiveIntensity = 1.05 + Math.sin(elapsed * 7.5) * 0.35;
              l6AshVeilMat.opacity = 0.48;
              l6MapRimMat.color.setHex(0x64748b);
              l6MapRimMat.emissive.setHex(0x334155);
              scene.background = skyColorCrisis;
              (scene.fog as THREE.FogExp2).color.copy(skyColorCrisis);
              oceanMat.color.copy(l6OceanCrisisGray);
              islandMat.color.copy(l6IslandCrisisGray);
              l6MapMat.color.copy(l6MapColorAshGray);

              const tourElapsed = l6IntroElapsed - 5.4;
              const perPointSec = 1.32;
              const visitFloat = Math.min(l6IntroBeaconCoords.length - 0.001, tourElapsed / perPointSec);
              const activeVisitIdx = Math.floor(visitFloat);
              const localOrbitT = visitFloat - activeVisitIdx;
              const [bx, bz] = l6IntroBeaconCoords[activeVisitIdx];
              // Front-facing sweeping orbit arc so map text always reads upright while circling each red beacon
              const orbitTheta = -0.68 + localOrbitT * 1.36;
              const orbitR = 5.2;

              camTargetPos.set(
                bx + Math.sin(orbitTheta) * orbitR,
                4.9 + Math.sin(localOrbitT * Math.PI) * 0.7,
                bz + Math.cos(orbitTheta) * orbitR
              );
              camLookTarget.set(bx, 1.15, bz);
            }

            l6IntroBeacons.forEach((bObj, idx) => {
              const visitIdx =
                l6IntroElapsed >= 5.4
                  ? Math.min(l6IntroBeaconCoords.length - 1, Math.floor((l6IntroElapsed - 5.4) / 1.32))
                  : -1;
              const isSpotlight = visitIdx === idx;
              const pulse = 0.5 + 0.5 * Math.sin(elapsed * (isSpotlight ? 10.5 : 7.0) + idx);
              bObj.halo.scale.setScalar((isSpotlight ? 1.55 : 1.0) + pulse * 0.42);
              bObj.orb.rotation.y = elapsed * 2.5 + idx;
              bObj.orb.position.y = 1.65 + Math.sin(elapsed * 4.5 + idx) * 0.16;
              (bObj.beam.material as THREE.MeshBasicMaterial).opacity =
                (isSpotlight ? 0.72 : 0.32) + pulse * 0.25;
              bObj.beam.scale.setScalar(isSpotlight ? 1.28 : 0.95);
            });
          } else {
            // Tahap Narasi Pembukaan Level 6: Orbit pelan di atas Peta Nusantara + 5 Titik Merah di atas kotak narasi
            wasL1HouseIntro = true;
            l6IntroCrackGroup.visible = true;
            l6AshVeilMat.opacity = 0.44;
            l6MapRimMat.color.setHex(0x64748b);
            l6MapRimMat.emissive.setHex(0x334155);
            scene.background = skyColorCrisis;
            (scene.fog as THREE.FogExp2).color.copy(skyColorCrisis);
            oceanMat.color.copy(l6OceanCrisisGray);
            islandMat.color.copy(l6IslandCrisisGray);
            l6MapMat.color.copy(l6MapColorAshGray);

            const focusIdx = Math.floor(elapsed / 2.6) % l6IntroBeaconCoords.length;
            const [bx, bz] = l6IntroBeaconCoords[focusIdx];
            const sweepAngle = elapsed * 0.42;
            camTargetPos.set(
              bx * 0.45 + Math.sin(sweepAngle) * 11.5,
              11.8,
              bz * 0.45 + Math.cos(sweepAngle) * 12.0 + 3.2
            );
            camLookTarget.set(bx * 0.4, 0.8, bz * 0.4);

            l6IntroBeacons.forEach((bObj, idx) => {
              const isFocus = idx === focusIdx;
              const pulse = 0.5 + 0.5 * Math.sin(elapsed * 7.5 + idx);
              bObj.halo.scale.setScalar((isFocus ? 1.45 : 1.0) + pulse * 0.35);
              bObj.orb.rotation.y = elapsed * 2.2 + idx;
              (bObj.beam.material as THREE.MeshBasicMaterial).opacity =
                (isFocus ? 0.68 : 0.35) + pulse * 0.2;
              bObj.beam.scale.setScalar(isFocus ? 1.2 : 0.95);
            });
          }
        } else {
          // Blocky stands in Level 1-5 environment looking around as seen from the approaching aerial camera
          const lookScan = Math.sin(elapsed * 2.2) * 0.42;
          player1Avatar.group.visible = true;
          player1Avatar.group.position.set(cur.gameMode === 'split' ? -1.35 : 0, 0, 2.35);
          player1Avatar.group.rotation.y = Math.PI + lookScan * 0.45;
          player1Avatar.headGroup.rotation.y = lookScan * 0.65;
          player1Avatar.headGroup.rotation.x = 0.16;
          player1Avatar.leftArm.rotation.x = -0.35 + Math.sin(elapsed * 3) * 0.12;
          player1Avatar.rightArm.rotation.x = -0.25 - Math.sin(elapsed * 3) * 0.12;

          if (cur.gameMode === 'split') {
            player2Avatar.group.visible = true;
            player2Avatar.group.position.set(1.35, 0, 2.35);
            player2Avatar.group.rotation.y = Math.PI - lookScan * 0.45;
            player2Avatar.headGroup.rotation.y = -lookScan * 0.65;
            player2Avatar.headGroup.rotation.x = 0.16;
            player2Avatar.leftArm.rotation.x = -0.25 + Math.cos(elapsed * 3) * 0.12;
            player2Avatar.rightArm.rotation.x = -0.35 - Math.cos(elapsed * 3) * 0.12;
          } else {
            player2Avatar.group.visible = false;
          }

          if (cur.level1IntroPhase === 'looking') {
            if (!wasL1HouseIntro || lastLookingLevel !== cur.currentLevel) {
              wasL1HouseIntro = true;
              lastLookingLevel = cur.currentLevel;
              lookingPhaseStartTime = elapsed;
              camera.position.set(0, 20.5, 23.0);
              currentLook.set(0, 0.4, -2.2);
            }

            const zoomElapsed = Math.max(0, elapsed - lookingPhaseStartTime);
            const zoomT = Math.min(1, zoomElapsed / 12.0);
            const easeZoom = 1 - Math.pow(1 - zoomT, 1.65);

            const approachY = 20.5 - easeZoom * 13.8;
            const approachZ = 23.0 - easeZoom * 14.4;
            const sweepX = Math.sin(zoomT * Math.PI) * 2.6 * (1 - zoomT * 0.5);

            camTargetPos.set(sweepX, approachY, approachZ);
            camLookTarget.set(0, 0.4 + easeZoom * 0.55, -2.2 + easeZoom * 1.3);
          } else {
            wasL1HouseIntro = true;
            camTargetPos.set(
              Math.sin(elapsed * 0.55) * 0.95,
              6.7 + Math.sin(elapsed * 1.1) * 0.22,
              8.6
            );
            camLookTarget.set(0, 0.95, -0.9);
          }
        }

        const w = container?.clientWidth || window.innerWidth;
        const h = container?.clientHeight || window.innerHeight;
        const mobilePreFixedSpec =
          cur.currentLevel === 3
            ? computeMobileLevel3CameraSpec(w, h, false)
            : cur.currentLevel === 2
            ? computeMobileLevel2CameraSpec(w, h, false)
            : null;

        if (mobilePreFixedSpec) {
          // On mobile (<768px) in Level 2/3 pre-level intro, keep the 3D mechanic clearly visible in the upper screen
          player1Avatar.group.visible = false;
          player2Avatar.group.visible = false;
          camera.fov = mobilePreFixedSpec.fov;
          const zoomElapsed = Math.max(0, elapsed - lookingPhaseStartTime);
          const zoomT =
            cur.level1IntroPhase === 'looking' ? Math.min(1, zoomElapsed / 6.0) : 1;
          const easeZoom = 1 - Math.pow(1 - zoomT, 2);
          camTargetPos.set(
            Math.sin(elapsed * 0.65) * 0.45 * (1 - easeZoom * 0.5),
            mobilePreFixedSpec.camPos[1] + (1 - easeZoom) * 3.2,
            mobilePreFixedSpec.camPos[2] + (1 - easeZoom) * 3.8
          );
          camLookTarget.set(
            mobilePreFixedSpec.lookAt[0],
            mobilePreFixedSpec.lookAt[1],
            mobilePreFixedSpec.lookAt[2]
          );
        }

        renderer.setViewport(0, 0, w, h);
        camera.aspect = w / h;
        if (mobilePreFixedSpec) {
          camera.setViewOffset(
            w,
            h,
            0,
            Math.floor(h * mobilePreFixedSpec.viewOffsetYFrac),
            w,
            h
          );
        } else if (cur.currentLevel === 6 && cur.level1IntroPhase === 'narration') {
          camera.setViewOffset(w, h, 0, Math.floor(h * 0.12), w, h);
        } else {
          camera.clearViewOffset();
        }
        camera.updateProjectionMatrix();

        const introLerp = isSoftwareGl ? 0.55 : 0.16;

        camera.position.x += (camTargetPos.x - camera.position.x) * introLerp;
        camera.position.y += (camTargetPos.y - camera.position.y) * introLerp;
        camera.position.z += (camTargetPos.z - camera.position.z) * introLerp;
        currentLook.x += (camLookTarget.x - currentLook.x) * introLerp;
        currentLook.y += (camLookTarget.y - currentLook.y) * introLerp;
        currentLook.z += (camLookTarget.z - currentLook.z) * introLerp;

        if (shakeRemaining > 0) {
          shakeRemaining = Math.max(0, shakeRemaining - dt);
          const amp = 0.24;
          camera.position.x += Math.sin(elapsed * 42) * amp * 0.65 + (Math.random() - 0.5) * amp;
          camera.position.y += Math.cos(elapsed * 38) * amp * 0.65 + (Math.random() - 0.5) * amp;
        }

        camera.lookAt(currentLook);
        renderer.render(scene, camera);
      } else if (cur.gameMode === 'split' && inArena) {
        wasL1HouseIntro = false;
        lastLookingLevel = 0;
        player1Avatar.headGroup.rotation.set(0, 0, 0);
        player2Avatar.headGroup.rotation.set(0, 0, 0);
        if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = true;
        if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = true;

        const fullW = container?.clientWidth || window.innerWidth;
        const fullH = container?.clientHeight || window.innerHeight;
        const halfW = Math.floor(fullW / 2);
        const splitAspect = Math.max(0.45, halfW / fullH);
        const adaptiveSplitFov = Math.min(
          72,
          Math.max(
            54,
            THREE.MathUtils.radToDeg(
              2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / splitAspect)
            )
          )
        );
        const viewShiftX = fullW >= 900 ? Math.floor(halfW * 0.27) : 0;
        const camLerp = !wasSplitArena ? 1.0 : isSoftwareGl ? 0.68 : 0.22;
        wasSplitArena = true;

        renderer.setScissorTest(true);

        // =====================================================================
        // LAYAR KIRI (VIEWPORT 1): SEMUA KARAKTER UTAMA (P1 & P2) SELALU TERLIHAT
        // =====================================================================
        player1Avatar.group.visible = true;
        player2Avatar.group.visible = true;

        level1Group.visible = cur.currentLevel === 1;
        level1Group.position.set(0, 0, 0);
        level2Group.visible = cur.currentLevel === 2;
        level3Group.visible = cur.currentLevel === 3;
        level4Group.visible = cur.currentLevel === 4;
        level5Group.visible = cur.currentLevel === 5;
        level6Group.visible = cur.currentLevel === 6;

        schoolGroup.visible = !level1Group.visible && !level2Group.visible && !level3Group.visible && !level5Group.visible && !level6Group.visible;
        roadNS.visible = !level3Group.visible;
        roadEW.visible = !level3Group.visible;
        trunkInstanced.visible = !level3Group.visible && !(level2Group.visible && fullW < 768);
        crownInstanced.visible = !level3Group.visible && !(level2Group.visible && fullW < 768);
        checkpointPad.visible = !level1Group.visible && !level2Group.visible && !level3Group.visible && !level6Group.visible;

        if (level2Group.visible) {
          syncLevel2Visuals(cur.level2Visual, elapsed);
        }
        if (level3Group.visible) {
          syncLevel3ClawVisual(
            p1ClawAnim,
            cur.clawX,
            cur.clawGrabbing,
            cur.clawItemIndex ?? 0,
            cur.clawPhase ?? 'claw',
            dt,
            elapsed
          );
        }
        if (level4Group.visible) {
          syncLevel4Visuals(cur.completedCitizens, lastNearestCitizenRef.current, elapsed);
        }
        if (level5Group.visible) {
          syncLevel5Visuals(cur.completedZones, lastNearestZoneRef.current, elapsed);
        }
        if (level6Group.visible) {
          syncLevel6Visuals(cur.completedIslands, lastNearestIslandRef.current, elapsed);
        }

        const p1HasBottomDeck = cur.currentLevel === 1 || cur.currentLevel === 2 || cur.currentLevel === 3;
        const p1HasSidePanel = !p1HasBottomDeck && Boolean(cur.p1DialogOpen);

        let p1SafeMinX = -0.86;
        let p1SafeMaxX = 0.86;
        let p1SafeMinY = -0.68;
        let p1SafeMaxY = 0.58;

        const p1MobileFixed =
          cur.currentLevel === 3
            ? computeMobileLevel3CameraSpec(fullW, fullH, true)
            : cur.currentLevel === 2
            ? computeMobileLevel2CameraSpec(fullW, fullH, true)
            : null;

        renderer.setViewport(0, 0, halfW, fullH);
        renderer.setScissor(0, 0, halfW, fullH);
        camera.fov = p1MobileFixed ? p1MobileFixed.fov : adaptiveSplitFov;
        camera.aspect = halfW / fullH;
        if (p1HasBottomDeck) {
          // Bottom card covers lower ~48%; shift 3D scene upward into upper unobstructed half
          const yFrac = p1MobileFixed ? p1MobileFixed.viewOffsetYFrac : 0.175;
          camera.setViewOffset(halfW, fullH, 0, Math.floor(fullH * yFrac), halfW, fullH);
          p1SafeMinX = -0.88;
          p1SafeMaxX = 0.88;
          p1SafeMinY = -0.02;
          p1SafeMaxY = 0.68;
        } else if (p1HasSidePanel && viewShiftX > 0) {
          // P1's dialog/L6 card sits on RIGHT side of Left Pane -> positive offsetX shifts 3D world to open LEFT half!
          camera.setViewOffset(halfW, fullH, viewShiftX, 0, halfW, fullH);
          p1SafeMinX = -0.90;
          p1SafeMaxX = -0.14;
          p1SafeMinY = -0.66;
          p1SafeMaxY = 0.28;
        } else if (p1HasSidePanel) {
          camera.setViewOffset(halfW, fullH, 0, Math.floor(fullH * 0.16), halfW, fullH);
          p1SafeMinY = -0.05;
          p1SafeMaxY = 0.64;
        } else {
          camera.clearViewOffset();
        }
        camera.updateProjectionMatrix();

        if (p1MobileFixed) {
          player1Avatar.group.visible = false;
          player2Avatar.group.visible = false;
          camTargetPos.set(p1MobileFixed.camPos[0], p1MobileFixed.camPos[1], p1MobileFixed.camPos[2]);
          camLookTarget.set(p1MobileFixed.lookAt[0], p1MobileFixed.lookAt[1], p1MobileFixed.lookAt[2]);
        } else {
          computePlayerCamera(
            cur.currentLevel,
            p1.x,
            p1.z,
            elapsed,
            camTargetPos,
            camLookTarget,
            true,
            p2.x,
            p2.z
          );
          fitSplitCameraToBothPlayers(
            camera,
            camTargetPos,
            camLookTarget,
            p1.x,
            player1Avatar.group.position.y,
            p1.z,
            p2.x,
            player2Avatar.group.position.y,
            p2.z,
            p1SafeMinX,
            p1SafeMaxX,
            p1SafeMinY,
            p1SafeMaxY
          );
        }

        const mobileCameraAdjusted =
          slot1Touch.zoomScale !== 1.0 ||
          Math.abs(slot1Touch.panX) >= 0.001 ||
          Math.abs(slot1Touch.panZ) >= 0.001;
        applySlotCameraAdjust(slot1Touch, camTargetPos, camLookTarget, true);
        const splitCamLerp1 =
          slot1Touch.touchPoints.size > 0
            ? Math.max(camLerp, 0.34)
            : camLerp;

        camera.position.x += (camTargetPos.x - camera.position.x) * splitCamLerp1;
        camera.position.y += (camTargetPos.y - camera.position.y) * splitCamLerp1;
        camera.position.z += (camTargetPos.z - camera.position.z) * splitCamLerp1;
        currentLook.x += (camLookTarget.x - currentLook.x) * splitCamLerp1;
        currentLook.y += (camLookTarget.y - currentLook.y) * splitCamLerp1;
        currentLook.z += (camLookTarget.z - currentLook.z) * splitCamLerp1;

        // Hard post-lerp guarantee: neither P1 nor P2 can clip out of Left Viewport even during rapid motion
        if (!mobileCameraAdjusted && !p1MobileFixed) {
          fitSplitCameraToBothPlayers(
            camera,
            camera.position,
            currentLook,
            p1.x,
            player1Avatar.group.position.y,
            p1.z,
            p2.x,
            player2Avatar.group.position.y,
            p2.z,
            p1SafeMinX,
            p1SafeMaxX,
            p1SafeMinY,
            p1SafeMaxY
          );
        }
        if (shakeRemaining > 0) {
          shakeRemaining = Math.max(0, shakeRemaining - dt);
          const amp = 0.22;
          camera.position.x += Math.sin(elapsed * 42) * amp * 0.65 + (Math.random() - 0.5) * amp;
          camera.position.y += Math.cos(elapsed * 38) * amp * 0.65 + (Math.random() - 0.5) * amp;
        }
        camera.lookAt(currentLook);
        renderer.render(scene, camera);

        // =====================================================================
        // LAYAR KANAN (VIEWPORT 2): SEMUA KARAKTER UTAMA (P1 & P2) SELALU TERLIHAT
        // =====================================================================
        player1Avatar.group.visible = true;
        player2Avatar.group.visible = true;

        level1Group.visible = p2Level === 1;
        level1Group.position.set(0, 0, 0);
        level2Group.visible = p2Level === 2;
        level3Group.visible = p2Level === 3;
        level4Group.visible = p2Level === 4;
        level5Group.visible = p2Level === 5;
        level6Group.visible = p2Level === 6;

        schoolGroup.visible = !level1Group.visible && !level2Group.visible && !level3Group.visible && !level5Group.visible && !level6Group.visible;
        roadNS.visible = !level3Group.visible;
        roadEW.visible = !level3Group.visible;
        trunkInstanced.visible = !level3Group.visible && !(level2Group.visible && fullW < 768);
        crownInstanced.visible = !level3Group.visible && !(level2Group.visible && fullW < 768);
        checkpointPad.visible = !level1Group.visible && !level2Group.visible && !level3Group.visible && !level6Group.visible;

        if (level2Group.visible) {
          syncLevel2Visuals(cur.p2Level2Visual, elapsed);
        }
        if (level3Group.visible) {
          syncLevel3ClawVisual(
            p2ClawAnim,
            cur.p2ClawX ?? cur.clawX,
            cur.p2ClawGrabbing ?? false,
            cur.p2ClawItemIndex ?? 1,
            cur.p2ClawPhase ?? 'claw',
            dt,
            elapsed
          );
        }
        if (level4Group.visible) {
          syncLevel4Visuals(cur.p2CompletedCitizens ?? [], lastP2NearestCitizenRef.current, elapsed);
        }
        if (level5Group.visible) {
          syncLevel5Visuals(cur.p2CompletedZones ?? [], lastP2NearestZoneRef.current, elapsed);
        }
        if (level6Group.visible) {
          syncLevel6Visuals(cur.p2CompletedIslands ?? [], lastP2NearestIslandRef.current, elapsed);
        }

        const p2HasBottomDeck = p2Level === 1 || p2Level === 2 || p2Level === 3;
        const p2HasSidePanel = !p2HasBottomDeck && Boolean(cur.p2DialogOpen);

        let p2SafeMinX = -0.86;
        let p2SafeMaxX = 0.86;
        let p2SafeMinY = -0.68;
        let p2SafeMaxY = 0.58;

        const p2MobileFixed =
          p2Level === 3
            ? computeMobileLevel3CameraSpec(fullW, fullH, true)
            : p2Level === 2
            ? computeMobileLevel2CameraSpec(fullW, fullH, true)
            : null;

        renderer.setViewport(halfW, 0, halfW, fullH);
        renderer.setScissor(halfW, 0, halfW, fullH);
        camera2.fov = p2MobileFixed ? p2MobileFixed.fov : adaptiveSplitFov;
        camera2.aspect = halfW / fullH;
        if (p2HasBottomDeck) {
          const yFrac2 = p2MobileFixed ? p2MobileFixed.viewOffsetYFrac : 0.175;
          camera2.setViewOffset(halfW, fullH, 0, Math.floor(fullH * yFrac2), halfW, fullH);
          p2SafeMinX = -0.88;
          p2SafeMaxX = 0.88;
          p2SafeMinY = -0.02;
          p2SafeMaxY = 0.68;
        } else if (p2HasSidePanel && viewShiftX > 0) {
          // P2's dialog/L6 card sits on LEFT side of Right Pane -> negative offsetX shifts 3D world to open RIGHT half!
          camera2.setViewOffset(halfW, fullH, -viewShiftX, 0, halfW, fullH);
          p2SafeMinX = 0.14;
          p2SafeMaxX = 0.90;
          p2SafeMinY = -0.66;
          p2SafeMaxY = 0.28;
        } else if (p2HasSidePanel) {
          camera2.setViewOffset(halfW, fullH, 0, Math.floor(fullH * 0.16), halfW, fullH);
          p2SafeMinY = -0.05;
          p2SafeMaxY = 0.64;
        } else {
          camera2.clearViewOffset();
        }
        camera2.updateProjectionMatrix();

        if (p2MobileFixed) {
          player1Avatar.group.visible = false;
          player2Avatar.group.visible = false;
          camTargetPos2.set(p2MobileFixed.camPos[0], p2MobileFixed.camPos[1], p2MobileFixed.camPos[2]);
          camLookTarget2.set(p2MobileFixed.lookAt[0], p2MobileFixed.lookAt[1], p2MobileFixed.lookAt[2]);
        } else {
          computePlayerCamera(
            p2Level,
            p2.x,
            p2.z,
            elapsed,
            camTargetPos2,
            camLookTarget2,
            true,
            p1.x,
            p1.z
          );
          fitSplitCameraToBothPlayers(
            camera2,
            camTargetPos2,
            camLookTarget2,
            p1.x,
            player1Avatar.group.position.y,
            p1.z,
            p2.x,
            player2Avatar.group.position.y,
            p2.z,
            p2SafeMinX,
            p2SafeMaxX,
            p2SafeMinY,
            p2SafeMaxY
          );
        }

        const mobileCameraAdjusted2 =
          slot2Touch.zoomScale !== 1.0 ||
          Math.abs(slot2Touch.panX) >= 0.001 ||
          Math.abs(slot2Touch.panZ) >= 0.001;
        applySlotCameraAdjust(slot2Touch, camTargetPos2, camLookTarget2, true);
        const splitCamLerp2 =
          slot2Touch.touchPoints.size > 0
            ? Math.max(camLerp, 0.34)
            : camLerp;

        camera2.position.x += (camTargetPos2.x - camera2.position.x) * splitCamLerp2;
        camera2.position.y += (camTargetPos2.y - camera2.position.y) * splitCamLerp2;
        camera2.position.z += (camTargetPos2.z - camera2.position.z) * splitCamLerp2;
        currentLook2.x += (camLookTarget2.x - currentLook2.x) * splitCamLerp2;
        currentLook2.y += (camLookTarget2.y - currentLook2.y) * splitCamLerp2;
        currentLook2.z += (camLookTarget2.z - currentLook2.z) * splitCamLerp2;

        if (!mobileCameraAdjusted2 && !p2MobileFixed) {
          fitSplitCameraToBothPlayers(
            camera2,
            camera2.position,
            currentLook2,
            p1.x,
            player1Avatar.group.position.y,
            p1.z,
            p2.x,
            player2Avatar.group.position.y,
            p2.z,
            p2SafeMinX,
            p2SafeMaxX,
            p2SafeMinY,
            p2SafeMaxY
          );
        }
        if (shakeRemaining2 > 0) {
          shakeRemaining2 = Math.max(0, shakeRemaining2 - dt);
          const amp = 0.22;
          camera2.position.x += Math.sin(elapsed * 42) * amp * 0.65 + (Math.random() - 0.5) * amp;
          camera2.position.y += Math.cos(elapsed * 38) * amp * 0.65 + (Math.random() - 0.5) * amp;
        }
        camera2.lookAt(currentLook2);
        renderer.render(scene, camera2);
      } else {
        wasSplitArena = false;
        wasL1HouseIntro = false;
        lastLookingLevel = 0;
        camera.fov = 50;
        camera2.fov = 50;
        player1Avatar.headGroup.rotation.set(0, 0, 0);
        player2Avatar.headGroup.rotation.set(0, 0, 0);
        camera.clearViewOffset();
        camera2.clearViewOffset();
        level1Group.position.set(0, 0, 0);
        // 1P / Mode Kelas / Splash / Setup / Prologue
        const isCoreGameL1 = inArena && cur.currentLevel === 1;
        const isCoreGameL2Mobile =
          inArena && cur.currentLevel === 2 && typeof window !== 'undefined' && window.innerWidth < 768;
        const isCoreGameL3 = inArena && cur.currentLevel === 3;
        player1Avatar.group.visible = !isCoreGameL1 && !isCoreGameL2Mobile && !isCoreGameL3;
        player2Avatar.group.visible =
          (cur.gameMode !== 'solo' || cur.page !== 'arena') &&
          !isCoreGameL1 &&
          !isCoreGameL2Mobile &&
          !isCoreGameL3;

        level1Group.visible = false;
        level2Group.visible = inArena && cur.currentLevel === 2;
        level3Group.visible = inArena && cur.currentLevel === 3;
        level4Group.visible = inArena && cur.currentLevel === 4;
        level5Group.visible = inArena && cur.currentLevel === 5;
        level6Group.visible = inArena && cur.currentLevel === 6;

        if (isCoreGameL3 || isCoreGameL2Mobile) {
          schoolGroup.visible = false;
          roadNS.visible = false;
          roadEW.visible = false;
          checkpointPad.visible = false;
        } else if (level5Group.visible) {
          schoolGroup.visible = false;
        } else if (level6Group.visible) {
          schoolGroup.visible = false;
          checkpointPad.visible = false;
        }

        if (level2Group.visible) {
          syncLevel2Visuals(cur.level2Visual, elapsed);
        }

        if (level3Group.visible) {
          syncLevel3ClawVisual(
            p1ClawAnim,
            cur.clawX,
            cur.clawGrabbing,
            cur.clawItemIndex ?? 0,
            cur.clawPhase ?? 'claw',
            dt,
            elapsed
          );
        }
        if (level4Group.visible) {
          syncLevel4Visuals(cur.completedCitizens, lastNearestCitizenRef.current, elapsed);
        }
        if (level5Group.visible) {
          syncLevel5Visuals(cur.completedZones, lastNearestZoneRef.current, elapsed);
        }
        if (level6Group.visible) {
          syncLevel6Visuals(cur.completedIslands, lastNearestIslandRef.current, elapsed);
        }

        if (cur.page === 'splash' || cur.page === 'setup' || cur.page === 'result') {
          const orbitAngle = elapsed * 0.18;
          camTargetPos.set(Math.sin(orbitAngle) * 26, 13, Math.cos(orbitAngle) * 26);
          camLookTarget.set(0, 1.5, -2);
        } else if (cur.prologueActive) {
          if (cur.prologueStage !== lastPrologueStage) {
            lastPrologueStage = cur.prologueStage;
            prologueStageStartTime = elapsed;

            if (cur.prologueStage === 1) {
              camera.position.set(-2.2, 11.4, 16.5);
              currentLook.set(0, 3.6, -7.5);
            } else if (cur.prologueStage === 2) {
              // Start high so camera visibly dives sharply (Menukik Tajam) into the cracked grey valley
              camera.position.set(0, 16.5, 17.5);
              currentLook.set(0, 2.5, -5.0);
              shakeRemaining = 0.65;
            } else if (cur.prologueStage === 3) {
              // Start orbiting directly around the student character & descending sprout
              camera.position.set(0, 3.35, 7.1);
              currentLook.set(0, 2.05, 0.5);
            }
          }

          const stageElapsed = Math.max(0, elapsed - prologueStageStartTime);

          // Animate flowing river ripples downstream in all prologue stages
          riverRippleMeshes.forEach((rip, idx) => {
            const flowT = (elapsed * 0.42 + idx / riverRippleMeshes.length) % 1;
            const wpFloat = flowT * (riverCurveWaypoints.length - 1);
            const wpIdx = Math.floor(wpFloat);
            const wpNext = Math.min(riverCurveWaypoints.length - 1, wpIdx + 1);
            const frac = wpFloat - wpIdx;
            const [x0, z0] = riverCurveWaypoints[wpIdx];
            const [x1, z1] = riverCurveWaypoints[wpNext];
            const lateralOffset = ((idx % 3) - 1) * 0.95;
            rip.position.set(
              x0 + (x1 - x0) * frac + lateralOffset,
              0.23,
              z0 + (z1 - z0) * frac
            );
            rip.rotation.y = Math.atan2(x1 - x0, z1 - z0);
          });

          // Animate waterfall plunge foam
          waterfallFoamMeshes.forEach((fm, idx) => {
            const s = 0.85 + Math.sin(elapsed * 5.5 + idx * 1.1) * 0.25;
            fm.scale.setScalar(s);
            fm.position.y = 0.26 + Math.abs(Math.sin(elapsed * 4.2 + idx)) * 0.14;
          });

          if (cur.prologueStage === 1) {
            // =================================================================
            // BABAK 1: Kamera Melayang di Atas Panorama Nusantara
            // (Pemandangan Gunung Hijau Menjulang & Sungai Mengalir Jernih)
            // =================================================================
            prologueBabak1HarmonyGroup.visible = true;
            prologueBabak2CrisisGroup.visible = false;
            prologueBabak3HeroGroup.visible = false;
            player1Avatar.group.visible = false;
            player2Avatar.group.visible = false;
            if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = true;
            if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = true;

            scene.background = skyColorHarmony;
            (scene.fog as THREE.FogExp2).color.copy(skyColorHarmony);
            islandMat.color.setHex(0x16a34a);
            oceanMat.color.setHex(0x0284c7);
            mtnFootMat.color.setHex(0x15803d);
            mtnMidMat.color.setHex(0x16a34a);
            mtnPeakMat.color.setHex(0x065f46);
            mtnCraterMat.color.setHex(0xe7e5e4);
            riverWaterMat.color.setHex(0x38bdf8);
            riverWaterMat.emissive.setHex(0x0284c7);
            riverWaterMat.emissiveIntensity = 0.45;
            riverBankMat.color.setHex(0x84cc16);
            riverRippleMat.color.setHex(0xf0f9ff);

            // Drift clouds gently across mountain peaks
            prologueClouds.forEach((cg, idx) => {
              const baseX = cloudSpecs[idx][0];
              cg.position.x = baseX + Math.sin(elapsed * 0.35 + idx * 1.2) * 1.6;
            });

            // Kamera melayang lembut di atas lembah sungai dan deretan 3 gunung hijau
            const panAngle = Math.sin(elapsed * 0.38) * 5.0;
            camTargetPos.set(panAngle, 11.4 + Math.sin(elapsed * 0.7) * 0.35, 16.5);
            camLookTarget.set(panAngle * 0.15, 3.6, -7.5);
          } else if (cur.prologueStage === 2) {
            // =================================================================
            // BABAK 2: Kamera Menukik Tajam, Tanah Retak, Warna Kelabu, Gemuruh Bumi
            // =================================================================
            prologueBabak1HarmonyGroup.visible = false;
            prologueBabak2CrisisGroup.visible = true;
            prologueBabak3HeroGroup.visible = false;
            player1Avatar.group.visible = false;
            player2Avatar.group.visible = false;
            if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = true;
            if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = true;

            // Warna Kelabu (Bleak Ash-Grey Sky, Ground, Barren Mountains & Polluted River)
            scene.background = skyColorCrisis;
            (scene.fog as THREE.FogExp2).color.copy(skyColorCrisis);
            islandMat.color.setHex(0x57534e);
            oceanMat.color.setHex(0x1e293b);
            mtnFootMat.color.setHex(0x44403c);
            mtnMidMat.color.setHex(0x3f3f46);
            mtnPeakMat.color.setHex(0x27272a);
            mtnCraterMat.color.setHex(0x52525b);
            riverWaterMat.color.setHex(0x57534e);
            riverWaterMat.emissive.setHex(0x292524);
            riverWaterMat.emissiveIntensity = 0.18;
            riverBankMat.color.setHex(0x44403c);
            riverRippleMat.color.setHex(0x78716c);

            // Pulse seismic glow inside cracked earth fissures
            crackGlowMat.emissiveIntensity = 1.0 + Math.sin(elapsed * 8.0) * 0.35;

            // Rising grey pollution smoke in upper background
            crisisSmokePuffs.forEach((pf, idx) => {
              pf.position.y = 5.2 + ((elapsed * 0.8 + idx * 0.45) % 3.2);
              const s = 0.7 + ((elapsed * 0.45 + idx * 0.3) % 0.9) * 0.5;
              pf.scale.setScalar(s);
            });

            // Kamera Menukik Tajam (Sharp Dive from high altitude down into the cracked earth & polluted river)
            const diveT = Math.min(1, stageElapsed * 1.25);
            const easeDive = 1 - Math.pow(1 - diveT, 3);
            const diveY = 16.5 - easeDive * 7.8; // Dives steeply from y=16.5 down to y=8.7
            const diveZ = 17.5 - easeDive * 8.3; // Dives forward from z=17.5 in to z=9.2
            camTargetPos.set(Math.sin(elapsed * 0.55) * 1.2, diveY, diveZ);
            camLookTarget.set(0, 0.2, -3.5);

            // Gemuruh Bumi (Continuous seismic earth-tremor camera vibration)
            shakeRemaining = 0.25;
          } else {
            // =================================================================
            // BABAK 3: Kamera Mengorbit ke Karakter Murid, Tunas Hijau Bercahaya Turun
            // =================================================================
            prologueBabak1HarmonyGroup.visible = true;
            prologueBabak2CrisisGroup.visible = false;
            prologueBabak3HeroGroup.visible = true;
            // Hide floating name tag sprites during Babak 3 so the descending glowing green sprout above the student is 100% unobstructed
            if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = false;
            if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = false;

            // Restore emerald atmosphere around the student & mountains
            scene.background = skyColorHero;
            (scene.fog as THREE.FogExp2).color.copy(skyColorHero);
            islandMat.color.setHex(0x15803d);
            oceanMat.color.setHex(0x0284c7);
            mtnFootMat.color.setHex(0x15803d);
            mtnMidMat.color.setHex(0x16a34a);
            mtnPeakMat.color.setHex(0x065f46);
            mtnCraterMat.color.setHex(0xe7e5e4);
            riverWaterMat.color.setHex(0x38bdf8);
            riverWaterMat.emissive.setHex(0x0284c7);
            riverWaterMat.emissiveIntensity = 0.42;
            riverBankMat.color.setHex(0x65a30d);
            riverRippleMat.color.setHex(0xe0f2fe);

            // Kamera Mengorbit ke Karakter Murid (Smooth 360-degree orbit around the student character)
            const orbitAngle = stageElapsed * 0.68;
            const orbitRadius = 6.6;
            camTargetPos.set(
              Math.sin(orbitAngle) * orbitRadius,
              3.35,
              0.5 + Math.cos(orbitAngle) * orbitRadius
            );
            camLookTarget.set(0, 2.05, 0.5);

            // Place Student Character on the sacred restoration pad looking up at the descending sprout
            player1Avatar.group.visible = true;
            if (cur.gameMode === 'split') {
              player1Avatar.group.position.set(-0.75, 0.18, 0.5);
              player1Avatar.group.rotation.y = orbitAngle * 0.55;
              player2Avatar.group.visible = true;
              player2Avatar.group.position.set(0.75, 0.18, 0.5);
              player2Avatar.group.rotation.y = orbitAngle * 0.55;
              player2Avatar.headGroup.rotation.set(-0.32, 0, 0);
              player2Avatar.leftArm.rotation.x = -0.95 + Math.sin(elapsed * 3.2) * 0.1;
              player2Avatar.rightArm.rotation.x = -0.95 - Math.sin(elapsed * 3.2) * 0.1;
            } else {
              player1Avatar.group.position.set(0, 0.18, 0.5);
              player1Avatar.group.rotation.y = orbitAngle * 0.55;
              player2Avatar.group.visible = false;
            }
            player1Avatar.headGroup.rotation.set(-0.32, 0, 0);
            player1Avatar.leftArm.rotation.x = -0.95 + Math.sin(elapsed * 3.2) * 0.1;
            player1Avatar.rightArm.rotation.x = -0.95 - Math.sin(elapsed * 3.2) * 0.1;
            player1Avatar.leftLeg.rotation.x = 0;
            player1Avatar.rightLeg.rotation.x = 0;

            // Tunas Hijau Bercahaya Turun (Glowing Green Sprout descends from sky down to y=2.30 right above student)
            const descentCycle = Math.min(1, stageElapsed * 0.8);
            const smoothDescent = 1 - Math.pow(1 - descentCycle, 3);
            const sproutY =
              2.85 - smoothDescent * 0.55 + Math.sin(elapsed * 2.8) * 0.06;
            glowingSproutAssembly.position.set(0, sproutY, 0.5);
            glowingSproutAssembly.rotation.y = elapsed * 1.35;
            haloRing.rotation.x = Math.PI / 2 + Math.sin(elapsed * 2.4) * 0.35;
            haloRing.rotation.y = elapsed * 1.8;

            // Animate downward-cascading light rings to visually emphasize downward descent
            descendingLightRings.forEach((dRing, idx) => {
              const ringProgress = (elapsed * 0.55 + idx / 3) % 1;
              dRing.position.y = 4.6 - ringProgress * 4.0;
              const ringScale = 0.65 + ringProgress * 1.1;
              dRing.scale.setScalar(ringScale);
              (dRing.material as THREE.MeshBasicMaterial).opacity =
                (1 - ringProgress) * 0.85;
            });

            // Animate spiraling light motes around the descending sprout & student
            sproutMotes.forEach((mote, idx) => {
              const mAngle = elapsed * 1.5 + (idx / sproutMotes.length) * Math.PI * 2;
              const mRad = 0.75 + (idx % 3) * 0.45;
              const mFall = 4.2 - ((elapsed * 0.85 + idx * 0.28) % 3.8);
              mote.position.set(
                Math.cos(mAngle) * mRad,
                mFall,
                0.5 + Math.sin(mAngle) * mRad
              );
            });

            // Pulse ground healing rings outward
            heroAuraRings.forEach((rMesh, idx) => {
              const pulse = 1 + Math.sin(elapsed * 2.6 - idx * 0.7) * 0.08;
              rMesh.scale.setScalar(pulse);
            });
          }
        } else {
          if (player1Avatar.nameTagSprite) player1Avatar.nameTagSprite.visible = true;
          if (player2Avatar.nameTagSprite) player2Avatar.nameTagSprite.visible = true;
          if (cur.currentLevel === 6 && cur.completedIslands.length >= LEVEL_6_ISLANDS.length) {
            camTargetPos.set(Math.sin(elapsed * 0.45) * 4.5, 19.5, 23.0);
            camLookTarget.set(0, 2.2, 0);
          } else {
            computePlayerCamera(
              cur.currentLevel,
              p1.x,
              p1.z,
              elapsed,
              camTargetPos,
              camLookTarget,
              false
            );
          }
        }

        renderer.setScissorTest(false);
        const w = container?.clientWidth || window.innerWidth;
        const h = container?.clientHeight || window.innerHeight;
        const mobileFixedSpec =
          inArena &&
          !cur.prologueActive &&
          (cur.level1IntroPhase ?? 'core_game') === 'core_game'
            ? cur.currentLevel === 3
              ? computeMobileLevel3CameraSpec(w, h, false)
              : cur.currentLevel === 2
              ? computeMobileLevel2CameraSpec(w, h, false)
              : null
            : null;

        if (mobileFixedSpec) {
          camera.fov = mobileFixedSpec.fov;
          camTargetPos.set(mobileFixedSpec.camPos[0], mobileFixedSpec.camPos[1], mobileFixedSpec.camPos[2]);
          camLookTarget.set(mobileFixedSpec.lookAt[0], mobileFixedSpec.lookAt[1], mobileFixedSpec.lookAt[2]);
        } else {
          camera.fov = 50;
        }

        renderer.setViewport(0, 0, w, h);
        camera.aspect = w / h;
        if (cur.prologueActive) {
          // Shift optical center slightly upward so the 3D Prologue scene sits cleanly above the bottom dialog box
          camera.setViewOffset(w, h, 0, Math.floor(h * 0.11), w, h);
        } else if (mobileFixedSpec) {
          // Mobile (<768px) Level 2/3 dock sits neatly at bottom -> shift 3D centerpiece cleanly upward
          camera.setViewOffset(w, h, 0, Math.floor(h * mobileFixedSpec.viewOffsetYFrac), w, h);
        } else if (inArena && (cur.currentLevel === 2 || cur.currentLevel === 3) && w >= 1024) {
          // Shift 3D centerpiece cleanly to the open left-center area away from the right-side action panel
          camera.setViewOffset(w, h, Math.floor(w * 0.14), 0, w, h);
        } else {
          camera.clearViewOffset();
        }
        camera.updateProjectionMatrix();

        if (inArena && !cur.prologueActive && (cur.level1IntroPhase ?? 'core_game') === 'core_game') {
          applySlotCameraAdjust(slot1Touch, camTargetPos, camLookTarget, window.innerWidth < 768);
        }

        const basePrologueLerp = cur.prologueActive
          ? isSoftwareGl
            ? 0.55
            : 0.14
          : inArena && (cur.currentLevel === 2 || cur.currentLevel === 3)
          ? isSoftwareGl
            ? 0.45
            : 0.16
          : 0.08;
        const prologueLerp =
          window.innerWidth < 768 && slot1Touch.touchPoints.size > 0
            ? Math.max(basePrologueLerp, 0.34)
            : basePrologueLerp;

        camera.position.x += (camTargetPos.x - camera.position.x) * prologueLerp;
        camera.position.y += (camTargetPos.y - camera.position.y) * prologueLerp;
        camera.position.z += (camTargetPos.z - camera.position.z) * prologueLerp;

        currentLook.x += (camLookTarget.x - currentLook.x) * prologueLerp;
        currentLook.y += (camLookTarget.y - currentLook.y) * prologueLerp;
        currentLook.z += (camLookTarget.z - currentLook.z) * prologueLerp;

        if (shakeRemaining > 0) {
          shakeRemaining = Math.max(0, shakeRemaining - dt);
          const amp = cur.prologueActive && cur.prologueStage === 2 ? 0.28 : 0.22;
          camera.position.x += Math.sin(elapsed * 42) * amp * 0.65 + (Math.random() - 0.5) * amp;
          camera.position.y += Math.cos(elapsed * 38) * amp * 0.65 + (Math.random() - 0.5) * amp;
        }

        camera.lookAt(currentLook);
        if (!isCoreGameL1) {
          renderer.render(scene, camera);
        }
      }

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    animate();

    const npcRaycaster = new THREE.Raycaster();
    const npcPointerNdc = new THREE.Vector2();
    const activePointerDowns = new Map<number, { x: number; y: number; time: number }>();
    let lastHoverCheck = 0;

    const pickLevelNpcAtClientPoint = (
      clientX: number,
      clientY: number
    ): { npcIdx: number; slot: 1 | 2; level: 4 | 5 | 6 } | null => {
      const cur = propsRef.current;
      const introPhase = cur.level1IntroPhase ?? 'core_game';
      if (cur.page !== 'arena' || cur.prologueActive || introPhase !== 'core_game') {
        return null;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      let slot: 1 | 2 = 1;
      let activeCam: THREE.PerspectiveCamera = camera;
      let ndcX = 0;
      let ndcY = 0;
      let targetLevel: 4 | 5 | 6 | null = null;

      if (cur.gameMode === 'split') {
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        const halfW = rect.width / 2;
        if (halfW <= 0) return null;
        slot = relX < halfW ? 1 : 2;
        const slotLevel = slot === 1 ? cur.currentLevel : cur.p2CurrentLevel ?? cur.currentLevel;
        if (slotLevel !== 4 && slotLevel !== 5 && slotLevel !== 6) return null;
        targetLevel = slotLevel;
        const localX = slot === 1 ? relX : relX - halfW;
        ndcX = (localX / halfW) * 2 - 1;
        ndcY = -(relY / rect.height) * 2 + 1;
        activeCam = slot === 1 ? camera : camera2;
      } else {
        if (cur.currentLevel !== 4 && cur.currentLevel !== 5 && cur.currentLevel !== 6) return null;
        targetLevel = cur.currentLevel;
        ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        slot = 1;
        activeCam = camera;
      }

      activeCam.updateMatrixWorld(true);
      npcPointerNdc.set(ndcX, ndcY);
      npcRaycaster.setFromCamera(npcPointerNdc, activeCam);

      if (targetLevel === 4) {
        const prevL4Vis = level4Group.visible;
        level4Group.visible = true;
        level4Group.updateMatrixWorld(true);
        const intersects = npcRaycaster.intersectObjects(citizenClickTargets, true);
        level4Group.visible = prevL4Vis;

        for (let i = 0; i < intersects.length; i++) {
          const hitIdx = intersects[i].object.userData?.citizenIdx;
          if (typeof hitIdx === 'number') {
            return { npcIdx: hitIdx, slot, level: 4 };
          }
        }
        return null;
      }

      if (targetLevel === 5) {
        const prevL5Vis = level5Group.visible;
        level5Group.visible = true;
        level5Group.updateMatrixWorld(true);
        const intersects = npcRaycaster.intersectObjects(zoneClickTargets, true);
        level5Group.visible = prevL5Vis;

        for (let i = 0; i < intersects.length; i++) {
          const hitIdx = intersects[i].object.userData?.zoneIdx;
          if (typeof hitIdx === 'number') {
            return { npcIdx: hitIdx, slot, level: 5 };
          }
        }
        return null;
      }

      const prevL6Vis = level6Group.visible;
      level6Group.visible = true;
      level6Group.updateMatrixWorld(true);
      const intersects = npcRaycaster.intersectObjects(towerClickTargets, true);
      level6Group.visible = prevL6Vis;

      for (let i = 0; i < intersects.length; i++) {
        const hitIdx = intersects[i].object.userData?.islandIdx;
        if (typeof hitIdx === 'number') {
          return { npcIdx: hitIdx, slot, level: 6 };
        }
      }
      return null;
    };

    const canUseSlotCameraGesture = (slot: 1 | 2, pointerType: string) => {
      const cur = propsRef.current;
      const isTouchInput = pointerType === 'touch' || pointerType === 'pen' || window.innerWidth < 768;
      if (!isTouchInput) return false;
      if (cur.gameMode !== 'split' && window.innerWidth >= 768) return false;
      const introPhase = cur.level1IntroPhase ?? 'core_game';
      if (cur.page !== 'arena' || cur.prologueActive || introPhase !== 'core_game') {
        return false;
      }
      if (cur.gameMode === 'split') {
        return slot === 2 ? !cur.p2DialogOpen : !cur.p1DialogOpen;
      }
      return !cur.p1DialogOpen && cur.currentLevel >= 2;
    };

    const handleCanvasPointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const slot = resolveSplitTouchSlot(
        e.clientX,
        rect.left,
        rect.width || window.innerWidth,
        propsRef.current.gameMode === 'split'
      );
      pointerSlotMap.set(e.pointerId, slot);

      activePointerDowns.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      });

      if (canUseSlotCameraGesture(slot, e.pointerType)) {
        const st = slot === 2 ? slot2Touch : slot1Touch;
        st.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (st.touchPoints.size === 1) {
          st.gestureMovedSinceDown = false;
          st.lastPinchDist = null;
        } else if (st.touchPoints.size === 2) {
          const pts = Array.from(st.touchPoints.values());
          st.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          st.gestureMovedSinceDown = true;
        }
      }
    };

    const handleCanvasPointerMove = (e: PointerEvent) => {
      const slot = pointerSlotMap.get(e.pointerId) ?? 1;
      const st = slot === 2 ? slot2Touch : slot1Touch;

      if (canUseSlotCameraGesture(slot, e.pointerType) && st.touchPoints.has(e.pointerId)) {
        const prev = st.touchPoints.get(e.pointerId)!;
        const curPt = { x: e.clientX, y: e.clientY };
        st.touchPoints.set(e.pointerId, curPt);
        const fullW = Math.max(240, renderer.domElement.clientWidth || window.innerWidth);
        const rectW = propsRef.current.gameMode === 'split' ? Math.max(120, fullW / 2) : fullW;
        const rectH = Math.max(240, renderer.domElement.clientHeight || window.innerHeight);

        if (st.touchPoints.size === 2) {
          const pts = Array.from(st.touchPoints.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (st.lastPinchDist !== null && st.lastPinchDist > 6 && dist > 6) {
            const scaleRatio = st.lastPinchDist / dist;
            st.zoomScale = THREE.MathUtils.clamp(st.zoomScale * scaleRatio, 0.48, 1.95);
          }
          st.lastPinchDist = dist;
          st.gestureMovedSinceDown = true;

          const dx = curPt.x - prev.x;
          const dy = curPt.y - prev.y;
          st.panX = THREE.MathUtils.clamp(
            st.panX - (dx / rectW) * 10 * st.zoomScale,
            -16,
            16
          );
          st.panZ = THREE.MathUtils.clamp(
            st.panZ - (dy / rectH) * 6 * st.zoomScale,
            -10,
            10
          );
        } else if (st.touchPoints.size === 1) {
          const dx = curPt.x - prev.x;
          const dy = curPt.y - prev.y;
          const down = activePointerDowns.get(e.pointerId);
          const totalMove = down
            ? Math.hypot(curPt.x - down.x, curPt.y - down.y)
            : Math.hypot(dx, dy);
          if (totalMove > 6) {
            st.gestureMovedSinceDown = true;
            st.panX = THREE.MathUtils.clamp(
              st.panX - (dx / rectW) * 18 * st.zoomScale,
              -16,
              16
            );
            st.panZ = THREE.MathUtils.clamp(
              st.panZ - (dy / rectH) * 10 * st.zoomScale,
              -10,
              10
            );
          }
        }
      }

      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      const hit = pickLevelNpcAtClientPoint(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hit ? 'pointer' : '';
    };

    const handleCanvasPointerUp = (e: PointerEvent) => {
      const slot = pointerSlotMap.get(e.pointerId) ?? 1;
      pointerSlotMap.delete(e.pointerId);
      const st = slot === 2 ? slot2Touch : slot1Touch;

      const down = activePointerDowns.get(e.pointerId);
      activePointerDowns.delete(e.pointerId);

      const wasGestureActive = st.touchPoints.has(e.pointerId);
      st.touchPoints.delete(e.pointerId);
      if (st.touchPoints.size < 2) {
        st.lastPinchDist = null;
      }

      if (down) {
        const moveDist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        const elapsedMs = performance.now() - down.time;
        if (moveDist > 24 || elapsedMs > 850) return;
      }
      const hit = pickLevelNpcAtClientPoint(e.clientX, e.clientY);
      if (hit) {
        propsRef.current.onNpcInteract?.(hit.npcIdx, hit.slot, hit.level);
        return;
      }

      // Double-tap empty 3D scene on that player's viewport resets only that player's camera zoom & pan
      if (wasGestureActive && !st.gestureMovedSinceDown && canUseSlotCameraGesture(slot, e.pointerType)) {
        const now = performance.now();
        if (now - st.lastTapAt < 320) {
          st.zoomScale = 1.0;
          st.panX = 0;
          st.panZ = 0;
          st.lastTapAt = 0;
        } else {
          st.lastTapAt = now;
        }
      }
    };

    const handleCanvasPointerCancel = (e: PointerEvent) => {
      const slot = pointerSlotMap.get(e.pointerId) ?? 1;
      pointerSlotMap.delete(e.pointerId);
      const st = slot === 2 ? slot2Touch : slot1Touch;
      activePointerDowns.delete(e.pointerId);
      st.touchPoints.delete(e.pointerId);
      if (st.touchPoints.size < 2) {
        st.lastPinchDist = null;
      }
    };

    renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
    renderer.domElement.addEventListener('pointermove', handleCanvasPointerMove);
    renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp);
    renderer.domElement.addEventListener('pointercancel', handleCanvasPointerCancel);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const isSplit = propsRef.current.gameMode === 'split';
      camera.aspect = isSplit ? w / 2 / h : w / h;
      camera.updateProjectionMatrix();
      camera2.aspect = w / 2 / h;
      camera2.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handleCanvasPointerDown);
      renderer.domElement.removeEventListener('pointermove', handleCanvasPointerMove);
      renderer.domElement.removeEventListener('pointerup', handleCanvasPointerUp);
      renderer.domElement.removeEventListener('pointercancel', handleCanvasPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      sharedAtlas.dispose();
      level3Rig.dispose();
      npcHitGeo.dispose();
      npcHitMat.dispose();
      l4InteractBadgeTex.dispose();
      l4InteractBadgeMat.dispose();
      l6HitGeo.dispose();
      l6HitMat.dispose();
      l6MapFallbackTex.dispose();
      l6LoadedMapTex?.dispose();
      l6AshVeil.geometry.dispose();
      l6AshVeilMat.dispose();
      l2BannerTex.dispose();
      l2LetterTexCache.forEach((t) => t.dispose());
      l2LetterTexCache.clear();
      renderer.dispose();
    };
  }, []);

  const isLevelNpcInteractive =
    props.page === 'arena' &&
    !props.prologueActive &&
    (props.level1IntroPhase ?? 'core_game') === 'core_game' &&
    (props.currentLevel === 4 ||
      props.currentLevel === 5 ||
      props.currentLevel === 6 ||
      (props.gameMode === 'split' &&
        ((props.p2CurrentLevel ?? props.currentLevel) === 4 ||
          (props.p2CurrentLevel ?? props.currentLevel) === 5 ||
          (props.p2CurrentLevel ?? props.currentLevel) === 6)));

  const isMobileCameraGestureReady =
    props.page === 'arena' &&
    !props.prologueActive &&
    (props.level1IntroPhase ?? 'core_game') === 'core_game' &&
    (props.gameMode === 'split'
      ? !props.p1DialogOpen || !props.p2DialogOpen
      : !props.p1DialogOpen && props.currentLevel >= 2);

  return (
    <div
      ref={mountRef}
      data-testid="world-3d-canvas"
      style={{ touchAction: isMobileCameraGestureReady || isLevelNpcInteractive ? 'none' : undefined }}
      className={`fixed inset-0 w-full h-full z-0 ${
        isLevelNpcInteractive || props.gameMode === 'split'
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      } ${isMobileCameraGestureReady ? 'max-md:pointer-events-auto max-md:touch-none' : ''}`}
    />
  );
};
