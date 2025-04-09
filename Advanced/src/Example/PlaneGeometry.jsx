import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls, Leva } from 'leva'; // Import Leva

// --- Vertex Shader ---
const vertexShader = `
  varying vec2 vUv; // Pass UV coordinates to the fragment shader
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// --- Fragment Shader (Using Uniforms) ---
const fragmentShader = `
  uniform vec2 uResolution;
  uniform float uTime;

  // ---- Uniforms controlled by Leva ----
  uniform float uCoordMultiplier;   // Default 2.0
  uniform float uLoopLimit;         // Default 4.0
  uniform float uFractMultiplier;   // Default 1.5
  uniform float uFractOffset;       // Default 0.5
  uniform float uPaletteFactor;     // Default 0.4 (used for palette parameter)
  uniform float uTimeFactor;        // Default 0.4 (used for time affecting palette)
  uniform float uSinMultiplier;     // Default 8.0 (inside sin)
  uniform float uSinDivisor;        // Default 8.0 (outside sin)
  uniform float uPowNumerator;      // Default 0.01
  uniform float uPowExponent;       // Default 1.2
  uniform float uAlpha;             // Default 1.0 (alpha of the final color)
  // --------------------------------

  // palette function remains unchanged, not controlled by Leva
  vec3 palette(float t) {
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    // Use 2*PI (6.28318) as a common periodic value
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    // Normalize and adjust coordinates - using uniform
    vec2 uv = (fragCoord * uCoordMultiplier - uResolution.xy) / uResolution.y;
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);

    // Iterative superposition - using uniform
    // Note: GLSL for loop limits must be constant or uniform. Ensure uLoopLimit is an integer or the shader supports dynamic loops
    // For broader compatibility, you can limit the maximum loop count and control the actual iteration on the JS side
    // float loopCount = min(uLoopLimit, 10.0); // Example: limit maximum iteration
    for (float i = 0.0; i < uLoopLimit; i++) {
      // Break if i >= uLoopLimit (might be needed for some older hardware)
      // if (i >= uLoopLimit) break;

      // Adjust tiling each time - using uniforms
      uv = fract(uv * uFractMultiplier) - uFractOffset;

      // Local distance calculation, using exponential decay to weaken the effect in the distance
      float d = length(uv) * exp(-length(uv0));

      // Generate color based on coordinates, iteration step, and time - using uniforms
      vec3 col = palette(length(uv0) + i * uPaletteFactor + uTime * uTimeFactor);

      // Modify brightness and weight calculation - using uniforms
      d = sin(d * uSinMultiplier + uTime) / uSinDivisor;
      d = abs(d);
      // Avoid division by zero
      d = max(d, 0.0001);
      d = pow(uPowNumerator / d, uPowExponent);

      // Accumulate the color of the current layer
      finalColor += col * d;
    }

    // Control alpha using uniform
    gl_FragColor = vec4(finalColor, uAlpha);
  }
