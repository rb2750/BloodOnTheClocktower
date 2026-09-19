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
 * this app is used one-handed while standing. It carries the one shadow in
 * the app, because a sheet is physically above the page.
 */
export function Sheet({ open, onOpenChange, title, subtitle, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[14px] border-t border-(--hairline-strong) bg-(--surface) shadow-[0_-12px_40px_rgb(0_0_0/0.6)] outline-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto mt-3 h-[3px] w-9 shrink-0 rounded-full bg-(--hairline-strong)" />
          {title && (
            <div className="px-5 pt-4 pb-3">
              <Drawer.Title className="display text-[24px] leading-none text-(--text)">
                {title}
              </Drawer.Title>
              {subtitle && (
                <Drawer.Description className="mt-2 text-[13px] leading-snug text-(--text-faint)">
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
