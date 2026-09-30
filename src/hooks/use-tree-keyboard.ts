import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Vim-style motions over the visible tree rows (anywhere on the page, except
// while typing or with a dialog/menu open):
//   j / ↓  next row          k / ↑  previous row
//   h / ←  collapse folder, or jump to parent folder
//   l / →  expand folder, or step into its first child
//   gg     first row         G      last row
//   o      open link / toggle folder (Enter works natively too)
//   r      edit (rename / move) the focused folder or link
//   d      delete the hovered row (or the focused one), after confirming
//   x      cut the focused link   p  paste it here   Esc  cancel the cut
//   /      focus search
//
// Rows opt in by putting these on their focusable element:
//   data-tree-item, data-kind="folder|link", data-id, data-parent-id
// (data-parent-id is "" at the top level). The row's hover area (the element
// that also holds its menu) is marked with data-tree-row.

const ITEM = '[data-tree-item]'
const HOVERED_ROW = '[data-tree-row]:hover'
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
  onEdit,
  onDelete,
  onCut,
  onPaste,
  onCancelCut,
  enabled,
}: {
  containerRef: RefObject<HTMLElement | null>
  expanded: ReadonlySet<number>
  setOpen: (id: number, open: boolean) => void
  onSearch: () => void
  onEdit: (kind: 'folder' | 'link', id: number) => void
  onDelete: (kind: 'folder' | 'link', id: number) => void
  onCut: (linkId: number) => void
  /** Paste onto the focused row, or at the top level when none is focused. */
  onPaste: (target: { kind: 'folder' | 'link'; id: number } | null) => void
  /** Returns whether there was a cut to cancel. */
  onCancelCut: () => boolean
  enabled: boolean
}) {
  const callbacks = {
    expanded,
    setOpen,
    onSearch,
    onEdit,
    onDelete,
    onCut,
    onPaste,
    onCancelCut,
  }
  const latest = useRef(callbacks)
  useEffect(() => {
    latest.current = callbacks
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
        case 'r':
          if (!current) return
          handled()
          cb.onEdit(isFolder ? 'folder' : 'link', id)
          return
        case 'd': {
          const target =
            containerRef.current
              ?.querySelector(HOVERED_ROW)
              ?.querySelector<HTMLElement>(ITEM) ?? current
          if (!target) return
          handled()
          cb.onDelete(
            target.dataset.kind === 'folder' ? 'folder' : 'link',
            Number(target.dataset.id),
          )
          return
        }
        case 'x':
          if (!current || isFolder) return
          handled()
          cb.onCut(id)
          return
        case 'p':
          handled()
          cb.onPaste(
            current ? { kind: isFolder ? 'folder' : 'link', id } : null,
          )
          return
        case 'Escape':
          if (cb.onCancelCut()) handled()
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
