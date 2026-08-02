export const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioFreq;
  uniform float uGrainDensity;
  uniform float uGlitch;
  uniform float uParticleMode;
  uniform float uBlurIntensity;
  uniform float uGlowIntensity;
  uniform float uPitch;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSize;

  varying float vRadius;
  varying float vAlpha;
  varying float vGlitchFactor;
  varying float vFocusBlur;
  varying float vAudioFreq;

  float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    vRadius = aRadius;
    vAudioFreq = uAudioFreq;

    float speed = 0.5 / (aRadius * aRadius);
    float currentAngle = aAngle + uTime * speed * (0.5 + uAudioFreq * 0.8);

    vec3 pos = position;
    pos.x = cos(currentAngle) * aRadius;
    pos.z = sin(currentAngle) * aRadius;

    float glitchNoise = rand(vec2(floor(uTime * 15.0), aRadius));
    vGlitchFactor = glitchNoise;

    if (uGlitch > 0.5 && glitchNoise > 0.7) {
      pos.x += (rand(vec2(pos.y, uTime)) - 0.5) * 0.35;
      pos.y += (rand(vec2(pos.x, uTime)) - 0.5) * 0.25;
    }

    float warp = sin(uTime * 2.0 + aRadius * 10.0) * (0.02 + uAudioFreq * 0.05);
    pos.y += warp;

    if (uParticleMode > 0.5 && uParticleMode < 1.5) {
      float ringIndex = floor(aRadius * 5.0);
      float ringWave = 0.5 + 0.5 * sin(uTime * 3.0 + ringIndex * 2.0);
      pos.y += (ringWave - 0.5) * 0.4 * (0.5 + uAudioFreq * 1.5);
      pos.x *= 1.0 + 0.08 * sin(uTime * 2.0 + ringIndex);
      pos.z *= 1.0 + 0.08 * cos(uTime * 2.0 + ringIndex);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float focusFactor = smoothstep(0.45, 2.0, aRadius);
    float iris = mix(0.4, 1.0, uAudioFreq);
    focusFactor = smoothstep(iris * 0.3, iris * 1.2, focusFactor);
    vFocusBlur = focusFactor;

    float sizeMult = 1.0;
    if (uParticleMode > 1.5) {
      sizeMult = 1.0 + focusFactor * uBlurIntensity * 4.0;
    }

    gl_PointSize = (aSize * (1.0 + uAudioFreq * 3.0)) * (3.0 / -mvPosition.z) * sizeMult;
    if (uGlitch > 0.5 && glitchNoise > 0.8) {
      gl_PointSize *= 2.5;
    }

    gl_Position = projectionMatrix * mvPosition;
    float distFade = 1.0 - smoothstep(0.45, 1.8, aRadius);
    vAlpha = distFade * (0.8 + uAudioFreq * 0.3);
  }
`;

export const FRAGMENT_SHADER = `
  varying float vRadius;
  varying float vAlpha;
  varying float vGlitchFactor;
  varying float vFocusBlur;
  varying float vAudioFreq;
  uniform float uAudioFreq;
  uniform float uGlitch;
  uniform float uParticleMode;
  uniform float uBlurIntensity;
  uniform float uGlowIntensity;
  uniform float uPitch;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float intensity;
    if (uParticleMode > 1.5) {
      float blur = 0.05 + vFocusBlur * uBlurIntensity * 0.9;
      intensity = exp(-(dist * dist) / (2.0 * blur * blur));
      intensity = clamp(intensity, 0.0, 1.0);
    } else {
      intensity = smoothstep(0.5, 0.0, dist);
    }

    vec3 colCore = vec3(1.0, 1.0, 1.0);
    vec3 colOuter = vec3(0.5, 0.55, 0.65);

    if (uGlitch > 0.5 && vGlitchFactor > 0.7) {
      colCore = mix(colCore, vec3(1.0, 0.0, 0.25), vGlitchFactor * 0.5);
    }
    if (uGlitch > 0.5 && vGlitchFactor > 0.82) {
      colCore = vec3(1.0, 0.0, 0.25);
    }
    if (uGlitch > 0.5 && vGlitchFactor > 0.9) {
      colCore = vec3(1.0, 0.0, 0.4);
    }

    vec3 color = mix(colCore, colOuter, smoothstep(0.45, 1.8, vRadius));
    color += vec3(uAudioFreq * 0.5);

    if (uParticleMode > 0.5 && uParticleMode < 1.5) {
      color = vec3(1.0);
    } else {
      vec3 pitchTint = mix(vec3(1.0, 0.85, 0.5), vec3(0.6, 0.7, 1.0), uPitch);
      color *= mix(vec3(1.0), pitchTint, 0.4);
    }

    float glowBoost = 1.0 + uGlowIntensity * 1.5;
    gl_FragColor = vec4(color * glowBoost, intensity * vAlpha * 1.2);
  }
`;
