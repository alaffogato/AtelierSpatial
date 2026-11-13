import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  CameraPreset,
  ColorScheme,
  LightingMood,
  RoomConfig,
  StyleDefinition,
} from '../types/design';
import {
  buildCoffeeTableGroup,
  buildCredenzaGroup,
  buildDiningSetGroup,
  buildFloorLampGroup,
  buildLoungeChairGroup,
  buildPlantGroup,
  buildSofaGroup,
  createFurnitureMaterials,
} from './furnitureBuilders';
import {
  createArtworkTexture,
  createFloorTexture,
  createRugTexture,
  createWallTexture,
} from './proceduralTextures';

const FT_TO_M = 0.3048;

// Pre-allocated math helpers (zero GC inside render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface SceneCallbacks {
  onContextLost?: (lost: boolean) => void;
  onModeChange?: (mode: CameraMode) => void;
}

export class RoomSceneEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;

  private roomRoot: THREE.Group;
  private ceilingMesh: THREE.Mesh | null = null;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private lampLight: THREE.PointLight;
  private ambientFill: THREE.PointLight;

  private roomWidthM = 7.9;
  private roomLengthM = 4.9;
  private roomHeightM = 2.9;

  private cameraMode: CameraMode = 'orbit';
  private walkYaw = 0;
  private walkPitch = -0.04;
  private keysPressed = new Set<string>();
  private isPointerLooking = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private isTransitioning = false;
  private transitionCamPos = new THREE.Vector3();
  private transitionTarget = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3(0, 0.9, 0);

  private clock = new THREE.Clock();
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private loopActive = false;
  private disposed = false;

  private trackedTextures: THREE.Texture[] = [];
  private trackedGeometries: THREE.BufferGeometry[] = [];
  private trackedMaterials: THREE.Material[] = [];

  private callbacks: SceneCallbacks;

  constructor(container: HTMLElement, callbacks: SceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(300, container.clientHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.outline = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#191816');
    this.scene.fog = new THREE.FogExp2('#191816', 0.022);

    // Procedural studio environment reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
    this.camera.position.set(6.5, 5.2, 7.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 18.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.target.set(0, 0.85, 0);

    this.controls.addEventListener('change', () => {
      if (this.cameraMode === 'orbit' && !this.isTransitioning) {
        this.requestRender();
      }
    });
    this.controls.addEventListener('start', () => {
      // Cancel automated camera preset glide when user grabs controls
      this.isTransitioning = false;
    });

    // Studio & Sunlight Rig
    this.hemiLight = new THREE.HemisphereLight('#E7F0FA', '#B89F84', 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#FFF3E0', 1.65);
    this.keyLight.position.set(5.5, 7.5, -5.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 25;
    const d = 7.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.lampLight = new THREE.PointLight('#FFCE8A', 1.8, 7.5, 1.8);
    this.lampLight.position.set(-2.2, 1.55, -1.2);
    this.scene.add(this.lampLight);

    this.ambientFill = new THREE.PointLight('#F5EFE4', 0.55, 14, 1.4);
    this.ambientFill.position.set(0, 2.5, 0);
    this.scene.add(this.ambientFill);

    this.roomRoot = new THREE.Group();
    this.scene.add(this.roomRoot);

    this.bindEvents();
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = Math.max(300, this.container.clientWidth);
    const h = Math.max(300, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.requestRender();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.cameraMode !== 'walkthrough') return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      this.keysPressed.add(e.code);
      this.ensureLoopRunning();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.cameraMode !== 'walkthrough') return;
    this.isPointerLooking = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.isTransitioning = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.cameraMode !== 'walkthrough' || !this.isPointerLooking) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.walkYaw -= dx * 0.0042;
    this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - dy * 0.0036, -0.55, 0.55);
    this.applyWalkOrientation();
    this.requestRender();
  };

  private onPointerUp = () => {
    this.isPointerLooking = false;
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.(true);
  };

  private onContextRestored = () => {
    this.callbacks.onContextLost?.(false);
    this.requestRender();
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private clearRoomResources() {
    while (this.roomRoot.children.length > 0) {
      this.roomRoot.remove(this.roomRoot.children[0]);
    }
    this.ceilingMesh = null;
    for (const g of this.trackedGeometries) g.dispose();
    for (const m of this.trackedMaterials) m.dispose();
    for (const t of this.trackedTextures) t.dispose();
    this.trackedGeometries = [];
    this.trackedMaterials = [];
    this.trackedTextures = [];
  }

  private trackObjectResources(obj: THREE.Object3D) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.geometry) this.trackedGeometries.push(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m) this.trackedMaterials.push(m);
        }
      }
    });
  }

  public updateRoomAndStyle(
    room: RoomConfig,
    style: StyleDefinition,
    scheme: ColorScheme,
    lightingMood: LightingMood,
  ) {
    this.clearRoomResources();

    const widthM = THREE.MathUtils.clamp(room.widthFt * FT_TO_M, 3.6, 10.5);
    const lengthM = THREE.MathUtils.clamp(room.lengthFt * FT_TO_M, 4.2, 11.5);
    const heightM = THREE.MathUtils.clamp(room.heightFt * FT_TO_M, 2.4, 4.2);

    this.roomWidthM = lengthM; // X-axis = longer length
    this.roomLengthM = widthM; // Z-axis = depth
    this.roomHeightM = heightM;

    const halfX = this.roomWidthM / 2;
    const halfZ = this.roomLengthM / 2;

    // Procedural Textures
    const floorTex = createFloorTexture(style.floorType, scheme.floorHex, this.maxAnisotropy);
    const wallTex = createWallTexture(style.wallFinish, scheme.wallHex, this.maxAnisotropy);
    const accentWallTex = createWallTexture(style.wallFinish, scheme.wallAccentHex, this.maxAnisotropy);
    const rugTex = createRugTexture(style.rugPattern, scheme, this.maxAnisotropy);
    const artTex = createArtworkTexture(scheme, this.maxAnisotropy);
    this.trackedTextures.push(floorTex, wallTex, accentWallTex, rugTex, artTex);

    // Exterior architectural plinth / terrace pad beneath the room
    const basePadMat = new THREE.MeshStandardMaterial({
      color: '#282623',
      roughness: 0.9,
      metalness: 0.05,
    });
    const basePad = new THREE.Mesh(
      new THREE.BoxGeometry(this.roomWidthM + 0.6, 0.14, this.roomLengthM + 0.6),
      basePadMat,
    );
    basePad.position.set(0, -0.071, 0);
    basePad.receiveShadow = true;
    this.roomRoot.add(basePad);

    // Main Interior Floor
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: style.floorType === 'honed-concrete' ? 0.42 : 0.62,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomWidthM, this.roomLengthM),
      floorMat,
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.roomRoot.add(floorMesh);

    // Woven Area Rug (offset +0.015m above floor to eliminate Z-fighting)
    const rugW = Math.min(3.5, this.roomWidthM * 0.48);
    const rugD = Math.min(2.6, this.roomLengthM * 0.56);
    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      roughness: 0.94,
      metalness: 0.0,
    });
    const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(rugW, 0.014, rugD), rugMat);
    const livingCenterX = room.includeDiningZone && this.roomWidthM >= 5.6 ? -this.roomWidthM * 0.18 : 0;
    rugMesh.position.set(livingCenterX, 0.015, 0.12);
    rugMesh.receiveShadow = true;
    this.roomRoot.add(rugMesh);

    // Walls (cutaway front/south wall kept low or glass-framed for Orbit visibility, full height in Walkthrough)
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.88,
      metalness: 0.02,
    });
    const accentWallMat = new THREE.MeshStandardMaterial({
      map: accentWallTex,
      roughness: style.wallFinish === 'brick-accent' ? 0.92 : 0.86,
      metalness: 0.02,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(scheme.trimHex),
      roughness: 0.45,
      metalness: 0.1,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#DDEBF5',
      roughness: 0.06,
      metalness: 0.0,
      transmission: this.isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: this.isSoftwareGl ? 0.28 : 1,
      ior: 1.5,
      depthWrite: false,
    });

    const wallThick = 0.14;

    // North Wall (Back Wall with large architectural glazed window bay)
    const winW = Math.min(3.4, this.roomWidthM * 0.46);
    const winH = Math.min(1.85, heightM * 0.65);
    const sillH = 0.52;
    const headerH = Math.max(0.24, heightM - sillH - winH);
    const sideW = (this.roomWidthM - winW) / 2;

    if (sideW > 0.1) {
      const leftN = new THREE.Mesh(new THREE.BoxGeometry(sideW, heightM, wallThick), wallMat);
      leftN.position.set(-halfX + sideW / 2, heightM / 2, -halfZ);
      leftN.receiveShadow = true;
      leftN.castShadow = true;
      this.roomRoot.add(leftN);

      const rightN = new THREE.Mesh(new THREE.BoxGeometry(sideW, heightM, wallThick), wallMat);
      rightN.position.set(halfX - sideW / 2, heightM / 2, -halfZ);
      rightN.receiveShadow = true;
      rightN.castShadow = true;
      this.roomRoot.add(rightN);
    }

    const sillWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, wallThick), wallMat);
    sillWall.position.set(0, sillH / 2, -halfZ);
    sillWall.receiveShadow = true;
    this.roomRoot.add(sillWall);

    const headerWall = new THREE.Mesh(new THREE.BoxGeometry(winW, headerH, wallThick), wallMat);
    headerWall.position.set(0, sillH + winH + headerH / 2, -halfZ);
    this.roomRoot.add(headerWall);

    // Window Frame + Mullions + Glass
    const winFrameTop = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, wallThick + 0.03), trimMat);
    winFrameTop.position.set(0, sillH + winH - 0.03, -halfZ);
    this.roomRoot.add(winFrameTop);

    const winFrameBot = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, wallThick + 0.05), trimMat);
    winFrameBot.position.set(0, sillH + 0.03, -halfZ);
    this.roomRoot.add(winFrameBot);

    [-winW / 2 + 0.03, -winW / 6, winW / 6, winW / 2 - 0.03].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, winH, wallThick + 0.02), trimMat);
      mullion.position.set(mx, sillH + winH / 2, -halfZ);
      this.roomRoot.add(mullion);
    });

    const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(winW - 0.08, winH - 0.08), glassMat);
    windowPane.position.set(0, sillH + winH / 2, -halfZ);
    this.roomRoot.add(windowPane);

    // West Wall (Accent Material Wall)
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, heightM, this.roomLengthM), accentWallMat);
    westWall.position.set(-halfX, heightM / 2, 0);
    westWall.receiveShadow = true;
    westWall.castShadow = true;
    this.roomRoot.add(westWall);

    // East Wall
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, heightM, this.roomLengthM), wallMat);
    eastWall.position.set(halfX, heightM / 2, 0);
    eastWall.receiveShadow = true;
    eastWall.castShadow = true;
    this.roomRoot.add(eastWall);

    // South Wall (with Entry Doorway)
    const doorW = 0.96;
    const doorH = 2.15;
    const doorX = -halfX + 1.1;
    const southLeftW = Math.max(0.2, doorX - doorW / 2 + halfX);
    const southRightW = Math.max(0.2, halfX - (doorX + doorW / 2));

    const southLeft = new THREE.Mesh(new THREE.BoxGeometry(southLeftW, heightM, wallThick), wallMat);
    southLeft.position.set(-halfX + southLeftW / 2, heightM / 2, halfZ);
    this.roomRoot.add(southLeft);

    const southRight = new THREE.Mesh(new THREE.BoxGeometry(southRightW, heightM, wallThick), wallMat);
    southRight.position.set(halfX - southRightW / 2, heightM / 2, halfZ);
    this.roomRoot.add(southRight);

    const southHeaderH = Math.max(0.2, heightM - doorH);
    const southHeader = new THREE.Mesh(new THREE.BoxGeometry(doorW, southHeaderH, wallThick), wallMat);
    southHeader.position.set(doorX, doorH + southHeaderH / 2, halfZ);
    this.roomRoot.add(southHeader);

    // Architectural Entry Door Leaf & Frame
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW - 0.06, doorH - 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: scheme.woodHex, roughness: 0.55 }),
    );
    doorPanel.position.set(doorX, (doorH - 0.04) / 2, halfZ);
    this.roomRoot.add(doorPanel);

    const doorHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.025, 0.09),
      new THREE.MeshStandardMaterial({ color: scheme.metalHex, metalness: 0.8, roughness: 0.25 }),
    );
    doorHandle.position.set(doorX + 0.34, 1.0, halfZ - 0.04);
    this.roomRoot.add(doorHandle);

    // Baseboards along North, West, East walls
    const baseboardN = new THREE.Mesh(new THREE.BoxGeometry(this.roomWidthM, 0.11, 0.025), trimMat);
    baseboardN.position.set(0, 0.055, -halfZ + wallThick / 2 + 0.01);
    this.roomRoot.add(baseboardN);

    const baseboardW = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, this.roomLengthM), trimMat);
    baseboardW.position.set(-halfX + wallThick / 2 + 0.01, 0.055, 0);
    this.roomRoot.add(baseboardW);

    const baseboardE = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, this.roomLengthM), trimMat);
    baseboardE.position.set(halfX - wallThick / 2 - 0.01, 0.055, 0);
    this.roomRoot.add(baseboardE);

    // Optional Interior Partition Wall (detected from uploaded floor plan or toggled)
    if (room.includePartitionWall) {
      const partW = Math.min(2.1, this.roomLengthM * 0.42);
      const partition = new THREE.Mesh(new THREE.BoxGeometry(0.14, heightM, partW), accentWallMat);
      partition.position.set(this.roomWidthM * 0.12, heightM / 2, -halfZ + partW / 2 + 0.07);
      partition.castShadow = true;
      partition.receiveShadow = true;
      this.roomRoot.add(partition);
    }

    // Ceiling (shown only in first-person Walkthrough mode so Orbit views remain open)
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: scheme.wallHex,
      roughness: 0.92,
    });
    this.ceilingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomWidthM, this.roomLengthM),
      ceilingMat,
    );
    this.ceilingMesh.rotation.x = Math.PI / 2;
    this.ceilingMesh.position.set(0, heightM, 0);
    this.ceilingMesh.visible = this.cameraMode === 'walkthrough';
    this.roomRoot.add(this.ceilingMesh);

    // Multi-Part Composite Furniture Groups
    const furnitureMats = createFurnitureMaterials(style, scheme, artTex);

    // 1. Sofa against West or North-West living anchor
    const sofa = buildSofaGroup(furnitureMats);
    sofa.position.set(livingCenterX, 0, -halfZ + 0.72);
    this.roomRoot.add(sofa);

    // 2. Coffee Table centered on rug
    const coffeeTable = buildCoffeeTableGroup(furnitureMats);
    coffeeTable.position.set(livingCenterX, 0, -halfZ + 1.88);
    this.roomRoot.add(coffeeTable);

    // 3. Lounge Chair + Side Table
    const loungeChair = buildLoungeChairGroup(furnitureMats);
    loungeChair.position.set(livingCenterX - 1.48, 0, 0.35);
    loungeChair.rotation.y = 0.72;
    this.roomRoot.add(loungeChair);

    // 4. Media Credenza + Wall Gallery Art facing the Sofa
    const credenza = buildCredenzaGroup(furnitureMats);
    credenza.position.set(livingCenterX, 0, halfZ - 0.42);
    credenza.rotation.y = Math.PI;
    this.roomRoot.add(credenza);

    // 5. Floor Lamp near Sofa & Window
    const floorLamp = buildFloorLampGroup(furnitureMats);
    floorLamp.position.set(livingCenterX - 1.52, 0, -halfZ + 0.56);
    floorLamp.rotation.y = 0.4;
    this.roomRoot.add(floorLamp);
    this.lampLight.position.set(livingCenterX - 1.28, 1.52, -halfZ + 0.68);

    // 6. Architectural Indoor Plant in Window Corner
    const plant = buildPlantGroup(furnitureMats);
    plant.position.set(livingCenterX + 1.55, 0, -halfZ + 0.52);
    this.roomRoot.add(plant);

    // 7. Optional Dining Set Zone (when room is wide enough & enabled)
    if (room.includeDiningZone && this.roomWidthM >= 5.2) {
      const dining = buildDiningSetGroup(furnitureMats);
      dining.position.set(halfX - 1.55, 0, -0.15);
      this.roomRoot.add(dining);
    }

    this.trackObjectResources(this.roomRoot);
    this.applyLightingMood(lightingMood);
    this.requestRender();
  }

  public applyLightingMood(mood: LightingMood) {
    if (mood === 'daylight') {
      this.keyLight.color.set('#FFF9EF');
      this.keyLight.intensity = 1.75;
      this.keyLight.position.set(5.0, 8.5, -5.5);
      this.hemiLight.color.set('#EBF3FC');
      this.hemiLight.groundColor.set('#C4B39B');
      this.hemiLight.intensity = 0.85;
      this.lampLight.intensity = 0.7;
      this.ambientFill.intensity = 0.6;
      this.renderer.toneMappingExposure = 1.1;
    } else if (mood === 'golden') {
      this.keyLight.color.set('#FFC988');
      this.keyLight.intensity = 2.05;
      this.keyLight.position.set(-6.5, 3.6, -6.5);
      this.hemiLight.color.set('#FBE4CE');
      this.hemiLight.groundColor.set('#967358');
      this.hemiLight.intensity = 0.62;
      this.lampLight.intensity = 2.1;
      this.ambientFill.intensity = 0.42;
      this.renderer.toneMappingExposure = 1.08;
    } else {
      // Evening Lamp
      this.keyLight.color.set('#7A92B8');
      this.keyLight.intensity = 0.55;
      this.keyLight.position.set(3.5, 6.0, -5.5);
      this.hemiLight.color.set('#384660');
      this.hemiLight.groundColor.set('#4D3F32');
      this.hemiLight.intensity = 0.45;
      this.lampLight.intensity = 4.2;
      this.ambientFill.intensity = 0.35;
      this.renderer.toneMappingExposure = 1.02;
    }
    this.requestRender();
  }

  public setCameraMode(mode: CameraMode) {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;

    if (this.ceilingMesh) {
      this.ceilingMesh.visible = mode === 'walkthrough';
    }

    if (mode === 'walkthrough') {
      this.controls.enabled = false;
      this.walkYaw = 0.25;
      this.walkPitch = -0.05;
      this.transitionCamPos.set(0.2, 1.62, this.roomLengthM * 0.26);
      this.applyWalkOrientation();
      this.isTransitioning = true;
      this.transitionTarget.set(-0.6, 1.45, -this.roomLengthM * 0.25);
      this.ensureLoopRunning();
    } else {
      this.controls.enabled = true;
      this.setCameraPreset('isometric');
    }

    this.callbacks.onModeChange?.(mode);
  }

  public setCameraPreset(preset: CameraPreset) {
    if (preset === 'eye-level' || preset === 'window-nook' || preset === 'entry') {
      if (this.cameraMode !== 'walkthrough') {
        this.cameraMode = 'walkthrough';
        this.controls.enabled = false;
        if (this.ceilingMesh) this.ceilingMesh.visible = true;
        this.callbacks.onModeChange?.('walkthrough');
      }

      if (preset === 'eye-level') {
        this.transitionCamPos.set(0.2, 1.62, this.roomLengthM * 0.26);
        this.walkYaw = 0.22;
        this.walkPitch = -0.05;
      } else if (preset === 'window-nook') {
        this.transitionCamPos.set(-this.roomWidthM * 0.22, 1.62, -this.roomLengthM * 0.24);
        this.walkYaw = -2.35;
        this.walkPitch = -0.08;
      } else {
        this.transitionCamPos.set(-this.roomWidthM * 0.32, 1.62, this.roomLengthM * 0.36);
        this.walkYaw = -0.52;
        this.walkPitch = -0.04;
      }
      this.isTransitioning = true;
      this.ensureLoopRunning();
      return;
    }

    if (this.cameraMode !== 'orbit') {
      this.cameraMode = 'orbit';
      this.controls.enabled = true;
      if (this.ceilingMesh) this.ceilingMesh.visible = false;
      this.callbacks.onModeChange?.('orbit');
    }

    if (preset === 'top') {
      this.transitionCamPos.set(0, Math.max(8.5, this.roomWidthM * 1.18), 0.01);
      this.transitionTarget.set(0, 0, 0);
    } else {
      // Isometric architectural corner view
      this.transitionCamPos.set(this.roomWidthM * 0.78, 5.2, this.roomLengthM * 1.15);
      this.transitionTarget.set(0, 0.85, 0);
    }
    this.isTransitioning = true;
    this.ensureLoopRunning();
  }

  public zoomStep(direction: 'in' | 'out') {
    if (this.cameraMode !== 'orbit') return;
    const factor = direction === 'in' ? 0.82 : 1.22;
    _targetPos.copy(this.camera.position).sub(this.controls.target).multiplyScalar(factor);
    const dist = _targetPos.length();
    if (dist >= this.controls.minDistance && dist <= this.controls.maxDistance) {
      this.transitionCamPos.copy(this.controls.target).add(_targetPos);
      this.transitionTarget.copy(this.controls.target);
      this.isTransitioning = true;
      this.ensureLoopRunning();
    }
  }

  public nudgeWalkthrough(dx: number, dz: number, dyaw = 0) {
    if (this.cameraMode !== 'walkthrough') {
      this.setCameraMode('walkthrough');
    }
    this.walkYaw += dyaw;
    this.applyWalkOrientation();
    this.moveWalkthrough(dx, dz);
    this.requestRender();
  }

  private applyWalkOrientation() {
    _euler.set(this.walkPitch, this.walkYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
  }

  private moveWalkthrough(rightStep: number, forwardStep: number) {
    _forward.set(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.walkYaw);
    _right.set(1, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.walkYaw);

    this.camera.position.addScaledVector(_forward, forwardStep);
    this.camera.position.addScaledVector(_right, rightStep);

    // Collision clamping inside room perimeter
    const pad = 0.48;
    this.camera.position.x = THREE.MathUtils.clamp(
      this.camera.position.x,
      -this.roomWidthM / 2 + pad,
      this.roomWidthM / 2 - pad,
    );
    this.camera.position.z = THREE.MathUtils.clamp(
      this.camera.position.z,
      -this.roomLengthM / 2 + pad,
      this.roomLengthM / 2 - pad,
    );
    this.camera.position.y = 1.62;
  }

  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public requestRender() {
    if (this.disposed || this.loopActive) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      if (this.cameraMode === 'orbit') {
        this.controls.update();
      }
      this.renderer.render(this.scene, this.camera);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty) this.requestRender();
      };
      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  private ensureLoopRunning() {
    if (this.loopActive || this.disposed) return;
    this.loopActive = true;
    this.clock.getDelta();
    this.tick();
  }

  private tick = () => {
    if (this.disposed) return;
    const delta = Math.min(0.08, this.clock.getDelta());
    let needsMoreFrames = false;

    if (this.isTransitioning) {
      const lambda = 7.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.transitionCamPos.x, lambda, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.transitionCamPos.y, lambda, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.transitionCamPos.z, lambda, delta);

      if (this.cameraMode === 'orbit') {
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.transitionTarget.x, lambda, delta);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.transitionTarget.y, lambda, delta);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.transitionTarget.z, lambda, delta);
        this.controls.update();
      } else {
        this.applyWalkOrientation();
      }

      if (this.camera.position.distanceTo(this.transitionCamPos) < 0.025) {
        this.camera.position.copy(this.transitionCamPos);
        if (this.cameraMode === 'orbit') {
          this.controls.target.copy(this.transitionTarget);
          this.controls.update();
        }
        this.isTransitioning = false;
      } else {
        needsMoreFrames = true;
      }
    }

    if (this.cameraMode === 'walkthrough' && this.keysPressed.size > 0) {
      const speed = 2.8 * delta;
      let fwd = 0;
      let right = 0;
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) fwd += speed;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) fwd -= speed;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) right += speed;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) right -= speed;
      if (fwd !== 0 || right !== 0) {
        this.moveWalkthrough(right, fwd);
        needsMoreFrames = true;
      }
    }

    if (this.cameraMode === 'orbit' && !this.isTransitioning) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);

    if (needsMoreFrames) {
      if (this.isSoftwareGl) this.afterDraw(this.tick);
      else this.frameId = requestAnimationFrame(this.tick);
    } else {
      this.loopActive = false;
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.clearRoomResources();
    this.controls.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
