import { useState, useEffect } from "react";
import { useGetDashboardStats, useGetRevenueChart, useGetAgentLeaderboard, useListLeads } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, TrendingUp, DollarSign, CheckCircle2, Briefcase, UserCog, Users, Filter } from "lucide-react";
import { getAuthHeaders } from "@/lib/apiClient";

interface PartnerStat { id: number; name: string; totalLeads: number; closedLeads: number; revenue: number; }
interface AManagerStat { id: number; name: string; totalLeads: number; closedLeads: number; revenue: number; }

const COLORS = ["hsl(217 91% 60%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(280 70% 55%)", "hsl(0 84% 60%)", "hsl(175 70% 45%)"];

export default function Reports() {
  const { data: stats } = useGetDashboardStats();
  const { data: chart6 } = useGetRevenueChart({ params: { months: 6 } });
  const { data: leaderboard } = useGetAgentLeaderboard();
  const { data: closedLeads } = useListLeads({ params: { status: "closed_won", limit: 50 } });

  const [partnerStats, setPartnerStats] = useState<PartnerStat[]>([]);
  const [amStats, setAmStats] = useState<AManagerStat[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "partners" | "account-managers">("overview");

  useEffect(() => {
    fetch("/api/dashboard/partner-stats", { headers: getAuthHeaders() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setPartnerStats(d); }).catch(() => {});
    fetch("/api/dashboard/account-manager-stats", { headers: getAuthHeaders() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAmStats(d); }).catch(() => {});
  }, []);

  const exportCsv = () => {
    const leads = closedLeads?.leads ?? [];
    const rows = [
      ["Lead Name", "Partner", "Account Manager", "Agent", "Revenue", "Close Date", "Remark"],
      ...leads.map(l => {
        const ext = l as Record<string, unknown>;
        return [
          l.name,
          String(ext.partnerName ?? ""),
          String(ext.accountManagerName ?? ""),
          l.assignedAgentName ?? "",
          String(l.revenueAmount ?? ""),
          formatDate(l.closingDate),
          l.closingRemark ?? "",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "closed_deals.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const TabBtn = ({ id, label, icon: Icon }: { id: typeof activeTab; label: string; icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"}`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Revenue and performance analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <TabBtn id="overview" label="Overview" icon={TrendingUp} />
          <TabBtn id="partners" label="Partners" icon={Briefcase} />
          <TabBtn id="account-managers" label="Account Mgrs" icon={UserCog} />
          <button onClick={exportCsv} className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: formatCurrency(stats?.totalRevenue), icon: DollarSign, color: "text-emerald-500" },
          { label: "Deals Closed", value: stats?.closedDeals ?? 0, icon: CheckCircle2, color: "text-blue-500" },
          { label: "Partners", value: partnerStats.length, icon: Briefcase, color: "text-violet-500" },
          { label: "Conversion Rate", value: `${stats?.conversionRate ?? 0}%`, icon: TrendingUp, color: "text-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className={color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {/* Revenue chart */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Monthly Revenue (Last 6 Months)</h2>
            {chart6 && chart6.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chart6} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ fill: "hsl(217 91% 60%)", strokeWidth: 0, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
            )}
          </div>

          {/* Agent performance */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Agent Performance</h2>
            {leaderboard && leaderboard.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leaderboard.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 40, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="agentName" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenueGenerated" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Agent", "Leads", "Calls", "Deals", "Revenue"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map(a => (
                        <tr key={a.agentId} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium text-foreground">{a.agentName}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{a.leadsAssigned}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{a.callsMade}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{a.dealsClosed}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(a.revenueGenerated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No agent data yet</div>
            )}
          </div>

          {/* Closed deals */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Closed Deals</h2>
            {closedLeads && closedLeads.leads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Lead", "Partner", "Account Mgr", "Agent", "Revenue", "Close Date"].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {closedLeads.leads.map(l => {
                      const ext = l as Record<string, unknown>;
                      return (
                        <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium text-foreground">{l.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">{String(ext.partnerName ?? "—")}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">{String(ext.accountManagerName ?? "—")}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{l.assignedAgentName ?? "-"}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(l.revenueAmount)}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{formatDate(l.closingDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">No closed deals yet</div>
            )}
          </div>
        </>
      )}

      {/* PARTNERS TAB */}
      {activeTab === "partners" && (
        <>
          {partnerStats.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground">
              <Briefcase size={36} className="mb-3 opacity-30" />
              <p className="font-medium">No partner data yet</p>
              <p className="text-sm mt-1">Assign partners to leads to see analytics</p>
            </div>
          ) : (
            <>
              {/* Partner distribution pie */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <h2 className="font-semibold text-foreground mb-4">Leads by Partner</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={partnerStats} dataKey="totalLeads" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {partnerStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, "Leads"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <h2 className="font-semibold text-foreground mb-4">Revenue by Partner</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={partnerStats} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {partnerStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-4">Partner Performance</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Partner", "Total Leads", "Deals Closed", "Revenue", "Conversion"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {partnerStats.map(p => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2"><Briefcase size={13} className="text-primary" />{p.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.totalLeads}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.closedLeads}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.revenue)}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {p.totalLeads > 0 ? `${((p.closedLeads / p.totalLeads) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ACCOUNT MANAGERS TAB */}
      {activeTab === "account-managers" && (
        <>
          {amStats.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground">
              <UserCog size={36} className="mb-3 opacity-30" />
              <p className="font-medium">No account manager data yet</p>
              <p className="text-sm mt-1">Assign account managers to leads to see analytics</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <h2 className="font-semibold text-foreground mb-4">Leads by Account Manager</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={amStats} dataKey="totalLeads" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {amStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, "Leads"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <h2 className="font-semibold text-foreground mb-4">Revenue by Account Manager</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={amStats} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {amStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-4">Account Manager Performance</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Account Manager", "Total Leads", "Deals Closed", "Revenue", "Conversion"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {amStats.map(am => (
                        <tr key={am.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2"><UserCog size={13} className="text-primary" />{am.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{am.totalLeads}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{am.closedLeads}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(am.revenue)}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {am.totalLeads > 0 ? `${((am.closedLeads / am.totalLeads) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
