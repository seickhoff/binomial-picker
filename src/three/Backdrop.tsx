import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type ShaderMaterial } from 'three'

/**
 * Hand-written backdrop shader: a vertical gradient, a soft glow behind the
 * device, slow drifting value noise and a vignette. Unlit and depth-write-free
 * so it never interferes with the board.
 *
 * The two operative chunks at the end put this shader through the renderer's
 * tone mapping and output color space, which three applies to its own
 * materials but not to a custom one. Only the operative chunks belong here —
 * their `_pars_` declarations are already prepended by WebGLProgram, and
 * including them again is a duplicate-definition compile error.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uGlow;
  uniform vec2 uFocus;
  /** 0 = plain backdrop, 1 = trading floor: grid, ticks and an index line. */
  uniform float uMarket;
  uniform vec3 uTrim;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec2 uv = vUv;

    // Deeper toward the floor, so the bins read as the bottom of a well.
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 1.0, uv.y));

    // Soft pool of light behind the playfield.
    float d = distance(uv, uFocus);
    col += uGlow * 0.55 * exp(-d * d * 6.5);

    // Slow drift, two octaves, keeps the flat gradient from looking dead.
    float n = valueNoise(uv * 3.0 + vec2(uTime * 0.017, uTime * -0.011));
    n += 0.5 * valueNoise(uv * 7.0 - vec2(uTime * 0.009, uTime * 0.013));
    col += uGlow * 0.085 * n;

    if (uMarket > 0.5) {
      // Dealing-room wall: a faint price grid...
      vec2 grid = abs(fract(uv * vec2(26.0, 15.0)) - 0.5);
      float lines = smoothstep(0.46, 0.5, max(grid.x, grid.y));
      col += uTrim * lines * 0.09;

      // ...and a big index line drifting across it. Two octaves of noise
      // sampled along x give a plausible-looking market history.
      float walk =
        valueNoise(vec2(uv.x * 3.5 - uTime * 0.02, 11.3)) * 0.6 +
        valueNoise(vec2(uv.x * 9.0 - uTime * 0.05, 4.7)) * 0.25;
      float lineY = 0.34 + walk * 0.26;

      // Soft fill under the line, brighter right at it.
      float under = smoothstep(0.0, 0.28, lineY - uv.y);
      col += uTrim * under * 0.055;
      float stroke = 1.0 - smoothstep(0.0, 0.0075, abs(uv.y - lineY));
      col += uTrim * stroke * 0.85;
    }

    // Vignette.
    col *= 1.0 - 0.6 * smoothstep(0.3, 1.05, distance(uv, vec2(0.5)));

    // Ordered-ish dither: a wide dark gradient bands badly without it.
    col += (hash(uv * 1024.0 + uTime) - 0.5) * 0.007;

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Per-mode palettes for the backdrop. */
const THEMES = {
  blackSwan: { deep: '#04050a', mid: '#131a2e', glow: '#2b4a7d', trim: '#2b4a7d' },
  // Trading floor: near-black walnut with brass trim.
  stock: { deep: '#05060a', mid: '#141a1c', glow: '#6d5a22', trim: '#d2a53c' },
} as const

export type BackdropTheme = keyof typeof THEMES

export interface BackdropProps {
  /** Sized to cover the camera's view of the board. */
  width: number
  height: number
  z: number
  /** Where the glow sits, in 0…1 backdrop UV space. */
  focusY?: number
  theme?: BackdropTheme
}

export function Backdrop({ width, height, z, focusY = 0.6, theme = 'blackSwan' }: BackdropProps) {
  const material = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new Color(THEMES.blackSwan.deep) },
      uMid: { value: new Color(THEMES.blackSwan.mid) },
      uGlow: { value: new Color(THEMES.blackSwan.glow) },
      uTrim: { value: new Color(THEMES.blackSwan.trim) },
      uFocus: { value: [0.5, focusY] as [number, number] },
      uMarket: { value: 0 },
    }),
    [focusY],
  )

  // Recolor in place rather than rebuilding the material, which would drop the
  // shader program and recompile on every mode switch.
  useEffect(() => {
    const uniformSet = material.current?.uniforms
    if (!uniformSet) return
    const palette = THEMES[theme]
    uniformSet.uDeep.value.set(palette.deep)
    uniformSet.uMid.value.set(palette.mid)
    uniformSet.uGlow.value.set(palette.glow)
    uniformSet.uTrim.value.set(palette.trim)
    uniformSet.uMarket.value = theme === 'stock' ? 1 : 0
  }, [theme])

  useFrame((_, dt) => {
    if (material.current) material.current.uniforms.uTime.value += dt
  })

  return (
    <mesh position={[0, 0, z]} renderOrder={-1}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
      />
    </mesh>
  )
}
