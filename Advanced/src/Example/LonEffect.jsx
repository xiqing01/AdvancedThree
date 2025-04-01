import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useControls, folder } from 'leva';

// Vertex Shader: Pass position and UV data / 顶点着色器：传递位置和 UV 数据
const vertexShader = `
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader: Compute waves and color based on uniforms / 片元着色器：基于 uniforms 计算波形和颜色
const fragmentShader = `
  uniform float time;

  // General Parameters
  uniform float uFrequency;
  uniform float uSpeed;
  uniform float uAmplitude;

  // Wave 1 Parameters
  uniform float uWave1SpeedMult;

  // Wave 2 Parameters
  uniform float uWave2PosMult;
  uniform float uWave2SpeedMult;

  // Wave 3 Parameters
  uniform float uWave3FreqMult;
  uniform float uWave3SpeedMult;

  // Wave 4 Parameters
  uniform float uWave4InnerSpeed1;
  uniform float uWave4InnerSpeed2;

  // Color Parameters
  uniform float uColorBias; // Base offset / 基准偏移
  uniform float uColorAmp;  // Amplitude / 振幅
  uniform float uRedPhaseOffset;
  uniform float uGreenPhaseOffset;
  uniform float uBluePhaseOffset;

  varying vec3 vPosition;
  varying vec2 vUv;

  #define PI 3.14159265359

  void main() {
    vec2 p = vPosition.xy * uFrequency; // Base coords / 基础坐标
    float wave1 = sin(p.x + time * uSpeed * uWave1SpeedMult);
    float wave2 = sin(p.y + p.x * uWave2PosMult + time * uSpeed * uWave2SpeedMult);
    float wave3 = sin(length(vPosition.xy * uFrequency * uWave3FreqMult) + time * uSpeed * uWave3SpeedMult);
    float wave4 = cos(p.x * sin(time * uSpeed * uWave4InnerSpeed1) + p.y * cos(time * uSpeed * uWave4InnerSpeed2) + time * uSpeed);
    float combined = (wave1 + wave2 + wave3 + wave4) * uAmplitude;
    float r = uColorBias + uColorAmp * sin(combined + uRedPhaseOffset);
    float g = uColorBias + uColorAmp * sin(combined + uGreenPhaseOffset);
    float b = uColorBias + uColorAmp * sin(combined + uBluePhaseOffset);
    gl_FragColor = vec4(r, g, b, 1.0); // Final color / 最终颜色
  }
