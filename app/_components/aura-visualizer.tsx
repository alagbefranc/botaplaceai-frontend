"use client";

import { useEffect, useRef, useCallback } from "react";

export type AuraState = "idle" | "connecting" | "listening" | "speaking" | "thinking" | "muted";

interface AuraVisualizerProps {
  state: AuraState;
  audioLevel?: number;
  color?: string;
  colorShift?: number;
  size?: number;
}

// Fragment shader — glowing ring/torus with organic wavy distortion
const FRAG_SHADER = `
precision mediump float;

uniform float u_time;
uniform float u_audioLevel;
uniform float u_stateBlend;    // 0=idle, 1=active
uniform float u_speaking;      // 0..1 speaking intensity
uniform float u_connecting;    // 0..1 connecting pulse
uniform vec3  u_color;
uniform float u_colorShift;
uniform vec2  u_resolution;

// Hash noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Time
  float t = u_time * 0.5;

  // --- Organic distortion along the ring ---
  // Use angle + noise to create wavy, organic ring edges
  float n1 = fbm(vec2(angle * 2.0 + t * 0.3, dist * 4.0 + t * 0.2));
  float n2 = fbm(vec2(angle * 3.0 - t * 0.4, dist * 3.0 - t * 0.15) + 5.0);
  float n3 = fbm(vec2(angle * 1.5 + t * 0.6, t * 0.1) + 10.0);

  // Combine distortions — stronger when speaking
  float baseDistort = (n1 - 0.5) * 0.06 + (n2 - 0.5) * 0.05;
  float audioDistort = u_audioLevel * u_speaking * 0.06 * sin(angle * 4.0 + t * 3.0);
  float connectDistort = u_connecting * 0.04 * sin(u_time * 3.5 + angle * 2.0);
  float distortion = baseDistort + audioDistort + connectDistort;

  // Extra waviness from noise applied radially
  float radialWave = (n3 - 0.5) * 0.04 * (1.0 + u_audioLevel * u_speaking * 2.0);
  distortion += radialWave;

  float modDist = dist + distortion;

  // --- Ring shape ---
  // Ring center radius and thickness
  float ringRadius = mix(0.28, 0.30, u_stateBlend) + u_speaking * u_audioLevel * 0.03;
  float ringThickness = mix(0.04, 0.055, u_stateBlend) + u_speaking * u_audioLevel * 0.015;

  // Distance from ring center line
  float ringDist = abs(modDist - ringRadius);

  // Core ring — sharp bright center
  float core = smoothstep(ringThickness, ringThickness * 0.2, ringDist);

  // Inner glow — medium spread
  float innerGlow = smoothstep(ringThickness * 3.5, ringThickness * 0.5, ringDist);

  // Outer glow — wide soft halo
  float outerGlow = smoothstep(ringThickness * 7.0, ringThickness * 1.5, ringDist);

  // Wispy tendrils extending from ring using noise
  float tendrilNoise = fbm(vec2(angle * 4.0 + t * 0.8, dist * 8.0 - t * 0.3) + 20.0);
  float tendrils = smoothstep(0.45, 0.7, tendrilNoise) * outerGlow * 0.4;

  // --- Color ---
  float slowT = u_time * 0.15;
  float hueAngle = u_colorShift * 6.2832 + slowT;
  vec3 col = u_color;
  col.r += sin(hueAngle) * u_colorShift * 0.2;
  col.g += sin(hueAngle + 2.094) * u_colorShift * 0.15;
  col.b += cos(hueAngle) * u_colorShift * 0.2;
  col = clamp(col, 0.0, 1.0);

  // Brighter core, slightly different hue for inner vs outer
  vec3 coreColor = mix(col, vec3(1.0), 0.6);   // Near-white bright core
  vec3 midColor = col * 1.2;                    // Saturated ring body
  vec3 outerColor = col * 0.5;                  // Dim outer glow

  // Composite color layers
  vec3 finalColor = outerColor * outerGlow * 0.5
                  + midColor * innerGlow * 0.7
                  + coreColor * core
                  + col * tendrils * 0.6;

  // Brightness based on state
  float brightness = mix(0.4, 1.0, u_stateBlend);
  finalColor *= brightness;

  // Alpha — ring visible, center transparent
  float alpha = (outerGlow * 0.4 + innerGlow * 0.7 + core) * brightness + tendrils * 0.3;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

const VERT_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

export function AuraVisualizer({
  state,
  audioLevel = 0,
  color = "#17DEBC",
  colorShift = 0.3,
  size = 260,
}: AuraVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);

  // Smoothed values for animation
  const smoothAudioRef = useRef(0);
  const smoothStateRef = useRef(0);
  const smoothSpeakingRef = useRef(0);
  const smoothConnectingRef = useRef(0);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return false;
    glRef.current = gl;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG_SHADER);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
      return false;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    programRef.current = program;

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }, [size]);

  // Store props in refs so the render loop always reads latest values
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const colorRef = useRef(color);
  const colorShiftRef = useRef(colorShift);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { colorShiftRef.current = colorShift; }, [colorShift]);

  useEffect(() => {
    const ok = initGL();
    if (!ok) return;

    startTimeRef.current = Date.now();

    const loop = () => {
      const gl = glRef.current;
      const program = programRef.current;
      if (!gl || !program) return;

      gl.useProgram(program);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const curState = stateRef.current;

      // Smooth interpolation targets
      const isActive = curState !== "idle";
      const targetState = isActive ? 1 : 0;
      const targetSpeaking = curState === "speaking" ? 1 : 0;
      const targetConnecting = curState === "connecting" ? 1 : 0;

      const lerpRate = 0.08;
      smoothStateRef.current += (targetState - smoothStateRef.current) * lerpRate;
      smoothSpeakingRef.current += (targetSpeaking - smoothSpeakingRef.current) * lerpRate;
      smoothConnectingRef.current += (targetConnecting - smoothConnectingRef.current) * lerpRate;
      smoothAudioRef.current += (audioLevelRef.current - smoothAudioRef.current) * 0.15;

      const [r, g, b] = hexToRgb(colorRef.current);

      // Set uniforms
      const u = (name: string) => gl.getUniformLocation(program, name);
      gl.uniform1f(u("u_time"), elapsed);
      gl.uniform1f(u("u_audioLevel"), smoothAudioRef.current);
      gl.uniform1f(u("u_stateBlend"), smoothStateRef.current);
      gl.uniform1f(u("u_speaking"), smoothSpeakingRef.current);
      gl.uniform1f(u("u_connecting"), smoothConnectingRef.current);
      gl.uniform3f(u("u_color"), r, g, b);
      gl.uniform1f(u("u_colorShift"), colorShiftRef.current);
      gl.uniform2f(u("u_resolution"), gl.canvas.width, gl.canvas.height);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [initGL]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
