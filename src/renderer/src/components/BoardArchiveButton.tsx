import { Archive } from "lucide-react";
import type { MouseEvent, ReactElement } from "react";
import { Button } from "./ui";

const ARCHIVE_ICON_SIZE = 12;

export function BoardArchiveButton({
  label,
  onArchive,
  busy = false
}: {
  label: string;
  onArchive: () => void;
  busy?: boolean;
}): ReactElement {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onArchive();
  };

  return (
    <Button
      type="button"
      className="board-archive-button board-drag-marker board-drag-marker-task"
      onClick={handleClick}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={busy}
      aria-label={label}
      title="Archive"
    >
      <Archive size={ARCHIVE_ICON_SIZE} strokeWidth={2.25} aria-hidden="true" />
    </Button>
  );
}
