import { BOARD_DEPTH, type BoardGeometry } from '../game/geometry'

export const CAMERA_FOV = 40
/** Breathing room around the device, as a multiplier on its size. */
const MARGIN = 1.16

/**
 * Camera distance that fits the whole device on screen at a given aspect ratio.
 * Shared by the camera rig and the backdrop so the two can never disagree about
 * how much of the world is visible.
 */
export function fitDistance(geo: BoardGeometry, aspect: number, fovDeg = CAMERA_FOV): number {
  const fov = (fovDeg * Math.PI) / 180
  const halfFovTan = Math.tan(fov / 2)
  const forHeight = (geo.height * MARGIN) / 2 / halfFovTan
  const forWidth = (geo.width * MARGIN) / 2 / (halfFovTan * Math.max(aspect, 0.01))
  return Math.max(forHeight, forWidth) + BOARD_DEPTH
}

/** Visible world size at a given distance from the camera. */
export function viewSizeAt(distance: number, aspect: number, fovDeg = CAMERA_FOV) {
  const fov = (fovDeg * Math.PI) / 180
  const height = 2 * Math.tan(fov / 2) * distance
  return { width: height * aspect, height }
}
