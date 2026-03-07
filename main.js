import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ═══════════════════════════════════════════
   Constants & Configuration
   ═══════════════════════════════════════════ */
const DEG = Math.PI / 180;
const LERP_SPEED = 6;

// Dimensions
const WHEEL_R = 0.28, WHEEL_W = 0.12;
const CHASSIS  = { w: 2.0, h: 0.28, d: 1.3 };
const TURRET   = { r: 0.38, h: 0.22 };
const ARM_UP   = { w: 0.16, h: 1.0, d: 0.16 };
const ARM_LO   = { w: 0.14, h: 0.78, d: 0.14 };
const FINGER   = { w: 0.05, h: 0.38, d: 0.10 };

// Colors
const C = {
  chassis: 0x2a2a3e, wheel: 0x1a1a1a, wheelHub: 0x4a4a55,
  turret: 0x3d3d55, arm: 0xf06830, joint: 0x9999bb,
  claw: 0xaabbcc, gear: 0xd4a84c, ground: 0x1a2233,
};

/* ═══════════════════════════════════════════
   Globals
   ═══════════════════════════════════════════ */
let scene, camera, renderer, orbit, clock;
let robotGroup, turretGrp, shoulderGrp, elbowGrp, wristGrp, clawRotGrp;
let leftFingerGrp, rightFingerGrp, gear1, gear2;
let wheelGrps = [];
let dirArrow;

const target  = { baseRot: 0, pitch: 0, clawOpen: true, clawRot: 0 };
const current = { baseRot: 0, pitch: 0, clawAng: 0.35, clawRot: 0 };
const keys = {};
const robot = { x: 0, z: 0, yaw: 0 };
let wheelSpin = 0;

/* ═══════════════════════════════════════════
   Initialization
   ═══════════════════════════════════════════ */
init();
requestAnimationFrame(animate);

function init() {
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e2d40);
  scene.fog = new THREE.FogExp2(0x1e2d40, 0.012);

  // Camera
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 150);
  camera.position.set(5, 3.5, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  // Orbit Controls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.target.set(0, 1.2, 0);
  orbit.minDistance = 2;
  orbit.maxDistance = 20;

  setupLights();
  setupGround();
  buildRobot();
  buildDirectionArrow();
  setupUI();
  setupKeys();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

/* ═══════════════════════════════════════════
   Lights
   ═══════════════════════════════════════════ */
function setupLights() {
  scene.add(new THREE.AmbientLight(0x667799, 0.8));

  const dir = new THREE.DirectionalLight(0xfff0dd, 2.0);
  dir.position.set(5, 12, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 30;
  [-8, 8, 8, -8].forEach((v, i) => {
    const c = dir.shadow.camera;
    [c.left, c.right, c.top, c.bottom][i] = v;
  });
  dir.shadow.bias = -0.0002;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0x6699cc, 0.5);
  fill.position.set(-5, 6, -4);
  scene.add(fill);

  // Backlight rim
  const rim = new THREE.DirectionalLight(0x8899bb, 0.4);
  rim.position.set(0, 4, -8);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0x88aadd, 0x334455, 0.6));
}

/* ═══════════════════════════════════════════
   Ground
   ═══════════════════════════════════════════ */
function setupGround() {
  const grid = new THREE.GridHelper(40, 40, 0x3a5070, 0x253548);
  grid.material.opacity = 0.6;
  grid.material.transparent = true;
  scene.add(grid);

  const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a2838, roughness: 0.88, metalness: 0.08 })
  );
  gnd.rotation.x = -Math.PI / 2;
  gnd.receiveShadow = true;
  scene.add(gnd);
}

/* ═══════════════════════════════════════════
   Materials Helper
   ═══════════════════════════════════════════ */
