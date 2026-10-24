"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/src/components/ui/Chart";

interface ForecastDay {
  date: string;
  count: number;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function labelFor(dateStr: string, index: number): string {
  if (index === 0) return "Hôm nay";
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS[d.getDay()];
}

const chartConfig = {
  count: { label: "Số từ cần ôn", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export function DueForecastChart() {
  const [days, setDays] = useState<ForecastDay[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/english/flashcard/forecast")
      .then((res) => res.json())
      .then((data: { days: ForecastDay[] }) => {
        if (!cancelled) setDays(data.days);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (days === null) {
    return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Đang tải biểu đồ...</div>;
  }

  const total = days.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Không có từ nào cần ôn tập trong 7 ngày tới.
      </div>
    );
  }

  const chartData = days.map((d, i) => ({
    label: labelFor(d.date, i),
    count: d.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
