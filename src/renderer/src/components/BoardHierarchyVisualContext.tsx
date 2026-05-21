import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import type { TicketSummary } from "@shared/schemas";
import {
  buildHierarchyVisualRegistry,
  getHierarchyVisual,
  type HierarchyVisual,
  type HierarchyVisualRegistry
} from "../lib/boardHierarchyVisuals";

const BoardHierarchyVisualContext = createContext<HierarchyVisualRegistry>(new Map());

export function BoardHierarchyVisualProvider({
  tickets,
  children
}: {
  tickets: TicketSummary[];
  children: ReactNode;
}): ReactElement {
  const registry = useMemo(() => buildHierarchyVisualRegistry(tickets), [tickets]);

  return <BoardHierarchyVisualContext.Provider value={registry}>{children}</BoardHierarchyVisualContext.Provider>;
}

export function useBoardHierarchyVisual(ticketId: string): HierarchyVisual | undefined {
  const registry = useContext(BoardHierarchyVisualContext);
  return getHierarchyVisual(registry, ticketId);
}
