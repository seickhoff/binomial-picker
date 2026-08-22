import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Object3D } from 'three'
import type { BoardGeometry } from '../game/geometry'
import { Backdrop, type BackdropTheme } from './Backdrop'
import { fitDistance, viewSizeAt } from './fit'

/** Sizes the shader backdrop to cover the widest shot the rig can take. */
export function SceneBackdrop({ geo, theme }: { geo: BoardGeometry; theme: BackdropTheme }) {
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height

  const { width, height, z } = useMemo(() => {
    const backZ = -geo.width * 1.6
    // Size for the whole-board framing, which is wider than any shot the rig
    // actually takes, then over-cover on top of that.
    const view = viewSizeAt(fitDistance(geo, aspect) - backZ, aspect)
    return { width: view.width * 1.6, height: view.height * 1.6, z: backZ }
  }, [geo, aspect])

  return (
    <group position={[0, geo.centerY, 0]}>
      <Backdrop width={width} height={height} z={z} focusY={0.55} theme={theme} />
    </group>
  )
}

export function Lights({ geo, fancy }: { geo: BoardGeometry; fancy: boolean }) {
  // A directional light aims at its target object, so give it one at the board's
  // centre — otherwise the shadow frustum is centred on the world origin, which
  // is up at the funnel.
  const target = useMemo(() => new Object3D(), [])
  const span = Math.max(geo.width, geo.height) * 0.62
  const keyPosition: [number, number, number] = [
    geo.width * 0.55,
    geo.centerY + geo.height * 0.7,
    geo.width,
  ]
  const keyDistance = Math.hypot(keyPosition[0], geo.height * 0.7, keyPosition[2])

  return (
    <>
      <primitive object={target} position={[0, geo.centerY, 0]} />

      <ambientLight intensity={0.4} />

      <directionalLight
        position={keyPosition}
        target={target}
        intensity={2.6}
        color="#eaf1ff"
        castShadow={fancy}
        // 1024 is plenty at this scale and a quarter the fill of 2048.
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-near={0.5}
        shadow-camera-far={keyDistance + span * 3}
      />

      {/* Cool rim from behind-left to separate the frame from the backdrop. */}
      <directionalLight
        position={[-geo.width * 0.9, geo.centerY + geo.height * 0.2, -geo.width * 0.6]}
        target={target}
        intensity={0.8}
        color="#6f8dff"
      />

      {/* Warm spill at the funnel, where the action starts. */}
      <pointLight
        position={[0, geo.funnelTopY, geo.width * 0.35]}
        intensity={geo.width * 1.2}
        distance={geo.width * 1.4}
        decay={1.8}
        color="#ffcf9b"
      />
    </>
  )
}

/**
 * Reflections from light shapes rather than a fetched HDRI, so the scene needs
 * no network and renders its environment map once.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={192} frames={1}>
      <color attach="background" args={['#080a12']} />
      <Lightformer
        form="rect"
        intensity={3}
        color="#a9c8ff"
        position={[-5, 3, -4]}
        scale={[9, 9, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#ffb98a"
        position={[6, -3, 3]}
        scale={[7, 7, 1]}
      />
      <Lightformer form="ring" intensity={2.2} color="#ffffff" position={[0, 7, 3]} scale={5} />
    </Environment>
  )
}
