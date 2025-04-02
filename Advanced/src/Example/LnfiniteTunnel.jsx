import { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { MeshReflectorMaterial, OrbitControls, shaderMaterial } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useControls, folder } from 'leva';
import { KernelSize } from 'postprocessing';

// Define custom shader material for neon lines - 定义霓虹线材质
const NeonLineMaterial = shaderMaterial(
  {
      w: 0.01,                         // Line width - 线条宽度
      colorA: new THREE.Color(0x00ffff), // Gradient color A - 渐变色 A
      colorB: new THREE.Color(0xff00ff), // Gradient color B - 渐变色 B
      time: 0.0,                       // Animation time - 动画时间
      animationSpeed: 1,               // Animation speed - 动画速度
      glowStartFactor: 1.0,            // Glow start factor - 光晕起始因子
      glowEndFactor: 5.0,              // Glow end factor - 光晕结束因子
      glowRelativeIntensity: 0.1,      // Glow intensity factor - 光晕相对强度
      opacity: 1.0,                    // Overall opacity - 整体不透明度
  },
  // Vertex shader (unchanged) - 顶点着色器（无变化）
  `
      varying vec2 vUv;
      void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
  `,
  // Fragment shader with optimized key comments - 片元着色器，优化了关键注释
  `
      varying vec2 vUv;
      uniform float w;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float time;
      uniform float animationSpeed;
      uniform float glowStartFactor;
      uniform float glowEndFactor;
      uniform float glowRelativeIntensity;
      uniform float opacity;

      void main() {
          // Define line center (vertical) - 定义线条中心（垂直）
          float lineCenterY = 0.5;
          // Compute vertical distance from center - 计算到中心的垂直距离
          float d = abs(vUv.y - lineCenterY);
          // Calculate half of the line width - 计算线条半宽
          float lineHalfWidth = w * 0.4;

          // Core intensity via smoothstep - 核心强度（平滑过渡）
          float coreIntensity = smoothstep(lineHalfWidth, 0.0, d);

          // Glow falloff parameters - 光晕衰减参数
          float glowFalloffStart = lineHalfWidth * glowStartFactor; // Start - 起始
          float glowFalloffEnd = max(glowFalloffStart + 0.001, lineHalfWidth * glowEndFactor); // End - 结束
          float glowIntensity = smoothstep(glowFalloffEnd, glowFalloffStart, d);

          // Combine core and glow intensities - 组合核心与光晕强度
          float totalIntensity = clamp(coreIntensity + glowIntensity * glowRelativeIntensity, 0.0, 1.0);

          // Compute gradient factor for animated color - 计算动画颜色渐变因子
          float gradientFactor = sin(vUv.x * 6.28 + time * animationSpeed) * 0.5 + 0.5;
          vec3 gradientColor = mix(colorA, colorB, gradientFactor);

          // Final color and alpha - 最终颜色与透明度
          vec3 finalColor = gradientColor * totalIntensity;
          float finalAlpha = totalIntensity * opacity;

          // Discard low alpha fragments for performance - 剔除低透明片元提高性能
          if (finalAlpha < 0.01) {
              discard;
          }
          gl_FragColor = vec4(finalColor, finalAlpha);
      }
  `
);

// Extend the custom material in R3F - 将自定义材质扩展到 R3F
extend({ NeonLineMaterial });

