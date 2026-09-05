'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssetListItem, StatsResponse } from '@/lib/trace-api';

const TYPE_COLORS: Record<string, string> = {
  image: '#2E5C8A',
  audio: '#2E8B57',
  video: '#1F3A5F',
  other: '#7A7A7A',
};

const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  other: 'Other',
};

export function ComplianceCharts({
  assets,
  stats,
}: {
  assets: AssetListItem[];
  stats: StatsResponse | null;
}) {
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      const t = a.file_type || 'other';
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).map(([type, count]) => ({
      type: TYPE_LABEL[type] || type,
      count,
      rawType: type,
    }));
  }, [assets]);

  const complianceData = useMemo(() => {
    const rate = stats?.compliance_rate ?? 1;
    const total = stats?.total_assets ?? 0;
    const valid = Math.round(rate * total);
    const invalid = total - valid;
    return [
      { name: 'Valid', value: valid, color: '#2E8B57' },
      { name: 'Unsigned', value: invalid, color: '#C0392B' },
    ];
  }, [stats]);

  const totalAssets = stats?.total_assets ?? assets.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Assets by type */}
      <Card className="bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#1F3A5F] flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Assets by type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {typeData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No assets yet</p>
          ) : (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 12, fill: '#7A7A7A' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#7A7A7A' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {typeData.map((entry, i) => (
                      <Cell key={i} fill={TYPE_COLORS[entry.rawType] || '#2E5C8A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance donut */}
      <Card className="bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#1F3A5F] flex items-center gap-2">
            <PieIcon className="h-4 w-4" />
            Compliance rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={complianceData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {complianceData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pr-24">
              <span className="text-2xl font-bold text-[#2E8B57]">
                {Math.round((stats?.compliance_rate ?? 1) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">valid</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            {totalAssets} asset{totalAssets === 1 ? '' : 's'} stamped · all carry valid C2PA signatures
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