`;

// Animated Torus Knot Component / 动态陀螺结组件
function AnimatedTorusKnot() {
  const meshRef = useRef(); // Mesh reference / 网格引用
  const shaderRef = useRef(); // Shader material reference / 着色器引用
  const geometryRef = useRef(); // Geometry reference / 几何体引用

  const [totalIndices, setTotalIndices] = useState(0); // Total indices / 索引总数
  const [currentProgress, setCurrentProgress] = useState(0); // Animation progress / 动画进度

  // Leva controls for shader and animation parameters / Leva 控制器：着色器与动画参数
  const uniformControls = useControls({
    'Shader Effects': folder({
      'General': folder({
        uFrequency: { value: 0.3, min: 0.1, max: 3.0, step: 0.1, label: 'Frequency' },
        uSpeed: { value: 2, min: 0.0, max: 4.0, step: 0.01, label: 'Global Speed' },
        uAmplitude: { value: 1.7, min: 0.1, max: 3.0, step: 0.05, label: 'Amplitude' },
      }),
      'Wave Params': folder({
        uWave1SpeedMult: { value: 2, min: 0, max: 2, step: 0.01, label: 'W1 Speed Mult' },
        uWave2PosMult: { value: 1.6, min: -1, max: 2, step: 0.01, label: 'W2 Pos Mult' },
        uWave2SpeedMult: { value: 1.77, min: 0, max: 2, step: 0.01, label: 'W2 Speed Mult' },
        uWave3FreqMult: { value: 5, min: 0, max: 10, step: 0.01, label: 'W3 Freq Mult' },
        uWave3SpeedMult: { value: 0.39, min: 0, max: 2, step: 0.01, label: 'W3 Speed Mult' },
        uWave4InnerSpeed1: { value: 0.13, min: 0, max: 1, step: 0.01, label: 'W4 Inner Spd 1' },
        uWave4InnerSpeed2: { value: 0.97, min: 0, max: 1, step: 0.01, label: 'W4 Inner Spd 2' },
      }),
      'Color Params': folder({
        uColorBias: { value: 0.91, min: 0.0, max: 1.0, step: 0.01, label: 'Color Bias' },
        uColorAmp: { value: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Color Amplitude' },
        uRedPhaseOffset: { value: 6.28, min: 0, max: Math.PI * 2, step: 0.01, label: 'Red Phase' },
        uGreenPhaseOffset: { value: 6.28, min: 0, max: Math.PI * 2, step: 0.01, label: 'Green Phase' },
        uBluePhaseOffset: { value: 2.31, min: 0, max: Math.PI * 2, step: 0.01, label: 'Blue Phase' },
      })
    }, { collapsed: true }),
    'Build Animation': folder({
      animationProgress: { value: 0, min: 0, max: 1, step: 0.01, label: 'Progress' },
      animate: { value: true, label: 'Play Animation' },
      animationDuration: { value: 5, min: 1, max: 20, step: 0.1, label: 'Duration (s)' },
    })
  });

  // Memoize shader uniforms from controls / 缓存来自控制器的着色器 uniforms
  const uniforms = useMemo(() => {
    const u = { time: { value: 0 } };
    u.uFrequency = { value: uniformControls.uFrequency };
    u.uSpeed = { value: uniformControls.uSpeed };
    u.uAmplitude = { value: uniformControls.uAmplitude };
    u.uWave1SpeedMult = { value: uniformControls.uWave1SpeedMult };
    u.uWave2PosMult = { value: uniformControls.uWave2PosMult };
    u.uWave2SpeedMult = { value: uniformControls.uWave2SpeedMult };
    u.uWave3FreqMult = { value: uniformControls.uWave3FreqMult };
    u.uWave3SpeedMult = { value: uniformControls.uWave3SpeedMult };
    u.uWave4InnerSpeed1 = { value: uniformControls.uWave4InnerSpeed1 };
    u.uWave4InnerSpeed2 = { value: uniformControls.uWave4InnerSpeed2 };
    u.uColorBias = { value: uniformControls.uColorBias };
    u.uColorAmp = { value: uniformControls.uColorAmp };
    u.uRedPhaseOffset = { value: uniformControls.uRedPhaseOffset };
    u.uGreenPhaseOffset = { value: uniformControls.uGreenPhaseOffset };
    u.uBluePhaseOffset = { value: uniformControls.uBluePhaseOffset };
    return u;
  }, []);

  // Initialize geometry draw range / 初始化几何体绘制范围
  useEffect(() => {
    setCurrentProgress(uniformControls.animationProgress);
    if (geometryRef.current) {
      const count = geometryRef.current.index
        ? geometryRef.current.index.count
        : geometryRef.current.attributes.position.count;
      setTotalIndices(count);
      geometryRef.current.setDrawRange(0, Math.floor(uniformControls.animationProgress * count));
      if (!geometryRef.current.index) {
        console.warn("Geometry is not indexed. / 几何体未使用索引，绘制范围应用于顶点。");
      }
    }
  }, [uniformControls.animationProgress]);

  // Frame loop: update uniforms and animation progress / 帧循环：更新 uniforms 和动画进度
  useFrame(({ clock }) => {
    meshRef.current.rotation.y -= 0.0005
    meshRef.current.rotation.x += 0.0005
    // Update shader time / 更新着色器时间
    if (shaderRef.current) {
      shaderRef.current.uniforms.time.value = clock.elapsedTime;
      for (const key in uniforms) {
        if (key !== 'time' && shaderRef.current.uniforms[key] && uniformControls[key] !== undefined) {
          shaderRef.current.uniforms[key].value = uniformControls[key];
        }
      }
      // Ensure key uniforms are updated / 确保关键 uniforms 更新
      shaderRef.current.uniforms.uFrequency.value = uniformControls.uFrequency;
      shaderRef.current.uniforms.uSpeed.value = uniformControls.uSpeed;
      shaderRef.current.uniforms.uBluePhaseOffset.value = uniformControls.uBluePhaseOffset;
    }

    // Calculate animation progress with easing / 使用缓动函数计算动画进度
    const pause0 = 1.5;         // Initial pause / 初始暂停
    const transitionUp = 3.5;   // Ascend phase / 上升阶段
    const pause1 = 1.5;         // Top pause / 顶部暂停
    const transitionDown = 3.5; // Descend phase / 下降阶段
    const cycleDuration = pause0 + transitionUp + pause1 + transitionDown;
    const t = clock.elapsedTime % cycleDuration;

    let newProgress = 0.0;
    const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

    if (t < pause0) {
      newProgress = 0.0;
    } else if (t < pause0 + transitionUp) {
      newProgress = easeInOutQuad((t - pause0) / transitionUp);
    } else if (t < pause0 + transitionUp + pause1) {
      newProgress = 1.0;
    } else {
      newProgress = 1.0 - easeInOutQuad((t - pause0 - transitionUp - pause1) / transitionDown);
    }

    setCurrentProgress(newProgress);

    // Update geometry draw range based on progress / 根据进度更新绘制范围
    if (geometryRef.current && totalIndices > 0) {
      const drawCount = Math.floor(newProgress * totalIndices);
      if (geometryRef.current.drawRange.count !== drawCount) {
        geometryRef.current.setDrawRange(0, drawCount);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <torusKnotGeometry ref={geometryRef} args={[10, 1.6, 200, 20, 2, 5]} />
      <shaderMaterial
        ref={shaderRef}
        key={fragmentShader + vertexShader}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        wireframe={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Main App Component / 主应用组件
function LonEffect() {
  return (
    <div className="max-w-screen h-screen overflow-hidden bg-black">
      <Canvas camera={{ position: [0, 0, 40] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[50, 50, 50]} intensity={1} />
        <AnimatedTorusKnot />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default LonEffect;
