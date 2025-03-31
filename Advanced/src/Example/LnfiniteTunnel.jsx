import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useControls, folder } from 'leva';
import { KernelSize } from 'postprocessing'; // Bloom kernel size options // Bloom核大小选项

// TunnelSegment: Render a single tunnel segment // TunnelSegment: 渲染单个隧道段落
function TunnelSegment({ position, scale, baseSize, spacing, wallMaterial }) {
  // Calculate segment dimensions // 计算段落尺寸
  const segmentWidth = baseSize[0];
  const segmentHeight = baseSize[1];
  const segmentDepth = spacing;

  return (
    <group position={position} scale={scale.x}> {/* Uniform scaling // 均匀缩放 */}
      {/* Top wall / ceiling // 顶部墙面/天花板 */}
      <mesh
        material={wallMaterial} // Use passed wall material // 使用传入的墙面材质
        position={[0, segmentHeight / 2, -segmentDepth / 2]} // Set top position // 设置顶部位置
        rotation={[Math.PI / 2, 0, 0]} // Rotate to horizontal // 旋转为水平面
      >
        <planeGeometry args={[segmentWidth, segmentDepth]} />
      </mesh>
      {/* Left wall // 左侧墙面 */}
      <mesh
        material={wallMaterial}
        position={[-segmentWidth / 2, 0, -segmentDepth / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[segmentDepth, segmentHeight]} />
      </mesh>
      {/* Right wall // 右侧墙面 */}
      <mesh
        material={wallMaterial}
        position={[segmentWidth / 2, 0, -segmentDepth / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[segmentDepth, segmentHeight]} />
      </mesh>
    </group>
  );
}

// Ground: Render the ground with reflective material // Ground: 使用反射材质渲染地面
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
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} // Rotate to horizontal plane // 旋转为水平面
      position={[0, -tunnelHeight / 2, -totalLength / 2]} // Position the ground // 设置地面位置
    >
      <planeGeometry args={[tunnelWidth, totalLength * 4]} />
      <MeshReflectorMaterial
        resolution={resolution} // Reflection resolution // 反射分辨率
        mixBlur={mixBlur} // Reflection blur amount // 反射模糊值
        mixStrength={mixStrength} // Reflection strength // 反射强度
        roughness={roughness} // Surface roughness // 表面粗糙度
        depthScale={depthScale} // Depth scaling factor // 深度缩放因子
        minDepthThreshold={minDepthThreshold} // Minimum depth threshold // 最小深度阈值
        maxDepthThreshold={maxDepthThreshold} // Maximum depth threshold // 最大深度阈值
        color={groundColor} // Ground color // 地面颜色
        metalness={metalness} // Metalness value // 金属度
        blur={[blurX, blurY]} // Blur values for X and Y axes // X/Y 轴模糊值
        mirror={mirror} // Mirror factor // 镜面反射因子
      />
    </mesh>
  );
}

