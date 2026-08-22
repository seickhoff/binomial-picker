import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import type { BoardGeometry } from '../game/geometry'
import { marbleFocus } from '../live/cameraFocus'
import { useGame } from '../game/store'
import { PITCH_DEG, shotFor, type Shot } from './framing'
import { clamp, lerp } from './mathx'

/** Camera easing, in e-foldings per second. */
const FOLLOW_RATE = 3.6
/** Never frame less than this much of the world, whatever the maths says. */
const MIN_VIEW_HEIGHT = 2.2

/**
 * Follows the marbles down.
 *
 * Sits close to the board at the funnel, tracks the leading marble as it falls,
 * and widens out to take in every bin as the drop finishes — so the action is
 * always framed rather than lost in a wide shot of the whole device.
 */
export function CameraRig({ geo }: { geo: BoardGeometry }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height

  const shot = useMemo(() => shotFor(geo, aspect, size.height), [geo, aspect, size.height])
  const framing = useRef({ y: shot.entryY, height: shot.closeHeight, settled: false })

  // A new board or viewport re-frames immediately instead of gliding.
  useEffect(() => {
    framing.current.settled = false
  }, [geo, aspect, size.height])

  useFrame((_, dt) => {
    const { phase, overview } = useGame.getState()
    const target = targetFraming(shot, phase, overview)

    if (framing.current.settled) {
      const easing = 1 - Math.exp(-FOLLOW_RATE * dt)
      framing.current.y += (target.y - framing.current.y) * easing
      framing.current.height += (target.height - framing.current.height) * easing
    } else {
      framing.current = { ...target, settled: true }
    }

    aimCamera(camera, framing.current.y, framing.current.height, shot.halfFovTan)
  })

  return null
}

/** Where the camera wants to be right now, before easing. */
function targetFraming(
  shot: Shot,
  phase: string,
  overview: boolean,
): { y: number; height: number } {
  // Held space wins over everything, marbles included: it is a request to stop
  // following the action and look at the device.
  if (overview) return { y: shot.overviewY, height: shot.overviewHeight }

  const focus = marbleFocus()

  if (!focus) {
    const atBins = phase === 'results'
    return {
      y: atBins ? shot.endY : shot.entryY,
      height: atBins ? shot.wideHeight : shot.closeHeight,
    }
  }

  // Bias toward the leading marble, but not so hard that the stragglers fall
  // out of frame.
  // Never drop below the finished framing, so the last of the descent glides
  // straight into it.
  const y = Math.max(focus.leadY * 0.62 + focus.meanY * 0.38, shot.endY)
  // Widen as the marbles approach the bins.
  const span = shot.entryY - shot.endY
  const travelled = clamp((shot.entryY - y) / (span || 1), 0, 1)
  return { y, height: lerp(shot.closeHeight, shot.wideHeight, travelled * travelled) }
}

/** Places the camera so `height` world units span the viewport, looking down. */
function aimCamera(camera: PerspectiveCamera, y: number, height: number, halfFovTan: number): void {
  const distance = Math.max(height, MIN_VIEW_HEIGHT) / 2 / halfFovTan
  const pitch = (PITCH_DEG * Math.PI) / 180

  camera.position.set(0, y + Math.sin(pitch) * distance, Math.cos(pitch) * distance)
  camera.lookAt(0, y, 0)
}