// TunnelSegment: Render a single tunnel segment - 渲染单个隧道段
function TunnelSegment({
  position,
  scale,
  baseSize,
  spacing,
  wallMaterial,
  neonLineWidth,
  neonColorA,
  neonColorB,
  neonAnimationSpeed,
  neonGlowStart,
  neonGlowEnd,
  neonGlowIntensity,
  neonOpacity,
}) {
  const materialRef = useRef(); // Material reference - 材质引用

  // Segment dimensions - 段尺寸
  const segmentWidth = baseSize[0];
  const segmentHeight = baseSize[1];
  const segmentDepth = spacing;

  // Update time uniform each frame - 每帧更新时间 uniform
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  // Memoize colors to prevent unnecessary recalculations - 缓存颜色，避免重复计算
  const memoColorA = useMemo(() => new THREE.Color(neonColorA), [neonColorA]);
  const memoColorB = useMemo(() => new THREE.Color(neonColorB), [neonColorB]);

  return (
    <group position={position} scale={scale.x}>
      {/* Top wall / ceiling with neon line - 顶部墙/天花板使用霓虹线 */}
      <mesh position={[0, segmentHeight / 2, -segmentDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[segmentWidth, segmentDepth]} />
        <neonLineMaterial
          ref={materialRef}
          key={NeonLineMaterial.key} // Unique material key - 材质唯一键
          // Update uniforms - 更新 uniform 参数
          uniforms-w-value={neonLineWidth}
          uniforms-colorA-value={memoColorA}
          uniforms-colorB-value={memoColorB}
          uniforms-animationSpeed-value={neonAnimationSpeed}
          uniforms-glowStartFactor-value={neonGlowStart}
          uniforms-glowEndFactor-value={neonGlowEnd}
          uniforms-glowRelativeIntensity-value={neonGlowIntensity}
          uniforms-opacity-value={neonOpacity}
          // Base material properties - 基础材质属性
          transparent={true} // Enable transparency - 开启透明
          depthWrite={false} // Disable depth writing - 禁止深度写入
          side={THREE.DoubleSide} // Render both sides - 渲染双面
        />
      </mesh>

      {/* Left wall with neon line - 左侧墙使用霓虹线 */}
      <mesh material={wallMaterial} position={[-segmentWidth / 2, 0, -segmentDepth / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[segmentDepth, segmentHeight]} />
        <neonLineMaterial
          ref={materialRef}
          key={NeonLineMaterial.key}
          uniforms-w-value={neonLineWidth}
          uniforms-colorA-value={memoColorA}
          uniforms-colorB-value={memoColorB}
          uniforms-animationSpeed-value={neonAnimationSpeed}
          uniforms-glowStartFactor-value={neonGlowStart}
          uniforms-glowEndFactor-value={neonGlowEnd}
          uniforms-glowRelativeIntensity-value={neonGlowIntensity}
          uniforms-opacity-value={neonOpacity}
          transparent={true}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right wall with neon line - 右侧墙使用霓虹线 */}
      <mesh material={wallMaterial} position={[segmentWidth / 2, 0, -segmentDepth / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[segmentDepth, segmentHeight]} />
        <neonLineMaterial
          ref={materialRef}
          key={NeonLineMaterial.key}
          uniforms-w-value={neonLineWidth}
          uniforms-colorA-value={memoColorA}
          uniforms-colorB-value={memoColorB}
          uniforms-animationSpeed-value={neonAnimationSpeed}
          uniforms-glowStartFactor-value={neonGlowStart}
          uniforms-glowEndFactor-value={neonGlowEnd}
          uniforms-glowRelativeIntensity-value={neonGlowIntensity}
          uniforms-opacity-value={neonOpacity}
          transparent={true}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// Ground: Render the reflective ground - 渲染反射地面
function Ground({
  tunnelWidth,
  tunnelHeight,
  totalLength,
  groundColor,
  metalness,
  roughness,
  resolution,
  mixBlur,
  mixStrength,
  depthScale,
  minDepthThreshold,
  maxDepthThreshold,
  blurX,
  blurY,
  mirror,
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -tunnelHeight / 2, -totalLength / 2]}>
      <planeGeometry args={[tunnelWidth, totalLength * 4]} />
      <MeshReflectorMaterial
        resolution={resolution}               // Reflection resolution - 反射分辨率
        mixBlur={mixBlur}                     // Blur amount - 模糊程度
        mixStrength={mixStrength}             // Reflection strength - 反射强度
        roughness={roughness}                 // Surface roughness - 表面粗糙度
        depthScale={depthScale}               // Depth scale - 深度缩放
        minDepthThreshold={minDepthThreshold} // Min depth - 最小深度
        maxDepthThreshold={maxDepthThreshold} // Max depth - 最大深度
        color={groundColor}                   // Ground color - 地面颜色
        metalness={metalness}                 // Metalness - 金属度
        blur={[blurX, blurY]}                 // X/Y blur - X/Y 轴模糊
        mirror={mirror}                       // Mirror factor - 镜面反射因子
      />
    </mesh>
  );
}

// Tunnel: Main tunnel component with animated segments - 主要隧道组件（含动画段）
function Tunnel({
  count,
  spacing,
  baseSize,
  scaleFactor,
  speed,
  wallMaterial,
  groundColor,
  groundMetalness,
  groundRoughness,
  groundResolution,
  groundMixBlur,
  groundMixStrength,
  groundDepthScale,
  groundMinDepthThreshold,
  groundMaxDepthThreshold,
  groundBlurX,
  groundBlurY,
  groundMirror,
  neonLineWidth,
  neonColorA,
  neonColorB,
  neonAnimationSpeed,
  neonGlowStart,
  neonGlowEnd,
  neonGlowIntensity,
  neonOpacity,
}) {
  const groupRef = useRef(); // Group reference - 段组引用
  const totalTunnelDepth = count * spacing; // Total tunnel depth - 隧道总深度

  // Prepare data for each tunnel segment - 构建每段数据
  const segmentsData = useMemo(() => {
    return Array.from({ length: count }).map((_, index) => ({
      id: index,
      initialZ: -index * spacing,         // Initial Z position - 初始 Z 位置
      scale: Math.pow(scaleFactor, index),  // Scale factor - 缩放因子
    }));
  }, [count, spacing, scaleFactor]);

  // Animate tunnel segments - 更新段动画
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const cappedDelta = Math.min(delta, 0.1); // Cap delta - 限制 delta
    const effectiveSpeed = speed * cappedDelta;
    const recycleThresholdZ = spacing;        // Recycle threshold - 回收阈值

    groupRef.current.children.forEach(segmentGroup => {
      if (segmentGroup.type === 'Group') {
        segmentGroup.position.z += effectiveSpeed; // Move segment - 移动段
        if (segmentGroup.position.z > recycleThresholdZ + spacing * 0.01) {
          segmentGroup.position.z -= totalTunnelDepth; // Recycle segment - 重置段位置
        }
      }
    });
  });

  const groundWidth = baseSize[0]; // Ground width equals tunnel width - 地面宽度等于隧道宽度

  return (
    <>
      <group ref={groupRef}>
        {segmentsData.map(data => (
          <TunnelSegment
            key={data.id}                              // Unique segment key - 段唯一键
            position={[0, 0, data.initialZ]}           // Segment position - 段位置
            scale={{ x: data.scale, y: data.scale, z: data.scale }} // Uniform scale - 均匀缩放
            baseSize={baseSize}                        // Tunnel dimensions - 隧道尺寸
            spacing={spacing}                          // Segment spacing - 段间距
            wallMaterial={wallMaterial}                // Shared wall material - 共享墙材
            neonLineWidth={neonLineWidth}
            neonColorA={neonColorA}
            neonColorB={neonColorB}
            neonAnimationSpeed={neonAnimationSpeed}
            neonGlowStart={neonGlowStart}
            neonGlowEnd={neonGlowEnd}
            neonGlowIntensity={neonGlowIntensity}
            neonOpacity={neonOpacity}
          />
        ))}
      </group>
      <Ground
        tunnelWidth={groundWidth}         // Ground width - 地面宽度
        tunnelHeight={baseSize[1]}          // Tunnel height - 隧道高度
        totalLength={totalTunnelDepth}      // Tunnel total length - 隧道总长
        groundColor={groundColor}           // Ground color - 地面颜色
        metalness={groundMetalness}         // Ground metalness - 地面金属度
        roughness={groundRoughness}         // Ground roughness - 地面粗糙度
        resolution={groundResolution}       // Reflector resolution - 反射分辨率
        mixBlur={groundMixBlur}             // Reflector mix blur - 反射模糊
        mixStrength={groundMixStrength}     // Reflector mix strength - 反射强度
        depthScale={groundDepthScale}       // Reflector depth scale - 深度缩放
        minDepthThreshold={groundMinDepthThreshold} // Min depth threshold - 最小深度阈值
        maxDepthThreshold={groundMaxDepthThreshold} // Max depth threshold - 最大深度阈值
        blurX={groundBlurX}                 // X blur - X轴模糊
        blurY={groundBlurY}                 // Y blur - Y轴模糊
        mirror={groundMirror}               // Mirror factor - 镜面反射因子
      />
    </>
  );
}

