import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { useControls, folder } from 'leva';

// --- Custom Hook: useImageToParticles ---
const useImageToParticles = (imgUrl, skip = 5, tolerance = 30, initialZ = 0) => {
  const [positions, setPositions] = useState([]);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
      const temp = [];
      for (let y = 0; y < img.height; y += skip) {
        for (let x = 0; x < img.width; x += skip) {
          const i = (y * img.width + x) * 4;
          const r = imageData[i]; const g = imageData[i + 1]; const b = imageData[i + 2]; const a = imageData[i + 3];
          const brightness = (r + g + b) / 3;
          if (brightness > tolerance && a > 1) {
            temp.push((x - img.width / 2), (img.height / 2 - y), initialZ);
          }
        }
      }
      setPositions(temp);
    };
    img.onerror = (error) => {
        console.error("Image loading failed:", imgUrl, error);
        setPositions([]);
    };
  }, [imgUrl, skip, tolerance, initialZ]);
  return positions;
};
// --- Custom Hook End ---


// --- Custom Shader Material Definition ---
const ParticleMaterial = shaderMaterial(
  // Uniforms (Defaults serve as hardcoded values for removed controls)
  {
    time: 0.0,
    mousePos: new THREE.Vector3(10000, 1000, 1000), // Start mouse off-screen

    // Vertex Shader Uniforms
    uVertTimeFactor: 0.5,       // Kept in GUI
    uIndexFactor: 0.08,
    uSwirlIndexFreq: 30.0,
    uSwirlTimeFreq: 9.9,
    uNoiseFactor1Low: 0,      // Kept in GUI
    uNoiseFactor1High: 0.48,    // Kept in GUI
    uOffset1Freq1X: 2.11, uOffset1IdxFreq1X: 5.0,
    uOffset1Freq1Y: 12.9, uOffset1IdxFreq1Y: 6.0,
    uOffset1Freq1Z: 3.64, uOffset1IdxFreq1Z: 7.0,
    uOffset1Strength: 8.8,
    uRandIdxFactor: 3.24,
    uNoiseFactor2Low: 7.1,
    uNoiseFactor2High: 0.0,
    uDriftSpeedFactor: 0.96,
    uOffset2Freq1X: 0.64, uOffset2IdxFreq1X: 1.1,
    uOffset2Freq1Y: 0.11, uOffset2IdxFreq1Y: 1.2,
    uOffset2Freq1Z: 0.54, uOffset2IdxFreq1Z: 1.3,
    uOffset2Strength: 1.94,
    uMouseInteractionRadius: 245.0, // Kept in GUI
    uMouseFalloffStart: 6.6,   // Kept in GUI
    uMouseRepelStrength: 39.0, // Kept in GUI
    uPerspectiveFactor: 1000.0,
    uPointSizeMouseMult: 5.0, // Kept in GUI
    uMinPointSize: 5.0,       // Kept in GUI

    // Fragment Shader Uniforms
    uFragHueShiftTimeFreq: 0.81,  // Kept in GUI
    uFragHueShiftIndexFreq: 0.03, // Kept in GUI
    uFragHueShiftAmount: 0.5,
    uFragTypeThresholdCore: 1.0,
    uFragCoreEdge1: 1.0,
    uFragCoreEdge2: 0.76,
    uFragCoreAlphaMult: 0.5,
    uFragGlowExponent: 0.1,
    uFragGlowAlphaMult: 2.0,
    uFragTypeThresholdRing: 2.0,
    uFragRingWidth: 0.05,
    uFragRingCenter: 0.0,
    uFragRingGaussianDiv: 5.0,
    uFragRingShapeEdge1: 1.0,
    uFragRingShapeEdge2: 0.8,
    uFragRingShapeAlphaMult: 1.39,
    uFragRingInnerGlowEdge1: 0.3,
    uFragRingInnerGlowEdge2: 1.0,
    uFragRingInnerGlowAlphaMult: 0.1,
    uFragPulseDistFreq: 5.0,
    uFragPulseTimeFreq: 2.0,
    uFragPulseIndexFreq: 0.1,
    uFragPulseRangeLow: 0.1,
    uFragPulseRangeHigh: 0.9,
    uFragPulseAlphaExponent: 2.5,
    uFragPulseAlphaMult: 0.9,
    uFragMouseColorMixBase: 0.08,
    uFragMouseColorMixTarget: 0.46,
    uFragMouseColorMixInfluence: 2.8,
    uFragFinalAlphaMult: 1.9,
    uFragAlphaClampMin: 0.0,
    uFragAlphaClampMax: 1.0,     // Kept in GUI
  },
  // Vertex Shader
  `
    uniform float time;
    uniform vec3 mousePos;
    uniform float uVertTimeFactor;
    uniform float uIndexFactor;
    uniform float uSwirlIndexFreq;
    uniform float uSwirlTimeFreq;
    uniform float uNoiseFactor1Low;
    uniform float uNoiseFactor1High;
    uniform float uOffset1Freq1X; uniform float uOffset1IdxFreq1X;
    uniform float uOffset1Freq1Y; uniform float uOffset1IdxFreq1Y;
    uniform float uOffset1Freq1Z; uniform float uOffset1IdxFreq1Z;
    uniform float uOffset1Strength;
    uniform float uRandIdxFactor;
    uniform float uNoiseFactor2Low;
    uniform float uNoiseFactor2High;
    uniform float uDriftSpeedFactor;
    uniform float uOffset2Freq1X; uniform float uOffset2IdxFreq1X;
    uniform float uOffset2Freq1Y; uniform float uOffset2IdxFreq1Y;
    uniform float uOffset2Freq1Z; uniform float uOffset2IdxFreq1Z;
    uniform float uOffset2Strength;
    uniform float uMouseInteractionRadius;
    uniform float uMouseFalloffStart;
    uniform float uMouseRepelStrength;
    uniform float uPerspectiveFactor;
    uniform float uPointSizeMouseMult;
    uniform float uMinPointSize;

    attribute float size;
    attribute float index;
    attribute float particleType;
    attribute vec3 color;

    varying vec3 vColor;
    varying float vDistanceToMouse;
    varying float vType;
    varying float vIndex;

    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

    void main() {
      vColor = color;
      vType = particleType;
      vIndex = index;
      vec3 pos = position;
      float T = time * uVertTimeFactor;
      float idx = index * uIndexFactor;

      float noiseFactor1 = sin(idx * uSwirlIndexFreq + T * uSwirlTimeFreq) * uNoiseFactor1Low + uNoiseFactor1High;
      vec3 offset1 = vec3( cos(T * uOffset1Freq1X + idx * uOffset1IdxFreq1X) * noiseFactor1, sin(T * uOffset1Freq1Y + idx * uOffset1IdxFreq1Y) * noiseFactor1, cos(T * uOffset1Freq1Z + idx * uOffset1IdxFreq1Z) * noiseFactor1 ) * uOffset1Strength;

      float noiseFactor2 = rand(vec2(idx, idx * uRandIdxFactor)) * uNoiseFactor2Low + uNoiseFactor2High;
      float speedFactor = uDriftSpeedFactor;
      vec3 offset2 = vec3( sin(T * speedFactor * uOffset2Freq1X + idx * uOffset2IdxFreq1X) * noiseFactor2, cos(T * speedFactor * uOffset2Freq1Y + idx * uOffset2IdxFreq1Y) * noiseFactor2, sin(T * speedFactor * uOffset2Freq1Z + idx * uOffset2IdxFreq1Z) * noiseFactor2 ) * uOffset2Strength;

      pos += offset1 + offset2;

      vec3 toMouse = mousePos - pos;
      float dist = length(toMouse);
      vDistanceToMouse = 0.0;
      if (dist < uMouseInteractionRadius) {
        float influence = smoothstep(uMouseInteractionRadius, uMouseFalloffStart, dist);
        vec3 repelDir = normalize(pos - mousePos);
        pos += repelDir * influence * uMouseRepelStrength;
        vDistanceToMouse = influence;
      }

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      float perspectiveFactor = uPerspectiveFactor / -mvPosition.z;
      gl_PointSize = size * perspectiveFactor * (1.0 + vDistanceToMouse * uPointSizeMouseMult);
      gl_PointSize = max(uMinPointSize, gl_PointSize);
    }
  `,
  // Fragment Shader
  `
    uniform float time;
    uniform float uFragHueShiftTimeFreq;
    uniform float uFragHueShiftIndexFreq;
    uniform float uFragHueShiftAmount;
    uniform float uFragTypeThresholdCore;
    uniform float uFragCoreEdge1;
    uniform float uFragCoreEdge2;
    uniform float uFragCoreAlphaMult;
    uniform float uFragGlowExponent;
    uniform float uFragGlowAlphaMult;
    uniform float uFragTypeThresholdRing;
    uniform float uFragRingWidth;
    uniform float uFragRingCenter;
    uniform float uFragRingGaussianDiv;
    uniform float uFragRingShapeEdge1;
    uniform float uFragRingShapeEdge2;
    uniform float uFragRingShapeAlphaMult;
    uniform float uFragRingInnerGlowEdge1;
    uniform float uFragRingInnerGlowEdge2;
    uniform float uFragRingInnerGlowAlphaMult;
    uniform float uFragPulseDistFreq;
    uniform float uFragPulseTimeFreq;
    uniform float uFragPulseIndexFreq;
    uniform float uFragPulseRangeLow;
    uniform float uFragPulseRangeHigh;
    uniform float uFragPulseAlphaExponent;
    uniform float uFragPulseAlphaMult;
    uniform float uFragMouseColorMixBase;
    uniform float uFragMouseColorMixTarget;
    uniform float uFragMouseColorMixInfluence;
    uniform float uFragFinalAlphaMult;
    uniform float uFragAlphaClampMin;
    uniform float uFragAlphaClampMax;

    varying vec3 vColor;
    varying float vDistanceToMouse;
    varying float vType;
    varying float vIndex;

    vec3 rgb2hsl( vec3 c ){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) ); vec4 q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) ); float d = q.x - min( q.w, q.y ); float e = 1.0e-10; return vec3( abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
    vec3 hsl2rgb( vec3 c ){ vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix( K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y ); }

    void main() {
      vec2 uv = gl_PointCoord * 2.0 - 1.0;
      float dist = length(uv);
      if (dist > 1.0) { discard; }

      float alpha = 0.0;
      vec3 baseColor = vColor;
      vec3 hsl = rgb2hsl(baseColor);
      float hueShift = sin(time * uFragHueShiftTimeFreq + vIndex * uFragHueShiftIndexFreq) * uFragHueShiftAmount;
      hsl.x = fract(hsl.x + hueShift);
      baseColor = hsl2rgb(hsl);
      vec3 finalColor = baseColor;

      if (vType < uFragTypeThresholdCore) { // Core type
          float core = smoothstep(uFragCoreEdge1, uFragCoreEdge2, dist) * uFragCoreAlphaMult;
          float glow = pow(max(0.0, 1.0 - dist), uFragGlowExponent) * uFragGlowAlphaMult;
          alpha = core + glow;
      }
      else if (vType < uFragTypeThresholdRing) { // Ring type
          float ringWidth = uFragRingWidth;
          float ringCenter = uFragRingCenter;
          float ringShape = exp(-pow(dist - ringCenter, 2.0) / (uFragRingGaussianDiv * ringWidth * ringWidth));
          alpha = smoothstep(uFragRingShapeEdge1, uFragRingShapeEdge2, ringShape) * uFragRingShapeAlphaMult;
          alpha += smoothstep(uFragRingInnerGlowEdge1, uFragRingInnerGlowEdge2, dist) * uFragRingInnerGlowAlphaMult;
      }
      else { // Pulse type
          float pulse = sin(dist * uFragPulseDistFreq - time * uFragPulseTimeFreq + vIndex * uFragPulseIndexFreq) * uFragPulseRangeLow + uFragPulseRangeHigh;
          alpha = pow(max(0.0, 1.0 - dist), uFragPulseAlphaExponent) * pulse * uFragPulseAlphaMult;
      }

      finalColor = mix(finalColor, finalColor * uFragMouseColorMixBase + uFragMouseColorMixTarget, vDistanceToMouse * uFragMouseColorMixInfluence);
      alpha *= uFragFinalAlphaMult;
      alpha = clamp(alpha, uFragAlphaClampMin, uFragAlphaClampMax);
      if (alpha < 0.01) discard;

      gl_FragColor = vec4(finalColor * alpha, alpha);
    }
  `
);

