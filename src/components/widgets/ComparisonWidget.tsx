import { resolveKeyedCell } from "@/lib/widgetCells"

interface ComparisonRow {
  label: string
  [key: string]: unknown
}

interface ComparisonData {
  columns?: string[]
  rows?: ComparisonRow[]
  recommendedColumn?: string
}

export function ComparisonWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const comparisonData = data as ComparisonData
  const columns = comparisonData.columns || []
  const rows = comparisonData.rows || []

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No comparison data</p>
      </div>
    )
  }

  const isRecommendedColumn = (col: string) => col === comparisonData.recommendedColumn

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      {/* Desktop view - full table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border/60 bg-muted/40 px-3 py-2 text-left font-semibold">
                Attribute
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`border border-border/60 px-3 py-2 text-center font-semibold transition-colors ${
                    isRecommendedColumn(col)
                      ? "bg-brand/20 text-brand dark:bg-brand/10"
                      : "bg-muted/40"
                  }`}
                >
                  {col}
                  {isRecommendedColumn(col) && (
                    <div className="mt-1 text-xs font-normal text-brand">Recommended</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                <td className="border border-border/40 bg-muted/20 px-3 py-2 font-medium">
                  {row.label}
                </td>
                {columns.map((col, cidx) => (
                  <td
                    key={`${idx}-${col}`}
                    className={`border border-border/40 px-3 py-2 text-center ${
                      isRecommendedColumn(col) ? "bg-brand/5" : ""
                    }`}
                  >
                    {resolveKeyedCell(row as Record<string, unknown>, col, cidx, columns)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view - cards per subject */}
      <div className="space-y-3 md:hidden">
        {columns.map((col, cidx) => (
          <div
            key={`${col}-${cidx}`}
            className={`rounded-lg border p-4 ${
              isRecommendedColumn(col)
                ? "border-brand/60 bg-brand/5"
                : "border-border/40 bg-background"
            }`}
          >
            <div className="mb-3">
              <p className="font-semibold">{col}</p>
              {isRecommendedColumn(col) && (
                <p className="text-xs font-medium text-brand">Recommended</p>
              )}
            </div>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex justify-between border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                  <p className="text-sm">
                    {resolveKeyedCell(row as Record<string, unknown>, col, cidx, columns)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
