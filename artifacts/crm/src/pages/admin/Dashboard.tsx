import { useGetDashboardStats, useGetRevenueChart, useGetAgentLeaderboard, useGetStatusBreakdown, useListActivities } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Phone, Target, DollarSign, CheckCircle2, Star, AlertCircle } from "lucide-react";
import { formatCurrency, timeAgo, STATUS_LABELS } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityEntry } from "@/components/ActivityEntry";

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6", interested: "#22c55e", follow_up: "#f59e0b",
  not_interested: "#ef4444", busy: "#eab308", callback_later: "#a855f7",
  converted: "#10b981", closed_won: "#16a34a", closed_lost: "#f87171",
};

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ${color.replace("text-", "text-")}`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: revenueChart } = useGetRevenueChart({ params: { months: 6 } });
  const { data: leaderboard } = useGetAgentLeaderboard();
  const { data: statusBreakdown } = useGetStatusBreakdown();
  const { data: activities } = useListActivities({ params: { limit: 10 } });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your sales pipeline</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats?.totalLeads ?? 0} sub={`+${stats?.newLeadsToday ?? 0} today`} icon={Target} />
        <StatCard label="Total Revenue" value={formatCurrency(stats?.totalRevenue)} sub={`${stats?.closedDeals ?? 0} deals closed`} icon={DollarSign} color="text-emerald-500" />
        <StatCard label="Total Calls" value={stats?.totalCalls ?? 0} sub={`${stats?.connectedCalls ?? 0} connected`} icon={Phone} color="text-blue-500" />
        <StatCard label="Conversion Rate" value={`${stats?.conversionRate ?? 0}%`} sub={`${stats?.totalAgents ?? 0} active agents`} icon={TrendingUp} color="text-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatCard label="Follow-ups Due" value={stats?.followUpsDue ?? 0} sub="Requires attention today" icon={AlertCircle} color="text-amber-500" />
        <StatCard label="Closed Deals" value={stats?.closedDeals ?? 0} sub="All time" icon={CheckCircle2} color="text-green-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Revenue (Last 6 Months)</h2>
          {revenueChart && revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Lead Status</h2>
          {statusBreakdown && statusBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {statusBreakdown.slice(0, 4).map(entry => (
                  <div key={entry.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[entry.status] }} />
                      <span className="text-muted-foreground">{STATUS_LABELS[entry.status] ?? entry.status}</span>
                    </div>
                    <span className="font-medium text-foreground">{entry.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Leaderboard + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Star size={16} className="text-amber-500" /> Agent Leaderboard</h2>
          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((agent, i) => (
                <div key={agent.agentId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{agent.agentName}</div>
                    <div className="text-xs text-muted-foreground">{agent.dealsClosed} deals · {agent.callsMade} calls</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(agent.revenueGenerated)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No agents yet</div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Recent Activity</h2>
          {activities && activities.length > 0 ? (
            <div className="space-y-4 divide-y divide-border">
              {activities.slice(0, 8).map(act => (
                <div key={act.id} className="pt-3 first:pt-0">
                  <ActivityEntry act={act as Parameters<typeof ActivityEntry>[0]["act"]} showAgent compact={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
