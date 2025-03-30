import React, { useRef, useEffect, useMemo } from 'react'
// React三方库

import { Canvas, useFrame } from '@react-three/fiber'
// Fiber渲染

import { OrbitControls, Text3D } from '@react-three/drei'
// Drei三方组件

import * as THREE from 'three'
// Three.js核心

import { useControls } from 'leva'
// GUI控制

const PixelText = () => {
  const meshRef = useRef()

  // Manage shader parameters // 管理着色器参数
  const {
    baseColorAggregated,
    baseColorExploded,
    uUvScale,
    uUvOffset,
    uBezierMidFactor,
    uBezierWeight,
    uOneValue,
    controlNormalScale,
    controlRandomRange,
    uFractalScale,
    uFractalOffset,
    uFractalMod,
    uFractalOffset2,
    uFractalBaseC,
    uFractalInten,
    uFractalPowA,
    uFractalPowB,
    uFractalPowC,
    uFractalTimeFactor,
    uMaxIter
  } = useControls({
    baseColorAggregated: { value: '#ffd000' },
    baseColorExploded:   { value: '#00ffff' },
    uUvScale:  { value: { x: 0.05, y: 0.18 } },
    uUvOffset: { value: { x: 0.17, y: 0.17 } },
    uBezierMidFactor: { value: 0.5, min: 0, max: 1 },
    uBezierWeight:    { value: 2.0, min: 0, max: 5 },
    uOneValue:        { value: 1.0, min: 0, max: 1 },
    controlNormalScale: { value: 0.0, min: 0, max: 2 },
    controlRandomRange: { value: 0.0, min: 0, max: 2 },
    uFractalScale:     { value: 3.0, min: 1, max: 50 },
    uFractalOffset:    { value: 1.0, step: 0.1 },
    uFractalMod:       { value: 3.28318530718 },
    uFractalOffset2:   { value: 200.0, max:300 },
    uFractalBaseC:     { value: 0.2, min: -2.5, max: 2.5 },
    uFractalInten:     { value: 0.001, min: 0.001, max: 0.01 },
    uFractalPowA:      { value: 1.17, step: 0.01 },
    uFractalPowB:      { value: 1.4,  min: 0.5, max: 2 },
    uFractalPowC:      { value: 6.0,  step: 0.1 },
    uFractalTimeFactor:{ value: 3.5,  min: 0, max: 5 },
    uMaxIter:          { value: 10,   min: 1, max: 50, step: 1 }
  })

  // Create custom ShaderMaterial // 创建自定义ShaderMaterial
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime:         { value: 0 },
        uProgress:     { value: 1 },
        baseColorAggregated: { value: new THREE.Color(baseColorAggregated) },
        baseColorExploded:   { value: new THREE.Color(baseColorExploded) },
        uUvScale:   { value: new THREE.Vector2(uUvScale.x, uUvScale.y) },
        uUvOffset:  { value: new THREE.Vector2(uUvOffset.x, uUvOffset.y) },
        uBezierMidFactor: { value: uBezierMidFactor },
        uBezierWeight:    { value: uBezierWeight },
        uOneValue:        { value: uOneValue },
        uFractalScale:     { value: uFractalScale },
        uFractalOffset:    { value: uFractalOffset },
        uFractalMod:       { value: uFractalMod },
        uFractalOffset2:   { value: uFractalOffset2 },
        uFractalBaseC:     { value: uFractalBaseC },
        uFractalInten:     { value: uFractalInten },
        uFractalPowA:      { value: uFractalPowA },
        uFractalPowB:      { value: uFractalPowB },
        uFractalPowC:      { value: uFractalPowC },
        uFractalTimeFactor:{ value: uFractalTimeFactor },
        uMaxIter:          { value: uMaxIter }
      },
      transparent: true,
      vertexShader: `
        uniform float uProgress;
        uniform vec2  uUvScale;
        uniform vec2  uUvOffset;
        uniform float uBezierMidFactor;
        uniform float uBezierWeight;
        uniform float uOneValue;

        attribute vec3 aControl;
        varying vec2   vUv;

        void main() {
          // Compute UV // 计算UV
          vUv = uv * uUvScale + uUvOffset;

          // Bezier interpolation // Bezier插值
          vec3 startPos = position;
          vec3 endPos   = position + aControl;
          vec3 ctrlPos  = position + aControl * uBezierMidFactor;
          float t = uProgress;
          float one = uOneValue;
          float two = uBezierWeight;
          vec3 bezierPos =
              (one - t) * (one - t) * startPos +
              two * (one - t) * t * ctrlPos +
              t * t * endPos;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(bezierPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3  baseColorAggregated;
        uniform vec3  baseColorExploded;

        // Fractal params // 分形参数
        uniform float uFractalScale;
        uniform float uFractalOffset;
        uniform float uFractalMod;
        uniform float uFractalOffset2;
        uniform float uFractalBaseC;
        uniform float uFractalInten;
        uniform float uFractalPowA;
        uniform float uFractalPowB;
        uniform float uFractalPowC;
        uniform float uFractalTimeFactor;
        uniform float uMaxIter;

        varying vec2 vUv;

        void main() {
          // Scale and offset for fractal // 分形的缩放与偏移
          vec2 uv = vUv * uFractalScale - uFractalOffset;
          vec2 p  = mod(uv * uFractalMod, uFractalMod) - uFractalOffset2;

          float c = uFractalBaseC;
          float inten = uFractalInten;
          vec2 iPos = p;
          int maxIter = int(uMaxIter);

          // Dynamic iteration // 动态迭代
          for (int n = 0; n < 200; n++) {
            if (n >= maxIter) { break; }
            float t = uTime * (1.0 - (uFractalTimeFactor / float(n+1)));
            iPos = p + vec2(
              cos(t - iPos.x) + sin(t + iPos.y),
              sin(t - iPos.y) + cos(t + iPos.x)
            );
            c += 1.0 / length(vec2(
              p.x / (sin(iPos.x + t) / inten),
              p.y / (cos(iPos.y + t) / inten)
            ));
          }

          c /= float(maxIter);
          c = uFractalPowA - pow(c, uFractalPowB);
          vec3 iterColor = vec3(pow(abs(c), uFractalPowC));
          // Interpolate between two colors // 在两种颜色间插值
          vec3 baseColor = mix(baseColorAggregated, baseColorExploded, uProgress);

          gl_FragColor = vec4(baseColor * iterColor, 1.0);
        }
      `
    })
  }, [
    baseColorAggregated,
    baseColorExploded,
    uUvScale, uUvOffset,
    uBezierMidFactor,
    uBezierWeight,
    uOneValue,
    uFractalScale,
    uFractalOffset,
    uFractalMod,
    uFractalOffset2,
    uFractalBaseC,
    uFractalInten,
    uFractalPowA,
    uFractalPowB,
    uFractalPowC,
    uFractalTimeFactor,
    uMaxIter
  ])

  // Update uniforms on parameter change // 参数变化时更新uniform
  useEffect(() => {
    shaderMaterial.uniforms.baseColorAggregated.value.set(baseColorAggregated)
    shaderMaterial.uniforms.baseColorExploded.value.set(baseColorExploded)
    shaderMaterial.uniforms.uUvScale.value.set(uUvScale.x, uUvScale.y)
    shaderMaterial.uniforms.uUvOffset.value.set(uUvOffset.x, uUvOffset.y)
    shaderMaterial.uniforms.uBezierMidFactor.value = uBezierMidFactor
    shaderMaterial.uniforms.uBezierWeight.value    = uBezierWeight
    shaderMaterial.uniforms.uOneValue.value        = uOneValue
    shaderMaterial.uniforms.uFractalScale.value      = uFractalScale
    shaderMaterial.uniforms.uFractalOffset.value     = uFractalOffset
    shaderMaterial.uniforms.uFractalMod.value        = uFractalMod
    shaderMaterial.uniforms.uFractalOffset2.value    = uFractalOffset2
    shaderMaterial.uniforms.uFractalBaseC.value      = uFractalBaseC
    shaderMaterial.uniforms.uFractalInten.value      = uFractalInten
    shaderMaterial.uniforms.uFractalPowA.value       = uFractalPowA
    shaderMaterial.uniforms.uFractalPowB.value       = uFractalPowB
    shaderMaterial.uniforms.uFractalPowC.value       = uFractalPowC
    shaderMaterial.uniforms.uFractalTimeFactor.value = uFractalTimeFactor
    shaderMaterial.uniforms.uMaxIter.value           = uMaxIter
  }, [
    baseColorAggregated,
    baseColorExploded,
    uUvScale,
    uUvOffset,
    uBezierMidFactor,
    uBezierWeight,
    uOneValue,
    uFractalScale,
    uFractalOffset,
    uFractalMod,
    uFractalOffset2,
    uFractalBaseC,
    uFractalInten,
    uFractalPowA,
    uFractalPowB,
    uFractalPowC,
    uFractalTimeFactor,
    uMaxIter,
    shaderMaterial
  ])

  // Initialize aControl for burst effect // 初始化aControl来制作爆裂效果
  useEffect(() => {
    const geometry = meshRef.current.geometry
    geometry.toNonIndexed()
    const count = geometry.attributes.position.count
    const aControl = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const nx = geometry.attributes.normal.getX(i)
      const ny = geometry.attributes.normal.getY(i)
      const nz = geometry.attributes.normal.getZ(i)
      aControl[i * 3]     = nx * controlNormalScale + (Math.random() - 0.5) * controlRandomRange
      aControl[i * 3 + 1] = ny * controlNormalScale + (Math.random() - 0.5) * controlRandomRange
      aControl[i * 3 + 2] = nz * controlNormalScale + (Math.random() - 0.5) * controlRandomRange
    }
    geometry.setAttribute('aControl', new THREE.BufferAttribute(aControl, 3))
  }, [controlNormalScale, controlRandomRange])

  // Animate burst/aggregate // 动画控制爆裂/聚合
  useFrame(({ clock }) => {
    shaderMaterial.uniforms.uTime.value = clock.getElapsedTime()

    // Cyclical timeline // 周期性时间线
    const pause0          = 1.5
    const transitionUp    = 3.5
    const pause1          = 1.5
    const transitionDown  = 3.5
    const cycleDuration   = pause0 + transitionUp + pause1 + transitionDown
    const t = clock.getElapsedTime() % cycleDuration

    let progress = 0.0
    // Ease in/out function // 缓进缓出函数
    const easeInOutQuad = (x) =>
      x < 0.5 ? 2.0 * x * x : 1.0 - pow(-2.0 * x + 2.0, 2.0) / 2.0

    if (t < pause0) {
      progress = 0.0
    } else if (t < pause0 + transitionUp) {
      progress = easeInOutQuad((t - pause0) / transitionUp)
    } else if (t < pause0 + transitionUp + pause1) {
      progress = 1.0
    } else {
      progress = 1.0 - easeInOutQuad((t - pause0 - transitionUp - pause1) / transitionDown)
    }
    shaderMaterial.uniforms.uProgress.value = progress
  })

  return (
    <mesh position={[-5.5, -1, -2]}>
      <Text3D
        ref={meshRef}
        font="/helvetiker_regular.typeface.json"
        size={3}
        height={0}
        material={shaderMaterial}
        curveSegments={1}
        bevelEnabled
        bevelThickness={0.23}
        bevelSize={0.02}
        bevelOffset={0}
        bevelSegments={1}
      >
        LIKE
      </Text3D>
    </mesh>
  )
}

const LogoPixelBreak = () => {
  return (
    <div className="max-w-screen h-screen overflow-hidden bg-gradient-to-r from-slate-400 via-zinc-400 to-stone-400">
      <Canvas>
        <PixelText />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default LogoPixelBreak
