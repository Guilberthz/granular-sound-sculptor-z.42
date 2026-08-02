import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "../shaders";
import {
  BLACK_HOLE_VERTEX,
  BLACK_HOLE_FRAGMENT,
  PHOTON_RING_VERTEX,
  PHOTON_RING_FRAGMENT,
  EVENT_HORIZON_VERTEX,
  EVENT_HORIZON_FRAGMENT,
  LENSING_VERTEX,
  LENSING_FRAGMENT,
  JET_VERTEX,
  JET_FRAGMENT,
} from "../blackHoleShaders";
import { ParticleMode } from "../types";

function particleModeValue(mode: ParticleMode): number {
  if (mode === "dots") return 0.0;
  if (mode === "rings") return 1.0;
  if (mode === "blackhole") return 3.0;
  return 2.0;
}

function pitchNorm(pitch: number): number {
  return Math.min(1, Math.max(0, (pitch - 0.2) / 1.8));
}

interface UseThreeSceneParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  orbitTargetRef: React.RefObject<HTMLDivElement | null>;
  analyserRef: React.RefObject<AnalyserNode | null>;
  grainDensity: number;
  isGlitchVoid: boolean;
  particleMode: ParticleMode;
  blurIntensity: number;
  glowIntensity: number;
  accretionIntensity: number;
  isPlaying: boolean;
  autoRotate: boolean;
  pitchShift: number;
}

