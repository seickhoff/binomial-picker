import { useEffect, useRef } from 'react'

/** How much of the panel's centre must stay on screen. */
const EDGE_MARGIN = 48

/**
 * Lets a centred panel be dragged by a handle.
 *
 * The offset is written straight to the element's transform rather than held in
 * state: a drag fires pointer events at screen refresh rate, and re-rendering a
 * panel containing a chart and a table that often would make it lag the cursor.
 *
 * The element is expected to be centred by CSS (`translate(-50%, -50%)`), which
 * this preserves — so it opens centred and the drag is a delta from there.
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

    const draw = () => {
      const { x, y } = offset.current
      card.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
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
      grip.setPointerCapture(event.pointerId)
      card.dataset.dragging = 'true'
      event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const limitX = window.innerWidth / 2 - EDGE_MARGIN
      const limitY = window.innerHeight / 2 - EDGE_MARGIN
      offset.current = {
        x: clamp(fromX + event.clientX - originX, -limitX, limitX),
        y: clamp(fromY + event.clientY - originY, -limitY, limitY),
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
