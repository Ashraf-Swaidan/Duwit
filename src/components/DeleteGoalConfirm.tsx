import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/useMediaQuery"

interface DeleteGoalConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalTitle: string
  onConfirm: () => void | Promise<void>
  isDeleting?: boolean
}

export function DeleteGoalConfirm({
  open,
  onOpenChange,
  goalTitle,
  onConfirm,
  isDeleting = false,
}: DeleteGoalConfirmProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const title = "Delete this goal?"
  const description = (
    <>
      <span className="font-medium text-foreground">“{goalTitle}”</span> and all task chats for it will be
      permanently removed. This cannot be undone.
    </>
  )

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={isDeleting}
        onClick={() => onOpenChange(false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="rounded-xl"
        disabled={isDeleting}
        onClick={() => void onConfirm()}
      >
        {isDeleting ? "Deleting…" : "Delete goal"}
      </Button>
    </>
  )

  function handleOpenChange(next: boolean) {
    if (!next && isDeleting) return
    onOpenChange(next)
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={!isDeleting} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" showCloseButton={!isDeleting} className="rounded-t-2xl">
        <SheetHeader className="text-start">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="text-start">{description}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="flex-col gap-2 sm:flex-col">{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
