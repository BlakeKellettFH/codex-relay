import type { CSSProperties } from "react";
import type { TicketSummary } from "@shared/schemas";

export type HierarchyVisual = {
  letter: string;
  color: string;
  backgroundColor: string;
};

export type HierarchyVisualRegistry = Map<string, HierarchyVisual>;

type HierarchyColorEntry = { color: string; backgroundColor: string };

/**
 * Fixed set of distinct hues ordered for maximum contrast on small boards:
 * red → blue → green → yellow first, then secondary shades (orange, turquoise, …).
 * Each color is assigned at most once across all epics and features until exhausted.
 */
export const HIERARCHY_COLOR_PALETTE: ReadonlyArray<HierarchyColorEntry> = [
  { color: "#ff6b6b", backgroundColor: "rgb(255 107 107 / 22%)" },
  { color: "#339af0", backgroundColor: "rgb(51 154 240 / 22%)" },
  { color: "#51cf66", backgroundColor: "rgb(81 207 102 / 22%)" },
  { color: "#fcc419", backgroundColor: "rgb(252 196 25 / 22%)" },
  { color: "#ff922b", backgroundColor: "rgb(255 146 43 / 22%)" },
  { color: "#22b8cf", backgroundColor: "rgb(34 184 207 / 22%)" },
  { color: "#845ef7", backgroundColor: "rgb(132 94 247 / 22%)" },
  { color: "#f06595", backgroundColor: "rgb(240 101 149 / 22%)" },
  { color: "#94d82d", backgroundColor: "rgb(148 216 45 / 22%)" },
  { color: "#5c7cfa", backgroundColor: "rgb(92 124 250 / 22%)" },
  { color: "#20c997", backgroundColor: "rgb(32 201 151 / 22%)" },
  { color: "#cc5de8", backgroundColor: "rgb(204 93 232 / 22%)" }
];

export const HIERARCHY_COLOR_PALETTE_SIZE = HIERARCHY_COLOR_PALETTE.length;

export const hierarchyColorAt = (colorIndex: number): HierarchyColorEntry | undefined =>
  HIERARCHY_COLOR_PALETTE[colorIndex % HIERARCHY_COLOR_PALETTE_SIZE];

export const indexToHierarchyLetter = (index: number): string => {
  if (index < 0) return "";
  let value = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (value % 26)) + letter;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return letter;
};

export const indexToHierarchyNumber = (index: number): string => {
  if (index < 0) return "";
  return String(index + 1);
};

const compareHierarchyTickets = (left: TicketSummary, right: TicketSummary): number => {
  const titleCompare = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  if (titleCompare !== 0) return titleCompare;
  return left.id.localeCompare(right.id);
};

const assignHierarchyVisuals = (
  registry: HierarchyVisualRegistry,
  tickets: TicketSummary[],
  markerForIndex: (index: number) => string,
  nextColorIndex: { value: number }
): void => {
  const sorted = [...tickets].sort(compareHierarchyTickets);
  sorted.forEach((ticket, markerIndex) => {
    const paletteEntry = hierarchyColorAt(nextColorIndex.value);
    nextColorIndex.value += 1;
    if (!paletteEntry) return;
    registry.set(ticket.id, {
      letter: markerForIndex(markerIndex),
      color: paletteEntry.color,
      backgroundColor: paletteEntry.backgroundColor
    });
  });
};

export const buildHierarchyVisualRegistry = (tickets: TicketSummary[]): HierarchyVisualRegistry => {
  const epics = tickets.filter((ticket) => ticket.ticketType === "epic");
  const features = tickets.filter((ticket) => ticket.ticketType === "feature");
  const registry: HierarchyVisualRegistry = new Map();
  const nextColorIndex = { value: 0 };

  assignHierarchyVisuals(registry, epics, indexToHierarchyNumber, nextColorIndex);
  assignHierarchyVisuals(registry, features, indexToHierarchyLetter, nextColorIndex);

  return registry;
};

export const getHierarchyVisual = (
  registry: HierarchyVisualRegistry,
  ticketId: string
): HierarchyVisual | undefined => registry.get(ticketId);

export const hierarchyMarkerCssVars = (marker?: HierarchyVisual): CSSProperties | undefined =>
  marker
    ? ({
        "--hierarchy-marker-color": marker.color
      } as CSSProperties)
    : undefined;
