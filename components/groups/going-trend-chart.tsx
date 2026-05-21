"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { weekStart: string; going: number }

export function GoingTrendChart({ data }: { data: Point[] }) {
  const formatted = data.map((p) => ({
    label: new Date(p.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    going: p.going,
  }));

  return (
    <div className="h-44 w-full text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="goingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" stopOpacity={0.4} />
              <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-popover)",
              color: "var(--color-popover-foreground)",
            }}
            labelStyle={{ color: "var(--color-popover-foreground)" }}
            cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="going"
            stroke="currentColor"
            strokeWidth={1.75}
            fill="url(#goingGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
