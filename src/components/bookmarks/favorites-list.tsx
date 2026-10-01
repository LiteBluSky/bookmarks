import { GlobeIcon, StarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { Link } from '@/db/schema'
import { hostname } from '@/lib/tree'

// Up to 9 favourite links above the tree; key 1-9 opens the matching one.
// The star removes it from the favourites.
export function FavoritesList({
  favorites,
  onRemove,
}: {
  favorites: Array<Link>
  onRemove: (linkId: number) => void
}) {
  if (!favorites.length) return null
  return (
    <section aria-labelledby="favorites-heading" className="flex flex-col">
      <h2
        id="favorites-heading"
        className="px-2.5 pb-1 text-sm font-medium text-muted-foreground"
      >
        Favourites
      </h2>
      <ul className="flex flex-col">
        {favorites.map((link, i) => (
          <li key={link.id} className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="min-w-0 flex-1 justify-start"
              nativeButton={false}
              render={
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.description ?? link.url}
                />
              }
            >
              <Kbd>{i + 1}</Kbd>
              <GlobeIcon />
              <span className="truncate">{link.title}</span>
              <span className="truncate text-muted-foreground">
                {hostname(link.url)}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${link.title} from favourites`}
              title="Remove from favourites"
              onClick={() => onRemove(link.id)}
            >
              <StarIcon className="fill-current" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
