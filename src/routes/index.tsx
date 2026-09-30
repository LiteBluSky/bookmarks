import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  BookmarkIcon,
  FolderPlusIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { BookmarkTree } from '@/components/bookmarks/bookmark-tree'
import type { EditorState } from '@/components/bookmarks/editor'
import { EditorDialogs } from '@/components/bookmarks/editor-dialogs'
import { TreeDndProvider } from '@/components/bookmarks/tree-dnd'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { useCutLink } from '@/hooks/use-cut-link'
import { useExpandedFolders } from '@/hooks/use-expanded-folders'
import { useTreeKeyboard } from '@/hooks/use-tree-keyboard'
import { APP_NAME } from '@/lib/config'
import { MOD_LABEL, SHORTCUTS, useShortcuts } from '@/lib/shortcuts'
import type { ShortcutName } from '@/lib/shortcuts'
import { buildTree, filterTree } from '@/lib/tree'
import { treeQueryOptions } from '@/server/bookmarks.functions'

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(treeQueryOptions),
  component: Home,
})

function Home() {
  const { data } = useSuspenseQuery(treeQueryOptions)
  const tree = useMemo(() => buildTree(data.folders, data.links), [data])

  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterTree(tree, query), [tree, query])
  const searching = query.trim().length > 0

  const { expanded, setOpen } = useExpandedFolders()

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const openEditor = (state: EditorState) => {
    setEditor(state)
    setEditorOpen(true)
  }

  const searchRef = useRef<HTMLInputElement>(null)
  const focusSearch = () => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }
  const clipboard = useCutLink({
    tree,
    links: data.links,
    onExpand: (id) => setOpen(id, true),
  })

  const treeRef = useRef<HTMLDivElement>(null)
  useTreeKeyboard({
    containerRef: treeRef,
    expanded,
    setOpen,
    onSearch: focusSearch,
    onEdit: (kind, id) => {
      if (kind === 'folder') {
        const folder = data.folders.find((f) => f.id === id)
        if (folder) openEditor({ kind, folder, parentId: folder.parentId })
      } else {
        const link = data.links.find((l) => l.id === id)
        if (link) openEditor({ kind, link, folderId: link.folderId })
      }
    },
    onCut: clipboard.cut,
    onPaste: clipboard.paste,
    onCancelCut: clipboard.cancel,
    enabled: !editorOpen,
  })
  // Disabled while a dialog is open so shortcuts don't stack editors.
  useShortcuts(
    {
      search: focusSearch,
      newLink: () => openEditor({ kind: 'link', folderId: null }),
      newFolder: () => openEditor({ kind: 'folder', parentId: null }),
    },
    !editorOpen,
  )

  const isEmpty = !tree.folders.length && !tree.links.length
  const noMatches = !visible.folders.length && !visible.links.length

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <BookmarkIcon />
          {APP_NAME}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => openEditor({ kind: 'folder', parentId: null })}
          >
            <FolderPlusIcon data-icon="inline-start" />
            Folder
            <ShortcutHint name="newFolder" />
          </Button>
          <Button onClick={() => openEditor({ kind: 'link', folderId: null })}>
            <PlusIcon data-icon="inline-start" />
            Link
            <ShortcutHint name="newLink" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={searchRef}
          type="search"
          aria-label="Search links"
          placeholder="Search links…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              e.currentTarget.blur()
            }
            // Jump into the tree (first match while searching).
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              const first =
                treeRef.current?.querySelector<HTMLElement>('[data-tree-item]')
              if (first) {
                e.preventDefault()
                first.focus()
              }
            }
          }}
        />
        {!searching && (
          <InputGroupAddon align="inline-end">
            <ShortcutHint name="search" />
          </InputGroupAddon>
        )}
      </InputGroup>

      <Separator />

      {isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>No links yet</EmptyTitle>
            <EmptyDescription>
              Add your first link, or create a folder to organise them.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => openEditor({ kind: 'link', folderId: null })}
            >
              <PlusIcon data-icon="inline-start" />
              Add link
            </Button>
          </EmptyContent>
        </Empty>
      ) : noMatches ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>No matches</EmptyTitle>
            <EmptyDescription>
              Nothing matches “{query.trim()}”.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div ref={treeRef}>
          <TreeDndProvider
            tree={tree}
            enabled={!searching}
            onExpand={(id) => setOpen(id, true)}
          >
            <BookmarkTree
              tree={visible}
              expanded={expanded}
              forceOpen={searching}
              onToggle={setOpen}
              onEdit={openEditor}
              cutId={clipboard.cutId}
            />
          </TreeDndProvider>
        </div>
      )}

      <EditorDialogs
        tree={tree}
        state={editor}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </main>
  )
}

function ShortcutHint({ name }: { name: ShortcutName }) {
  return (
    <KbdGroup className="max-sm:hidden">
      <Kbd>{MOD_LABEL}</Kbd>
      <Kbd>{SHORTCUTS[name].label}</Kbd>
    </KbdGroup>
  )
}
