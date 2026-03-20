interface YoutubeData {
  youtubeSearches?: string[]
  channels?: string[]
}

export function YoutubeWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const youtubeData = data as YoutubeData
  const searches = youtubeData.youtubeSearches || []
  const channels = youtubeData.channels || []

  if (searches.length === 0 && channels.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No YouTube resources</p>
      </div>
    )
  }

  function youtubeSearchUrl(q: string) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  }

  function youtubeChannelUrl(ch: string) {
    return `https://www.youtube.com/@${encodeURIComponent(ch)}`
  }

  return (
    <div className="space-y-3 rounded-lg border bg-red-500/5 p-4 dark:bg-red-950/20">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      {searches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Search topics:</p>
          <div className="flex flex-wrap gap-2">
            {searches.map((query, idx) => (
              <a
                key={idx}
                href={youtubeSearchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-400"
              >
                ▶ {query}
              </a>
            ))}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Recommended channels:</p>
          <div className="flex flex-wrap gap-2">
            {channels.map((channel, idx) => (
              <a
                key={idx}
                href={youtubeChannelUrl(channel)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/25 dark:text-red-300"
              >
                @{channel}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
