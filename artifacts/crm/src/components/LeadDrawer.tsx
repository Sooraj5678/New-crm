import { useState, useEffect } from "react";
import { useGetLead, useUpdateLead, useAddLeadNote, useCloseLead, useAssignLead, useListUsers, getGetLeadQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X, Phone, Mail, Building2, MapPin, MessageCircle, ExternalLink,
  CheckCircle2, XCircle, Plus, Loader2, Clock, DollarSign, User,
  ChevronDown, Edit3, AlertCircle
} from "lucide-react";
import { cn, formatCurrency, formatDate, formatDateTime, timeAgo, STATUS_LABELS, ALL_STATUSES } from "@/lib/utils";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { toast } from "sonner";

interface LeadDrawerProps {
  leadId: number | null;
  onClose: () => void;
}

function LeadColorBar({ status, followUpDate }: { status: string; followUpDate: string | null }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isMissed = followUpDate && new Date(followUpDate) < today && !["closed_won", "closed_lost", "converted"].includes(status);
  if (status === "closed_won") return <div className="h-1 w-full bg-emerald-500 rounded-t-2xl" />;
  if (status === "closed_lost") return <div className="h-1 w-full bg-gray-400 rounded-t-2xl" />;
  if (isMissed) return <div className="h-1 w-full bg-red-500 rounded-t-2xl" />;
  if (status === "interested") return <div className="h-1 w-full bg-green-500 rounded-t-2xl" />;
  if (status === "follow_up") return <div className="h-1 w-full bg-amber-500 rounded-t-2xl" />;
  return <div className="h-1 w-full bg-primary rounded-t-2xl" />;
}