function mat(color, rough = 0.5, metal = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

/* ═══════════════════════════════════════════
   Gear Geometry
   ═══════════════════════════════════════════ */
function gearGeo(innerR, outerR, teeth, depth) {
  const shape = new THREE.Shape();
  const ta = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * ta, q = ta / 4;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    shape[fn](Math.cos(a) * innerR, Math.sin(a) * innerR);
    shape.lineTo(Math.cos(a + q * 0.5) * outerR, Math.sin(a + q * 0.5) * outerR);
    shape.lineTo(Math.cos(a + q * 1.5) * outerR, Math.sin(a + q * 1.5) * outerR);
    shape.lineTo(Math.cos(a + q * 2.0) * innerR, Math.sin(a + q * 2.0) * innerR);
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

/* ═══════════════════════════════════════════
   Build Robot
   ═══════════════════════════════════════════ */
function buildRobot() {
  const mChassis  = mat(C.chassis, 0.55, 0.75);
  const mWheel    = mat(C.wheel, 0.92, 0.08);
  const mHub      = mat(C.wheelHub, 0.5, 0.7);
  const mTurret   = mat(C.turret, 0.45, 0.8);
  const mArm      = mat(C.arm, 0.3, 0.55);
  const mJoint    = mat(C.joint, 0.35, 0.85);
  const mClaw     = mat(C.claw, 0.3, 0.75);
  const mGear     = mat(C.gear, 0.25, 0.9);

  robotGroup = new THREE.Group();
  scene.add(robotGroup);

  const chassisY = WHEEL_R + CHASSIS.h / 2;

  // ── Chassis ──
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(CHASSIS.w, CHASSIS.h, CHASSIS.d), mChassis);
  chassis.position.y = chassisY;
  chassis.castShadow = chassis.receiveShadow = true;
  robotGroup.add(chassis);

  // Chassis accent strip
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(CHASSIS.w * 0.95, 0.02, CHASSIS.d * 0.6),
    mat(0xe45a22, 0.3, 0.5)
  );
  strip.position.y = chassisY + CHASSIS.h / 2 + 0.01;
  robotGroup.add(strip);

  // ── Wheels ──
  const wGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 20);
  const hGeo = new THREE.CylinderGeometry(WHEEL_R * 0.35, WHEEL_R * 0.35, WHEEL_W + 0.005, 12);

  const wPos = [
    [-CHASSIS.w / 2 - WHEEL_W / 2, WHEEL_R,  CHASSIS.d / 2 - 0.15],
    [ CHASSIS.w / 2 + WHEEL_W / 2, WHEEL_R,  CHASSIS.d / 2 - 0.15],
    [-CHASSIS.w / 2 - WHEEL_W / 2, WHEEL_R, -CHASSIS.d / 2 + 0.15],
    [ CHASSIS.w / 2 + WHEEL_W / 2, WHEEL_R, -CHASSIS.d / 2 + 0.15],
  ];

  wPos.forEach(([x, y, z]) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const w = new THREE.Mesh(wGeo, mWheel);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    grp.add(w);

    const h = new THREE.Mesh(hGeo, mHub);
    h.rotation.z = Math.PI / 2;
    grp.add(h);

    // Tire treads (3 ring accents)
    for (let t = -1; t <= 1; t++) {
      const tread = new THREE.Mesh(
        new THREE.TorusGeometry(WHEEL_R - 0.01, 0.012, 6, 16),
        mHub
      );
      tread.position.set(t * WHEEL_W * 0.3, 0, 0);
      tread.rotation.y = Math.PI / 2;
      grp.add(tread);
    }

    robotGroup.add(grp);
    wheelGrps.push(grp);
  });

  // ── Turret ── (Servo 1 : Y-rotation)
  const turretY = WHEEL_R + CHASSIS.h;
  turretGrp = new THREE.Group();
  turretGrp.position.y = turretY;
  robotGroup.add(turretGrp);

  const turret = new THREE.Mesh(
    new THREE.CylinderGeometry(TURRET.r, TURRET.r * 1.15, TURRET.h, 24),
    mTurret
  );
  turret.position.y = TURRET.h / 2;
  turret.castShadow = true;
  turretGrp.add(turret);

  // Turret ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TURRET.r * 0.55, 0.03, 8, 24), mJoint);
  ring.position.y = TURRET.h;
  ring.rotation.x = Math.PI / 2;
  turretGrp.add(ring);

  // ── Shoulder ── (Servo 2 : pitch)
  shoulderGrp = new THREE.Group();
  shoulderGrp.position.y = TURRET.h;
  turretGrp.add(shoulderGrp);

  shoulderGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), mJoint));

  const upArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_UP.w, ARM_UP.h, ARM_UP.d), mArm);
  upArm.position.y = ARM_UP.h / 2;
  upArm.castShadow = true;
  shoulderGrp.add(upArm);

  // ── Elbow ── (Servo 3 : pitch)
  elbowGrp = new THREE.Group();
  elbowGrp.position.y = ARM_UP.h;
  shoulderGrp.add(elbowGrp);

  elbowGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), mJoint));

  const loArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_LO.w, ARM_LO.h, ARM_LO.d), mArm);
  loArm.position.y = ARM_LO.h / 2;
  loArm.castShadow = true;
  elbowGrp.add(loArm);

  // ── Wrist ── (Servo 4 : pitch)
  wristGrp = new THREE.Group();
  wristGrp.position.y = ARM_LO.h;
  elbowGrp.add(wristGrp);

  wristGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), mJoint));

  // ── Claw Rotation Group ── (Servo 6 : Y-rotation of claw)
  clawRotGrp = new THREE.Group();
  wristGrp.add(clawRotGrp);

  // ── Claw Assembly ── (Servo 5 : open/close via gears)
  const clawBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), mClaw);
  clawBase.position.y = 0.08;
  clawBase.castShadow = true;
  clawRotGrp.add(clawBase);

  // Gears
  const gGeo = gearGeo(0.035, 0.07, 8, 0.025);
  gear1 = new THREE.Mesh(gGeo, mGear);
  gear1.position.set(-0.11, 0.08, 0);
  gear1.rotation.y = Math.PI / 2;
  clawRotGrp.add(gear1);

  gear2 = new THREE.Mesh(gGeo, mGear);
  gear2.position.set(0.11, 0.08, 0);
  gear2.rotation.y = Math.PI / 2;
  clawRotGrp.add(gear2);

  // Gear axle dots
  const axGeo = new THREE.SphereGeometry(0.02, 8, 8);
  [-0.11, 0.11].forEach(x => {
    const ax = new THREE.Mesh(axGeo, mGear);
    ax.position.set(x, 0.08, 0.02);
    clawRotGrp.add(ax);
  });

  // Fingers
  const fGeo = new THREE.BoxGeometry(FINGER.w, FINGER.h, FINGER.d);

  leftFingerGrp = new THREE.Group();
  leftFingerGrp.position.set(-0.06, 0.15, 0);
  clawRotGrp.add(leftFingerGrp);
  const lf = new THREE.Mesh(fGeo, mClaw);
  lf.position.y = FINGER.h / 2;
  lf.castShadow = true;
  leftFingerGrp.add(lf);
  // Finger tip (inward hook)
  const tipGeo = new THREE.BoxGeometry(FINGER.w, 0.08, FINGER.d * 0.7);
  const lt = new THREE.Mesh(tipGeo, mClaw);
  lt.position.set(FINGER.w * 0.4, FINGER.h, 0);
  lt.rotation.z = -0.35;
  leftFingerGrp.add(lt);

  rightFingerGrp = new THREE.Group();
  rightFingerGrp.position.set(0.06, 0.15, 0);
  clawRotGrp.add(rightFingerGrp);
  const rf = new THREE.Mesh(fGeo, mClaw);
  rf.position.y = FINGER.h / 2;
  rf.castShadow = true;
  rightFingerGrp.add(rf);
  const rt = new THREE.Mesh(tipGeo, mClaw);
  rt.position.set(-FINGER.w * 0.4, FINGER.h, 0);
  rt.rotation.z = 0.35;
  rightFingerGrp.add(rt);
}

