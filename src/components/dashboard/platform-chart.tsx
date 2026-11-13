"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PlatformStatDatum {
  name: string;
  generated: number;
  published: number;
}

export function PlatformChart({ data }: { data: PlatformStatDatum[] }) {
  const maxGenerated = Math.max(...data.map((d) => d.generated), 0);

  return (
    <div className="h-52 w-full" aria-label="Posts per platform chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text)", fontSize: 12 }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.7 }}
            contentStyle={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--line-strong)",
              borderRadius: "10px",
              color: "var(--text)",
              fontSize: "12px",
            }}
            itemStyle={{ color: "var(--text)" }}
            labelStyle={{ color: "var(--yellow)", fontWeight: 600 }}
          />
          <Bar dataKey="generated" name="Generated" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={
                  entry.generated === maxGenerated && maxGenerated > 0
                    ? "var(--yellow)"
                    : "var(--blue)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
