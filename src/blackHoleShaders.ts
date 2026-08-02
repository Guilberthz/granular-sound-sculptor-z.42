// Black Hole Shader System - Accretion Disk, Photon Ring, Gravitational Lensing

export const BLACK_HOLE_VERTEX = `
  uniform float uTime;
  uniform float uAudioFreq;
  uniform float uSpin;
  uniform float uAccretionIntensity;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aRingIndex;
  attribute float aSize;
  varying float vRadius;
  varying float vAngle;
  varying float vRingIndex;
  varying float vAlpha;
  varying vec3 vWorldPos;
  varying float vDopplerShift;
  
  float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  void main() {
    vRadius = aRadius;
    vAngle = aAngle;
    vRingIndex = aRingIndex;
    
    // Keplerian orbital velocity: v ~ 1/sqrt(r)
    float orbitalSpeed = 0.8 / sqrt(max(0.1, aRadius));
    float currentAngle = aAngle + uTime * 0.001 * orbitalSpeed * (1.0 + uAudioFreq * 0.5);
    
    // Disk thickness - MUCH THINNER for realistic thin rings
    float thickness = 0.005 + aRadius * 0.008 * (1.0 + uAudioFreq * 0.3);
    float verticalOffset = (rand(vec2(aAngle * 100.0, uTime)) - 0.5) * thickness;
    
    // Spiral density waves
    float spiralWave = sin(8.0 * aAngle - uTime * 0.003 + aRadius * 15.0) * 0.1;
    float perturbedRadius = aRadius + spiralWave * aRadius * 0.05;
    
    vec3 pos = vec3(
      cos(currentAngle) * perturbedRadius,
      verticalOffset,
      sin(currentAngle) * perturbedRadius
    );
    
    // Doppler shift calculation (approaching = blueshift, receding = redshift)
    vec3 velocity = vec3(
      -sin(currentAngle) * orbitalSpeed,
      0.0,
      cos(currentAngle) * orbitalSpeed
    );
    vec3 viewDir = normalize(-pos);
    vDopplerShift = dot(velocity, viewDir) * 2.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vWorldPos = pos;
    
    // Alpha based on radius and angle (fading at inner/outer edges)
    float innerFade = smoothstep(0.6, 0.8, aRadius);
    float outerFade = 1.0 - smoothstep(2.0, 2.5, aRadius);
    float angleFade = 0.7 + 0.3 * abs(sin(aAngle * 2.0 + uTime * 0.002));
    vAlpha = innerFade * outerFade * angleFade * (0.5 + uAccretionIntensity * 0.5);
    
    gl_PointSize = (aSize * (1.0 + uAudioFreq * 2.0)) * (85.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const BLACK_HOLE_FRAGMENT = `
  varying float vRadius;
  varying float vAngle;
  varying float vRingIndex;
  varying float vAlpha;
  varying vec3 vWorldPos;
  varying float vDopplerShift;
  uniform float uTime;
  uniform float uAudioFreq;
  uniform float uAccretionIntensity;
  uniform float uTemperature;
  
  // Blackbody radiation color from temperature
  vec3 blackbody(float T) {
    float t = T / 1000.0;
    vec3 c;
    if (t < 1.0) c = vec3(1.0, 0.3, 0.0);
    else if (t < 2.0) c = vec3(1.0, 0.6, 0.1);
    else if (t < 3.0) c = vec3(1.0, 0.85, 0.3);
    else if (t < 5.0) c = vec3(1.0, 0.95, 0.6);
    else if (t < 8.0) c = vec3(1.0, 1.0, 0.9);
    else c = vec3(0.9, 0.95, 1.0);
    return c;
  }
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Soft particle with falloff
    float intensity = smoothstep(0.5, 0.0, dist * 1.2);
    
    // Temperature varies with radius (hotter near black hole)
    float temp = 3.0 + (1.0 - vRadius / 2.5) * 5.0;
    vec3 baseColor = blackbody(temp);
    
    // Doppler shift: approaching side (blueshift), receding side (redshift)
    float doppler = clamp(vDopplerShift, -1.0, 1.0);
    vec3 dopplerColor = mix(
      vec3(1.0, 0.2, 0.0),  // Redshifted (receding)
      vec3(1.0, 0.9, 1.0),  // Blueshifted (approaching)
      doppler * 0.5 + 0.5
    );
    
