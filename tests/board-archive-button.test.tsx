import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardArchiveButton } from "../src/renderer/src/components/BoardArchiveButton";
import { HierarchyBoardGroupTrigger } from "../src/renderer/src/components/HierarchyBoardGroupTrigger";

test("hierarchy group trigger places archive control above expand for containers", () => {
  const markup = renderToStaticMarkup(
    <HierarchyBoardGroupTrigger
      triggerClassName="feature-board-group-trigger"
      marker={{ letter: "A", color: "#339af0", backgroundColor: "rgb(51 154 240 / 22%)" }}
      title="Auth"
      meta="1 task"
      labels={[]}
      expanded={false}
      onToggle={() => undefined}
      onOpen={() => undefined}
      openAriaLabel="Open feature"
      openTitle="Open feature"
      expandAriaLabel="Expand"
      collapseAriaLabel="Collapse"
      showArchive
      onArchive={() => undefined}
    />
  );

  const archiveIndex = markup.indexOf("board-archive-button");
  const expandIndex = markup.indexOf("hierarchy-board-group-expand");
  assert.ok(archiveIndex >= 0 && expandIndex >= 0);
  assert.ok(archiveIndex < expandIndex);
  assert.match(markup, /Archive Auth and child tickets/);
});

test("board archive button component exposes archive label", () => {
  const markup = renderToStaticMarkup(<BoardArchiveButton label="Archive Auth and child tickets" onArchive={() => undefined} />);
  assert.match(markup, /title="Archive"/);
  assert.match(markup, /Archive Auth and child tickets/);
});
