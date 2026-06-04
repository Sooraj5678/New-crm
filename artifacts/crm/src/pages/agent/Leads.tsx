import { useState } from "react";
import { useListLeads } from "@workspace/api-client-react";
import { Search, ChevronLeft, ChevronRight, Loader2, Target, X, Briefcase, UserCog } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { formatDate, STATUS_LABELS, ALL_STATUSES } from "@/lib/utils";
import { Link } from "wouter";

export default function AgentLeads() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPartnerName, setFilterPartnerName] = useState("");
  const [filterAccountManagerName, setFilterAccountManagerName] = useState("");

  const params: Record<string, string | number> = { page, limit: 20 };
  if (search) params.search = search;
  if (filterStatus) params.status = filterStatus;
  if (filterPartnerName) params.partnerName = filterPartnerName;
  if (filterAccountManagerName) params.accountManagerName = filterAccountManagerName;

  const { data, isLoading } = useListLeads(params as import("@workspace/api-client-react").ListLeadsParams);

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const hasFilters = !!(search || filterStatus || filterPartnerName || filterAccountManagerName);

  const clearFilters = () => {
    setSearch(""); setFilterStatus(""); setFilterPartnerName(""); setFilterAccountManagerName(""); setPage(1);
  };

  const SelectCls = "px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} leads assigned to you</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, mobile, company..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className={SelectCls}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input value={filterPartnerName} onChange={e => { setFilterPartnerName(e.target.value); setPage(1); }}
          placeholder="Search by Partner..."
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40" />
        <input value={filterAccountManagerName} onChange={e => { setFilterAccountManagerName(e.target.value); setPage(1); }}
          placeholder="Search by Acct Mgr..."
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40" />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground"><Loader2 size={24} className="animate-spin mr-2" /> Loading...</div>
      ) : !data?.leads.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Target size={36} className="mb-3 opacity-30" />
          <p className="font-medium">{hasFilters ? "No leads match your filters" : "No leads assigned to you"}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Mobile", "Status", "Priority", "Partner Name", "Account Manager", "Follow-up", "Updated", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.leads.map(lead => (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/agent/leads/${lead.id}`}>
                        <div className="font-medium text-foreground hover:text-primary cursor-pointer transition-colors">{lead.name}</div>
                      </Link>
                      <div className="text-xs text-muted-foreground">{lead.company ?? lead.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{lead.mobile}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={lead.priority} /></td>
                    <td className="px-4 py-3">
                      {lead.partnerName ? (
                        <span className="inline-flex items-center gap-1 text-xs text-foreground">
                          <Briefcase size={11} className="text-muted-foreground shrink-0" />{lead.partnerName}
                        </span>
                      ) : <span className="text-xs text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {lead.accountManagerName ? (
                        <span className="inline-flex items-center gap-1 text-xs text-foreground">
                          <UserCog size={11} className="text-muted-foreground shrink-0" />{lead.accountManagerName}
                        </span>
                      ) : <span className="text-xs text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(lead.followUpDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(lead.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/agent/leads/${lead.id}`}>
                        <button className="text-xs text-primary hover:underline">View</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40"><ChevronLeft size={15} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
