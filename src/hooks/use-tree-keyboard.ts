import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Vim-style motions over the visible tree rows (anywhere on the page, except
// while typing or with a dialog/menu open):
//   j / ↓  next row          k / ↑  previous row
//   h / ←  collapse folder, or jump to parent folder
//   l / →  expand folder, or step into its first child
//   gg     first row         G      last row
//   o      open link / toggle folder (Enter works natively too)
//   /      focus search
//
// Rows opt in by putting these on their focusable element:
//   data-tree-item, data-kind="folder|link", data-id, data-parent-id
// (data-parent-id is "" at the top level).

const ITEM = '[data-tree-item]'
const GG_TIMEOUT_MS = 500

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

export function useTreeKeyboard({
  containerRef,
  expanded,
  setOpen,
  onSearch,
  enabled,
}: {
  containerRef: RefObject<HTMLElement | null>
  expanded: ReadonlySet<number>
  setOpen: (id: number, open: boolean) => void
  onSearch: () => void
  enabled: boolean
}) {
  const latest = useRef({ expanded, setOpen, onSearch })
  useEffect(() => {
    latest.current = { expanded, setOpen, onSearch }
  })

  useEffect(() => {
    if (!enabled) return
    let lastG = 0

    const items = () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? [],
      ).filter((el) => el.offsetParent !== null)

    const focus = (el: HTMLElement | undefined) => {
      if (!el) return
      el.focus()
      el.scrollIntoView({ block: 'nearest' })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target)) return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('[role="menu"]')) {
        return
      }

      const list = items()
      const current =
        active instanceof HTMLElement && active.matches(ITEM)
          ? active
          : undefined
      const index = current ? list.indexOf(current) : -1
      const id = Number(current?.dataset.id)
      const isFolder = current?.dataset.kind === 'folder'
      const cb = latest.current

      const handled = () => e.preventDefault()

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          handled()
          focus(list[Math.min(index + 1, list.length - 1)])
          return
        case 'k':
        case 'ArrowUp':
          handled()
          focus(index === -1 ? list[0] : list[Math.max(index - 1, 0)])
          return
        case 'G':
          handled()
          focus(list.at(-1))
          return
        case 'g': {
          handled()
          const now = Date.now()
          if (now - lastG < GG_TIMEOUT_MS) {
            focus(list[0])
            lastG = 0
          } else {
            lastG = now
          }
          return
        }
        case 'h':
        case 'ArrowLeft': {
          if (!current) return
          handled()
          if (isFolder && cb.expanded.has(id)) {
            cb.setOpen(id, false)
            return
          }
          const parentId = current.dataset.parentId
          if (parentId) {
            focus(
              list.find(
                (el) =>
                  el.dataset.kind === 'folder' && el.dataset.id === parentId,
              ),
            )
          }
          return
        }
        case 'l':
        case 'ArrowRight': {
          if (!current || !isFolder) return
          handled()
          if (!cb.expanded.has(id)) {
            cb.setOpen(id, true)
            return
          }
          const next = list.at(index + 1)
          if (next?.dataset.parentId === String(id)) focus(next)
          return
        }
        case 'o':
          if (!current) return
          handled()
          current.click()
          return
        case '/':
          handled()
          cb.onSearch()
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, containerRef])
}
