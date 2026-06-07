import { useGetAgentStats, useListActivities, useListLeads } from "@workspace/api-client-react";
import { LayoutDashboard, Phone, Target, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { ActivityEntry } from "@/components/ActivityEntry";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

function StatCard({ label, value, icon: Icon, color = "text-primary", sub }: { label: string; value: string | number; icon: React.ElementType; color?: string; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetAgentStats();
  const { data: activities } = useListActivities({ params: { limit: 8 } });
  const { data: followUps } = useListLeads({ params: { status: "follow_up", limit: 5 } });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Good day, {user?.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your sales summary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Leads Assigned" value={stats?.leadsAssigned ?? 0} icon={Target} />
        <StatCard label="Calls Made" value={stats?.callsCompleted ?? 0} icon={Phone} color="text-blue-500" />
        <StatCard label="Follow-ups Pending" value={stats?.followUpsPending ?? 0} icon={Clock} color="text-amber-500" />
        <StatCard label="Deals Closed" value={stats?.dealsClosed ?? 0} icon={CheckCircle2} color="text-green-500" />
        <StatCard label="Revenue Generated" value={formatCurrency(stats?.revenueGenerated)} icon={DollarSign} color="text-emerald-500" />
        <Link href="/agent/dialer">
          <div className="bg-primary text-primary-foreground rounded-xl p-5 flex items-start gap-4 cursor-pointer hover:bg-primary/90 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold">Start Dialer</div>
              <div className="text-sm opacity-80">Auto-call next lead</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Follow-ups due */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Clock size={16} className="text-amber-500" /> Upcoming Follow-ups</h2>
          {followUps && followUps.leads.length > 0 ? (
            <div className="space-y-3">
              {followUps.leads.map(lead => (
                <Link key={lead.id} href={`/agent/leads/${lead.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-bold flex-shrink-0">
                      {lead.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.mobile} · Follow-up: {formatDate(lead.followUpDate)}</div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">No follow-ups pending</div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><LayoutDashboard size={16} className="text-primary" /> Recent Activity</h2>
          {activities && activities.length > 0 ? (
            <div className="space-y-4 divide-y divide-border">
              {activities.map(act => (
                <div key={act.id} className="pt-3 first:pt-0">
                  <ActivityEntry act={act as Parameters<typeof ActivityEntry>[0]["act"]} showAgent={false} compact={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}
