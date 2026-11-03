"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { hexToRgb } from "./scent-colors";

// "Visible scent": a domain-warped noise plume that rises from an origin
// point and drifts toward the reading direction. Rendered at half resolution
// (mist is soft by nature), paused off-screen and in hidden tabs, frozen to a
// single frame under prefers-reduced-motion, and replaced by a CSS gradient
// when WebGL is unavailable.

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec3 u_tint;
uniform vec2 u_origin;
uniform float u_drift;
uniform float u_intensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2((uv.x - u_origin.x) * aspect, uv.y - u_origin.y);
  float t = u_time * 0.06;

  vec2 q = vec2(fbm(p * 1.7 + vec2(0.0, -t * 2.0)), fbm(p * 1.7 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p * 2.1 + 4.0 * q + vec2(1.7, 9.2) + t * 0.6),
                fbm(p * 2.1 + 4.0 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p * 1.3 + 3.0 * r);

  float h = max(p.y, 0.0);
  float spread = 0.12 + h * 0.42;
  float lateral = p.x - u_drift * h * 0.45 - (q.x - 0.5) * 0.5;
  float plume = exp(-(lateral * lateral) / (spread * spread))
              * smoothstep(-0.04, 0.1, p.y)
              * (1.0 - smoothstep(0.9, 1.7, h));

  vec2 pp = vec2((uv.x - u_pointer.x) * aspect, uv.y - u_pointer.y);
  float touch = exp(-dot(pp, pp) * 5.0) * 0.4;

  // Thresholding the noise turns a uniform fog into separate wisps.
  float wisps = smoothstep(0.32, 0.92, f);
  float density = clamp(wisps * plume * 1.35 + touch * wisps, 0.0, 1.0);
  vec3 gold = vec3(0.93, 0.82, 0.56);
  vec3 col = mix(u_tint, gold, smoothstep(0.55, 0.95, f));
  float haze = smoothstep(0.45, 0.9, f) * 0.035;
  float a = clamp((density * 0.85 + haze) * u_intensity, 0.0, 0.78);
  gl_FragColor = vec4(col * a, a);
}
`;

type Props = {
  tint: string;
  // Plume origin in 0–1 canvas units, measured from the inline start (mirrored in RTL).
  originX?: number;
  originY?: number;
  // Optional origin height below the lg breakpoint, when the layout stacks.
  originYCompact?: number;
  intensity?: number;
  className?: string;
};

export function ScentField({
  tint,
  originX = 0.5,
  originY = 0.05,
  originYCompact,
  intensity = 1,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef = useRef(hexToRgb(tint));
  const fallbackRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    tintRef.current = hexToRgb(tint);
    // The animated loop eases toward the new tint on its own; a still
    // (reduced-motion) frame has to be redrawn.
    replayRef.current?.();
  }, [tint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
    if (!gl) {
      canvas.hidden = true;
      if (fallbackRef.current) fallbackRef.current.hidden = false;
      return;
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.hidden = true;
      if (fallbackRef.current) fallbackRef.current.hidden = false;
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      res: uniform("u_res"),
      time: uniform("u_time"),
      pointer: uniform("u_pointer"),
      tint: uniform("u_tint"),
      origin: uniform("u_origin"),
      drift: uniform("u_drift"),
      intensity: uniform("u_intensity"),
    };

    const rtl = document.documentElement.dir === "rtl";
    // Mirror the origin and drift so the plume flows toward the text in RTL.
    const startX = rtl ? 1 - originX : originX;
    const wide = window.matchMedia("(min-width: 1024px)");
    const applyOrigin = () =>
      gl.uniform2f(u.origin, startX, wide.matches ? originY : (originYCompact ?? originY));
    applyOrigin();
    gl.uniform1f(u.drift, rtl ? 0.6 : -0.6);
    gl.uniform1f(u.intensity, intensity);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const current = [...tintRef.current] as [number, number, number];
    const pointer = { x: startX, y: 0.6, tx: startX, ty: 0.6 };
    let frame = 0;
    let visible = true;
    let start = performance.now();

    const resize = () => {
      const scale = 0.5;
      const width = Math.max(1, Math.round(canvas.clientWidth * scale));
      const height = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(u.res, width, height);
    };

    const draw = (now: number) => {
      resize();
      for (let i = 0; i < 3; i++) current[i] += (tintRef.current[i] - current[i]) * 0.04;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      gl.uniform3f(u.tint, current[0], current[1], current[2]);
      gl.uniform2f(u.pointer, pointer.x, pointer.y);
      gl.uniform1f(u.time, (now - start) / 1000 + 12);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const play = () => {
      cancelAnimationFrame(frame);
      if (reduceMotion.matches) {
        // Settle the tint, then draw one still frame.
        for (let i = 0; i < 3; i++) current[i] = tintRef.current[i];
        draw(start + 8000);
        return;
      }
      if (visible && !document.hidden) frame = requestAnimationFrame(loop);
    };
    replayRef.current = () => {
      if (reduceMotion.matches) play();
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (event.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (event.clientY - rect.top) / rect.height;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else cancelAnimationFrame(frame);
    });
    observer.observe(canvas);

    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : play());
    const onMotionChange = () => {
      start = performance.now();
      play();
    };

    wide.addEventListener("change", applyOrigin);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", onMotionChange);
    play();

    return () => {
      cancelAnimationFrame(frame);
      replayRef.current = null;
      observer.disconnect();
      wide.removeEventListener("change", applyOrigin);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onMotionChange);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [originX, originY, originYCompact, intensity]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div
        ref={fallbackRef}
        hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 70% at 50% 85%, ${tint}55, transparent 70%)`,
        }}
      />
    </div>
  );
}
