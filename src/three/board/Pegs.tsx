import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  Euler,
  InstancedBufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three'
import { BOARD_DEPTH, PEG_RADIUS, type BoardGeometry } from '../../game/geometry'
import { resizeFlashBank } from '../../live/pegFlashes'
import { PEG_COLOR, PEG_EMISSIVE_COLOR } from './materials'

const REST_INTENSITY = 0.12
const FLASH_INTENSITY = 2.6
/*
 * three folds `emissiveIntensity` into the `emissive` uniform before the shader
 * sees it, so adding `emissive * flash` would add only the *resting* brightness
 * again — a flash six times too dim. Dividing it back out makes a full flash
 * reach FLASH_INTENSITY in absolute terms, as the per-material version did.
 */
const FLASH_GAIN = FLASH_INTENSITY / REST_INTENSITY
/** Flash decay, in units per second. */
const FLASH_DECAY = 3.4

/** Pegs all face the same way; the instance matrix carries it. */
const PEG_ORIENTATION = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))
const UNIT_SCALE = new Vector3(1, 1, 1)

/**
 * The pegs, as one instanced draw.
 *
 * A board of 24 rows has 300 pegs, and one mesh each would be 300 draw calls
 * doubled by the shadow pass — the thing that put a ceiling on the row count.
 * Instanced, the whole lattice costs one.
 *
 * The catch is the impact flash, which is per-peg and so can't come from the
 * shared material's uniforms. A small addition to the standard shader adds a
 * per-instance `aFlash` attribute straight into the emissive term, which keeps
 * the material otherwise stock — it still takes the scene's lights and shadows.
 */
export function Pegs({ geo }: { geo: BoardGeometry }) {
  const mesh = useRef<InstancedMesh>(null)
  const count = geo.pegs.length

  const flashAttribute = useMemo(
    () => new InstancedBufferAttribute(new Float32Array(count), 1),
    [count],
  )

  // Lay the lattice out once per board, not per frame.
  useEffect(() => {
    const instances = mesh.current
    if (!instances) return

    const matrix = new Matrix4()
    const position = new Vector3()
    geo.pegs.forEach((peg, i) => {
      matrix.compose(position.set(peg.x, peg.y, 0), PEG_ORIENTATION, UNIT_SCALE)
      instances.setMatrixAt(i, matrix)
    })
    instances.instanceMatrix.needsUpdate = true
    instances.geometry.setAttribute('aFlash', flashAttribute)
  }, [geo, flashAttribute])

  const lit = useRef(false)

  useFrame((_, dt) => {
    const flashes = resizeFlashBank(count)
    let anyLit = false

    for (let i = 0; i < flashes.length; i++) {
      if (flashes[i] <= 0) continue
      flashes[i] = Math.max(0, flashes[i] - dt * FLASH_DECAY)
      anyLit = true
    }

    // One upload per frame, and only while something is actually glowing.
    if (anyLit || lit.current) {
      ;(flashAttribute.array as Float32Array).set(flashes)
      flashAttribute.needsUpdate = true
    }
    lit.current = anyLit
  })

  return (
    <instancedMesh
      ref={mesh}
      // The key remounts the mesh when the peg count changes; instance buffers
      // are fixed-size, so they can't be resized in place.
      key={count}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[PEG_RADIUS, PEG_RADIUS, BOARD_DEPTH, 16]} />
      <meshStandardMaterial
        color={PEG_COLOR}
        metalness={0.85}
        roughness={0.22}
        emissive={new Color(PEG_EMISSIVE_COLOR)}
        emissiveIntensity={REST_INTENSITY}
        onBeforeCompile={addPerInstanceFlash}
        // Stops three reusing a cached program compiled without the addition.
        customProgramCacheKey={() => 'peg-flash'}
      />
    </instancedMesh>
  )
}

/**
 * Adds `aFlash` to the standard material's emissive output. Typed structurally:
 * three's parameter type for this hook is an internal name that has changed
 * between versions, and these two fields are all this needs.
 */
function addPerInstanceFlash(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nattribute float aFlash;\nvarying float vFlash;',
    )
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFlash = aFlash;')

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFlash;')
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += emissive * vFlash * ${FLASH_GAIN.toFixed(3)};`,
    )
}
