import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

export type SheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  /** Small line under the title, for context that is not the title itself. */
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet, never a centre modal.
 *
 * A sheet's controls land in the thumb zone; a centred dialog's do not, and
 * this app is used one-handed while standing.
 */
export function Sheet({ open, onOpenChange, title, subtitle, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-(--radius-surface) border-t border-(--hairline) bg-(--surface) outline-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-(--hairline)" />
          {title && (
            <div className="px-5 pt-4 pb-2">
              <Drawer.Title className="display text-[15px] text-(--text)">
                {title}
              </Drawer.Title>
              {subtitle && (
                <Drawer.Description className="mt-1 text-[13px] text-(--text-faint)">
                  {subtitle}
                </Drawer.Description>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
