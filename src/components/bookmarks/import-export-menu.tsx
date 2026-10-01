import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { APP_NAME } from '@/lib/config'
import { MAX_FAVORITES, bookmarksFile } from '@/lib/schemas'
import type { BookmarksFile } from '@/lib/schemas'
import { toBookmarksFile } from '@/lib/tree'
import type { Tree } from '@/lib/tree'
import { importBookmarks, treeQueryOptions } from '@/server/bookmarks.functions'

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function download(tree: Tree) {
  const json = JSON.stringify(toBookmarksFile(tree), null, 2)
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  )
  const slug = APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'bookmarks'
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function readFile(file: File): Promise<BookmarksFile> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  const parsed = bookmarksFile.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue.path.length ? ` (at ${issue.path.join('.')})` : ''
    throw new Error(`${issue.message}${where}`)
  }
  return parsed.data
}

// Header menu: export the whole tree as JSON, or import a file in the same
// format (added after what's already there, never replacing it).
export function ImportExportMenu({ tree }: { tree: Tree }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const importFile = useMutation({
    mutationFn: async (file: File) =>
      importBookmarks({ data: await readFile(file) }),
    onSuccess: async ({ folders, links, favorites, skippedFavorites }) => {
      await queryClient.invalidateQueries(treeQueryOptions)
      const notes = [
        favorites > 0 && `${plural(favorites, 'favourite')} added.`,
        skippedFavorites > 0 &&
          `${plural(skippedFavorites, 'favourite')} skipped (max ${MAX_FAVORITES}).`,
      ].filter(Boolean)
      toast.add({
        title: `Imported ${plural(folders, 'folder')} and ${plural(links, 'link')}`,
        description: notes.join(' ') || undefined,
        type: 'success',
      })
    },
    onError: (error) =>
      toast.add({
        title: "Couldn't import",
        description: error.message,
        type: 'error',
      }),
  })

  const isEmpty = !tree.folders.length && !tree.links.length

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Import / export"
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Bookmarks file</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={importFile.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon />
              Import JSON…
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isEmpty} onClick={() => download(tree)}>
              <DownloadIcon />
              Export JSON
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) importFile.mutate(file)
        }}
      />
    </>
  )
}