// Audio-reactive temperature boost
    float audioHeat = uAudioFreq * uAccretionIntensity * 0.5;
    vec3 hotColor = vec3(1.0, 1.0, 0.8);
    baseColor = mix(baseColor, hotColor, audioHeat);
    baseColor = mix(baseColor, dopplerColor, 0.45);

    // Magnetic field line highlights
    float fieldLines = sin(vAngle * 12.0 + uTime * 0.005) * 0.5 + 0.5;
    fieldLines = pow(fieldLines, 8.0) * 0.3;
    baseColor += vec3(fieldLines) * vec3(1.0, 0.5, 0.1);

    // Corona flares
    float flare = sin(vRadius * 50.0 + uTime * 0.02) * 0.5 + 0.5;
    flare = pow(flare, 20.0) * 0.2;
    baseColor += vec3(flare) * vec3(1.0, 0.8, 0.3);

    // Soft additive glow halo hugging the disk
    float halo = smoothstep(0.5, 0.0, dist) * (0.25 + uAccretionIntensity * 0.2);

    float glowBoost = 1.0 + uAccretionIntensity * 2.0;
    gl_FragColor = vec4(baseColor * glowBoost + vec3(1.0, 0.7, 0.3) * halo, intensity * vAlpha * 1.5);
  }
