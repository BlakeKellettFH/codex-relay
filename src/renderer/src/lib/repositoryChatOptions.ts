import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronUp,
  Gauge,
  Layers,
  LayoutGrid,
  Minus,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import type { CursorAgentModel, TicketEffort, TicketPriority } from "@shared/schemas";
import type { RepositoryChatOption } from "../components/RepositoryChatOptionMenu";

export type RepositoryChatDraftType = "epic" | "feature";

const priorityLabel = (priority: TicketPriority): string =>
  priority === "urgent" ? "Urgent" : `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;

const priorityIcon = (priority: TicketPriority): LucideIcon => {
  switch (priority) {
    case "low":
      return ArrowDown;
    case "medium":
      return Minus;
    case "high":
      return ArrowUp;
    case "urgent":
      return AlertTriangle;
  }
};

export const repositoryChatDraftTypeOptions: readonly RepositoryChatOption<RepositoryChatDraftType>[] = [
  { value: "epic", label: "Epic", icon: Layers },
  { value: "feature", label: "Feature", icon: LayoutGrid }
];

export const repositoryChatPriorityOptions: readonly RepositoryChatOption<TicketPriority>[] = (
  ["low", "medium", "high", "urgent"] as const
).map((priority) => ({
  value: priority,
  label: priorityLabel(priority),
  icon: priorityIcon(priority)
}));

export const repositoryChatEffortOptions: readonly RepositoryChatOption<TicketEffort>[] = [
  { value: "low", label: "Low", icon: ArrowDown },
  { value: "medium", label: "Medium", icon: Gauge },
  { value: "high", label: "High", icon: ChevronUp },
  { value: "xhigh", label: "Extra High", icon: AlertTriangle }
];

export const repositoryChatModelOptions: readonly RepositoryChatOption<CursorAgentModel>[] = [
  { value: "auto", label: "Auto", icon: Sparkles }
];