export function useThreeScene(params: UseThreeSceneParams) {
  const { canvasRef, viewportRef, orbitTargetRef, analyserRef } = params;

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const requestRef = useRef<number | null>(null);
  const savedCamPos = useRef<THREE.Vector3 | null>(null);
  const liveGrainDensity = useRef(params.grainDensity);
  const liveIsGlitchVoid = useRef(params.isGlitchVoid);
  const liveParticleMode = useRef(params.particleMode);
  const liveBlurIntensity = useRef(params.blurIntensity);
  const liveGlowIntensity = useRef(params.glowIntensity);
  const liveAccretionIntensity = useRef(params.accretionIntensity);
  const liveIsPlaying = useRef(params.isPlaying);
  const liveAutoRotate = useRef(params.autoRotate);
  const livePitchShift = useRef(params.pitchShift);
  liveGrainDensity.current = params.grainDensity;
  liveIsGlitchVoid.current = params.isGlitchVoid;
  liveParticleMode.current = params.particleMode;
  liveBlurIntensity.current = params.blurIntensity;
  liveGlowIntensity.current = params.glowIntensity;
  liveAccretionIntensity.current = params.accretionIntensity;
  liveIsPlaying.current = params.isPlaying;
  liveAutoRotate.current = params.autoRotate;
  livePitchShift.current = params.pitchShift;

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    if (savedCamPos.current) {
      camera.position.copy(savedCamPos.current);
    } else {
      camera.position.set(0, 0, 3.2);
    }
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, orbitTargetRef.current ?? viewportRef.current ?? canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 0.8;
    controls.maxDistance = 15;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    rendererRef.current = renderer;

    const particleCount = 18000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const angles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const r = 0.45 + Math.pow(Math.random(), 1.8) * 1.6;
      const angle = Math.random() * Math.PI * 2;
      radii[i] = r;
      angles[i] = angle;
      sizes[i] = 2.0 + Math.random() * 3.5;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.4 * r;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAudioFreq: { value: 0 },
        uGrainDensity: { value: liveGrainDensity.current },
        uGlitch: { value: liveIsGlitchVoid.current ? 1.0 : 0.0 },
        uParticleMode: { value: particleModeValue(liveParticleMode.current) },
        uBlurIntensity: { value: liveBlurIntensity.current },
        uGlowIntensity: { value: liveGlowIntensity.current },
        uPitch: { value: pitchNorm(livePitchShift.current) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      depthTest: true,
    });
    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = 0.6;
    particles.rotation.y = 0.2;
    scene.add(particles);

    // Central core: remains visible independently of the particle effects.
    const coreGeometry = new THREE.SphereGeometry(0.42, 48, 48);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: false,
      depthWrite: true,
    });
    const coreSphere = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(coreSphere);

    const glowDustCount = 2800;
    const glowDustGeo = new THREE.BufferGeometry();
    const glowDustPos = new Float32Array(glowDustCount * 3);
    const glowDustRadii = new Float32Array(glowDustCount);
    const glowDustAngles = new Float32Array(glowDustCount);
    for (let i = 0; i < glowDustCount; i++) {
      const r = 0.55 + Math.pow(Math.random(), 1.6) * 0.45;
      const a = Math.random() * Math.PI * 2;
      glowDustRadii[i] = r;
      glowDustAngles[i] = a;
      glowDustPos[i * 3] = Math.cos(a) * r;
      glowDustPos[i * 3 + 1] = (Math.random() - 0.5) * 0.1 * r;
      glowDustPos[i * 3 + 2] = Math.sin(a) * r;
    }
    glowDustGeo.setAttribute("position", new THREE.BufferAttribute(glowDustPos, 3));
    const glowDustMat = new THREE.PointsMaterial({
      color: 0xff0040,
      size: 0.02,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const glowDust = new THREE.Points(glowDustGeo, glowDustMat);
    glowDust.position.set(0, 0, 0);
    glowDust.rotation.x = 0.4;
    scene.add(glowDust);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const ctx = glowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0.6)");
    gradient.addColorStop(0.1, "rgba(220,220,255,0.25)");
    gradient.addColorStop(0.3, "rgba(180,180,220,0.08)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.position.set(0, 0, -3);
    glowSprite.scale.set(5, 5, 1);
    camera.add(glowSprite);

    const diskCount = 1500;
    const diskGeo = new THREE.BufferGeometry();
    const diskPos = new Float32Array(diskCount * 3);
    const diskSizes = new Float32Array(diskCount);
    const diskAngles = new Float32Array(diskCount);
    const diskRadii = new Float32Array(diskCount);
    for (let i = 0; i < diskCount; i++) {
      const r = 0.4 + Math.pow(Math.random(), 0.5) * 1.3;
      const angle = Math.random() * Math.PI * 2;
      const spread = (Math.random() - 0.5) * 0.15 * r;
      diskRadii[i] = r;
      diskAngles[i] = angle;
      diskSizes[i] = 0.005 + Math.random() * 0.015;
      diskPos[i * 3] = Math.cos(angle) * r;
      diskPos[i * 3 + 1] = spread;
      diskPos[i * 3 + 2] = Math.sin(angle) * r;
    }
    diskGeo.setAttribute("position", new THREE.BufferAttribute(diskPos, 3));
    diskGeo.setAttribute("aSize", new THREE.BufferAttribute(diskSizes, 1));
    const diskMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const disk = new THREE.Points(diskGeo, diskMat);
    disk.rotation.x = 0.3;
    scene.add(disk);

    const smokeCount = 350;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeRadii = new Float32Array(smokeCount);
    const smokeAngles = new Float32Array(smokeCount);
    const smokeVerts = new Float32Array(smokeCount);
    for (let i = 0; i < smokeCount; i++) {
      const r = 0.5 + Math.random() * 1.8;
      const angle = Math.random() * Math.PI * 2;
      smokeRadii[i] = r;
      smokeAngles[i] = angle;
      smokeVerts[i] = (Math.random() - 0.5) * 0.5;
      smokePos[i * 3] = Math.cos(angle) * r;
      smokePos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      smokePos[i * 3 + 2] = Math.sin(angle) * r;
    }
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.2,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const smoke = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smoke);

    // ===== Black Hole System (4th particle mode) =====
    const blackHoleGroup = new THREE.Group();
    blackHoleGroup.rotation.x = 0.9;
    blackHoleGroup.visible = false;
    scene.add(blackHoleGroup);

    const starCanvas = document.createElement("canvas");
    starCanvas.width = 64;
    starCanvas.height = 64;
    const starCtx = starCanvas.getContext("2d")!;
    starCtx.fillStyle = "#000";
    starCtx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      starCtx.fillStyle = `rgba(255,255,255,${Math.random()})`;
      starCtx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const accretionCount = 3000;
    const accretionGeo = new THREE.BufferGeometry();
    const accretionPos = new Float32Array(accretionCount * 3);
    const accretionRadius = new Float32Array(accretionCount);
    const accretionAngle = new Float32Array(accretionCount);
    const accretionRing = new Float32Array(accretionCount);
    const accretionSize = new Float32Array(accretionCount);
    for (let i = 0; i < accretionCount; i++) {
      const r = 0.5 + Math.pow(Math.random(), 1.5) * 2.0;
      const a = Math.random() * Math.PI * 2;
      accretionRadius[i] = r;
      accretionAngle[i] = a;
      accretionRing[i] = Math.random();
      accretionSize[i] = 0.4 + Math.random() * 1.6;
      accretionPos[i * 3] = Math.cos(a) * r;
      accretionPos[i * 3 + 1] = 0;
      accretionPos[i * 3 + 2] = Math.sin(a) * r;
    }
    accretionGeo.setAttribute("position", new THREE.BufferAttribute(accretionPos, 3));
    accretionGeo.setAttribute("aRadius", new THREE.BufferAttribute(accretionRadius, 1));
    accretionGeo.setAttribute("aAngle", new THREE.BufferAttribute(accretionAngle, 1));
    accretionGeo.setAttribute("aRingIndex", new THREE.BufferAttribute(accretionRing, 1));
    accretionGeo.setAttribute("aSize", new THREE.BufferAttribute(accretionSize, 1));
    const accretionMat = new THREE.ShaderMaterial({
      vertexShader: BLACK_HOLE_VERTEX,
      fragmentShader: BLACK_HOLE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAudioFreq: { value: 0 },
        uSpin: { value: 1 },
        uAccretionIntensity: { value: liveAccretionIntensity.current },
        uTemperature: { value: 3.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const accretion = new THREE.Points(accretionGeo, accretionMat);
    blackHoleGroup.add(accretion);

    const photonCount = 500;
    const photonGeo = new THREE.BufferGeometry();
    const photonPos = new Float32Array(photonCount * 3);
    const photonAngle = new Float32Array(photonCount);
    const photonRadius = new Float32Array(photonCount);
    for (let i = 0; i < photonCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.55 + (Math.random() - 0.5) * 0.02;
      photonAngle[i] = a;
      photonRadius[i] = r;
      photonPos[i * 3] = Math.cos(a) * r;
      photonPos[i * 3 + 1] = 0;
      photonPos[i * 3 + 2] = Math.sin(a) * r;
    }
    photonGeo.setAttribute("position", new THREE.BufferAttribute(photonPos, 3));
    photonGeo.setAttribute("aAngle", new THREE.BufferAttribute(photonAngle, 1));
    photonGeo.setAttribute("aRadius", new THREE.BufferAttribute(photonRadius, 1));
    const photonMat = new THREE.ShaderMaterial({
      vertexShader: PHOTON_RING_VERTEX,
      fragmentShader: PHOTON_RING_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uAudioFreq: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const photonRing = new THREE.Points(photonGeo, photonMat);
    blackHoleGroup.add(photonRing);

    const horizonGeo = new THREE.SphereGeometry(0.42, 48, 48);
    const horizonMat = new THREE.ShaderMaterial({
      vertexShader: EVENT_HORIZON_VERTEX,
      fragmentShader: EVENT_HORIZON_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAudioFreq: { value: 0 },
        uStarField: { value: starTexture },
      },
    });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    blackHoleGroup.add(horizon);

    const jetCount = 400;
    const jetGeo = new THREE.BufferGeometry();
    const jetPos = new Float32Array(jetCount * 3);
    const jetHeight = new Float32Array(jetCount);
    const jetAngle = new Float32Array(jetCount);
    for (let i = 0; i < jetCount; i++) {
      jetHeight[i] = Math.random();
      jetAngle[i] = Math.random() * Math.PI * 2;
      jetPos[i * 3] = 0;
      jetPos[i * 3 + 1] = Math.random() * 2 - 0.5;
      jetPos[i * 3 + 2] = 0;
    }
    jetGeo.setAttribute("position", new THREE.BufferAttribute(jetPos, 3));
    jetGeo.setAttribute("aHeight", new THREE.BufferAttribute(jetHeight, 1));
    jetGeo.setAttribute("aAngle", new THREE.BufferAttribute(jetAngle, 1));
    const jetMat = new THREE.ShaderMaterial({
      vertexShader: JET_VERTEX,
      fragmentShader: JET_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uAudioFreq: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const jets = new THREE.Points(jetGeo, jetMat);
    blackHoleGroup.add(jets);

    // Lensing render target + fullscreen post-process pass
    const pixelRatio = renderer.getPixelRatio();
    const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio);
    const lensingMat = new THREE.ShaderMaterial({
      vertexShader: LENSING_VERTEX,
      fragmentShader: LENSING_FRAGMENT,
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        uTime: { value: 0 },
        uBHMass: { value: 1 },
        uBHScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
        uBHRadius: { value: 0.05 },
        uAspect: { value: width / height },
      },
      depthTest: false,
      depthWrite: false,
    });
    const lensScene = new THREE.Scene();
    const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensingMat);
    lensQuad.frustumCulled = false;
    lensScene.add(lensQuad);
    const lensCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    lensCamera.position.z = 1;
    lensCamera.lookAt(0, 0, 0);

    const bhCenterNDC = new THREE.Vector3();
    const bhEdgeNDC = new THREE.Vector3();

    const dataArray = new Uint8Array(64);
    let frameCount = 0;
    let lastAvgFreq = 0;
    let cachedAvgFreq = 0;
    let lastRenderTime = 0;

    const animate = (time: number) => {
      requestRef.current = requestAnimationFrame(animate);

      // Visibility check - pause heavy updates when tab is hidden
      if (document.hidden) {
        controls.update();
        renderer.render(scene, camera);
        return;
      }

      // Idle FPS cap: ~30fps when nothing is playing frees main-thread time for UI input.
      if (!liveIsPlaying.current && lastRenderTime > 0 && time - lastRenderTime < 1000 / 30) return;
      lastRenderTime = time;

      frameCount++;

      // Throttle audio analysis to every 3rd frame (60fps -> 20fps for audio)
      if (frameCount % 3 === 0 && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        lastAvgFreq = sum / (dataArray.length * 255);
      }
      cachedAvgFreq = lastAvgFreq;
      const avgFreq = cachedAvgFreq;

      const t = time * 0.0008;

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = t;
        materialRef.current.uniforms.uAudioFreq.value = avgFreq;
        materialRef.current.uniforms.uGrainDensity.value = liveGrainDensity.current;
        materialRef.current.uniforms.uGlitch.value = liveIsGlitchVoid.current ? 1.0 : 0.0;
        materialRef.current.uniforms.uParticleMode.value = particleModeValue(liveParticleMode.current);
        materialRef.current.uniforms.uBlurIntensity.value = liveBlurIntensity.current;
        materialRef.current.uniforms.uGlowIntensity.value = liveGlowIntensity.current;
        materialRef.current.uniforms.uPitch.value = pitchNorm(livePitchShift.current);
      }

      controls.autoRotate = liveAutoRotate.current;

      // BLACK HOLE MODE: hide the standard cloud, run the BH system + lensing post-process
      const isBlackhole = liveParticleMode.current === "blackhole";
      particles.visible = !isBlackhole;
      glowDust.visible = !isBlackhole;
      disk.visible = !isBlackhole;
      smoke.visible = !isBlackhole;
      coreSphere.visible = !isBlackhole;
      blackHoleGroup.visible = isBlackhole;

      // REDUCED reactive intensity when playing - lower multipliers to prevent lag
      const isActive = liveIsPlaying.current && avgFreq > 0.01;
      const baseGlow = liveGlowIntensity.current;
      const audioBoost = isActive ? avgFreq * 0.5 : 0.0; // Reduced from 1.5 to 0.5
      const totalGlow = Math.min(1, baseGlow + audioBoost);
      glowMat.opacity = totalGlow;

      if (isBlackhole) {
        const acc = Math.min(1, liveAccretionIntensity.current + avgFreq * 0.3);
        accretionMat.uniforms.uTime.value = time;
        accretionMat.uniforms.uAudioFreq.value = avgFreq;
        accretionMat.uniforms.uSpin.value = 1.0 + avgFreq * 0.5;
        accretionMat.uniforms.uAccretionIntensity.value = acc;
        accretionMat.uniforms.uTemperature.value = 3.5 + avgFreq * 2.0;
        photonMat.uniforms.uTime.value = time;
        photonMat.uniforms.uAudioFreq.value = avgFreq;
        horizonMat.uniforms.uTime.value = time;
        horizonMat.uniforms.uAudioFreq.value = avgFreq;
        jetMat.uniforms.uTime.value = time;
        jetMat.uniforms.uAudioFreq.value = avgFreq;

        // Project the black hole center into screen space for the lensing pass
        bhCenterNDC.set(0, 0, 0).project(camera);
        const screenX = bhCenterNDC.x * 0.5 + 0.5;
        const screenY = bhCenterNDC.y * 0.5 + 0.5;
        lensingMat.uniforms.uBHScreenPos.value.set(screenX, screenY);

        // Projected event-horizon radius (NDC -> UV) with audio-reactive swelling
        bhEdgeNDC.set(0.42, 0, 0).project(camera);
        const ndcRadius = Math.abs(bhCenterNDC.x - bhEdgeNDC.x);
        lensingMat.uniforms.uBHRadius.value = Math.max(0.001, ndcRadius / 2) * (1.0 + avgFreq * 0.4);
        lensingMat.uniforms.uBHMass.value = 1.0 + avgFreq * 0.5;
        lensingMat.uniforms.uTime.value = time * 0.001;

        controls.update();
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(lensScene, lensCamera);
      } else {
        const audioIntensity = isActive ? avgFreq * 0.4 : 0; // Reduced intensity

        // GPU rotation instead of per-particle CPU updates: rotate the shells by absolute time.
        glowDust.rotation.y = time * 0.0004;
        glowDustMat.size = 0.008 + audioIntensity * 0.015; // Reduced from 0.02
        glowDustMat.opacity = 0.2 + audioIntensity * 0.5; // Reduced from 0.75
        const corePulse = 1 + avgFreq * 0.08 + Math.sin(time * 0.002) * 0.025; // Reduced from 0.18
        coreSphere.scale.setScalar(corePulse);

        disk.rotation.y = time * 0.0003;
        diskMat.size = 0.008 + avgFreq * 0.008; // Reduced from 0.015
        diskMat.opacity = 0.3 + avgFreq * 0.3; // Reduced from 0.6

        smoke.rotation.y = time * 0.0001;
        smokeMat.size = 0.08 + avgFreq * 0.05; // Reduced from 0.1
        smokeMat.opacity = 0.08 + avgFreq * 0.08; // Reduced from 0.15

        controls.update();
        renderer.render(scene, camera);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      renderTarget.setSize(Math.max(1, Math.floor(w * pixelRatio)), Math.max(1, Math.floor(h * pixelRatio)));
      lensingMat.uniforms.uAspect.value = w / h;
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.current) handleResize();
    });
    resizeObserver.observe(canvas);

    return () => {
      if (cameraRef.current) {
        savedCamPos.current = cameraRef.current.position.clone();
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      glowDustGeo.dispose();
      glowDustMat.dispose();
      diskGeo.dispose();
      diskMat.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      camera.remove(glowSprite);
      glowMat.dispose();
      glowTexture.dispose();
      accretionGeo.dispose();
      accretionMat.dispose();
      photonGeo.dispose();
      photonMat.dispose();
      horizonGeo.dispose();
      horizonMat.dispose();
      jetGeo.dispose();
      jetMat.dispose();
      starTexture.dispose();
      renderTarget.dispose();
      lensingMat.dispose();
      lensQuad.geometry.dispose();
      lensScene.remove(lensQuad);
    };
  }, []);
}