`;

// --- BackgroundPlane Component ---
function BackgroundPlane() {
  const meshRef = useRef();
  const materialRef = useRef(); // useRef to reference ShaderMaterial
  const { size, viewport } = useThree();

  // Leva controls
  const controls = useControls('Shader Parameters', { // Changed title to English
    coordMultiplier: { value: 2.0, min: 0.1, max: 5.0, step: 0.1, label: 'Coord Scale Factor' }, // Changed label
    // Ensuring the loop limit is an integer might align better with GLSL expectations, but float is often accepted
    loopLimit: { value: 7.0, min: 1.0, max: 10.0, step: 1.0, label: 'Loop Count Limit' }, // Changed label
    fractMultiplier: { value: 1.3, min: 0.1, max: 5.0, step: 0.1, label: 'Fractal Scale' }, // Changed label
    fractOffset: { value: 0.2, min: -1.0, max: 1.0, step: 0.1, label: 'Fractal Offset' }, // Changed label
    paletteFactor: { value: 0.9, min: 0.0, max: 2.0, step: 0.01, label: 'Palette Iteration Factor' }, // Changed label
    timeFactor: { value: 0.47, min: 0.0, max: 2.0, step: 0.01, label: 'Palette Time Factor' }, // Changed label
    sinMultiplier: { value: 9.5, min: 1.0, max: 20.0, step: 0.1, label: 'Sine Multiplier' }, // Changed label
    sinDivisor: { value: 10.0, min: 1.0, max: 20.0, step: 0.1, label: 'Sine Divisor' }, // Changed label
    powNumerator: { value: 0.01, min: 0.001, max: 0.5, step: 0.001, label: 'Power Numerator' }, // Changed label
    powExponent: { value: 1.2, min: 0.1, max: 5.0, step: 0.1, label: 'Power Exponent' }, // Changed label
    alpha: { value: 1.0, min: 0.0, max: 1.0, step: 0.01, label: 'Alpha' }, // Changed label
  });

  // Initial Uniforms (set structure and initial values only once)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(size.width * viewport.dpr, size.height * viewport.dpr) },
      uCoordMultiplier: { value: controls.coordMultiplier },
      uLoopLimit: { value: controls.loopLimit },
      uFractMultiplier: { value: controls.fractMultiplier },
      uFractOffset: { value: controls.fractOffset },
      uPaletteFactor: { value: controls.paletteFactor },
      uTimeFactor: { value: controls.timeFactor },
      uSinMultiplier: { value: controls.sinMultiplier },
      uSinDivisor: { value: controls.sinDivisor },
      uPowNumerator: { value: controls.powNumerator },
      uPowExponent: { value: controls.powExponent },
      uAlpha: { value: controls.alpha },
    }),
    // Remove controls dependency, so the uniforms structure is created only once (or as needed)
    // If resolution is dynamic, keep size/viewport dependency
    [size.width, size.height, viewport.dpr]
    // Or if resolution is only set on mount, use []
    // []
  );

  // Use useEffect to listen for controls changes and directly update uniforms'.value
  useEffect(() => {
    if (materialRef.current) {
      // console.log('Updating uniforms:', controls); // For debugging
      materialRef.current.uniforms.uCoordMultiplier.value = controls.coordMultiplier;
      materialRef.current.uniforms.uLoopLimit.value = controls.loopLimit;
      materialRef.current.uniforms.uFractMultiplier.value = controls.fractMultiplier;
      materialRef.current.uniforms.uFractOffset.value = controls.fractOffset;
      materialRef.current.uniforms.uPaletteFactor.value = controls.paletteFactor;
      materialRef.current.uniforms.uTimeFactor.value = controls.timeFactor;
      materialRef.current.uniforms.uSinMultiplier.value = controls.sinMultiplier;
      materialRef.current.uniforms.uSinDivisor.value = controls.sinDivisor;
      materialRef.current.uniforms.uPowNumerator.value = controls.powNumerator;
      materialRef.current.uniforms.uPowExponent.value = controls.powExponent;
      materialRef.current.uniforms.uAlpha.value = controls.alpha;
    }
  }, [controls]); // Key: depends on the controls object

  // useEffect for updating resolution
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(
        size.width * viewport.dpr,
        size.height * viewport.dpr
      );
    }
  }, [size, viewport.dpr]); // Depends on size and dpr

  // useFrame for updating time
  useFrame((state) => {
    const { clock } = state;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      {/* Use simple planeGeometry */}
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef} // Associate ref
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms} // Pass initial uniforms structure
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// --- Main App Component ---
function PlaneGeometry() {
  return (
    <>
      {/* Leva GUI control panel */}
      <Leva collapsed={false} /* oneLineLabels */ />
      <div className='fixed top-0 left-0 w-full h-full -z-10'> {/* Ensure Canvas is at the bottom layer */}
        <Canvas camera={{ position: [0, 0, 1], fov: 75 }} >
          <BackgroundPlane />
        </Canvas>
      </div>
    </>
  );
}

export default PlaneGeometry;