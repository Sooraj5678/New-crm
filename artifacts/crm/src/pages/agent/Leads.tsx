import { useState } from "react";
import { useListLeads } from "@workspace/api-client-react";
import { Search, ChevronLeft, ChevronRight, Loader2, Target, X, Briefcase, UserCog } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { formatDate, STATUS_LABELS, ALL_STATUSES } from "@/lib/utils";
import { Link } from "wouter";

export default function AgentLeads() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPartnerName, setFilterPartnerName] = useState("");
  const [filterAccountManagerName, setFilterAccountManagerName] = useState("");

  const params: Record<string, string | number> = { page, limit: 20 };
  if (search) params.search = search;
  if (filterStatuses.length > 0) params.status = filterStatuses.join(",");
  if (filterPartnerName) params.partnerName = filterPartnerName;
  if (filterAccountManagerName) params.accountManagerName = filterAccountManagerName;

  const { data, isLoading } = useListLeads(params as import("@workspace/api-client-react").ListLeadsParams);

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const hasFilters = !!(search || filterStatuses.length || filterPartnerName || filterAccountManagerName);

  const clearFilters = () => {
    setSearch(""); setFilterStatuses([]); setFilterPartnerName(""); setFilterAccountManagerName(""); setPage(1);
  };

  const statusOptions = ALL_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }));

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

        <MultiSelectDropdown
          options={statusOptions}
          selected={filterStatuses}
          onChange={v => { setFilterStatuses(v); setPage(1); }}
          placeholder="All Statuses"
          searchPlaceholder="Search statuses..."
          maxWidth="w-44"
        />

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

      {/* Active filter chips */}
      {filterStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterStatuses.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {STATUS_LABELS[s]}
              <button onClick={() => setFilterStatuses(p => p.filter(v => v !== s))} className="hover:text-destructive"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground"><Loader2 size={24} className="animate-spin mr-2" /> Loading...</div>
      ) : !data?.leads.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Target size={36} className="mb-3 opacity-30" />
          <p className="font-medium">{hasFilters ? "No leads match your filters" : "No leads assigned to you"}</p>
          {hasFilters && <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>}
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
                      <Link href={`/leads/${lead.id}`}>
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
                      <Link href={`/leads/${lead.id}`}>
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
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"><ChevronLeft size={15} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
