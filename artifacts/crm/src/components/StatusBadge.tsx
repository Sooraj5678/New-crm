import { cn } from "@/lib/utils";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/utils";

const statusClass: Record<string, string> = {
  new: "status-new",
  interested: "status-interested",
  follow_up: "status-follow_up",
  not_interested: "status-not_interested",
  busy: "status-busy",
  callback_later: "status-callback_later",
  converted: "status-converted",
  closed_won: "status-closed_won",
  closed_lost: "status-closed_lost",
};

const priorityClass: Record<string, string> = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
  urgent: "priority-urgent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", statusClass[status] ?? "bg-gray-100 text-gray-600")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", priorityClass[priority] ?? "priority-medium")}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