extend({ ParticleMaterial });
// --- Custom Shader Material Definition End ---


// --- ParticlePlane Component ---
const ParticlePlane = ({ image }) => {

  // --- Leva Controls (Reduced Set, English Keys) ---
  const controls = useControls({
    imageProcessing: folder({
        skip: { value: 2, min: 1, max: 20, step: 1, label: "Skip" },
        tolerance: { value: 30, min: 0, max: 254, step: 1, label: "Tolerance" },
        initialZ: { value: 0.9, min: -100, max: 100, step: 0.1, label: "Initial Z" },
    }),
    particleProperties: folder({
        minSize: { value: 0.94, min: 0.01, max: 5, step: 0.01, label: "Min Size" },
        maxSize: { value: 1.5, min: 0.1, max: 10, step: 0.1, label: "Max Size" },
        particleTypes: { value: 2, min: 1, max: 3, step: 1, label: "Types (int)" },
        baseColor: { value: '#0058eb', label: "Base Color" },
    }),
    shaderParameters: folder({
      vertex: folder ({
        vertTimeFactor: { value: 0.5, min: 0, max: 5, step: 0.01, label:"Vertex Time Factor" },
        noiseFactor1Low: { value: 0, min: 0, max: 2, step: 0.01, label:"Noise Factor 1 Low" },
        noiseFactor1High: { value: 0.48, min: 0, max: 2, step: 0.01, label:"Noise Factor 1 High" },
        mouseInteractionRadius: { value: 245.0, min: 0, max: 500, step: 1, label:"Mouse Radius" },
        mouseFalloffStart: { value: 6.6, min: 0, max: 400, step: 0.1, label:"Mouse Falloff" },
        mouseRepelStrength: { value: 39.0, min: 0, max: 400, step: 0.1, label:"Mouse Repel" },
        pointSizeMouseMult: { value: 5.0, min: 0, max: 5, step: 0.01, label:"Point Size Mouse Mult" },
        minPointSize: { value: 5.0, min: 0.1, max: 10, step: 0.1, label:"Min Point Size" },
      }),
      fragment: folder ({
        fragHueShiftTimeFreq: { value: 0.81, min: 0, max: 5, step: 0.01, label:"Hue Shift Time Freq" },
        fragHueShiftIndexFreq: { value: 0.03, min: 0, max: 0.1, step: 0.01, label:"Hue Shift Index Freq" },
        fragAlphaClampMax: { value: 1.0, min: 0, max: 1, step: 0.01, label:"Alpha Clamp Max" },
      }),
    }),
  });
  // --- Leva Controls End ---

  const targetPositions = useImageToParticles(
    image,
    controls.skip,
    controls.tolerance,
    controls.initialZ
  );

  const groupRef = useRef();
  const materialRef = useRef();
  const pointsRef = useRef();

  const [progress, setProgress] = useState(0);
  const animatingRef = useRef(false);

  // Initialize mouse refs far away using literals
  const mousePos = useRef(new THREE.Vector3(10000, 1000, 1000));
  const smoothedMousePos = useRef(new THREE.Vector3(10000, 1000, 1000));

  // Geometry setup
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const numPoints = targetPositions.length / 3;
    const initialPositions = new Float32Array(targetPositions.length).fill(0);
    geom.setAttribute('position', new THREE.BufferAttribute(initialPositions, 3));

    const indices = new Float32Array(numPoints);
    const sizes = new Float32Array(numPoints);
    const types = new Float32Array(numPoints);
    const colors = new Float32Array(numPoints * 3);
    const baseColor = new THREE.Color(controls.baseColor);

    for (let i = 0; i < numPoints; i++) {
      indices[i] = i;
      sizes[i] = Math.random() * (controls.maxSize - controls.minSize) + controls.minSize;
      types[i] = Math.floor(Math.random() * controls.particleTypes);
      colors[i * 3] = baseColor.r; colors[i * 3 + 1] = baseColor.g; colors[i * 3 + 2] = baseColor.b;
    }
    geom.setAttribute('index', new THREE.BufferAttribute(indices, 1));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('particleType', new THREE.BufferAttribute(types, 1));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeBoundingSphere();
    return geom;
  }, [targetPositions, controls.baseColor, controls.minSize, controls.maxSize, controls.particleTypes]);

  const triggerAnimation = useCallback(() => {
    if (animatingRef.current) return;
    setProgress(0);
    animatingRef.current = true;
  }, []);

  useEffect(() => {
    if (targetPositions.length > 0 && geometry) {
      // Use literal for delay
      const timer = setTimeout(() => triggerAnimation(), 100); // ANIMATION_DELAY = 100
      return () => clearTimeout(timer);
    }
  }, [targetPositions, geometry, triggerAnimation]);

  useEffect(() => {
      if (pointsRef.current && pointsRef.current.geometry) {
          const colorsArray = pointsRef.current.geometry.attributes.color.array;
          const baseColor = new THREE.Color(controls.baseColor);
          const numPoints = colorsArray.length / 3;
          for (let i = 0; i < numPoints; i++) {
              colorsArray[i * 3] = baseColor.r;
              colorsArray[i * 3 + 1] = baseColor.g;
              colorsArray[i * 3 + 2] = baseColor.b;
          }
          pointsRef.current.geometry.attributes.color.needsUpdate = true;
      }
  }, [controls.baseColor]);

  useFrame((state, delta) => {
    // 1. Initial formation animation
    if (animatingRef.current && pointsRef.current && pointsRef.current.geometry) {
      setProgress((prev) => {
        // Use literal for duration
        const newProgress = prev + delta / 2.5; // ANIMATION_DURATION = 2.5
        const currentGeometry = pointsRef.current.geometry;
        const positionsArray = currentGeometry.attributes.position.array;

        if (newProgress >= 1) {
          animatingRef.current = false;
          for (let i = 0; i < targetPositions.length; i++) {
            positionsArray[i] = targetPositions[i];
          }
          currentGeometry.attributes.position.needsUpdate = true;
          return 1;
        } else {
          const easedProgress = newProgress;
          for (let i = 0; i < targetPositions.length; i++) {
            positionsArray[i] = targetPositions[i] * easedProgress;
          }
          currentGeometry.attributes.position.needsUpdate = true;
          return newProgress;
        }
      });
    }

    // 2. Update shader uniforms
    if (materialRef.current) {
      const uniforms = materialRef.current.uniforms;
      uniforms.time.value = state.clock.getElapsedTime();

      // Use literal for lerp factor
      smoothedMousePos.current.lerp(mousePos.current, 0.4); // MOUSE_LERP_FACTOR = 0.4
      uniforms.mousePos.value.copy(smoothedMousePos.current);

      // --- Update uniforms from kept controls ---
      uniforms.uVertTimeFactor.value = controls.vertTimeFactor;
      uniforms.uNoiseFactor1Low.value = controls.noiseFactor1Low;
      uniforms.uNoiseFactor1High.value = controls.noiseFactor1High;
      uniforms.uMouseInteractionRadius.value = controls.mouseInteractionRadius;
      uniforms.uMouseFalloffStart.value = controls.mouseFalloffStart;
      uniforms.uMouseRepelStrength.value = controls.mouseRepelStrength;
      uniforms.uPointSizeMouseMult.value = controls.pointSizeMouseMult;
      uniforms.uMinPointSize.value = controls.minPointSize;
      uniforms.uFragHueShiftTimeFreq.value = controls.fragHueShiftTimeFreq;
      uniforms.uFragHueShiftIndexFreq.value = controls.fragHueShiftIndexFreq;
      uniforms.uFragAlphaClampMax.value = controls.fragAlphaClampMax;
      // Other uniforms use the initial defaults set in shaderMaterial
    }
  });

  const handlePointerMove = useCallback((event) => {
    // Use literal for interaction plane Z
    mousePos.current.set(event.point.x, event.point.y, 0 + 1); // INTERACTION_PLANE_Z = 0
  }, []);

  const handlePointerOut = useCallback(() => {
    // Use literals for out position
    mousePos.current.set(10000, 1000, 1000); // MOUSE_OUT_X/Y/Z
  }, []);

  return (
    <group ref={groupRef}>
      <points
        ref={pointsRef}
        geometry={geometry}
        frustumCulled={false}
      >
        <particleMaterial
          ref={materialRef}
          transparent={true}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Interaction Plane - Use literal size and position */}
      <Plane
        args={[1000, 1000]} // INTERACTION_PLANE_SIZE = 1000
        position={[0, 0, 0]} // INTERACTION_PLANE_Z = 0
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
       />
    </group>
  );
};
// --- ParticlePlane Component End ---


// --- UseCard Component (Wrapper) ---
const UseCard = ({ image }) => {
  return (
    <div className='max-w-screen h-screen overflow-hidden bg-slate-900'>
      <Canvas camera={{ position: [0, 0, 900], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <ParticlePlane image={image} />
      </Canvas>
    </div>
  );
};
// --- UseCard Component End ---

export default UseCard;