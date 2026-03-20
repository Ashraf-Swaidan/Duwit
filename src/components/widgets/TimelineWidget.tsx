interface TimelineItem {
  date: string
  title: string
  description?: string
}

interface TimelineData {
  items?: TimelineItem[]
  orientation?: "vertical" | "horizontal"
}

export function TimelineWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const timelineData = data as TimelineData
  const items = timelineData.items || []

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No timeline data</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      <div className="relative">
        <div
          className="absolute left-[0.65rem] top-2 bottom-2 w-0.5 bg-linear-to-b from-brand/50 to-brand/10 rounded-full"
          aria-hidden
        />

        <ul className="relative z-0 m-0 list-none space-y-5 pl-0">
          {items.map((item, idx) => (
            <li key={idx} className="relative flex gap-3 pl-1">
              <div className="relative z-10 mt-0.5 flex w-6 shrink-0 justify-center">
                <span className="inline-flex max-w-22 items-center justify-center rounded-full bg-brand px-2 py-1 text-center text-[10px] font-bold leading-tight text-background">
                  {item.date}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1 rounded-lg border border-border/40 bg-background/80 p-3">
                <p className="font-semibold text-sm leading-snug">{item.title}</p>
                {item.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
