import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls, folder, Leva } from 'leva';

// Vertex Shader - No changes needed. // 顶点着色器 - 无需修改。
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader - No changes needed (Keep all uniforms included). // 片元着色器 - 无需修改 (保持包含所有uniforms)。
const fragmentShader = `
// --- Uniforms controlled by Leva --- // --- Leva 控制的 Uniforms ---
uniform float uTime;              // Time. // 时间。
uniform vec2 uResolution;           // Resolution. // 分辨率。
uniform float uNumLayers;           // Number of star layers. // 星星层数。
uniform float uHorizontalSpeed;     // Horizontal movement speed. // 水平移动速度。
uniform float uFlickerSpeed;        // Star flicker speed. // 星星闪烁速度。
uniform float uStarBaseDivisor;     // Base divisor in Star(). // Star() 中的基础除数。
uniform float uStarRayFactor;       // Ray factor in Star(). // Star() 中的射线因子。
uniform float uStarFlareFactor;     // Flare factor in Star(). // Star() 中的光晕因子。
uniform float uStarRayIntensity;    // Ray intensity in Star(). // Star() 中的射线强度。
uniform float uStarExistenceThreshold; // Existence threshold in StarLayer(). // StarLayer() 中的存在阈值。
uniform float uStarColorIntensity1; // Color parameter 1 (R) in StarLayer(). // StarLayer() 颜色参数1 (R)。
uniform float uStarColorIntensity2; // Color parameter 2 (G) in StarLayer(). // StarLayer() 颜色参数2 (G)。
uniform float uStarColorIntensity3; // Color parameter 3 (B) in StarLayer(). // StarLayer() 颜色参数3 (B)。
uniform float uScaleMin;            // Minimum scale. // 最小缩放。
uniform float uScaleMax;            // Maximum scale. // 最大缩放。
uniform float uGammaCorrection;     // Gamma correction. // 伽马校正。

varying vec2 vUv; // Passed from Vertex Shader. // 从顶点着色器传递。

// Function to create a 2D rotation matrix. // 创建二维旋转矩阵的函数。
mat2 Rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// Function to calculate the appearance of a single star. // 计算单个星星外观的函数。
float Star(vec2 uv, float flare) {
    float d = length(uv);
    float m = uStarBaseDivisor / d; // Base brightness based on distance. // 基于距离的基础亮度。

    // Calculate rays along axes. // 计算沿轴的射线。
    float rays = max(0.0, 1.0 - abs(uv.x * uv.y * uStarRayFactor));
    m += rays * flare * uStarRayIntensity;

    // Rotate and calculate rays again for cross shape. // 旋转并再次计算射线以形成十字形状。
    uv *= Rot(3.1415 / 2.0); // Rotate by 90 degrees. // 旋转90度。
    rays = max(0.0, 1.0 - abs(uv.x * uv.y * uStarRayFactor));
    m += rays * uStarFlareFactor * flare * uStarRayIntensity; // Use flare factor for rotated rays. // 对旋转后的射线使用光晕因子。

    // Smoothly fade out the star further from the center. // 距离中心越远，星星平滑淡出。
    m *= smoothstep(1.0, 0.2, d);
    return m;
}

// Pseudo-random number generator based on 2D input. // 基于二维输入的伪随机数生成器。
float Hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Function to generate a layer of stars across the UV space. // 在UV空间中生成一层星星的函数。
vec3 StarLayer(vec2 uv) {
    vec3 col = vec3(0.0); // Initialize color. // 初始化颜色。
    vec2 gv = fract(uv) - 0.5; // Grid coordinates within a cell (-0.5 to 0.5). // 单元格内的网格坐标 (-0.5 到 0.5)。
    vec2 id = floor(uv); // Integer cell ID. // 整数单元格ID。

    // Loop through the current cell and its 8 neighbours. // 遍历当前单元格及其8个邻居。
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offs = vec2(float(x), float(y)); // Neighbour offset. // 邻居偏移量。
            float n = Hash21(id + offs); // Generate a random number for the cell. // 为单元格生成随机数。

            // Skip drawing if the random number is below the threshold. // 如果随机数低于阈值，则跳过绘制。
            if(n < uStarExistenceThreshold) continue;

            float size = fract(n * 345.32); // Determine star size based on hash. // 基于哈希确定星星大小。
            vec2 starPos = gv - offs - vec2(n, fract(n * 34.0)) + 0.5; // Calculate star position within the cell, adding randomness. // 计算星星在单元格内的位置，增加随机性。

            // Calculate star brightness/shape. // 计算星星亮度/形状。
            float star = Star(starPos, smoothstep(0.9, 1.0, size) * 0.6); // Flare depends on size. // 光晕取决于大小。

            // Determine star color based on hash. // 基于哈希确定星星颜色。
            vec3 color = sin(vec3(uStarColorIntensity1, uStarColorIntensity2, uStarColorIntensity3) * fract(n * 2345.2) * 123.2) * 0.5 + 0.5;
            color = color * vec3(1.0, 0.25, 1.0 + size) + vec3(0.2, 0.2, 0.1) * 2.0; // Adjust color based on size and add base color. // 根据大小调整颜色并添加基色。

            // Apply flicker effect based on time and hash. // 根据时间和哈希应用闪烁效果。
            star *= sin(uTime * uFlickerSpeed + n * 6.2831) * 0.5 + 1.0;

            // Add the star's contribution to the final color. // 将星星的贡献添加到最终颜色中。
            col += star * size * color;
        }
    }
    return col;
}

// Main fragment shader function. // 片元着色器主函数。
void main() {
    // Convert vertex UV to screen fragment coordinates. // 将顶点UV转换为屏幕片段坐标。
    vec2 fragCoord = vUv * uResolution.xy;
    // Normalize coordinates and center the origin. // 归一化坐标并将原点居中。
    vec2 uv = (fragCoord - 0.5 * uResolution.xy) / uResolution.y;

    float t = uTime * 0.02; // Slow down time for layer animation. // 减慢层动画的时间。
    uv.x -= uTime * uHorizontalSpeed; // Apply horizontal scrolling based on time and speed. // 根据时间和速度应用水平滚动。

    vec3 col = vec3(0.0); // Initialize final color. // 初始化最终颜色。
    float layerStep = 1.0 / uNumLayers; // Calculate step size for iterating through layers. // 计算遍历图层的步长。

    // Loop through multiple layers to create depth. // 循环遍历多个层以创建深度。
    for (float i = 0.0; i < 1.0; i += layerStep) {
        float depth = fract(i + t); // Calculate depth for parallax effect, cycles over time. // 计算视差效果的深度，随时间循环。
        float scale = mix(uScaleMax, uScaleMin, depth); // Interpolate scale based on depth (closer layers are larger/scaled less). // 根据深度插值缩放 (较近的层更大/缩放更少)。
        float fade = depth * smoothstep(1.0, 0.9, depth); // Fade layers based on depth (fade out furthest layers). // 根据深度淡化图层 (淡出最远的图层)。

        // Calculate color for this layer and add it to the total. // 计算此图层的颜色并将其添加到总和中。
        col += StarLayer(uv * scale + i * 453.2 ) * fade; // Apply scale and pseudo-random offset per layer. // 应用每层的缩放和伪随机偏移。
    }

    // Apply gamma correction for better brightness perception. // 应用伽马校正以获得更好的亮度感知。
    col = pow(col, vec3(uGammaCorrection));

    // Set the final fragment color. // 设置最终的片段颜色。
    gl_FragColor = vec4(col, 1.0);
}
`;