/* ═══════════════════════════════════════════
   Direction Arrow
   ═══════════════════════════════════════════ */
function buildDirectionArrow() {
  const arrowGrp = new THREE.Group();

  // Arrow shaft
  const shaftGeo = new THREE.BoxGeometry(0.08, 0.04, 1.2);
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.6,
    roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.85,
  });
  const shaft = new THREE.Mesh(shaftGeo, arrowMat);
  shaft.position.z = 0.6;
  arrowGrp.add(shaft);

  // Arrow head (cone)
  const headGeo = new THREE.ConeGeometry(0.16, 0.35, 8);
  const head = new THREE.Mesh(headGeo, arrowMat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 1.35;
  arrowGrp.add(head);

  // Glow ring at base
  const ringGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 16);
  const ring = new THREE.Mesh(ringGeo, arrowMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.0;
  arrowGrp.add(ring);

  arrowGrp.position.y = 0.05; // Just above ground
  arrowGrp.visible = false;

  dirArrow = arrowGrp;
  robotGroup.add(dirArrow);
}

/* ═══════════════════════════════════════════
   UI Controls
   ═══════════════════════════════════════════ */
function setupUI() {
  const rotSlider    = document.getElementById('rotation-slider');
  const pitchSlider  = document.getElementById('pitch-slider');
  const clawRotSl    = document.getElementById('claw-rot-slider');
  const clawBtn      = document.getElementById('claw-btn');
  const resetBtn     = document.getElementById('reset-btn');
  const rotVal       = document.getElementById('rotation-value');
  const pitchVal     = document.getElementById('pitch-value');
  const clawRotVal   = document.getElementById('claw-rot-value');

  rotSlider.addEventListener('input', () => {
    const t = parseFloat(rotSlider.value) / 100;
    target.baseRot = (t - 0.5) * 2 * Math.PI;
    rotVal.textContent = Math.round((t - 0.5) * 360) + '°';
  });

  pitchSlider.addEventListener('input', () => {
    const t = parseFloat(pitchSlider.value) / 100;
    target.pitch = (-30 + t * 120) * DEG;
    pitchVal.textContent = Math.round(-30 + t * 120) + '°';
  });

  clawRotSl.addEventListener('input', () => {
    const t = parseFloat(clawRotSl.value) / 100;
    target.clawRot = (t - 0.5) * 2 * Math.PI;             // -π → +π
    clawRotVal.textContent = Math.round((t - 0.5) * 360) + '°';
  });

  clawBtn.addEventListener('click', () => {
    target.clawOpen = !target.clawOpen;
    clawBtn.textContent = target.clawOpen ? '🤏 GRAB' : '✋ RELEASE';
    clawBtn.classList.toggle('grabbed', !target.clawOpen);
  });

  resetBtn.addEventListener('click', () => {
    target.baseRot = 0; target.pitch = 0; target.clawOpen = true; target.clawRot = 0;
    robot.x = robot.z = robot.yaw = 0;
    rotSlider.value = 50; pitchSlider.value = 25; clawRotSl.value = 50;
    rotVal.textContent = '0°'; pitchVal.textContent = '0°'; clawRotVal.textContent = '0°';
    clawBtn.textContent = '🤏 GRAB';
    clawBtn.classList.remove('grabbed');
  });
}