// Tunnel: Main tunnel component with moving segments // Tunnel: 主要隧道组件，包含移动段落
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
}) {
  const groupRef = useRef(); // Reference to the group of segments // 段落组的引用
  const totalTunnelDepth = count * spacing; // Total depth of the tunnel // 隧道总深度

  // Create data for each tunnel segment // 创建每个隧道段的数据
  const segmentsData = useMemo(() => {
    return Array.from({ length: count }).map((_, index) => ({
      id: index,
      initialZ: -index * spacing, // Initial Z position // 初始Z位置
      scale: Math.pow(scaleFactor, index), // Scale factor for the segment // 该段的缩放因子
    }));
  }, [count, spacing, scaleFactor]);

  // Animate tunnel segments each frame // 每帧更新隧道段动画
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const cappedDelta = Math.min(delta, 0.1); // Limit delta to avoid large jumps // 限制 delta 避免过大跳变
    const effectiveSpeed = speed * cappedDelta;
    const recycleThresholdZ = spacing; // Recycle threshold // 回收阈值

    groupRef.current.children.forEach(segmentGroup => {
      if (segmentGroup.type === 'Group') {
        segmentGroup.position.z += effectiveSpeed; // Move segment forward // 推进段落
        if (segmentGroup.position.z > recycleThresholdZ + spacing * 0.01) {
          // Recycle segment to the back // 回收段落到最后
          segmentGroup.position.z -= totalTunnelDepth;
        }
      }
    });
  });

  // Calculate ground width based on tunnel base width // 根据隧道宽度计算地面宽度
  const groundWidth = baseSize[0];

  return (
    <>
      <group ref={groupRef}>
        {segmentsData.map(data => (
          <TunnelSegment
            key={data.id} // Unique key for each segment // 每个段的唯一键
            position={[0, 0, data.initialZ]} // Set segment position // 设置段落位置
            scale={{ x: data.scale, y: data.scale, z: data.scale }} // Uniform scale // 均匀缩放
            baseSize={baseSize} // Pass tunnel dimensions // 传递隧道尺寸
            spacing={spacing} // Pass spacing // 传递间隔
            wallMaterial={wallMaterial} // Use shared wall material // 使用共享墙面材质
          />
        ))}
      </group>
      <Ground
        tunnelWidth={groundWidth} // Ground width // 地面宽度
        tunnelHeight={baseSize[1]} // Tunnel height // 隧道高度
        totalLength={totalTunnelDepth} // Tunnel total length // 隧道总长度
        groundColor={groundColor} // Ground color // 地面颜色
        metalness={groundMetalness} // Ground metalness // 地面金属度
        roughness={groundRoughness} // Ground roughness // 地面粗糙度
        resolution={groundResolution} // Reflector resolution // 反射材质分辨率
        mixBlur={groundMixBlur} // Reflector mix blur // 反射混合模糊
        mixStrength={groundMixStrength} // Reflector mix strength // 反射混合强度
        depthScale={groundDepthScale} // Reflector depth scale // 反射深度缩放
        minDepthThreshold={groundMinDepthThreshold} // Minimum depth threshold // 最小深度阈值
        maxDepthThreshold={groundMaxDepthThreshold} // Maximum depth threshold // 最大深度阈值
        blurX={groundBlurX} // Blur X axis // X轴模糊值
        blurY={groundBlurY} // Blur Y axis // Y轴模糊值
        mirror={groundMirror} // Mirror factor // 镜面反射因子
      />
    </>
  );
}

// LnfiniteTunnel: Main application component integrating controls and postprocessing
// LnfiniteTunnel: 主应用组件，整合控制面板与后期处理效果
function LnfiniteTunnel() {
  // Leva controls for all parameters // 使用 Leva 控制所有参数
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
      wallColor: '#ffffff',
      wallRoughness: { value: 0.25, min: 0, max: 1, step: 0.05 },
      wallMetalness: { value: 0.3, min: 0, max: 1, step: 0.05 },
    }),
    groundReflector: folder({
      color: '#0b0a0a', // Darker ground color // 较暗的地面颜色
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
      mirror: { value: 0, min: 0, max: 1, step: 0.01 },
    }),
    postProcessing: folder({
      bloomEnabled: { value: true },
      bloomIntensity: { value: 0.2, min: 0, max: 10, step: 0.1 },
      bloomLuminanceThreshold: { value: 0.6, min: 0, max: 1, step: 0.01 },
      bloomLuminanceSmoothing: { value: 0.05, min: 0, max: 1, step: 0.01 },
      bloomMipmapBlur: { value: true },
      bloomKernelSize: { value: KernelSize.LARGE, options: KernelSize },
    }),
  });

  // Create a shared wall material using Leva controls values // 使用 Leva 控制面板中的值创建共享墙面材质
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: controls.wallColor,
        roughness: controls.wallRoughness,
        metalness: controls.wallMetalness,
        side: THREE.DoubleSide, // Render both sides // 渲染双面
      }),
    [controls.wallColor, controls.wallRoughness, controls.wallMetalness]
  );

  // Combine baseWidth and baseHeight into an array // 将 baseWidth 和 baseHeight 合并为数组
  const baseSize = useMemo(
    () => [controls.baseWidth, controls.baseHeight],
    [controls.baseWidth, controls.baseHeight]
  );

  return (
    <div style={{ height: '100vh', width: '100vw', background: controls.backgroundColor }}>
      <Canvas camera={{ position: [0, 0, controls.positionZ], fov: controls.fov }}>
        <ambientLight intensity={controls.ambientIntensity} />
        <pointLight
          position={controls.pointLightPosition}
          intensity={controls.pointLightIntensity}
          color={controls.pointLightColor}
        />

        <Tunnel
          speed={controls.speed}
          count={controls.count}
          spacing={controls.spacing}
          baseSize={baseSize}
          scaleFactor={controls.scaleFactor}
          wallMaterial={wallMaterial}
          // Ground reflector parameters passed through // 透传地面反射参数
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