// --- 1. Define Presets --- // --- 1. 定义预设 (Presets) ---
// !! Please replace the values below with the actual parameters for your 3 tuned effects !! // !! 请将下面的值替换为你调试好的 3 种效果的实际参数 !!
const presets = {
  'A': { // Effect 1 - Example values. // 第 1 种效果 - 示例值。
    numLayers: 2.0, horizontalSpeed: 0.01, flickerSpeed: 0.1, gammaCorrection: 1.61, scaleMin: 20.0, scaleMax: 100.0,
    starBaseDivisor: 0.2, starRayFactor: 8.0, starFlareFactor: 0.87, starRayIntensity: 1.3, starExistenceThreshold: 0.63,
    starColorIntensity1: 0.0, starColorIntensity2: 0.0, starColorIntensity3: 0.09,
  },
  'B': { // Effect 2 - Example values. // 第 2 种效果 - 示例值。
    numLayers: 8.0, horizontalSpeed: 0.01, flickerSpeed: 1.3, gammaCorrection: 0.35, scaleMin: 3.5, scaleMax: 10.0,
    starBaseDivisor: 0.01, starRayFactor: 125.0, starFlareFactor: 1.0, starRayIntensity: 10.0, starExistenceThreshold: 0.0,
    starColorIntensity1: 1.0, starColorIntensity2: 1.0, starColorIntensity3: 1.0,
  },
  'C': { // Effect 3 - Example values (Previous settings from your code). // 第 3 种效果 - 示例值 (你代码中之前的设置)。
    numLayers: 29.0, horizontalSpeed: 0.01, flickerSpeed: 0.1, gammaCorrection: 1.61, scaleMin: 7.7, scaleMax: 23.0,
    starBaseDivisor: 0.03, starRayFactor: 91.0, starFlareFactor: 0.71, starRayIntensity: 5.0, starExistenceThreshold: 0.89,
    starColorIntensity1: 0.19, starColorIntensity2: 0.49, starColorIntensity3: 0.32,
  }
};