/* ═══════════════════════════════════════════
   Keyboard
   ═══════════════════════════════════════════ */
function setupKeys() {
  addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
function lerp(a, b, t) { return a + (b - a) * t; }

/* ═══════════════════════════════════════════
   Animation Loop
   ═══════════════════════════════════════════ */
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const lf = 1 - Math.exp(-LERP_SPEED * dt);

  // ── WASD Movement ──
  const spd = 2.8, turn = 2.2;
  let moved = false;

  if (keys['a']) { robot.yaw += turn * dt; moved = true; }
  if (keys['d']) { robot.yaw -= turn * dt; moved = true; }

  const fwd = { x: Math.sin(robot.yaw), z: Math.cos(robot.yaw) };
  if (keys['w']) { robot.x += fwd.x * spd * dt; robot.z += fwd.z * spd * dt; moved = true; }
  if (keys['s']) { robot.x -= fwd.x * spd * dt; robot.z -= fwd.z * spd * dt; moved = true; }

  robotGroup.position.set(robot.x, 0, robot.z);
  robotGroup.rotation.y = robot.yaw;

  // Wheel spin
  if (moved) {
    const dir = keys['s'] ? -1 : 1;
    wheelSpin += dir * spd * dt * 2.5;
  }
  wheelGrps.forEach(g => {
    // The wheel meshes are the first two children (wheel + hub)
    g.children[0].rotation.x = wheelSpin;
    g.children[1].rotation.x = wheelSpin;
  });

  // ── Direction Arrow ──
  const isMoving = keys['w'] || keys['s'] || keys['a'] || keys['d'];
  dirArrow.visible = isMoving;
  if (isMoving) {
    // Pulse the arrow opacity for a lively feel
    const pulse = 0.65 + 0.2 * Math.sin(clock.elapsedTime * 6);
    dirArrow.children.forEach(c => { c.material.opacity = pulse; });
  }

  // ── Interpolate Joints ──
  current.baseRot = lerp(current.baseRot, target.baseRot, lf);
  current.pitch   = lerp(current.pitch,   target.pitch,   lf);
  current.clawRot = lerp(current.clawRot, target.clawRot, lf);

  const clawTarget = target.clawOpen ? 0.35 : 0.02;
  current.clawAng  = lerp(current.clawAng, clawTarget, lf * 0.7);

  // ── Apply Joints ──
  turretGrp.rotation.y    = current.baseRot;                      // Servo 1
  shoulderGrp.rotation.x  = current.pitch;                        // Servo 2
  elbowGrp.rotation.x     = current.pitch * 0.6;                  // Servo 3
  wristGrp.rotation.x     = current.pitch * 0.35;                 // Servo 4

  // Claw open/close (Servo 5)
  leftFingerGrp.rotation.z  =  current.clawAng;
  rightFingerGrp.rotation.z = -current.clawAng;

  // Claw rotation (Servo 6)
  clawRotGrp.rotation.y = current.clawRot;

  // Gear animation - rotate when claw is changing
  const gearRot = current.clawAng * 8;
  gear1.rotation.x =  gearRot;
  gear2.rotation.x = -gearRot;

  // ── Camera target follows robot ──
  orbit.target.set(robot.x, 1.2, robot.z);
  orbit.update();

  renderer.render(scene, camera);
}