export function LeadDrawer({ leadId, onClose }: LeadDrawerProps) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);

  const { data: lead, isLoading } = useGetLead(leadId ?? 0, {
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId ?? 0) },
  });
  const { data: users } = useListUsers();
  const agents = (users ?? []).filter(u => u.role === "agent");

  const [noteText, setNoteText] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [showCloseWon, setShowCloseWon] = useState(false);
  const [revenue, setRevenue] = useState("");
  const [closingRemark, setClosingRemark] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    if (leadId) { requestAnimationFrame(() => setVisible(true)); }
    else { setVisible(false); }
  }, [leadId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId ?? 0) });
        toast.success("Lead updated");
        setShowStatusMenu(false);
      },
      onError() { toast.error("Failed to update"); },
    },
  });

  const noteMutation = useAddLeadNote({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId ?? 0) });
        setNoteText(""); setCallOutcome(""); setNewFollowUp("");
        toast.success("Note added");
        setSavingNote(false);
      },
      onError() { toast.error("Failed to add note"); setSavingNote(false); },
    },
  });

  const closeMutation = useCloseLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId ?? 0) });
        setShowCloseWon(false); setRevenue(""); setClosingRemark("");
        toast.success("Deal closed!");
      },
      onError() { toast.error("Failed to close deal"); },
    },
  });

  const assignMutation = useAssignLead({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId ?? 0) }); toast.success("Assigned"); },
    },
  });

  const handleAddNote = async () => {
    if (!noteText.trim() || !leadId) { toast.error("Note content required"); return; }
    setSavingNote(true);
    noteMutation.mutate({
      id: leadId,
      data: { content: noteText, callOutcome: callOutcome || undefined, followUpDate: newFollowUp || undefined },
    });
    if (newFollowUp) {
      updateMutation.mutate({ id: leadId, data: { followUpDate: newFollowUp } });
    }
  };

  const handleStatusChange = (status: string) => {
    if (!leadId) return;
    if (status === "closed_won") { setShowCloseWon(true); return; }
    updateMutation.mutate({ id: leadId, data: { status: status as Parameters<typeof updateMutation.mutate>[0]["data"]["status"] } });
  };

  const handleCloseWon = () => {
    if (!leadId || !revenue || !closingRemark) { toast.error("Revenue and remark required"); return; }
    closeMutation.mutate({ id: leadId, data: { revenueAmount: parseFloat(revenue), closingRemark, status: "closed_won" } });
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isMissed = lead?.followUpDate && new Date(lead.followUpDate) < today && !["closed_won", "closed_lost", "converted"].includes(lead?.status ?? "");

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn("absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}
        onClick={handleClose}
      />
      <div className={cn(
        "absolute right-0 top-0 h-full w-full max-w-[560px] bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out",
        visible ? "translate-x-0" : "translate-x-full"
      )}>
        {isLoading || !lead ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            <LeadColorBar status={lead.status} followUpDate={lead.followUpDate} />

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {lead.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground text-lg leading-tight truncate">{lead.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <StatusBadge status={lead.status} />
                    <PriorityBadge priority={lead.priority} />
                    {isMissed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <AlertCircle size={10} /> Missed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                <Link href={`/${isAdmin ? "admin" : "agent"}/leads/${lead.id}`}>
                  <button onClick={handleClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Open full detail">
                    <ExternalLink size={15} />
                  </button>
                </Link>
                <button onClick={handleClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Contact info */}
              <div className="px-5 py-4 border-b border-border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { icon: Phone, label: "Mobile", value: lead.mobile as string },
                    { icon: Phone, label: "Alternate", value: (lead.alternateMobile ?? "-") as string },
                    { icon: Mail, label: "Email", value: (lead.email ?? "-") as string },
                    { icon: Building2, label: "Company", value: (lead.company ?? "-") as string },
                    { icon: MapPin, label: "Location", value: ([lead.city, lead.state].filter(Boolean).join(", ") || "-") as string },
                    { icon: Clock, label: "Follow-up", value: formatDate(lead.followUpDate) as string },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-foreground font-medium text-xs">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {lead.status === "closed_won" && (
                  <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                      <DollarSign size={14} /> {formatCurrency(lead.revenueAmount)} — {lead.closingRemark}
                    </div>
                    <div className="text-xs text-emerald-600/70 mt-0.5">Closed {formatDate(lead.closingDate)}</div>
                  </div>
                )}

                {lead.source && (
                  <div className="mt-2">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Source: {lead.source}</span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-5 py-4 border-b border-border space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h3>

                {/* Call + WhatsApp buttons */}
                <div className="flex gap-2">
                  <a href={`tel:${lead.mobile}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                    <Phone size={14} /> Call
                  </a>
                  <a href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#22c55e] transition-colors">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                </div>

                {/* Status change */}
                {lead.status !== "closed_won" && lead.status !== "closed_lost" && (
                  <div className="relative">
                    <button onClick={() => setShowStatusMenu(p => !p)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors">
                      <span className="text-foreground">Change Status: <span className="font-medium">{STATUS_LABELS[lead.status]}</span></span>
                      <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", showStatusMenu && "rotate-180")} />
                    </button>
                    {showStatusMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                          <div className="grid grid-cols-2 gap-0.5 p-1">
                            {ALL_STATUSES.map(s => (
                              <button key={s} onClick={() => handleStatusChange(s)}
                                className={cn("px-2.5 py-1.5 text-xs rounded hover:bg-muted text-left transition-colors", lead.status === s && "bg-primary/10 text-primary font-medium")}>
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                          <div className="border-t border-border p-1">
                            <button onClick={() => handleStatusChange("closed_won")}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} /> Close Won
                            </button>
                            <button onClick={() => { if (!leadId) return; updateMutation.mutate({ id: leadId, data: { status: "closed_lost" } }); setShowStatusMenu(false); }}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
                              <XCircle size={12} /> Close Lost
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Agent assignment (admin only) */}
                {isAdmin && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Assigned Agent</label>
                    <select
                      value={lead.assignedAgentId?.toString() ?? ""}
                      onChange={e => { if (leadId && e.target.value) assignMutation.mutate({ id: leadId, data: { agentId: parseInt(e.target.value) } }); }}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Unassigned</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Add Note */}
              <div className="px-5 py-4 border-b border-border space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 size={12} /> Add Note
                </h3>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Write a note about this call or interaction..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2">
                  <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Outcome...</option>
                    {["Connected", "Not answered", "Busy", "Voicemail", "Wrong number"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input type="datetime-local" value={newFollowUp} onChange={e => setNewFollowUp(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save Note
                </button>
              </div>

              {/* Notes Timeline */}
              {lead.notes && lead.notes.length > 0 && (
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notes Timeline</h3>
                  <div className="space-y-3">
                    {lead.notes.slice(0, 6).map(note => (
                      <div key={note.id} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="bg-muted/60 rounded-lg p-2.5">
                            <div className="text-xs text-foreground leading-relaxed">{note.content}</div>
                            {note.callOutcome && <div className="text-xs text-muted-foreground mt-1">Outcome: {note.callOutcome}</div>}
                            {note.followUpDate && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1"><Clock size={10} /> Follow-up: {formatDateTime(note.followUpDate)}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="font-medium text-foreground">{note.agentName}</span>
                            · {timeAgo(note.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Call History */}
              {lead.calls && lead.calls.length > 0 && (
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Phone size={11} /> Call History
                  </h3>
                  <div className="space-y-2">
                    {lead.calls.slice(0, 4).map(call => (
                      <div key={call.id} className="flex items-start justify-between text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                        <div>
                          <div className="font-medium text-foreground">{call.agentName}</div>
                          <div className="text-muted-foreground">{formatDateTime(call.startedAt)}</div>
                          {call.outcome && <div className="text-foreground/70">{call.outcome}</div>}
                        </div>
                        {call.duration && <span className="text-muted-foreground">{Math.floor(call.duration / 60)}m {call.duration % 60}s</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activities */}
              {lead.activities && lead.activities.length > 0 && (
                <div className="px-5 py-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Log</h3>
                  <div className="space-y-2">
                    {lead.activities.slice(0, 5).map(act => (
                      <div key={act.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1 shrink-0" />
                        <div>
                          <div className="text-xs text-foreground">{act.description}</div>
                          <div className="text-xs text-muted-foreground">{act.agentName} · {timeAgo(act.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Close Won Modal */}
      {showCloseWon && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-sm p-5">
            <h2 className="font-bold text-foreground mb-4">Close Deal as Won</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Revenue ($) *</label>
                <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="50000"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Closing Remark *</label>
                <textarea value={closingRemark} onChange={e => setClosingRemark(e.target.value)} rows={2}
                  placeholder="Describe the deal..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCloseWon(false)} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleCloseWon} disabled={closeMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
                {closeMutation.isPending && <Loader2 size={13} className="animate-spin" />} Close Won
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