// Get the first preset name as the default. // 获取第一个预设名称作为默认值。
const initialPresetName = Object.keys(presets)[0];


// --- Modified Background Plane Component --- // --- 修改后的背景平面组件 ---
function BackgroundPlane() {
  // Refs for the mesh and material. // 网格和材质的引用。
  const meshRef = useRef();
  const materialRef = useRef();
  // Get canvas size and viewport details from R3F. // 从 R3F 获取画布尺寸和视口详情。
  const { size, viewport } = useThree();

  // --- 2. Get useControls values and the set function --- // --- 2. 获取 useControls 的值和 set 函数 ---
  const [shaderControls, setShaderControls] = useControls(() => {
    // Get values from the initial preset, or fallback to the first one. // 从初始预设获取值，如果找不到则回退到第一个。
    const currentPresetValues = presets[initialPresetName] || presets[Object.keys(presets)[0]];

    // Define control schema (min/max/step/label) - these are not stored in preset values. // 定义控件的 min/max/step/label 信息 (这些不存储在 preset 值中)。
    const controlSchema = {
        numLayers: { min: 1, max: 50, step: 1, label: 'Number of Layers' },
        horizontalSpeed: { min: -0.5, max: 0.5, step: 0.01, label: 'Horizontal Speed' },
        flickerSpeed: { min: 0.1, max: 20.0, step: 0.1, label: 'Flicker Speed' },
        gammaCorrection: { min: 0.1, max: 2.0, step: 0.001, label: 'Gamma Correction' },
        scaleMin: { min: 0.1, max: 20.0, step: 0.1, label: 'Min Scale' },
        scaleMax: { min: 10.0, max: 100.0, step: 0.1, label: 'Max Scale' },
        starBaseDivisor: { min: 0.001, max: 0.2, step: 0.001, label: 'Base Divisor' },
        starRayFactor: { min: 1.0, max: 200.0, step: 1.0, label: 'Ray Factor' },
        starFlareFactor: { min: 0.0, max: 1.0, step: 0.01, label: 'Flare Factor' },
        starRayIntensity: { min: 0.1, max: 10.0, step: 0.1, label: 'Ray Intensity' },
        starExistenceThreshold: { min: 0.0, max: 0.99, step: 0.01, label: 'Existence Threshold' },
        starColorIntensity1: { min: 0.0, max: 1.0, step: 0.01, label: 'Color Intensity R' },
        starColorIntensity2: { min: 0.0, max: 1.0, step: 0.01, label: 'Color Intensity G' },
        starColorIntensity3: { min: 0.0, max: 1.0, step: 0.01, label: 'Color Intensity B' },
    }

    // Merge preset values and schema to create Leva control definitions. // 合并 preset 值和 schema 来创建 Leva 控件定义。
    const levaControls = {
        // Preset selection dropdown. // 预设选择下拉菜单。
        preset: {
            value: initialPresetName,
            options: Object.keys(presets),
            label: 'Effect Preset',
          },
    };
    // Add individual controls using schema and initial preset values. // 使用 schema 和初始预设值添加单独的控件。
    Object.keys(controlSchema).forEach(key => {
        levaControls[key] = {
            value: currentPresetValues[key], // Get value from the current preset. // 从当前预设获取 value。
            ...controlSchema[key] // Merge min/max/step/label. // 合并 min/max/step/label。
        };
    });

    // Group the controls into folders in the Leva panel. // 将控件分组到 Leva 面板中的文件夹。
    return {
        preset: levaControls.preset,
        general: folder({
            numLayers: levaControls.numLayers,
            horizontalSpeed: levaControls.horizontalSpeed,
            flickerSpeed: levaControls.flickerSpeed,
            gammaCorrection: levaControls.gammaCorrection,
            scaleMin: levaControls.scaleMin,
            scaleMax: levaControls.scaleMax,
        }, { collapsed: true }), // Start folder collapsed. // 初始折叠文件夹。
        starAppearance: folder({
            starBaseDivisor: levaControls.starBaseDivisor,
            starRayFactor: levaControls.starRayFactor,
            starFlareFactor: levaControls.starFlareFactor,
            starRayIntensity: levaControls.starRayIntensity,
            starExistenceThreshold: levaControls.starExistenceThreshold,
        }, { collapsed: true }),
        starColor: folder({
            starColorIntensity1: levaControls.starColorIntensity1,
            starColorIntensity2: levaControls.starColorIntensity2,
            starColorIntensity3: levaControls.starColorIntensity3,
        }, { collapsed: true }),
    };
  }, []); // Empty dependency array ensures this runs only once on mount. // 空依赖数组确保这只在挂载时运行一次。


    // --- 3. Listen for preset changes and apply them --- // --- 3. 监听预设变化并应用 ---
    useEffect(() => {
     const selectedPresetValues = presets[shaderControls.preset];
     if (selectedPresetValues) {
         // Create a copy to avoid modifying the original preset object. // 创建副本以避免修改原始预设对象。
         const valuesToApply = { ...selectedPresetValues };
         // Update the Leva controls with the values from the selected preset. // 使用所选预设的值更新 Leva 控件。
         setShaderControls(valuesToApply);
     }
     // Run this effect when the selected preset name changes. // 当所选预设名称更改时运行此效果。
    }, [shaderControls.preset, setShaderControls]);


  // --- 4. Cache the uniforms object using useMemo --- // --- 4. 使用 useMemo 缓存 uniforms 对象 ---
  // The *initial values* for uniforms should come from the *initial preset*. // uniforms 的 *初始值* 应该来自 *初始预设*。
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 }, // Time uniform, updated in useFrame. // 时间 uniform，在 useFrame 中更新。
      // Resolution uniform, set initially and updated on resize. // 分辨率 uniform，初始设置并在调整大小时更新。
      uResolution: { value: new THREE.Vector2(size.width * viewport.dpr, size.height * viewport.dpr) },
      // Use initialPresetName to get initial values for shader parameters. // 使用 initialPresetName 获取着色器参数的初始值。
      uNumLayers:           { value: presets[initialPresetName].numLayers },
      uHorizontalSpeed:     { value: presets[initialPresetName].horizontalSpeed },
      uFlickerSpeed:        { value: presets[initialPresetName].flickerSpeed },
      uStarBaseDivisor:     { value: presets[initialPresetName].starBaseDivisor },
      uStarRayFactor:       { value: presets[initialPresetName].starRayFactor },
      uStarFlareFactor:     { value: presets[initialPresetName].starFlareFactor },
      uStarRayIntensity:    { value: presets[initialPresetName].starRayIntensity },
      uStarExistenceThreshold: { value: presets[initialPresetName].starExistenceThreshold },
      uStarColorIntensity1: { value: presets[initialPresetName].starColorIntensity1 },
      uStarColorIntensity2: { value: presets[initialPresetName].starColorIntensity2 },
      uStarColorIntensity3: { value: presets[initialPresetName].starColorIntensity3 },
      uScaleMin:            { value: presets[initialPresetName].scaleMin },
      uScaleMax:            { value: presets[initialPresetName].scaleMax },
      uGammaCorrection:     { value: presets[initialPresetName].gammaCorrection },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Keep empty dependency array, so the uniforms object is created only once. // 保持为空依赖，uniforms 对象本身只创建一次。
  );

  // Update uResolution uniform when canvas size or device pixel ratio changes. // 当画布尺寸或设备像素比变化时更新 uResolution uniform。
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(
        size.width * viewport.dpr, // Use physical pixels for resolution. // 使用物理像素作为分辨率。
        size.height * viewport.dpr
      );
    }
  }, [size, viewport.dpr]); // Rerun effect if size or dpr changes. // 如果 size 或 dpr 更改，则重新运行效果。

  // --- 5. Update uniforms in useFrame (every frame) --- // --- 5. 在 useFrame 中更新 uniforms (每一帧) ---
  useFrame((state) => {
    const { clock } = state; // Get clock from R3F state. // 从 R3F 状态获取时钟。
    if (materialRef.current) {
      const currentUniforms = materialRef.current.uniforms;
      // Update time uniform. // 更新时间 uniform。
      currentUniforms.uTime.value = clock.getElapsedTime();

      // --- Update other uniforms from Leva controls --- // --- 从 Leva controls 更新其他 uniforms ---
      // This ensures the shader reflects the current Leva settings in real-time. // 这确保着色器实时反映当前的 Leva 设置。
      currentUniforms.uNumLayers.value           = shaderControls.numLayers;
      currentUniforms.uHorizontalSpeed.value     = shaderControls.horizontalSpeed;
      currentUniforms.uFlickerSpeed.value        = shaderControls.flickerSpeed;
      currentUniforms.uStarBaseDivisor.value     = shaderControls.starBaseDivisor;
      currentUniforms.uStarRayFactor.value       = shaderControls.starRayFactor;
      currentUniforms.uStarFlareFactor.value     = shaderControls.starFlareFactor;
      currentUniforms.uStarRayIntensity.value    = shaderControls.starRayIntensity;
      currentUniforms.uStarExistenceThreshold.value = shaderControls.starExistenceThreshold;
      currentUniforms.uStarColorIntensity1.value = shaderControls.starColorIntensity1;
      currentUniforms.uStarColorIntensity2.value = shaderControls.starColorIntensity2;
      currentUniforms.uStarColorIntensity3.value = shaderControls.starColorIntensity3;
      currentUniforms.uScaleMin.value            = shaderControls.scaleMin;
      currentUniforms.uScaleMax.value            = shaderControls.scaleMax;
      currentUniforms.uGammaCorrection.value     = shaderControls.gammaCorrection;
    }
  });

  return (
    // A mesh that covers the entire viewport. // 覆盖整个视口的网格。
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      {/* Basic plane geometry. */} {/* 基础平面几何体。 */}
      <planeGeometry args={[1, 1, 1, 1]} />
      {/* Use shaderMaterial to apply custom shaders. */} {/* 使用 shaderMaterial 应用自定义着色器。 */}
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms} // Pass the uniforms object. // 传递 uniforms 对象。
        depthWrite={false} // Disable writing to depth buffer (good for backgrounds). // 禁用写入深度缓冲区 (适用于背景)。
        depthTest={false} // Disable depth testing (good for backgrounds). // 禁用深度测试 (适用于背景)。
      />
    </mesh>
  );
}

// Main application component (No changes needed). // 主应用组件 (无需修改)。
function GLSLA() {
  return (
    <>
      {/* Leva control panel. */} {/* Leva 控制面板。 */}
      <Leva collapsed={false} /> {/* Keep Leva expanded by default. // 让 Leva 默认展开。 */}
      {/* React Three Fiber Canvas setup. */} {/* React Three Fiber 画布设置。 */}
      <Canvas
        // Camera settings. // 相机设置。
        camera={{ position: [0, 0, 1], fov: 75 }}
        // Style to make canvas fill the screen and stay behind other content. // 使画布填充屏幕并位于其他内容之后的样式。
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}
        // WebGL renderer options. // WebGL 渲染器选项。
        gl={{
          antialias: true, // Enable anti-aliasing. // 启用抗锯齿。
          pixelRatio: window.devicePixelRatio // Set pixel ratio for sharp rendering on high-DPI screens. // 设置像素比率以在高DPI屏幕上清晰渲染。
        }}
      >
        {/* Render the background plane component. */} {/* 渲染背景平面组件。 */}
        <BackgroundPlane />
      </Canvas>
    </>
  );
}

export default GLSLA;