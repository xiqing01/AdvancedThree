import React, { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, RoundedBox, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// 1. 定义 Shader Material (使用 Drei 的 helper)
const NeonLineMaterial = shaderMaterial(
  // Uniforms: 传递给 Shader 的变量
  {
    w: 0.05, // 线条宽度 (可以调整)
    glowColor: new THREE.Color(0x00ffff), // 霓虹灯颜色 (青色)
  },
  // Vertex Shader (GLSL)
  `
    varying vec2 vUv; // 将 UV 坐标传递给 Fragment Shader
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader (GLSL) - 实现霓虹效果的核心
  `
    varying vec2 vUv;     // 从 Vertex Shader 接收的 UV 坐标
    uniform float w;      // 线条宽度
    uniform vec3 glowColor; // 光晕颜色

    void main() {
      // 定义线条中心位置 (例如，在 UV 的 Y 轴中间)
      float lineCenterY = 0.5;

      // 计算当前片元到线条中心的距离 d (只考虑 Y 轴)
      float d = abs(vUv.y - lineCenterY);

      // 线条半宽 (w 是总宽度)
      float lineHalfWidth = w * 0.5;

      // --- 核心思路应用 ---
      // 核心线条: 从中心 (d=0) 到半宽 (d=lineHalfWidth) 逐渐变暗
      // 使用 smoothstep(edge0, edge1, x): 当 x 从 edge1 变到 edge0 时，结果从 0 平滑过渡到 1
      // 这里我们希望距离越小越亮，所以 edge0 > edge1
      float coreIntensity = smoothstep(lineHalfWidth, 0.0, d); // 距离 < lineHalfWidth 时有值

      // 光晕: 在线条外部一定范围 (例如从半宽到 3 倍半宽) 逐渐衰减
      // glowFalloffStart: 光晕开始衰减的距离
      // glowFalloffEnd: 光晕完全消失的距离
      float glowFalloffStart = lineHalfWidth;
      float glowFalloffEnd = lineHalfWidth * 5.0; // 光晕范围是线宽的几倍
      float glowIntensity = smoothstep(glowFalloffEnd, glowFalloffStart, d); // 距离在 start 和 end 之间时有值

      // --- 组合效果 ---
      // 基础强度 = 核心亮度 + 光晕亮度 (光晕通常没核心亮)
      float totalIntensity = coreIntensity + glowIntensity * 0.4; // 调整光晕的相对亮度

      // 限制强度在 [0, 1] 范围
      totalIntensity = clamp(totalIntensity, 0.0, 1.0);

      // --- 输出颜色 ---
      // 最终颜色 = 光晕颜色 * 总强度
      // 透明度 = 总强度 (越亮的地方越不透明)
      vec3 finalColor = glowColor * totalIntensity;
      float finalAlpha = totalIntensity;

      // 如果强度过低，可以完全透明 (可选，避免背景有微弱颜色)
      // if (finalAlpha < 0.01) {
      //   discard; // 丢弃这个片元
      // }

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
);

// 2. 将自定义材质 'extend' 到 R3F 中，使其可以作为 JSX 标签使用
extend({ NeonLineMaterial });

// 3. 组件：包含 TurosKnot 和自定义材质
function NeonObject() {
  const meshRef = useRef();
  const materialRef = useRef();

  useFrame((state, delta) => {
    // 可以添加动画，例如旋转物体
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.1;
      meshRef.current.rotation.y += delta * 0.2;
    }
    // 也可以动画化 uniform 参数，例如改变颜色或宽度
    // if (materialRef.current) {
    //   materialRef.current.uniforms.w.value = Math.sin(state.clock.elapsedTime) * 0.02 + 0.05;
    // }
  });

  return (
    <RoundedBox ref={meshRef} args={[5]}>
      {/* 应用自定义的 Shader Material */}
      <neonLineMaterial
        ref={materialRef}
        // 设置材质属性，启用透明度
        transparent={false}
        // 对于发光效果，通常禁用深度写入，以获得更好的叠加效果
        depthWrite={false}
        // 可以传递或更新 uniforms
        // glowColor={"#ff00ff"} // 例如设置为品红色
        // w={0.1}
      />
    </RoundedBox>
  );
}

// 4. 主应用组件
function Asssa() {
  return (
    <div className="max-w-screen h-screen overflow-hidden bg-black">
      <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={['#101010']} /> {/* 深色背景 */}
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={1.0} />
      <OrbitControls />
      <NeonObject />
    </Canvas>
    </div>
  );
}

export default Asssa;