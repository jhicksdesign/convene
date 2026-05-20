"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { weekStart: string; going: number }

export function GoingTrendChart({ data }: { data: Point[] }) {
  const formatted = data.map((p) => ({
    label: new Date(p.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    going: p.going,
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="goingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(240 5.9% 10%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(240 5.9% 10%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="hsl(240 5.9% 90%)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(240 3.8% 46.1%)" }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(240 3.8% 46.1%)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(240 5.9% 90%)" }}
            labelStyle={{ color: "hsl(240 5.9% 10%)" }}
          />
          <Area
            type="monotone"
            dataKey="going"
            stroke="hsl(240 5.9% 10%)"
            strokeWidth={1.5}
            fill="url(#goingGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
