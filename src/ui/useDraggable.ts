import { useEffect, useRef } from 'react'

/** How much of the panel's centre must stay on screen. */
const EDGE_MARGIN = 48

/**
 * Lets a panel be dragged by a handle.
 *
 * The offset is written straight to the element's transform rather than held in
 * state: a drag fires pointer events at screen refresh rate, and re-rendering a
 * panel containing a chart and a table that often would make it lag the cursor.
 *
 * Wherever CSS puts the panel is where it opens, and the drag is a delta from
 * there — bounded so the gaps it opens with are the closest it can ever get to
 * the top and right edges. See `measure`.
 */
export function useDraggable<TPanel extends HTMLElement, THandle extends HTMLElement>() {
  const panel = useRef<TPanel>(null)
  const handle = useRef<THandle>(null)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const grip = handle.current
    const card = panel.current
    if (!grip || !card) return

    let dragging = false
    let originX = 0
    let originY = 0
    let fromX = 0
    let fromY = 0

    // How far the offset may run, worked out when a drag starts.
    let limits = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

    const draw = () => {
      const { x, y } = offset.current
      card.style.transform = `translate(${x}px, ${y}px)`
    }

    /**
     * The range of offsets the panel may be dragged through.
     *
     * Sideways and downward it runs until a margin is left between it and the
     * window, which is what makes room to see the board behind it — the point of
     * being draggable at all.
     *
     * Upward it stops where it opened. Above that is the nav, which draws over
     * the panel: a card tucked under it loses the grip along its top edge, and
     * with the grip goes any way of dragging it back out.
     */
    const measure = () => {
      const box = card.getBoundingClientRect()
      // Where CSS alone would put it: the current position less the drag so far.
      const left = box.left - offset.current.x
      const top = box.top - offset.current.y

      return {
        minX: Math.min(0, EDGE_MARGIN - left),
        maxX: Math.max(0, window.innerWidth - EDGE_MARGIN - (left + box.width)),
        minY: 0,
        maxY: Math.max(0, window.innerHeight - EDGE_MARGIN - (top + box.height)),
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      // Left button or touch only, and never from a control inside the handle.
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest('button, input, a')) return

      dragging = true
      originX = event.clientX
      originY = event.clientY
      fromX = offset.current.x
      fromY = offset.current.y
      limits = measure()
      grip.setPointerCapture(event.pointerId)
      card.dataset.dragging = 'true'
      event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      offset.current = {
        x: clamp(fromX + event.clientX - originX, limits.minX, limits.maxX),
        y: clamp(fromY + event.clientY - originY, limits.minY, limits.maxY),
      }
      draw()
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return
      dragging = false
      if (grip.hasPointerCapture(event.pointerId)) {
        grip.releasePointerCapture(event.pointerId)
      }
      delete card.dataset.dragging
    }

    grip.addEventListener('pointerdown', onPointerDown)
    grip.addEventListener('pointermove', onPointerMove)
    grip.addEventListener('pointerup', onPointerUp)
    grip.addEventListener('pointercancel', onPointerUp)

    return () => {
      grip.removeEventListener('pointerdown', onPointerDown)
      grip.removeEventListener('pointermove', onPointerMove)
      grip.removeEventListener('pointerup', onPointerUp)
      grip.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  return { panel, handle }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
