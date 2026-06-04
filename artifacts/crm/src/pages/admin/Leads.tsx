import { useState, useCallback } from "react";
import { useListLeads, useCreateLead, useDeleteLead, useAssignLead, useImportLeads, useListUsers, getListLeadsQueryKey } from "@workspace/api-client-react";
import type { ListLeadsParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, UserCheck, Upload, ChevronLeft, ChevronRight, Loader2, Target, X, Download, Briefcase, UserCog, CheckSquare, Square } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { formatDate, STATUS_LABELS, PRIORITY_LABELS, ALL_STATUSES, ALL_PRIORITIES } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";
import { getAuthHeaders } from "@/lib/apiClient";

export default function AdminLeads() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAgentId, setFilterAgentId] = useState("");
  const [filterPartnerName, setFilterPartnerName] = useState("");
  const [filterAccountManagerName, setFilterAccountManagerName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [csvText, setCsvText] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const params: ListLeadsParams = { page, limit: 20 };
  if (search) params.search = search;
  if (filterStatus) params.status = filterStatus;
  if (filterPriority) params.priority = filterPriority;
  if (filterAgentId) params.agentId = parseInt(filterAgentId);
  if (filterPartnerName) params.partnerName = filterPartnerName;
  if (filterAccountManagerName) params.accountManagerName = filterAccountManagerName;

  const { data, isLoading } = useListLeads(params);
  const { data: users } = useListUsers();
  const agents = users?.filter(u => u.role === "agent") ?? [];

  const emptyForm = {
    name: "", mobile: "", email: "", company: "", city: "", state: "", country: "",
    source: "", status: "new", priority: "medium", assignedAgentId: "",
    partnerName: "", accountManagerName: "",
  };
  const [form, setForm] = useState(emptyForm);

  const createMutation = useCreateLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setShowCreate(false); setForm(emptyForm);
        toast.success("Lead created");
      },
      onError() { toast.error("Failed to create lead"); },
    },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); toast.success("Lead deleted"); },
      onError() { toast.error("Failed to delete lead"); },
    },
  });

  const assignMutation = useAssignLead({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); setShowAssign(null); toast.success("Lead assigned"); },
      onError() { toast.error("Failed to assign lead"); },
    },
  });

  const importMutation = useImportLeads({
    mutation: {
      onSuccess(data) {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setShowImport(false); setCsvText("");
        toast.success(`Imported ${data.imported} leads${data.failed > 0 ? `, ${data.failed} failed` : ""}`);
      },
      onError() { toast.error("Import failed"); },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.mobile) { toast.error("Name and mobile are required"); return; }
    if (!form.partnerName.trim()) { toast.error("Partner Name is required"); return; }
    if (!form.accountManagerName.trim()) { toast.error("Account Manager Name is required"); return; }
    createMutation.mutate({
      data: {
        ...form,
        assignedAgentId: form.assignedAgentId ? parseInt(form.assignedAgentId) : undefined,
        status: form.status as Parameters<typeof createMutation.mutate>[0]["data"]["status"],
        priority: form.priority as Parameters<typeof createMutation.mutate>[0]["data"]["priority"],
      },
    });
  };

  const handleImport = () => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
    const leads = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return {
        name: obj.name ?? obj["lead name"] ?? "",
        mobile: obj.mobile ?? obj["phone number"] ?? obj.phone ?? "",
        email: obj.email,
        company: obj.company ?? obj["company name"] ?? "",
        city: obj.city,
        state: obj.state,
        source: obj.source ?? obj["lead source"] ?? "",
        status: (obj.status || "new") as "new",
        priority: (obj.priority || "medium") as "medium",
        partnerName: obj["partner name"] ?? obj.partner ?? "",
        accountManagerName: obj["account manager name"] ?? obj["account manager"] ?? "",
      };
    }).filter(l => l.name && l.mobile);
    if (!leads.length) { toast.error("No valid leads found"); return; }
    importMutation.mutate({ data: { leads } });
  };

  const exportCsv = () => {
    const leads = data?.leads ?? [];
    const rows = [
      ["ID", "Name", "Mobile", "Email", "Company", "City", "State", "Status", "Priority", "Partner Name", "Account Manager Name", "Agent", "Follow-up", "Created"],
      ...leads.map(l => [
        l.id, l.name, l.mobile, l.email ?? "", l.company ?? "", l.city ?? "", "",
        l.status, l.priority,
        l.partnerName ?? "",
        l.accountManagerName ?? "",
        l.assignedAgentName ?? "",
        formatDate(l.followUpDate), formatDate(l.createdAt),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const currentLeads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const hasFilters = !!(search || filterStatus || filterPriority || filterAgentId || filterPartnerName || filterAccountManagerName);
  const clearFilters = () => {
    setSearch(""); setFilterStatus(""); setFilterPriority("");
    setFilterAgentId(""); setFilterPartnerName(""); setFilterAccountManagerName(""); setPage(1);
  };

  const allCurrentSelected = currentLeads.length > 0 && currentLeads.every(l => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentLeads.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentLeads.forEach(l => next.add(l.id));
        return next;
      });
    }
  }, [allCurrentSelected, currentLeads]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkAssign = async () => {
    if (!bulkAssignAgentId || selectedIds.size === 0) return;
    setIsBulkAssigning(true);
    try {
      const res = await fetch("/api/leads/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), agentId: parseInt(bulkAssignAgentId) }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setSelectedIds(new Set());
      setShowBulkAssign(false);
      setBulkAssignAgentId("");
      toast.success(`Assigned ${result.updated} lead${result.updated !== 1 ? "s" : ""} successfully`);
    } catch {
      toast.error("Bulk assign failed");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setSelectedIds(new Set());
      toast.success(`Deleted ${result.deleted} lead${result.deleted !== 1 ? "s" : ""} successfully`);
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const InputCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const SelectCls = "px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} total leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Upload size={15} /> Import
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
            placeholder="Search by name, mobile, email..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); setSelectedIds(new Set()); }} className={SelectCls}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1); setSelectedIds(new Set()); }} className={SelectCls}>
          <option value="">All Priorities</option>
          {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={filterAgentId} onChange={e => { setFilterAgentId(e.target.value); setPage(1); setSelectedIds(new Set()); }} className={SelectCls}>
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input value={filterPartnerName} onChange={e => { setFilterPartnerName(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          placeholder="Filter by Partner..."
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40" />
        <input value={filterAccountManagerName} onChange={e => { setFilterAccountManagerName(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          placeholder="Filter by Acct Mgr..."
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-40" />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => { setShowBulkAssign(true); setBulkAssignAgentId(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <UserCheck size={14} /> Bulk Assign
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
            >
              {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Bulk Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground"><Loader2 size={24} className="animate-spin mr-2" /> Loading...</div>
      ) : !currentLeads.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Target size={36} className="mb-3 opacity-30" />
          <p className="font-medium">{hasFilters ? "No leads match your filters" : "No leads yet"}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                      {allCurrentSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                    </button>
                  </th>
                  {["Name", "Mobile", "Status", "Priority", "Partner Name", "Account Manager", "Agent", "Follow-up", "Updated", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentLeads.map(lead => (
                  <tr key={lead.id} className={`border-b border-border last:border-0 transition-colors ${selectedIds.has(lead.id) ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                    <td className="px-4 py-3 w-10">
                      <button onClick={() => toggleSelect(lead.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {selectedIds.has(lead.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${lead.id}`}>
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
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lead.assignedAgentName ?? <span className="italic">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(lead.followUpDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(lead.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowAssign(lead.id)} title="Assign" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <UserCheck size={15} />
                        </button>
                        <button onClick={() => { if (confirm("Delete this lead?")) deleteMutation.mutate({ id: lead.id }); }} title="Delete" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
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
                <button onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedIds(new Set()); }} disabled={page === 1} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"><ChevronLeft size={15} /></button>
                <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelectedIds(new Set()); }} disabled={page === totalPages} className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-foreground text-lg mb-4">Add New Lead</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "name", label: "Full Name *", span: 2 }, { key: "mobile", label: "Mobile *", span: 1 },
                  { key: "email", label: "Email", span: 1 }, { key: "company", label: "Company", span: 1 },
                  { key: "city", label: "City", span: 1 }, { key: "state", label: "State", span: 1 },
                  { key: "country", label: "Country", span: 1 }, { key: "source", label: "Source", span: 1 },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? "col-span-2" : ""}>
                    <label className="block text-xs font-medium text-foreground mb-1">{f.label}</label>
                    <input value={form[f.key as keyof typeof form]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} className={InputCls} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Partner Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={form.partnerName}
                    onChange={e => setForm(x => ({ ...x, partnerName: e.target.value }))}
                    placeholder="e.g. Acme Partners"
                    className={InputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Account Manager Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={form.accountManagerName}
                    onChange={e => setForm(x => ({ ...x, accountManagerName: e.target.value }))}
                    placeholder="e.g. John Smith"
                    className={InputCls}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(x => ({ ...x, status: e.target.value }))} className={InputCls}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(x => ({ ...x, priority: e.target.value }))} className={InputCls}>
                    {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Assign Agent</label>
                  <select value={form.assignedAgentId} onChange={e => setForm(x => ({ ...x, assignedAgentId: e.target.value }))} className={InputCls}>
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />} Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal (single) */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-4">Assign Lead</h2>
            <select value={assignAgentId} onChange={e => setAssignAgentId(e.target.value)} className={`w-full ${InputCls} mb-4`}>
              <option value="">Select agent...</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowAssign(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={() => { if (assignAgentId) assignMutation.mutate({ id: showAssign, data: { agentId: parseInt(assignAgentId) } }); }}
                disabled={!assignAgentId || assignMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {assignMutation.isPending && <Loader2 size={14} className="animate-spin" />} Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-1">Bulk Assign Leads</h2>
            <p className="text-sm text-muted-foreground mb-4">Assign {selectedIds.size} selected lead{selectedIds.size !== 1 ? "s" : ""} to an agent.</p>
            <select value={bulkAssignAgentId} onChange={e => setBulkAssignAgentId(e.target.value)} className={`w-full ${InputCls} mb-4`}>
              <option value="">Select agent...</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkAssign(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignAgentId || isBulkAssigning}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {isBulkAssigning && <Loader2 size={14} className="animate-spin" />} Assign All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-lg p-6">
            <h2 className="font-bold text-lg mb-2">Import Leads from CSV</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Required: <code className="bg-muted px-1 rounded text-xs">name, mobile</code>. Also supported: <code className="bg-muted px-1 rounded text-xs">partner name, account manager name</code>
            </p>
            <p className="text-xs text-muted-foreground mb-4">For a full template with all columns, use the <Link href="/admin/bulk-upload"><span className="text-primary underline cursor-pointer">Bulk Upload wizard</span></Link>.</p>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
              placeholder={"name,mobile,email,company,partner name,account manager name\nJohn Doe,9876543210,john@co.com,TechCorp,Acme Partners,Jane Smith"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowImport(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleImport} disabled={importMutation.isPending || !csvText.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {importMutation.isPending && <Loader2 size={14} className="animate-spin" />} Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
