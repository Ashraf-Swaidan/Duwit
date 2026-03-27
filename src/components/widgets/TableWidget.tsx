import { resolveKeyedCell } from "@/lib/widgetCells"

interface TableColumn {
  key: string
  label: string
  type?: "text" | "number"
}

interface TableRow {
  [key: string]: unknown
}

interface TableData {
  columns?: TableColumn[]
  rows?: TableRow[]
}

export function TableWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const tableData = data as TableData
  const columns = tableData.columns || []
  const rows = tableData.rows || []
  const columnKeys = columns.map((c) => c.key)

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No table data</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border border-border/60 bg-muted/40 px-3 py-2 text-left font-semibold"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                {columns.map((col, cidx) => (
                  <td
                    key={`${idx}-${col.key}`}
                    className={`border border-border/40 px-3 py-2 ${
                      col.type === "number" ? "text-right font-mono" : ""
                    }`}
                  >
                    {resolveKeyedCell(row as Record<string, unknown>, col.key, cidx, columnKeys)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
