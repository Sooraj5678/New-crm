import { useState, useMemo, useCallback } from "react";
import { useListLeads, useUpdateLead, useListUsers, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutList, Clock,
  Filter, X, AlertCircle, CheckCircle2, Calendar
} from "lucide-react";
import { cn, formatDate, formatDateTime, STATUS_LABELS, ALL_STATUSES, ALL_PRIORITIES, PRIORITY_LABELS } from "@/lib/utils";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { LeadDrawer } from "@/components/LeadDrawer";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function toKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TODAY = toKey(new Date());

function getMonthGridDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const days: Date[] = [];
  for (let i = startDay - 1; i >= 0; i--) days.push(new Date(year, month, -i));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  const rem = 42 - days.length;
  for (let i = 1; i <= rem; i++) days.push(new Date(year, month + 1, i));
  return days;
}

function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}

function viewRange(view: string, anchor: Date): { from: Date; to: Date } {
  if (view === "month") {
    return {
      from: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (view === "week") {
    const days = getWeekDays(anchor);
    const to = new Date(days[6]); to.setHours(23, 59, 59);
    return { from: days[0], to };
  }
  const from = new Date(anchor); from.setHours(0, 0, 0, 0);
  const to = new Date(anchor); to.setHours(23, 59, 59);
  return { from, to };
}

// ── Lead color/classification ────────────────────────────────────────────────
type LeadMeta = "missed" | "closed_won" | "closed_lost" | "urgent" | "high" | "upcoming";

function getLeadMeta(lead: { status: string; priority: string; followUpDate: string | null }): LeadMeta {
  if (lead.status === "closed_won") return "closed_won";
  if (lead.status === "closed_lost") return "closed_lost";
  if (lead.followUpDate) {
    const fp = new Date(lead.followUpDate); fp.setHours(0, 0, 0, 0);
    const tod = new Date(); tod.setHours(0, 0, 0, 0);
    if (fp < tod && !["closed_won", "closed_lost", "converted"].includes(lead.status)) return "missed";
  }
  if (lead.priority === "urgent") return "urgent";
  if (lead.priority === "high") return "high";
  return "upcoming";
}

const META_STYLES: Record<LeadMeta, { dot: string; badge: string; label: string }> = {
  missed:     { dot: "bg-red-500",     badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         label: "Missed" },
  closed_won: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Closed Won" },
  closed_lost:{ dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",         label: "Closed Lost" },
  urgent:     { dot: "bg-orange-500",  badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", label: "Urgent" },
  high:       { dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   label: "High Priority" },
  upcoming:   { dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",       label: "Upcoming" },
};

// ── Lead types ────────────────────────────────────────────────────────────────
type CalendarLead = {
  id: number;
  name: string;
  mobile: string;
  status: string;
  priority: string;
  followUpDate: string | null;
  assignedAgentName?: string | null;
};

// ── Lead card for date popup / week / day views ──────────────────────────────
interface LeadCardProps {
  lead: CalendarLead;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
}

function LeadCard({ lead, onClick, draggable, onDragStart, compact }: LeadCardProps) {
  const meta = getLeadMeta(lead);
  const styles = META_STYLES[meta];
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "group flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/60 cursor-pointer transition-all duration-150 select-none",
        compact ? "py-1.5" : "",
        draggable && "hover:shadow-md"
      )}
    >
      <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", styles.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground text-sm truncate">{lead.name}</span>
          {!compact && <StatusBadge status={lead.status} />}
        </div>
        {!compact && (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{lead.mobile}</span>
            {lead.assignedAgentName && <span>{lead.assignedAgentName}</span>}
            {lead.followUpDate && <span className="flex items-center gap-0.5"><Clock size={10} />{formatDateTime(lead.followUpDate)}</span>}
          </div>
        )}
        {compact && lead.followUpDate && (
          <div className="text-xs text-muted-foreground">{formatDateTime(lead.followUpDate).split(",")[1]?.trim()}</div>
        )}
      </div>
      {!compact && <PriorityBadge priority={lead.priority} />}
    </div>
  );
}

// ── Date Popup ───────────────────────────────────────────────────────────────
interface DatePopupProps {
  date: Date;
  leads: CalendarLead[];
  onClose: () => void;
  onSelectLead: (id: number) => void;
}

function DatePopup({ date, leads, onClose, onSelectLead }: DatePopupProps) {
  const key = toKey(date);
  const isToday = key === TODAY;
  const isMissedDay = new Date(date) < new Date(new Date().setHours(0, 0, 0, 0));

  const sorted = [...leads].sort((a, b) => {
    const order: Record<LeadMeta, number> = { missed: 0, urgent: 1, high: 2, upcoming: 3, closed_won: 4, closed_lost: 5 };
    return order[getLeadMeta(a)] - order[getLeadMeta(b)];
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-lg">
                {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              {isToday && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">Today</span>}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {leads.length} follow-up{leads.length !== 1 ? "s" : ""}
              {isMissedDay && leads.filter(l => getLeadMeta(l) === "missed").length > 0 && (
                <span className="ml-2 text-red-500 font-medium">
                  · {leads.filter(l => getLeadMeta(l) === "missed").length} missed
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No follow-ups for this date</div>
          ) : (
            sorted.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => { onSelectLead(lead.id); onClose(); }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Month View ───────────────────────────────────────────────────────────────
interface MonthViewProps {
  year: number;
  month: number;
  byDate: Record<string, CalendarLead[]>;
  onDateClick: (date: Date) => void;
  onLeadClick: (id: number) => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
  onDragStart: (e: React.DragEvent, lead: CalendarLead) => void;
}

function MonthView({ year, month, byDate, onDateClick, onLeadClick, onDrop, onDragStart }: MonthViewProps) {
  const days = getMonthGridDays(year, month);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 sticky top-0 z-10">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2.5">{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1">
        {days.map((day, i) => {
          const key = toKey(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = key === TODAY;
          const leads = byDate[key] ?? [];
          const missed = leads.filter(l => getLeadMeta(l) === "missed").length;
          const isDragTarget = dragOver === key;

          return (
            <div
              key={i}
              className={cn(
                "min-h-[110px] border-b border-r border-border p-1.5 transition-colors duration-150 relative group",
                !isCurrentMonth && "bg-muted/20",
                isToday && "bg-primary/5",
                isDragTarget && "bg-primary/10 border-primary/40",
                leads.length > 0 && isCurrentMonth && "hover:bg-muted/30 cursor-pointer"
              )}
              onClick={() => leads.length > 0 && onDateClick(day)}
              onDragOver={e => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { setDragOver(null); onDrop(e, day); }}
            >
              {/* Date number */}
              <div className="flex items-start justify-between mb-1">
                <span className={cn(
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  !isCurrentMonth && "opacity-40",
                  leads.length > 0 && isCurrentMonth && !isToday && "text-foreground group-hover:bg-muted"
                )}>
                  {day.getDate()}
                </span>
                {missed > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                    <AlertCircle size={10} />{missed}
                  </span>
                )}
              </div>

              {/* Lead dots / mini cards */}
              {leads.length > 0 && isCurrentMonth && (
                <div className="space-y-0.5">
                  {leads.slice(0, 3).map(lead => {
                    const meta = getLeadMeta(lead);
                    const styles = META_STYLES[meta];
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={e => { e.stopPropagation(); onDragStart(e, lead); }}
                        onClick={e => { e.stopPropagation(); onLeadClick(lead.id); }}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 transition-opacity",
                          styles.badge
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
                        <span className="truncate font-medium">{lead.name}</span>
                      </div>
                    );
                  })}
                  {leads.length > 3 && (
                    <button onClick={e => { e.stopPropagation(); onDateClick(day); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-1">
                      +{leads.length - 3} more
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ────────────────────────────────────────────────────────────────
interface WeekViewProps {
  anchor: Date;
  byDate: Record<string, CalendarLead[]>;
  onLeadClick: (id: number) => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
  onDragStart: (e: React.DragEvent, lead: CalendarLead) => void;
}

function WeekView({ anchor, byDate, onLeadClick, onDrop, onDragStart }: WeekViewProps) {
  const days = getWeekDays(anchor);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 sticky top-0 z-10">
        {days.map(day => {
          const key = toKey(day);
          const isToday = key === TODAY;
          return (
            <div key={key} className="text-center py-2.5 border-r border-border last:border-0">
              <div className="text-xs font-medium text-muted-foreground">{DAY_LABELS[days.indexOf(day)]}</div>
              <div className={cn("text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map(day => {
          const key = toKey(day);
          const leads = byDate[key] ?? [];
          const isDragTarget = dragOver === key;
          const isToday = key === TODAY;
          return (
            <div
              key={key}
              className={cn(
                "border-r border-border last:border-0 p-2 space-y-1.5 min-h-[400px] transition-colors",
                isToday && "bg-primary/5",
                isDragTarget && "bg-primary/10"
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { setDragOver(null); onDrop(e, day); }}
            >
              {leads.map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={e => onDragStart(e, lead)}
                  onClick={() => onLeadClick(lead.id)}
                >
                  <LeadCard lead={lead} onClick={() => onLeadClick(lead.id)} draggable compact />
                </div>
              ))}
              {leads.length === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground/40 pt-8">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day View ─────────────────────────────────────────────────────────────────
interface DayViewProps {
  anchor: Date;
  byDate: Record<string, CalendarLead[]>;
  onLeadClick: (id: number) => void;
}

function DayView({ anchor, byDate, onLeadClick }: DayViewProps) {
  const key = toKey(anchor);
  const leads = byDate[key] ?? [];
  const missed = leads.filter(l => getLeadMeta(l) === "missed");
  const upcoming = leads.filter(l => getLeadMeta(l) !== "missed");

  return (
    <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </h2>
        <div className="text-muted-foreground text-sm mt-1">{leads.length} follow-up{leads.length !== 1 ? "s" : ""} scheduled</div>
      </div>

      {missed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-3">
            <AlertCircle size={14} /> Missed Follow-ups ({missed.length})
          </h3>
          <div className="space-y-2">
            {missed.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} draggable={false} />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
            <Clock size={14} className="text-primary" /> Follow-ups ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} draggable={false} />
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Calendar size={40} className="mb-3 opacity-30" />
          <p className="font-medium">No follow-ups today</p>
          <p className="text-sm">Enjoy the free day!</p>
        </div>
      )}
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAgentId, setFilterAgentId] = useState("");
  const [filterMissed, setFilterMissed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: usersData } = useListUsers();
  const agents = (usersData ?? []).filter(u => u.role === "agent");

  const { from, to } = viewRange(view, anchor);

  const viewParams = {
    followUpFrom: from.toISOString(),
    followUpTo: to.toISOString(),
    limit: 500,
    ...(filterStatus && { status: filterStatus }),
    ...(filterPriority && { priority: filterPriority }),
    ...(filterAgentId && { agentId: parseInt(filterAgentId) }),
  };

  // Also fetch missed leads (past follow-ups not closed)
  const missedTo = new Date(); missedTo.setHours(0, 0, 0, 0); missedTo.setDate(missedTo.getDate() - 1);
  const missedParams = {
    followUpFrom: new Date(2020, 0, 1).toISOString(),
    followUpTo: missedTo.toISOString(),
    limit: 200,
    ...(filterAgentId && { agentId: parseInt(filterAgentId) }),
  };

  const { data: leadsData, isLoading } = useListLeads(viewParams);
  const { data: missedLeadsData } = useListLeads(missedParams);

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast.success("Follow-up rescheduled");
      },
      onError() { toast.error("Failed to reschedule"); },
    },
  });

  // Merge current view leads + missed leads (deduplicated)
  const allLeads = useMemo(() => {
    const map = new Map<number, (typeof leadsData)["leads"][0]>();
    (leadsData?.leads ?? []).forEach(l => map.set(l.id, l));
    (missedLeadsData?.leads ?? []).forEach(l => {
      if (!map.has(l.id) && !["closed_won", "closed_lost", "converted"].includes(l.status)) {
        map.set(l.id, l);
      }
    });
    return Array.from(map.values());
  }, [leadsData, missedLeadsData]);

  const filteredLeads = useMemo(() => {
    let leads = allLeads;
    if (filterMissed) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      leads = leads.filter(l => {
        if (!l.followUpDate) return false;
        const fp = new Date(l.followUpDate); fp.setHours(0, 0, 0, 0);
        return fp < today && !["closed_won", "closed_lost", "converted"].includes(l.status);
      });
    }
    return leads;
  }, [allLeads, filterMissed]);

  const byDate = useMemo(() => {
    const map: Record<string, typeof filteredLeads> = {};
    filteredLeads.forEach(lead => {
      if (lead.followUpDate) {
        const key = lead.followUpDate.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(lead);
      }
    });
    return map;
  }, [filteredLeads]);

  const navigate = useCallback((dir: number) => {
    const next = new Date(anchor);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setAnchor(next);
  }, [anchor, view]);

  const handleDragStart = (e: React.DragEvent, lead: { id: number }) => {
    e.dataTransfer.setData("leadId", String(lead.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    const leadId = parseInt(e.dataTransfer.getData("leadId"), 10);
    if (!leadId) return;
    const followUpDate = new Date(date); followUpDate.setHours(10, 0, 0, 0);
    updateMutation.mutate({ id: leadId, data: { followUpDate: followUpDate.toISOString() } });
  };

  // Missed count badge
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const missedCount = (missedLeadsData?.leads ?? []).filter(l =>
    l.followUpDate && !["closed_won", "closed_lost", "converted"].includes(l.status)
  ).length;

  const headerTitle = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (view === "week") {
      const days = getWeekDays(anchor);
      const s = days[0], e = days[6];
      if (s.getMonth() === e.getMonth()) return `${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`;
      return `${s.toLocaleDateString("en-US", { month: "short" })} – ${e.toLocaleDateString("en-US", { month: "short" })} ${e.getFullYear()}`;
    }
    return anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, anchor]);

  const hasFilters = !!(filterStatus || filterPriority || filterAgentId || filterMissed);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setAnchor(new Date())}
              className="px-3 py-1 rounded text-sm font-medium border border-border hover:bg-muted transition-colors">
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <h1 className="text-lg font-bold text-foreground hidden sm:block">{headerTitle}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Missed badge */}
          {missedCount > 0 && (
            <button
              onClick={() => setFilterMissed(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                filterMissed
                  ? "bg-red-500 text-white border-red-600"
                  : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 hover:bg-red-100"
              )}>
              <AlertCircle size={13} /> {missedCount} Missed
            </button>
          )}

          {/* View switcher */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 text-sm">
            {([["month", CalendarDays], ["week", LayoutList], ["day", Clock]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1.5 rounded-md flex items-center gap-1.5 capitalize transition-colors",
                  view === v ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
                <Icon size={14} /> <span className="hidden sm:inline">{v}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <button onClick={() => setShowFilters(p => !p)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors",
              hasFilters ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground")}>
            <Filter size={14} />
            <span className="hidden sm:inline">Filter</span>
            {hasFilters && <span className="w-4 h-4 rounded-full bg-white/20 text-xs flex items-center justify-center">{[filterStatus, filterPriority, filterAgentId, filterMissed].filter(Boolean).length}</span>}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-border bg-muted/30 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All Statuses</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All Priorities</option>
            {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
          {isAdmin && (
            <select value={filterAgentId} onChange={e => setFilterAgentId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">All Agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterAgentId(""); setFilterMissed(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X size={13} /> Clear
            </button>
          )}

          {/* Legend */}
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {([
              ["missed", "Missed"],
              ["closed_won", "Won"],
              ["urgent", "Urgent"],
              ["high", "High"],
              ["upcoming", "Upcoming"],
            ] as [LeadMeta, string][]).map(([meta, label]) => (
              <div key={meta} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn("w-2.5 h-2.5 rounded-full", META_STYLES[meta].dot)} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading calendar...</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === "month" && (
            <MonthView
              year={anchor.getFullYear()}
              month={anchor.getMonth()}
              byDate={byDate}
              onDateClick={setSelectedDate}
              onLeadClick={setSelectedLeadId}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
            />
          )}
          {view === "week" && (
            <WeekView
              anchor={anchor}
              byDate={byDate}
              onLeadClick={setSelectedLeadId}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
            />
          )}
          {view === "day" && (
            <DayView
              anchor={anchor}
              byDate={byDate}
              onLeadClick={setSelectedLeadId}
            />
          )}
        </div>
      )}

      {/* Date popup */}
      {selectedDate && (
        <DatePopup
          date={selectedDate}
          leads={byDate[toKey(selectedDate)] ?? []}
          onClose={() => setSelectedDate(null)}
          onSelectLead={id => { setSelectedLeadId(id); setSelectedDate(null); }}
        />
      )}

      {/* Lead drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
