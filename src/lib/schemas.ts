import { z } from 'zod'

// Shared between TanStack Form validators and server-function validators.

const id = z.number().int().positive()

export const folderInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Keep it under 255 characters'),
  parentId: id.nullable(),
})
export type FolderInput = z.infer<typeof folderInput>

export const linkInput = z.object({
  // Optional — falls back to the URL's hostname on save.
  title: z.string().trim().max(255, 'Keep it under 255 characters'),
  url: z
    .url({
      protocol: /^https?$/,
      error: 'Enter a full URL, e.g. https://example.com',
    })
    .max(2048, 'URL is too long'),
  description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
  folderId: id.nullable(),
})
export type LinkInput = z.infer<typeof linkInput>

export const byId = z.object({ id })

export const updateFolderInput = folderInput.extend({ id })
export const updateLinkInput = linkInput.extend({ id })

// Place a folder/link under `parentId` (null = top level) at `index` among
// its new siblings (counted without the moved item itself).
export const moveInput = z.object({
  kind: z.enum(['folder', 'link']),
  id,
  parentId: id.nullable(),
  index: z.number().int().min(0),
})
export type MoveInput = z.infer<typeof moveInput>