`;

// Photon Ring Shader - THIN bright ring at 1.5x Schwarzschild radius
export const PHOTON_RING_VERTEX = `
  uniform float uTime;
  uniform float uAudioFreq;
  attribute float aAngle;
  attribute float aRadius;
  varying float vAngle;
  varying float vAlpha;
  
  void main() {
    vAngle = aAngle;
    float orbitalSpeed = 1.2 / sqrt(aRadius);
    float currentAngle = aAngle + uTime * 0.001 * orbitalSpeed;
    
    vec3 pos = vec3(
      cos(currentAngle) * aRadius,
      sin(uTime * 0.0005 + aAngle * 3.0) * 0.001,
      sin(currentAngle) * aRadius
    );
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    // Much tighter vertical constraint for ultra-thin ring
    vAlpha = smoothstep(0.0, 0.003, abs(mvPosition.y)) * (1.0 - smoothstep(0.0, 0.003, abs(mvPosition.y)));
    gl_PointSize = (3.5 * (1.0 + uAudioFreq * 3.0)) * (3.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const PHOTON_RING_FRAGMENT = `
  varying float vAngle;
  varying float vAlpha;
  uniform float uTime;
  uniform float uAudioFreq;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Much sharper falloff for ultra-thin ring
    float intensity = exp(-dist * dist * 50.0);
    
    // Pulsing photon ring
    float pulse = 0.7 + 0.3 * sin(uTime * 0.003 + vAngle * 6.0);
    float audioPulse = 1.0 + uAudioFreq * 0.5;
    
    // Relativistic beaming - brighter on approaching side
    float beaming = 0.5 + 0.5 * cos(vAngle);
    
    vec3 color = vec3(1.0, 0.95, 0.8) * pulse * audioPulse * (0.8 + beaming * 0.4);
    
    gl_FragColor = vec4(color, intensity * vAlpha * 4.0);
  }
`;

// Event Horizon Shader - perfect black with gravitational lensing
export const EVENT_HORIZON_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const EVENT_HORIZON_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uAudioFreq;
  uniform sampler2D uStarField;
  
  void main() {
    // Mirrored star-field reflection across the sphere
    float azimuth = atan(vNormal.y, vNormal.x);
    float polar = acos(clamp(vNormal.z, -1.0, 1.0));
    vec2 mirrorUv = vec2(azimuth / 6.2831853 + 0.5, 1.0 - polar / 3.1415926);

    vec3 base = vec3(0.03, 0.03, 0.05); // dark metallic body
    vec3 reflection = texture2D(uStarField, mirrorUv).rgb;

    // Fresnel so starlight glints toward the silhouette (mirror edge)
    float fres = pow(1.0 - abs(vNormal.z), 2.5);

    vec3 color = mix(base, reflection, 0.2 + fres * 0.7);
    color += reflection * fres * (0.5 + uAudioFreq * 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Small iridescent core that pulses like a light source inside the black hole
export const IRIDESCENT_CORE_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uAudioFreq;
  
  float clouds(vec3 p) {
    float n = 0.0;
    float amp = 0.6;
    vec3 q = p;
    for (int i = 0; i < 4; i++) {
      n += amp * sin(q.x * 6.0 + 1.0) * sin(q.y * 6.0 + 2.0) * sin(q.z * 6.0 + 3.0);
      amp *= 0.5;
      q *= 2.1;
    }
    return n;
  }
  
  void main() {
    float t = uTime * 0.6;

    float hue = t * 0.35 + vWorldPos.x * 0.5 + vWorldPos.y * 0.4 + vWorldPos.z * 0.35;
    vec3 irid = 0.5 + 0.5 * cos(vec3(hue, hue + 2.094, hue + 4.188) + uAudioFreq);

    float pulse = 0.55 + 0.45 * sin(t * 2.2);
    float flicker = 0.85 + 0.15 * sin(t * 5.1 + vWorldPos.y * 40.0);

    float cloud = clouds(vWorldPos + vec3(0.0, t, t * 0.7));

    vec3 color = irid * (pulse + cloud * 0.5) * flicker * (1.0 + uAudioFreq * 1.5);
    float core = smoothstep(0.6, 0.0, abs(vNormal.z));
    color += vec3(1.0, 0.98, 0.92) * core * pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Gravitational Lensing Post-Process
export const LENSING_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const LENSING_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uBHMass;
  uniform vec2 uBHScreenPos;
  uniform float uBHRadius;
  uniform float uAspect;
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    vec2 toBH = vec2((uv.x - uBHScreenPos.x) * uAspect, uv.y - uBHScreenPos.y);
    float dist = length(toBH);
    
    if (dist < uBHRadius * 2.5) {
      // Einstein ring effect
      float einsteinRadius = uBHRadius * 1.8;
      float deflection = einsteinRadius / max(dist, 0.001);
      
      if (dist < uBHRadius) {
        // Inside event horizon - pure black
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else if (dist < einsteinRadius) {
        // Gravitational lensing - magnify and distort background
        vec2 lensedUV = uv + toBH * deflection * 0.3;
        vec3 color = texture2D(tDiffuse, lensedUV).rgb;
        // Chromatic aberration at lens edge
        float r = texture2D(tDiffuse, lensedUV + vec2(0.002, 0.0)).r;
        float b = texture2D(tDiffuse, lensedUV - vec2(0.002, 0.0)).b;
        color.r = r;
        color.b = b;
        gl_FragColor = vec4(color, 1.0);
      } else {
        // Weak lensing outside Einstein radius
        vec2 lensedUV = uv + toBH * deflection * 0.05;
        gl_FragColor = texture2D(tDiffuse, lensedUV);
      }
    } else {
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  }
`;

// Relativistic Jet Shader
export const JET_VERTEX = `
  uniform float uTime;
  uniform float uAudioFreq;
  attribute float aHeight;
  attribute float aAngle;
  varying float vHeight;
  varying float vAngle;
  varying float vAlpha;
  
  void main() {
    vHeight = aHeight;
    vAngle = aAngle;
    
    // Jet precession
    float precession = sin(uTime * 0.0002) * 0.1;
    float radius = 0.03 + aHeight * 0.08 * (1.0 + aHeight * 0.5);
    float currentAngle = aAngle + precession + uTime * 0.0001;
    
    vec3 pos = vec3(
      cos(currentAngle) * radius,
      aHeight * 2.0 - 0.5,
      sin(currentAngle) * radius
    );
    
    // Internal shock diamonds with smooth falloff at the tips
    float shock = sin(aHeight * 20.0 + uTime * 0.01) * 0.5 + 0.5;
    float taper = pow(1.0 - aHeight, 2.2);
    vAlpha = taper * shock * (0.5 + uAudioFreq * 0.5);
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (3.0 + aHeight * 5.0) * (100.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const JET_FRAGMENT = `
  varying float vHeight;
  varying float vAngle;
  varying float vAlpha;
  uniform float uTime;
  uniform float uAudioFreq;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float intensity = smoothstep(0.5, 0.0, dist);
    
    // Synchrotron radiation - blue/white at base, red at tips
    vec3 baseColor = mix(
      vec3(0.2, 0.5, 1.0),  // Blue base
      vec3(1.0, 0.3, 0.0),  // Red tip
      vHeight
    );
    
    // Shock diamond pulsing
    float pulse = sin(vHeight * 30.0 + uTime * 0.02) * 0.5 + 0.5;
    baseColor *= 0.5 + pulse * 0.5;
    
    // Audio reactive
    baseColor *= 1.0 + uAudioFreq * 0.5;
    
    gl_FragColor = vec4(baseColor, intensity * vAlpha * 2.0);
  }
`;