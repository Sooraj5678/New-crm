import { useState, useEffect, useRef, useCallback } from "react";
import { useUpdateLead, useAddLeadNote, useLogLeadCall, useCreateDialerSession, useEndDialerSession } from "@workspace/api-client-react";
import {
  Phone, PhoneOff, SkipForward, CheckCircle2, Clock,
  Mail, Building2, MapPin, Loader2, MessageCircle, PhoneCall,
  TrendingUp, DollarSign, RefreshCw,
  ChevronRight, Target, Award, Zap, Play, Briefcase, UserCog,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { formatDate, STATUS_LABELS, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { customFetch, ApiError } from "@workspace/api-client-react";

const STATUSES = ["new", "interested", "follow_up", "not_interested", "busy", "callback_later"];
const OUTCOMES = ["Connected", "Not answered", "Busy", "Voicemail", "Wrong number", "Switched off"];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

interface SessionStats {
  totalCalls: number;
  connectedCalls: number;
  followUpsScheduled: number;
  dealsWon: number;
  revenueGenerated: number;
}

interface DialerLead {
  id: number;
  name: string;
  mobile: string;
  alternateMobile?: string | null;
  email?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  status: string;
  priority: string;
  followUpDate?: string | null;
  partnerName?: string | null;
  accountManagerName?: string | null;
  notes?: Array<{ id: number; content: string; callOutcome?: string | null; agentName: string; createdAt: string }>;
}

async function fetchNextLead(excludeIds: number[]): Promise<{ exhausted: boolean; remainingCount?: number; lead?: DialerLead }> {
  const exclude = excludeIds.length > 0 ? `?exclude=${excludeIds.join(",")}` : "";
  return customFetch<{ exhausted: boolean; remainingCount?: number; lead?: DialerLead }>(`/api/leads/next-dialer${exclude}`);
}

function useCallTimer(callStart: Date | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!callStart) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - callStart.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [callStart]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

type DialerView = "start" | "calling" | "exhausted";

export default function Dialer() {
  const [view, setView] = useState<DialerView>("start");
  const [lead, setLead] = useState<DialerLead | null>(null);
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [loadingLead, setLoadingLead] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [calledLeadIds, setCalledLeadIds] = useState<number[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalCalls: 0, connectedCalls: 0, followUpsScheduled: 0, dealsWon: 0, revenueGenerated: 0,
  });
  const [dbSessionId, setDbSessionId] = useState<number | null>(null);
  const [callStart, setCallStart] = useState<Date | null>(null);
  const callStartRef = useRef<Date | null>(null);
  const [postCallOpen, setPostCallOpen] = useState(false);
  const [note, setNote] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [priority, setPriority] = useState("");
  const [revenue, setRevenue] = useState("");
  const [closingRemark, setClosingRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateLead = useUpdateLead();
  const addNote = useAddLeadNote();
  const logCall = useLogLeadCall();
  const createSessionMutation = useCreateDialerSession();
  const endSessionMutation = useEndDialerSession();
  const timerDisplay = useCallTimer(callStart);

  const loadNextLead = useCallback(async (excludeIds: number[]): Promise<boolean> => {
    setLoadingLead(true);
    try {
      const data = await fetchNextLead(excludeIds);
      if (data.exhausted || !data.lead) {
        setLead(null); setRemainingCount(0);
        return false;
      }
      setLead(data.lead);
      setRemainingCount(data.remainingCount ?? 0);
      return true;
    } catch {
      toast.error("Failed to load next lead");
      return false;
    } finally {
      setLoadingLead(false);
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => { if (callStartRef.current) setTimeout(() => setPostCallOpen(true), 300); };
    const handleVisibility = () => { if (!document.hidden && callStartRef.current) setTimeout(() => setPostCallOpen(true), 400); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleStartDialer = async () => {
    setLoadingLead(true);
    try {
      const session = await createSessionMutation.mutateAsync();
      setDbSessionId(session.id);
      const data = await fetchNextLead([]);
      if (data.exhausted || !data.lead) { setView("exhausted"); return; }
      setLead(data.lead);
      setRemainingCount(data.remainingCount ?? 0);
      setView("calling");
      const phone = normalizePhone(data.lead.mobile);
      window.location.href = `tel:${phone}`;
      const start = new Date();
      setCallStart(start); callStartRef.current = start;
      setSessionStats(s => ({ ...s, totalCalls: s.totalCalls + 1 }));
      logCall.mutate({ id: data.lead.id, data: { startedAt: start.toISOString(), sessionId: session.id } });
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.data as { error?: string } | null)?.error ?? err.message
        : err instanceof Error ? err.message : "Failed to start dialer";
      toast.error(msg);
    } finally {
      setLoadingLead(false);
    }
  };

  const handleCallNow = () => {
    if (!lead) return;
    const start = new Date();
    setCallStart(start); callStartRef.current = start;
    setSessionStats(s => ({ ...s, totalCalls: s.totalCalls + 1 }));
    const phone = normalizePhone(lead.mobile);
    window.location.href = `tel:${phone}`;
    logCall.mutate({ id: lead.id, data: { startedAt: start.toISOString(), sessionId: dbSessionId ?? undefined } });
  };

  const openWhatsApp = () => {
    if (!lead) return;
    const phone = normalizePhone(lead.mobile).replace("+", "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const handleSkip = async () => {
    if (!lead) return;
    const newExclude = [...calledLeadIds, lead.id];
    setCalledLeadIds(newExclude);
    resetCallForm(); setPostCallOpen(false);
    toast.info("Lead skipped");
    const hasMore = await loadNextLead(newExclude);
    if (!hasMore) setView("exhausted");
  };

  const handleNextLead = async () => {
    const hasMore = await loadNextLead(calledLeadIds);
    if (!hasMore) setView("exhausted");
  };

  const resetCallForm = () => {
    setNote(""); setCallOutcome(""); setNewStatus("");
    setFollowUpDate(""); setPriority(""); setRevenue(""); setClosingRemark("");
    setCallStart(null); callStartRef.current = null;
  };

  const saveCall = async (shouldEndSession = false) => {
    if (!lead) return;
    if (!callOutcome && !note && !newStatus) {
      toast.error("Please fill at least one field — outcome, note, or status");
      return;
    }
    setSubmitting(true);
    try {
      const endedAt = new Date().toISOString();
      const duration = callStart ? Math.floor((Date.now() - callStart.getTime()) / 1000) : undefined;

      if (note || callOutcome) {
        await addNote.mutateAsync({
          id: lead.id,
          data: { content: note || `Call outcome: ${callOutcome}`, callOutcome: callOutcome || undefined, followUpDate: followUpDate || undefined },
        });
      }

      const isClosedWon = newStatus === "closed_won";
      if (isClosedWon) {
        if (!revenue || !closingRemark) {
          toast.error("Revenue and closing remark required for Closed Won");
          setSubmitting(false); return;
        }
        await updateLead.mutateAsync({
          id: lead.id,
          data: { status: "closed_won", revenueAmount: Number(revenue), closingRemark } as Parameters<typeof updateLead.mutateAsync>[0]["data"],
        });
      } else {
        const updates: Record<string, unknown> = {};
        if (newStatus) updates.status = newStatus;
        if (priority) updates.priority = priority;
        if (followUpDate) updates.followUpDate = followUpDate;
        if (Object.keys(updates).length > 0) {
          await updateLead.mutateAsync({ id: lead.id, data: updates as Parameters<typeof updateLead.mutateAsync>[0]["data"] });
        }
      }

      if (callStart) {
        await logCall.mutateAsync({
          id: lead.id,
          data: { startedAt: callStart.toISOString(), endedAt, duration, outcome: callOutcome || undefined, notes: note || undefined, sessionId: dbSessionId ?? undefined },
        });
      }

      const connected = callOutcome === "Connected";
      const hasFollowUp = !!followUpDate;
      const nextStats: SessionStats = {
        ...sessionStats,
        dealsWon: isClosedWon ? sessionStats.dealsWon + 1 : sessionStats.dealsWon,
        revenueGenerated: isClosedWon ? sessionStats.revenueGenerated + Number(revenue) : sessionStats.revenueGenerated,
        connectedCalls: connected ? sessionStats.connectedCalls + 1 : sessionStats.connectedCalls,
        followUpsScheduled: hasFollowUp ? sessionStats.followUpsScheduled + 1 : sessionStats.followUpsScheduled,
      };
      setSessionStats(nextStats);

      const newExclude = [...calledLeadIds, lead.id];
      setCalledLeadIds(newExclude);
      resetCallForm(); setPostCallOpen(false);

      if (shouldEndSession) {
        if (dbSessionId) endSessionMutation.mutate({ id: dbSessionId, data: nextStats });
        setSessionEnded(true); setView("exhausted");
        return;
      }

      toast.success("Saved! Loading next lead...");
      const hasMore = await loadNextLead(newExclude);
      if (!hasMore) setView("exhausted");
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.data as { error?: string } | null)?.error ?? err.message
        : err instanceof Error ? err.message : "Failed to save call";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (view === "start") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="w-24 h-24 rounded-3xl bg-green-600/10 flex items-center justify-center mb-6">
          <PhoneCall size={44} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Auto Dialer</h1>
        <p className="text-muted-foreground text-sm max-w-xs mb-8">
          Start your calling session. The system will automatically open the phone dialer for each lead and track your calls.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <button onClick={handleStartDialer} disabled={loadingLead}
            className="flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-5 rounded-2xl font-bold text-lg transition-colors touch-manipulation disabled:opacity-60">
            {loadingLead ? <Loader2 size={22} className="animate-spin" /> : <Play size={22} fill="white" />}
            {loadingLead ? "Loading..." : "Start Auto Dialer"}
          </button>
          <p className="text-xs text-muted-foreground">Tapping Start will immediately open your phone dialer for the first lead</p>
        </div>
      </div>
    );
  }

  if (loadingLead && !lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading next lead...</span>
      </div>
    );
  }

  if (view === "exhausted") {
    return (
      <ExhaustedScreen
        stats={sessionStats}
        sessionEnded={sessionEnded}
        onRefresh={() => {
          setView("start"); setSessionEnded(false); setCalledLeadIds([]);
          setSessionStats({ totalCalls: 0, connectedCalls: 0, followUpsScheduled: 0, dealsWon: 0, revenueGenerated: 0 });
        }}
        onRequestMore={() => toast.info("Request sent to admin")}
      />
    );
  }

  if (!lead) return null;

  return (
    <div className="pb-6 max-w-2xl mx-auto">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Zap size={18} className="text-primary" /> Auto Dialer
        </h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">{remainingCount} left</span>
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{sessionStats.totalCalls} called</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Lead card */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                {lead.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{lead.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <StatusBadge status={lead.status} />
                  <PriorityBadge priority={lead.priority} />
                </div>
              </div>
              {callStart && (
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400">{timerDisplay}</span>
                </div>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2.5 text-sm mb-3">
              {[
                { icon: Phone, label: "Mobile", value: lead.mobile },
                { icon: Phone, label: "Alt.", value: lead.alternateMobile || "-" },
                { icon: Mail, label: "Email", value: lead.email || "-" },
                { icon: Building2, label: "Company", value: lead.company || "-" },
                { icon: MapPin, label: "City", value: [lead.city, lead.state].filter(Boolean).join(", ") || "-" },
                { icon: Clock, label: "Follow-up", value: formatDate(lead.followUpDate) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-foreground font-medium truncate">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Partner & AM info */}
            {(lead.partnerName || lead.accountManagerName) && (
              <div className="grid grid-cols-2 gap-2.5 mb-4 p-3 bg-primary/5 rounded-xl">
                {lead.partnerName && (
                  <div className="flex items-start gap-2">
                    <Briefcase size={13} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Partner</div>
                      <div className="text-sm font-semibold text-foreground truncate">{lead.partnerName}</div>
                    </div>
                  </div>
                )}
                {lead.accountManagerName && (
                  <div className="flex items-start gap-2">
                    <UserCog size={13} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Account Manager</div>
                      <div className="text-sm font-semibold text-foreground truncate">{lead.accountManagerName}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button onClick={handleCallNow}
                className="flex items-center justify-center gap-2.5 w-full bg-green-600 active:bg-green-800 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg transition-colors touch-manipulation select-none">
                <PhoneCall size={22} />
                {callStart ? "Call Again" : `Call ${lead.name.split(" ")[0]}`}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={openWhatsApp}
                  className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b858] active:bg-[#1a9e4a] text-white py-3 rounded-xl font-semibold text-sm transition-colors touch-manipulation">
                  <MessageCircle size={18} /> WhatsApp
                </button>
                <button onClick={() => setPostCallOpen(true)}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors touch-manipulation ${callStart ? "border-2 border-primary text-primary hover:bg-primary/5" : "border border-border text-foreground hover:bg-muted"}`}>
                  <CheckCircle2 size={18} />
                  {callStart ? "Log Call" : "Log Result"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleSkip}
                  className="flex items-center justify-center gap-2 w-full border border-border text-muted-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-colors touch-manipulation">
                  <SkipForward size={16} /> Skip Lead
                </button>
                <button onClick={handleNextLead} disabled={loadingLead}
                  className="flex items-center justify-center gap-2 w-full border border-border text-muted-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-colors touch-manipulation disabled:opacity-50">
                  {loadingLead ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={16} />}
                  Next Lead
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Previous notes */}
        {lead.notes && lead.notes.length > 0 && (
          <div className="bg-card border border-card-border rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Previous Notes</h3>
            <div className="space-y-2.5">
              {lead.notes.slice(0, 3).map(n => (
                <div key={n.id} className="border-l-2 border-primary/30 pl-3">
                  <div className="text-sm text-foreground">{n.content}</div>
                  {n.callOutcome && <span className="text-xs text-primary font-medium">{n.callOutcome}</span>}
                  <div className="text-xs text-muted-foreground mt-0.5">{n.agentName} · {timeAgo(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Post-call popup */}
      {postCallOpen && (
        <PostCallPopup
          lead={lead} callStart={callStart} timerDisplay={timerDisplay}
          note={note} setNote={setNote}
          callOutcome={callOutcome} setCallOutcome={setCallOutcome}
          newStatus={newStatus} setNewStatus={setNewStatus}
          followUpDate={followUpDate} setFollowUpDate={setFollowUpDate}
          priority={priority} setPriority={setPriority}
          revenue={revenue} setRevenue={setRevenue}
          closingRemark={closingRemark} setClosingRemark={setClosingRemark}
          submitting={submitting}
          onSaveNext={() => saveCall(false)}
          onSaveEnd={() => saveCall(true)}
          onClose={() => setPostCallOpen(false)}
        />
      )}
    </div>
  );
}

interface PostCallProps {
  lead: DialerLead;
  callStart: Date | null;
  timerDisplay: string;
  note: string; setNote: (v: string) => void;
  callOutcome: string; setCallOutcome: (v: string) => void;
  newStatus: string; setNewStatus: (v: string) => void;
  followUpDate: string; setFollowUpDate: (v: string) => void;
  priority: string; setPriority: (v: string) => void;
  revenue: string; setRevenue: (v: string) => void;
  closingRemark: string; setClosingRemark: (v: string) => void;
  submitting: boolean;
  onSaveNext: () => void;
  onSaveEnd: () => void;
  onClose: () => void;
}

function PostCallPopup(p: PostCallProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-card border border-card-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 pt-4 pb-3 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-foreground text-lg">Log This Call</h2>
            <p className="text-sm text-muted-foreground">{p.lead.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {p.callStart && (
              <span className="font-mono text-green-600 dark:text-green-400 font-bold">{p.timerDisplay}</span>
            )}
            <button onClick={p.onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
              <PhoneOff size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Partner / AM info strip */}
        {(p.lead.partnerName || p.lead.accountManagerName) && (
          <div className="mx-5 mt-4 flex gap-4 p-3 bg-primary/5 rounded-xl">
            {p.lead.partnerName && (
              <div className="flex items-center gap-1.5 text-xs">
                <Briefcase size={12} className="text-primary" />
                <span className="text-muted-foreground">Partner:</span>
                <span className="font-semibold text-foreground">{p.lead.partnerName}</span>
              </div>
            )}
            {p.lead.accountManagerName && (
              <div className="flex items-center gap-1.5 text-xs">
                <UserCog size={12} className="text-primary" />
                <span className="text-muted-foreground">AM:</span>
                <span className="font-semibold text-foreground">{p.lead.accountManagerName}</span>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          {/* Call Outcome */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Call Outcome</label>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map(o => (
                <button key={o} type="button" onClick={() => p.setCallOutcome(o === p.callOutcome ? "" : o)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors touch-manipulation ${p.callOutcome === o ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Update Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button key={s} type="button" onClick={() => p.setNewStatus(s === p.newStatus ? "" : s)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors touch-manipulation ${p.newStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
                  {STATUS_LABELS[s] ?? s}
                </button>
              ))}
              <button type="button" onClick={() => p.setNewStatus(p.newStatus === "closed_won" ? "" : "closed_won")}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors touch-manipulation ${p.newStatus === "closed_won" ? "bg-green-600 text-white border-green-600" : "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}>
                ✓ Closed Won
              </button>
            </div>
          </div>

          {/* Closed Won fields */}
          {p.newStatus === "closed_won" && (
            <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800">
              <div>
                <label className="block text-xs font-semibold text-green-800 dark:text-green-300 mb-1.5">Revenue Amount ($) *</label>
                <input type="number" value={p.revenue} onChange={e => p.setRevenue(e.target.value)} placeholder="50000"
                  className="w-full px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-green-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-green-800 dark:text-green-300 mb-1.5">Closing Remark *</label>
                <textarea value={p.closingRemark} onChange={e => p.setClosingRemark(e.target.value)} rows={2}
                  placeholder="Describe the deal..."
                  className="w-full px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-green-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
          )}

          {/* Follow-up */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Follow-up Date</label>
            <input type="datetime-local" value={p.followUpDate} onChange={e => p.setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Note</label>
            <textarea value={p.note} onChange={e => p.setNote(e.target.value)} rows={3} placeholder="Add a note about this call..."
              className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2 pb-safe">
            <button onClick={p.onSaveEnd} disabled={p.submitting}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-destructive text-destructive font-semibold text-sm hover:bg-destructive/5 disabled:opacity-50 transition-colors touch-manipulation">
              {p.submitting ? <Loader2 size={16} className="animate-spin" /> : <PhoneOff size={16} />}
              Save & End
            </button>
            <button onClick={p.onSaveNext} disabled={p.submitting}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors touch-manipulation">
              {p.submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Save & Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExhaustedScreen({ stats, sessionEnded, onRefresh, onRequestMore }: {
  stats: SessionStats; sessionEnded: boolean; onRefresh: () => void; onRequestMore: () => void;
}) {
  const noLeadsAssigned = !sessionEnded && stats.totalCalls === 0;
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
        {sessionEnded ? <Award size={44} className="text-primary" /> : noLeadsAssigned ? <UserCog size={44} className="text-primary" /> : <Target size={44} className="text-primary" />}
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {sessionEnded ? "Session Complete!" : noLeadsAssigned ? "No Leads Assigned" : "Queue Exhausted"}
      </h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-xs">
        {sessionEnded
          ? "Great work! You've ended your calling session."
          : noLeadsAssigned
          ? "You don't have any leads assigned yet. Ask your admin to assign leads to you before starting the dialer."
          : "You've reached the end of your lead queue."}
      </p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
        {[
          { icon: Phone, label: "Total Calls", value: stats.totalCalls },
          { icon: CheckCircle2, label: "Connected", value: stats.connectedCalls },
          { icon: Clock, label: "Follow-ups", value: stats.followUpsScheduled },
          { icon: DollarSign, label: "Deals Won", value: stats.dealsWon },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card border border-card-border rounded-2xl p-4 text-center">
            <Icon size={20} className="text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {stats.revenueGenerated > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-6 py-4 mb-6 w-full max-w-xs">
          <TrendingUp size={20} className="text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            ${stats.revenueGenerated.toLocaleString()}
          </div>
          <div className="text-xs text-green-600 dark:text-green-500">Revenue Generated</div>
        </div>
      )}

      <div className="w-full max-w-xs space-y-3">
        <button onClick={onRefresh}
          className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base transition-colors">
          <RefreshCw size={20} /> Start New Session
        </button>
        <button onClick={onRequestMore}
          className="flex items-center justify-center gap-2 w-full border border-border text-foreground py-3.5 rounded-2xl font-semibold text-sm hover:bg-muted transition-colors">
          Request More Leads
        </button>
      </div>
    </div>
  );
}
