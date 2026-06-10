import { useState, useCallback, useEffect, useRef } from "react";
import { useListLeads, useCreateLead, useDeleteLead, useAssignLead, useImportLeads, useListUsers, getListLeadsQueryKey, customFetch, ApiError } from "@workspace/api-client-react";
import type { ListLeadsParams } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, UserCheck, Upload, ChevronLeft, ChevronRight, Loader2, Target, X, Download, Briefcase, UserCog, CheckSquare, Square, ChevronDown, Check } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import type { MultiSelectOption } from "@/components/MultiSelectDropdown";
import { formatDate, STATUS_LABELS, PRIORITY_LABELS, ALL_STATUSES, ALL_PRIORITIES } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";

interface Partner { id: number; name: string; code?: string | null; isActive: boolean; }

function usePartners() {
  return useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    queryFn: () => customFetch<Partner[]>("/api/partners"),
  });
}

function useAccountManagers() {
  return useQuery<string[]>({
    queryKey: ["/api/leads/managers"],
    queryFn: () => customFetch<string[]>("/api/leads/managers"),
  });
}

interface SearchableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  onAddNew?: (name: string) => Promise<void> | void;
  addNewLabel?: string;
  className?: string;
}

function SearchableSelect({ value, onChange, options, placeholder = "Select...", onAddNew, addNewLabel = "Add new", className = "" }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch(""); setShowAdd(false); setNewName("");
      }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find(o => o.value === value)?.label ?? value;

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !onAddNew) return;
    setIsAdding(true);
    try {
      await onAddNew(trimmed);
      onChange(trimmed);
      setShowAdd(false); setNewName(""); setOpen(false); setSearch("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[38px]"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value ? selectedLabel : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No options</p>}
            {filtered.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${value === o.value ? "bg-primary border-primary" : "border-input"}`}>
                  {value === o.value && <Check size={10} className="text-primary-foreground" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
          {onAddNew && (
            <div className="border-t border-border p-2">
              {showAdd ? (
                <div className="flex gap-1.5">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } if (e.key === "Escape") { setShowAdd(false); setNewName(""); } }}
                    placeholder="Enter name..." className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  <button type="button" onClick={handleAdd} disabled={!newName.trim() || isAdding}
                    className="px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 flex items-center gap-1">
                    {isAdding && <Loader2 size={10} className="animate-spin" />} Add
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAdd(true)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-primary font-medium hover:bg-primary/5 rounded transition-colors">
                  <Plus size={12} /> {addNewLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminLeads() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterAgentId, setFilterAgentId] = useState("");
  const [filterPartnerNames, setFilterPartnerNames] = useState<string[]>([]);
  const [filterAccountManagerNames, setFilterAccountManagerNames] = useState<string[]>([]);
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
  if (filterStatuses.length > 0) params.status = filterStatuses.join(",");
  if (filterPriorities.length > 0) params.priority = filterPriorities.join(",");
  if (filterAgentId) params.agentId = parseInt(filterAgentId);
  if (filterPartnerNames.length > 0) params.partnerName = filterPartnerNames.join(",");
  if (filterAccountManagerNames.length > 0) params.accountManagerName = filterAccountManagerNames.join(",");

  const { data, isLoading } = useListLeads(params);
  const { data: users } = useListUsers();
  const { data: partnersData, refetch: refetchPartners } = usePartners();
  const { data: managersData, refetch: refetchManagers } = useAccountManagers();

  const agents = users?.filter(u => u.role === "agent") ?? [];
  const partners = partnersData ?? [];
  const managers = managersData ?? [];

  const partnerOptions: MultiSelectOption[] = partners.map(p => ({ value: p.name, label: p.name }));
  const managerOptions: MultiSelectOption[] = managers.map(m => ({ value: m, label: m }));
  const statusOptions: MultiSelectOption[] = ALL_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }));
  const priorityOptions: MultiSelectOption[] = ALL_PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] }));
  const agentOptions = agents.map(a => ({ value: String(a.id), label: a.name }));

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
        refetchPartners();
        refetchManagers();
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

  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | null>(null);

  const runExport = async (format: "csv" | "xlsx") => {
    if (exportingFormat) return;
    setExportingFormat(format);
    const date = new Date().toISOString().slice(0, 10);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (filterStatuses.length) qp.set("status", filterStatuses.join(","));
      if (filterPriorities.length) qp.set("priority", filterPriorities.join(","));
      if (filterAgentId) qp.set("agentId", filterAgentId);
      if (filterPartnerNames.length) qp.set("partnerName", filterPartnerNames.join(","));
      if (filterAccountManagerNames.length) qp.set("accountManagerName", filterAccountManagerNames.join(","));
      qp.set("format", format);

      const token = localStorage.getItem("crm_token");
      const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
      console.log(`[export] Starting ${format.toUpperCase()} export — URL: ${baseUrl}/api/leads/export?${qp.toString()}`);

      const res = await fetch(`${baseUrl}/api/leads/export?${qp.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      console.log(`[export] Response: HTTP ${res.status} — Content-Type: ${contentType}`);

      if (contentType.includes("text/html")) {
        console.error("[export] Received HTML — API routing issue or auth redirect");
        throw new Error("Export routing error: received HTML instead of file. Check API server.");
      }

      if (!res.ok) {
        let errMsg = `Export failed (HTTP ${res.status})`;
        try {
          const body = await res.json() as { error?: string };
          if (body?.error) errMsg = body.error;
        } catch { /* non-JSON body, use status message */ }
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      console.log(`[export] Blob received — size: ${blob.size} bytes, type: ${blob.type}`);
      if (blob.size === 0) throw new Error("Export returned an empty file.");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported leads as ${format.toUpperCase()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      console.error("[export] error:", msg);
      toast.error(msg);
    } finally {
      setExportingFormat(null);
    }
  };

  const currentLeads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const hasFilters = !!(search || filterStatuses.length || filterPriorities.length || filterAgentId || filterPartnerNames.length || filterAccountManagerNames.length);
  const clearFilters = () => {
    setSearch(""); setFilterStatuses([]); setFilterPriorities([]);
    setFilterAgentId(""); setFilterPartnerNames([]); setFilterAccountManagerNames([]); setPage(1);
  };

  const allCurrentSelected = currentLeads.length > 0 && currentLeads.every(l => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      setSelectedIds(prev => { const next = new Set(prev); currentLeads.forEach(l => next.delete(l.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); currentLeads.forEach(l => next.add(l.id)); return next; });
    }
  }, [allCurrentSelected, currentLeads]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleBulkAssign = async () => {
    if (!bulkAssignAgentId || selectedIds.size === 0) return;
    const leadIds = Array.from(selectedIds);
    const agentId = parseInt(bulkAssignAgentId, 10);
    if (isNaN(agentId) || agentId <= 0) { toast.error("Please select a valid agent"); return; }
    setIsBulkAssigning(true);
    try {
      const result = await customFetch<{ updated: number; agentId: number; agentName: string }>(
        "/api/leads/bulk-assign",
        { method: "POST", body: JSON.stringify({ leadIds, agentId }), headers: { "Content-Type": "application/json" } },
      );
      await qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setSelectedIds(new Set()); setShowBulkAssign(false); setBulkAssignAgentId("");
      toast.success(`${result.updated} lead${result.updated !== 1 ? "s" : ""} assigned to ${result.agentName}`);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.data as { error?: string } | null)?.error ?? err.message : "Bulk assign failed";
      toast.error(msg);
    } finally { setIsBulkAssigning(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    const leadIds = Array.from(selectedIds);
    setIsBulkDeleting(true);
    try {
      const result = await customFetch<{ deleted: number }>(
        "/api/leads/bulk-delete",
        { method: "POST", body: JSON.stringify({ leadIds }), headers: { "Content-Type": "application/json" } },
      );
      await qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setSelectedIds(new Set());
      toast.success(`${result.deleted} lead${result.deleted !== 1 ? "s" : ""} deleted successfully`);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.data as { error?: string } | null)?.error ?? err.message : "Bulk delete failed";
      toast.error(msg);
    } finally { setIsBulkDeleting(false); }
  };

  const handleAddNewPartner = async (name: string) => {
    await customFetch("/api/partners", { method: "POST", body: JSON.stringify({ name }), headers: { "Content-Type": "application/json" } });
    await refetchPartners();
    toast.success(`Partner "${name}" added`);
  };

  const handleAddNewManager = async (name: string) => {
    await refetchManagers();
    toast.success(`Account manager "${name}" will appear after saving a lead`);
  };

  const InputCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const SelectCls = "px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  const filterCount = filterStatuses.length + filterPriorities.length + filterPartnerNames.length + filterAccountManagerNames.length + (filterAgentId ? 1 : 0) + (search ? 1 : 0);

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
          <button
            onClick={() => runExport("csv")}
            disabled={!!exportingFormat}
            className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
          >
            {exportingFormat === "csv" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {exportingFormat === "csv" ? "Exporting…" : "CSV"}
          </button>
          <button
            onClick={() => runExport("xlsx")}
            disabled={!!exportingFormat}
            className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
          >
            {exportingFormat === "xlsx" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} className="text-green-600 dark:text-green-400" />}
            {exportingFormat === "xlsx" ? "Exporting…" : "Excel"}
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Filters {filterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">{filterCount}</span>}</span>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
              placeholder="Search by name, mobile, email..."
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <MultiSelectDropdown
            options={statusOptions}
            selected={filterStatuses}
            onChange={v => { setFilterStatuses(v); setPage(1); setSelectedIds(new Set()); }}
            placeholder="All Statuses"
            searchPlaceholder="Search statuses..."
            maxWidth="w-44"
          />

          <MultiSelectDropdown
            options={priorityOptions}
            selected={filterPriorities}
            onChange={v => { setFilterPriorities(v); setPage(1); setSelectedIds(new Set()); }}
            placeholder="All Priorities"
            searchPlaceholder="Search priorities..."
            maxWidth="w-40"
          />

          <select value={filterAgentId} onChange={e => { setFilterAgentId(e.target.value); setPage(1); setSelectedIds(new Set()); }} className={SelectCls}>
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <MultiSelectDropdown
            options={partnerOptions}
            selected={filterPartnerNames}
            onChange={v => { setFilterPartnerNames(v); setPage(1); setSelectedIds(new Set()); }}
            placeholder="All Partners"
            searchPlaceholder="Search partners..."
            maxWidth="w-44"
          />

          <MultiSelectDropdown
            options={managerOptions}
            selected={filterAccountManagerNames}
            onChange={v => { setFilterAccountManagerNames(v); setPage(1); setSelectedIds(new Set()); }}
            placeholder="All Account Mgrs"
            searchPlaceholder="Search managers..."
            maxWidth="w-44"
          />
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-foreground border border-border">
                Search: "{search}"
                <button onClick={() => { setSearch(""); setPage(1); }} className="hover:text-destructive"><X size={11} /></button>
              </span>
            )}
            {filterStatuses.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {STATUS_LABELS[s]}
                <button onClick={() => setFilterStatuses(p => p.filter(v => v !== s))} className="hover:text-destructive"><X size={11} /></button>
              </span>
            ))}
            {filterPriorities.map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 text-xs text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                {PRIORITY_LABELS[p]}
                <button onClick={() => setFilterPriorities(prev => prev.filter(v => v !== p))} className="hover:text-destructive"><X size={11} /></button>
              </span>
            ))}
            {filterPartnerNames.map(n => (
              <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/30 text-xs text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <Briefcase size={10} /> {n}
                <button onClick={() => setFilterPartnerNames(p => p.filter(v => v !== n))} className="hover:text-destructive"><X size={11} /></button>
              </span>
            ))}
            {filterAccountManagerNames.map(n => (
              <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-xs text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                <UserCog size={10} /> {n}
                <button onClick={() => setFilterAccountManagerNames(p => p.filter(v => v !== n))} className="hover:text-destructive"><X size={11} /></button>
              </span>
            ))}
            {filterAgentId && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-foreground border border-border">
                Agent: {agents.find(a => String(a.id) === filterAgentId)?.name ?? filterAgentId}
                <button onClick={() => setFilterAgentId("")} className="hover:text-destructive"><X size={11} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => { setShowBulkAssign(true); setBulkAssignAgentId(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <UserCheck size={14} /> Bulk Assign
            </button>
            <button onClick={handleBulkDelete} disabled={isBulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60">
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
          {hasFilters && <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>}
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
                    Partner <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    value={form.partnerName}
                    onChange={v => setForm(x => ({ ...x, partnerName: v }))}
                    options={partners.map(p => ({ value: p.name, label: p.name }))}
                    placeholder="Select partner..."
                    onAddNew={handleAddNewPartner}
                    addNewLabel="Add new partner"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Account Manager <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    value={form.accountManagerName}
                    onChange={v => setForm(x => ({ ...x, accountManagerName: v }))}
                    options={managers.map(m => ({ value: m, label: m }))}
                    placeholder="Select manager..."
                    onAddNew={async (name) => { setForm(x => ({ ...x, accountManagerName: name })); await handleAddNewManager(name); }}
                    addNewLabel="Add new manager"
                    className="w-full"
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
              <button onClick={handleBulkAssign} disabled={!bulkAssignAgentId || isBulkAssigning}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
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
