import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetLead, useUpdateLead, useAddLeadNote, useCloseLead, useListUsers, useAssignLead, getGetLeadQueryKey, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Phone, Mail, Building2, MapPin, Edit2, Save, X, Plus, Clock, DollarSign, Loader2, CheckCircle2, Briefcase, UserCog, User, CalendarDays } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime, timeAgo, STATUS_LABELS, PRIORITY_LABELS, ALL_STATUSES, ALL_PRIORITIES } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LeadDetail({ basePath }: { basePath: "admin" | "agent" }) {
  const [, params] = useRoute(`/${basePath}/leads/:id`);
  const id = parseInt(params?.id ?? "0", 10);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: lead, isLoading } = useGetLead(id, { query: { enabled: !!id, queryKey: getGetLeadQueryKey(id) } });
  const { data: users } = useListUsers();
  const agents = users?.filter(u => u.role === "agent") ?? [];

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [revenue, setRevenue] = useState("");
  const [closingRemark, setClosingRemark] = useState("");

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setEditing(false); toast.success("Lead updated");
      },
      onError() { toast.error("Failed to update lead"); },
    },
  });

  const addNoteMutation = useAddLeadNote({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
        setNoteText(""); setCallOutcome(""); setFollowUpDate("");
        toast.success("Note added");
      },
      onError() { toast.error("Failed to add note"); },
    },
  });

  const closeMutation = useCloseLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
        setShowCloseModal(false); toast.success("Deal closed successfully!");
      },
      onError() { toast.error("Failed to close deal"); },
    },
  });

  const assignMutation = useAssignLead({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) }); toast.success("Lead assigned"); },
    },
  });

  if (isLoading || !lead) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading lead...
      </div>
    );
  }

  const startEdit = () => {
    setEditForm({
      name: lead.name, mobile: lead.mobile, alternateMobile: lead.alternateMobile ?? "",
      email: lead.email ?? "", company: lead.company ?? "", city: lead.city ?? "",
      state: lead.state ?? "", source: lead.source ?? "", status: lead.status,
      priority: lead.priority, followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 16) : "",
      partnerName: lead.partnerName ?? "",
      accountManagerName: lead.accountManagerName ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id,
      data: {
        ...editForm,
        status: editForm.status as Parameters<typeof updateMutation.mutate>[0]["data"]["status"],
        priority: editForm.priority as Parameters<typeof updateMutation.mutate>[0]["data"]["priority"],
        followUpDate: editForm.followUpDate || undefined,
      },
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) { toast.error("Note content required"); return; }
    addNoteMutation.mutate({ id, data: { content: noteText, callOutcome: callOutcome || undefined, followUpDate: followUpDate || undefined } });
  };

  const handleCloseWon = () => {
    if (!revenue || !closingRemark) { toast.error("Revenue and closing remark required"); return; }
    closeMutation.mutate({ id, data: { revenueAmount: parseFloat(revenue), closingRemark, status: "closed_won" } });
  };

  const InputCls = "w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <Link href={`/${basePath}/leads`}>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-3 transition-colors">
            <ArrowLeft size={16} /> Back to Leads
          </button>
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
              {lead.name?.charAt(0)}
            </div>
            <div>
              {editing ? (
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none text-foreground" />
              ) : (
                <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
                {lead.source && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{lead.source}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"><X size={15} /> Cancel</button>
                <button onClick={handleSave} disabled={updateMutation.isPending} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={15} />} Save
                </button>
              </>
            ) : (
              <>
                {lead.status !== "closed_won" && lead.status !== "closed_lost" && (
                  <button onClick={() => setShowCloseModal(true)} className="flex items-center gap-1.5 border border-green-500 text-green-600 dark:text-green-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                    <CheckCircle2 size={15} /> Close Won
                  </button>
                )}
                <button onClick={startEdit} className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                  <Edit2 size={15} /> Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {editing ? (
                <>
                  {[
                    { key: "mobile", label: "Mobile" }, { key: "alternateMobile", label: "Alt Mobile" },
                    { key: "email", label: "Email" }, { key: "company", label: "Company" },
                    { key: "city", label: "City" }, { key: "state", label: "State" },
                    { key: "source", label: "Source" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                      <input value={editForm[f.key] ?? ""} onChange={e => setEditForm(x => ({ ...x, [f.key]: e.target.value }))} className={InputCls} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm(x => ({ ...x, status: e.target.value }))} className={InputCls}>
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                    <select value={editForm.priority} onChange={e => setEditForm(x => ({ ...x, priority: e.target.value }))} className={InputCls}>
                      {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Follow-up Date</label>
                    <input type="datetime-local" value={editForm.followUpDate} onChange={e => setEditForm(x => ({ ...x, followUpDate: e.target.value }))} className={InputCls} />
                  </div>
                </>
              ) : (
                <>
                  {[
                    { icon: Phone, label: "Mobile", value: lead.mobile },
                    { icon: Phone, label: "Alternate", value: lead.alternateMobile ?? "-" },
                    { icon: Mail, label: "Email", value: lead.email ?? "-" },
                    { icon: Building2, label: "Company", value: lead.company ?? "-" },
                    { icon: MapPin, label: "City", value: lead.city ?? "-" },
                    { icon: MapPin, label: "State", value: lead.state ?? "-" },
                    { icon: Clock, label: "Follow-up", value: formatDate(lead.followUpDate) },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-foreground font-medium text-sm">{value}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {lead.status === "closed_won" && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-1">
                  <DollarSign size={16} /> Revenue: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(lead.revenueAmount ?? 0)}
                </div>
                <div className="text-sm text-green-700 dark:text-green-400">{lead.closingRemark}</div>
                <div className="text-xs text-green-600/70 dark:text-green-500/70 mt-1">Closed {formatDate(lead.closingDate)}</div>
              </div>
            )}
          </div>

          {/* Add Note */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plus size={16} /> Add Note</h2>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3}
              placeholder="Write your note here..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-3" />
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Call outcome (optional)</option>
                  {["Connected", "Not answered", "Busy", "Voicemail", "Wrong number"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <button onClick={handleAddNote} disabled={addNoteMutation.isPending || !noteText.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {addNoteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Note
            </button>
          </div>

          {/* Notes Timeline */}
          {lead.notes && lead.notes.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Notes Timeline</h2>
              <div className="space-y-4">
                {lead.notes.map(note => (
                  <div key={note.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="w-px flex-1 bg-border mt-1" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-sm text-foreground leading-relaxed">{note.content}</div>
                        {note.callOutcome && <div className="text-xs text-muted-foreground mt-1.5">Outcome: {note.callOutcome}</div>}
                        {note.followUpDate && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Follow-up: {formatDateTime(note.followUpDate)}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{note.agentName}</span>
                        <span>·</span>
                        <span>{timeAgo(note.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Assignment Information */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Briefcase size={15} /> Assignment Info
            </h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Partner Name</label>
                  <input
                    value={editForm.partnerName ?? ""}
                    onChange={e => setEditForm(x => ({ ...x, partnerName: e.target.value }))}
                    placeholder="e.g. Acme Partners"
                    className={InputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Account Manager Name</label>
                  <input
                    value={editForm.accountManagerName ?? ""}
                    onChange={e => setEditForm(x => ({ ...x, accountManagerName: e.target.value }))}
                    placeholder="e.g. John Smith"
                    className={InputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { icon: Briefcase, label: "Partner Name", value: lead.partnerName ?? "—" },
                  { icon: UserCog, label: "Account Manager", value: lead.accountManagerName ?? "—" },
                  { icon: User, label: "Assigned Agent", value: lead.assignedAgentName ?? "Unassigned" },
                  { icon: CalendarDays, label: "Created", value: formatDate(lead.createdAt) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className={`text-sm font-medium ${value === "—" || value === "Unassigned" ? "text-muted-foreground italic" : "text-foreground"}`}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent assignment (admin only) */}
          {isAdmin && !editing && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Reassign Agent</h2>
              <select
                value={lead.assignedAgentId?.toString() ?? ""}
                onChange={e => { if (e.target.value) assignMutation.mutate({ id, data: { agentId: parseInt(e.target.value) } }); }}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Call history */}
          {lead.calls && lead.calls.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Phone size={15} /> Call History</h2>
              <div className="space-y-2.5">
                {lead.calls.map(call => (
                  <div key={call.id} className="text-sm border-b border-border last:border-0 pb-2.5 last:pb-0">
                    <div className="font-medium text-foreground">{call.agentName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(call.startedAt)}{call.duration ? ` · ${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : ""}</div>
                    {call.outcome && <div className="text-xs text-foreground mt-0.5">{call.outcome}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity log */}
          {lead.activities && lead.activities.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Activity Log</h2>
              <div className="space-y-2.5">
                {lead.activities.slice(0, 8).map(act => (
                  <div key={act.id} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-foreground leading-relaxed">{act.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{act.agentName} · {timeAgo(act.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Won Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Close Deal as Won</h2>
            <p className="text-sm text-muted-foreground mb-5">Record the revenue and closing details.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Revenue Amount ($) *</label>
                <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="50000"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Closing Remark *</label>
                <textarea value={closingRemark} onChange={e => setClosingRemark(e.target.value)} rows={3}
                  placeholder="Describe the deal..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCloseModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
                <button onClick={handleCloseWon} disabled={closeMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                  {closeMutation.isPending && <Loader2 size={14} className="animate-spin" />} Close Won
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
