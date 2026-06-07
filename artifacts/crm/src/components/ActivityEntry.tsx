import { timeAgo, formatDateTime } from "@/lib/utils";
import { Phone, Plus, Pencil, Trash2, UserCheck, PhoneCall, FileText, Trophy, Upload, Users } from "lucide-react";

type ChangeValue = string | number | boolean | null | undefined;
interface FieldChange { from: ChangeValue; to: ChangeValue; }

export interface ActivityItem {
  id: number;
  type: string;
  description: string;
  phone?: string | null;
  changes?: Record<string, FieldChange> | null;
  agentName?: string;
  createdAt: string;
  leadName?: string | null;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lead_created:        { label: "Added Contact",     icon: Plus,       color: "text-emerald-500 bg-emerald-500/10" },
  lead_edited:         { label: "Edited Contact",    icon: Pencil,     color: "text-blue-500 bg-blue-500/10" },
  lead_deleted:        { label: "Deleted Contact",   icon: Trash2,     color: "text-red-500 bg-red-500/10" },
  lead_assigned:       { label: "Assigned Contact",  icon: UserCheck,  color: "text-violet-500 bg-violet-500/10" },
  lead_reassigned:     { label: "Reassigned Contact",icon: UserCheck,  color: "text-violet-500 bg-violet-500/10" },
  status_changed:      { label: "Status Changed",    icon: Pencil,     color: "text-amber-500 bg-amber-500/10" },
  call_logged:         { label: "Call Logged",       icon: PhoneCall,  color: "text-sky-500 bg-sky-500/10" },
  note_added:          { label: "Note Added",        icon: FileText,   color: "text-slate-500 bg-slate-500/10" },
  deal_closed:         { label: "Deal Closed",       icon: Trophy,     color: "text-yellow-500 bg-yellow-500/10" },
  leads_bulk_assigned: { label: "Bulk Assigned",     icon: Users,      color: "text-violet-500 bg-violet-500/10" },
  leads_bulk_deleted:  { label: "Bulk Deleted",      icon: Trash2,     color: "text-red-500 bg-red-500/10" },
  leads_imported:      { label: "Leads Imported",    icon: Upload,     color: "text-teal-500 bg-teal-500/10" },
};

function renderChangeValue(v: ChangeValue): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

interface ActivityEntryProps {
  act: ActivityItem;
  showAgent?: boolean;
  compact?: boolean;
}

export function ActivityEntry({ act, showAgent = true, compact = false }: ActivityEntryProps) {
  const meta = TYPE_META[act.type] ?? { label: act.type, icon: FileText, color: "text-muted-foreground bg-muted" };
  const Icon = meta.icon;
  const changes = act.changes as Record<string, FieldChange> | null | undefined;
  const hasChanges = changes && Object.keys(changes).length > 0;

  return (
    <div className="flex items-start gap-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{meta.label}</span>
          {act.leadName && (
            <span className="text-xs text-muted-foreground">· {act.leadName}</span>
          )}
        </div>

        {act.phone && (
          <div className="flex items-center gap-1 mt-0.5">
            <Phone size={10} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground font-mono">{act.phone}</span>
          </div>
        )}

        {hasChanges && !compact && (
          <div className="mt-1.5 space-y-0.5">
            {Object.entries(changes!).map(([field, change]) => {
              const hasFrom = change.from !== null && change.from !== undefined && change.from !== "";
              const hasTo = change.to !== null && change.to !== undefined && change.to !== "";
              if (!hasFrom && !hasTo) return null;
              return (
                <div key={field} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground/70 font-medium">{field}:</span>{" "}
                  {hasFrom && (
                    <>
                      <span className="line-through text-red-400/80">{renderChangeValue(change.from)}</span>
                      {" → "}
                    </>
                  )}
                  <span className="text-emerald-600 dark:text-emerald-400">{renderChangeValue(change.to)}</span>
                </div>
              );
            })}
          </div>
        )}

        {hasChanges && compact && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {Object.entries(changes!).map(([field, change]) => {
              const hasFrom = change.from !== null && change.from !== undefined && change.from !== "";
              return hasFrom
                ? `${field}: ${renderChangeValue(change.from)} → ${renderChangeValue(change.to)}`
                : `${field}: ${renderChangeValue(change.to)}`;
            }).join(" · ")}
          </div>
        )}

        {!hasChanges && (
          <div className="text-xs text-muted-foreground mt-0.5">{act.description}</div>
        )}

        <div className="text-xs text-muted-foreground/60 mt-0.5">
          {showAgent && act.agentName && <span>{act.agentName} · </span>}
          <span title={formatDateTime(act.createdAt)}>{timeAgo(act.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
