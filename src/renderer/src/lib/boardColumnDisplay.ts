import {
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NEEDS_CLARIFICATION_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_READY_STATUS,
  RELAY_REVIEW_STATUS
} from "@shared/schemas";
import { columnAcceptsBoardDrop, type BoardDragItem, type BoardDragSourceColumn } from "./boardDragDrop";

export const BOARD_MINIFIABLE_COLUMN_IDS = new Set<string>([
  RELAY_READY_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NEEDS_CLARIFICATION_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_NOT_DOING_STATUS
]);

export const isBoardMinifiableColumn = (columnId: string): boolean => BOARD_MINIFIABLE_COLUMN_IDS.has(columnId);

export const shouldMinifyBoardColumn = (
  columnId: string,
  ticketCount: number,
  options: { readonly dragging: boolean; readonly isDropTarget: boolean }
): boolean => {
  if (!isBoardMinifiableColumn(columnId)) return false;
  if (ticketCount > 0) return false;
  if (options.dragging && options.isDropTarget) return false;
  return true;
};

export const boardColumnAcceptsActiveDrag = (
  columnId: string,
  activeDrag: BoardDragItem | null,
  dragSourceColumn: BoardDragSourceColumn | null
): boolean => columnAcceptsBoardDrop(columnId, activeDrag, dragSourceColumn);

export const boardColumnGridTrack = (minified: boolean): string =>
  minified ? "var(--board-column-minified-width)" : "minmax(304px, 338px)";

export const boardColumnGridTemplateColumns = (tracks: readonly string[]): string => tracks.join(" ");
