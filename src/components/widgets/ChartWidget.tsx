import { useMemo } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  Tooltip,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"

interface Dataset {
  label: string
  data: number[]
}

interface ChartData {
  chartType?: "bar" | "line" | "pie" | "area" | "radar"
  labels?: string[]
  datasets?: Dataset[]
  xAxisLabel?: string
  yAxisLabel?: string
}

const COLORS = [
  "hsl(var(--brand))",
  "hsl(var(--brand) / 0.7)",
  "hsl(var(--brand) / 0.5)",
  "hsl(var(--brand) / 0.3)",
  "hsl(var(--destructive))",
  "hsl(var(--secondary))",
]

export function ChartWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const chartData = data as ChartData
  const chartType = chartData.chartType || "bar"
  const labels = chartData.labels || []
  const datasets = chartData.datasets || []

  // Transform data based on chart type
  const chartableData = useMemo(() => {
    if (chartType === "pie") {
      // Pie chart expects array of { name, value }
      if (datasets.length === 0 || datasets[0].data.length === 0) {
        return []
      }
      return labels.map((label, idx) => ({
        name: label,
        value: datasets[0].data[idx] || 0,
      }))
    }

    // Bar, line, area, radar charts expect array of objects
    return labels.map((label, idx) => {
      const entry: Record<string, unknown> = { name: label }
      datasets.forEach((ds) => {
        entry[ds.label] = ds.data[idx] || 0
      })
      return entry
    })
  }, [labels, datasets, chartType])

  if (chartableData.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No chart data</p>
      </div>
    )
  }

  const commonProps = {
    data: chartableData,
    margin: { top: 5, right: 30, left: 0, bottom: 5 },
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <div className="w-full overflow-x-auto">
        {chartType === "pie" && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartableData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="hsl(var(--brand))"
                dataKey="value"
              >
                {chartableData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === "bar" && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              {chartData.xAxisLabel && (
                <XAxis
                  label={{ value: chartData.xAxisLabel, position: "insideBottom", offset: -5 }}
                />
              )}
              {chartData.yAxisLabel && (
                <YAxis
                  label={{ value: chartData.yAxisLabel, angle: -90, position: "insideLeft" }}
                />
              )}
              <Tooltip />
              <Legend />
              {datasets.map((ds, idx) => (
                <Bar key={ds.label} dataKey={ds.label} fill={COLORS[idx % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === "line" && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Legend />
              {datasets.map((ds, idx) => (
                <Line
                  key={ds.label}
                  type="monotone"
                  dataKey={ds.label}
                  stroke={COLORS[idx % COLORS.length]}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {chartType === "area" && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Legend />
              {datasets.map((ds, idx) => (
                <Area
                  key={ds.label}
                  type="monotone"
                  dataKey={ds.label}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {chartType === "radar" && (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart {...commonProps}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <PolarRadiusAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip />
              <Legend />
              {datasets.map((ds, idx) => (
                <Radar
                  key={ds.label}
                  name={ds.label}
                  dataKey={ds.label}
                  stroke={COLORS[idx % COLORS.length]}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.5}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