// LnfiniteTunnel: Main application component integrating controls and postprocessing - 主应用组件，整合控制与后处理
function LnfiniteTunnel() {
  // Leva controls configuration - Leva 控制参数
  const controls = useControls({
    scene: folder({
      backgroundColor: '#000000',
    }),
    camera: folder({
      fov: { value: 75, min: 10, max: 120, step: 1 },
      positionZ: { value: 0, min: 0.1, max: 50, step: 0.1 },
    }),
    lighting: folder({
      ambientIntensity: { value: 3, min: 0, max: 10, step: 0.1 },
      pointLightIntensity: { value: 6, min: 0, max: 100, step: 0.1 },
      pointLightColor: '#ffffff',
      pointLightPosition: { value: [0, 0, -1], step: 0.2 },
    }),
    tunnel: folder({
      speed: { value: 5, min: 0, max: 100, step: 1 },
      count: { value: 25, min: 3, max: 60, step: 1 },
      spacing: { value: 5, min: 1, max: 30, step: 0.5 },
      baseWidth: { value: 12, min: 1, max: 50, step: 0.5 },
      baseHeight: { value: 12, min: 1, max: 50, step: 0.5 },
      scaleFactor: { value: 0.95, min: 0.8, max: 1.0, step: 0.005 },
    }),
    segmentAppearance: folder({
      wallColor: '#003457',
      wallRoughness: { value: 0.25, min: 0, max: 1, step: 0.05 },
      wallMetalness: { value: 0.3, min: 0, max: 1, step: 0.05 },
    }),
    groundReflector: folder({
      color: '#0077c6', // Dark ground - 较暗地面
      metalness: { value: 0.3, min: 0, max: 1, step: 0.05 },
      roughness: { value: 0.45, min: 0, max: 1, step: 0.05 },
      resolution: { value: 1024, options: [256, 512, 1024, 2048] },
      mixBlur: { value: 7.5, min: 0, max: 10, step: 0.1 },
      mixStrength: { value: 4.4, min: 0, max: 5, step: 0.1 },
      depthScale: { value: 1.6, min: 0, max: 2, step: 0.05 },
      minDepthThreshold: { value: 1.7, min: 0, max: 2, step: 0.05 },
      maxDepthThreshold: { value: 1.4, min: 0, max: 5, step: 0.05 },
      blurX: { value: 500, min: 0, max: 1000, step: 10 },
      blurY: { value: 100, min: 0, max: 1000, step: 10 },
      mirror: { value: 1, min: 0, max: 1, step: 0.01 },
    }),
    postProcessing: folder({
      bloomEnabled: { value: true },
      bloomIntensity: { value: 0.2, min: 0, max: 10, step: 0.1 },
      bloomLuminanceThreshold: { value: 0.6, min: 0, max: 1, step: 0.01 },
      bloomLuminanceSmoothing: { value: 0.05, min: 0, max: 1, step: 0.01 },
      bloomMipmapBlur: { value: true },
      bloomKernelSize: { value: KernelSize.LARGE, options: KernelSize },
    }),
    neonLine: folder({
      lineWidth: { value: 0.02, min: 0.001, max: 0.05, step: 0.005, label: 'Line Width (w)' },
      colorA: { value: '#0d5ff7', label: 'Color A' },
      colorB: { value: '#8a00e6', label: 'Color B' },
      animationSpeed: { value: 10, min: 0, max: 10, step: 0.1 },
      glowStart: { value: 0.1, min: 0.01, max: 0.5, step: 0.001, label: 'Glow Start Factor' },
      glowEnd: { value: 8.5, min: 1.0, max: 50.0, step: 0.1, label: 'Glow End Factor' },
      glowIntensity: { value: 0.44, min: 0.0, max: 1.0, step: 0.01, label: 'Glow Relative Intensity' },
      opacity: { value: 1.0, min: 0.0, max: 1.0, step: 0.01, label: 'Line Opacity' }
    }),
  });

  // Create shared wall material - 创建共享墙材质
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: controls.wallColor,
        roughness: controls.wallRoughness,
        metalness: controls.wallMetalness,
        side: THREE.DoubleSide, // Render both sides - 渲染双面
      }),
    [controls.wallColor, controls.wallRoughness, controls.wallMetalness]
  );

  // Combine base dimensions - 合并基础尺寸
  const baseSize = useMemo(() => [controls.baseWidth, controls.baseHeight], [controls.baseWidth, controls.baseHeight]);

  return (
    <div style={{ height: '100vh', width: '100vw', background: controls.backgroundColor }}>
      <Canvas camera={{ position: [0, 0, controls.positionZ], fov: controls.fov }}>
        <ambientLight intensity={controls.ambientIntensity} />
        <pointLight position={controls.pointLightPosition} intensity={controls.pointLightIntensity} color={controls.pointLightColor} />
        <Tunnel
          speed={controls.speed}
          count={controls.count}
          spacing={controls.spacing}
          baseSize={baseSize}
          scaleFactor={controls.scaleFactor}
          wallMaterial={wallMaterial}
          // Ground reflector parameters - 地面反射参数
          groundColor={controls.color}
          groundMetalness={controls.metalness}
          groundRoughness={controls.roughness}
          groundResolution={controls.resolution}
          groundMixBlur={controls.mixBlur}
          groundMixStrength={controls.mixStrength}
          groundDepthScale={controls.depthScale}
          groundMinDepthThreshold={controls.minDepthThreshold}
          groundMaxDepthThreshold={controls.maxDepthThreshold}
          groundBlurX={controls.blurX}
          groundBlurY={controls.blurY}
          groundMirror={controls.mirror}
          neonLineWidth={controls.lineWidth}
          neonColorA={controls.colorA}
          neonColorB={controls.colorB}
          neonAnimationSpeed={controls.animationSpeed}
          neonGlowStart={controls.glowStart}
          neonGlowEnd={controls.glowEnd}
          neonGlowIntensity={controls.glowIntensity}
          neonOpacity={controls.opacity}
        />
        {controls.bloomEnabled && (
          <EffectComposer>
            <Bloom
              intensity={controls.bloomIntensity}
              luminanceThreshold={controls.bloomLuminanceThreshold}
              luminanceSmoothing={controls.bloomLuminanceSmoothing}
              mipmapBlur={controls.bloomMipmapBlur}
              kernelSize={controls.bloomKernelSize}
            />
          </EffectComposer>
        )}
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default LnfiniteTunnel;
