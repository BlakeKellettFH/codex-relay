import test from "node:test";
import assert from "node:assert/strict";
import {
  RELAY_COMPLETED_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_READY_STATUS,
  RELAY_TODO_STATUS
} from "../src/shared/schemas";
import {
  boardColumnGridTrack,
  isBoardMinifiableColumn,
  shouldMinifyBoardColumn
} from "../src/renderer/src/lib/boardColumnDisplay";

test("only workflow stage columns minify when empty", () => {
  assert.equal(isBoardMinifiableColumn(RELAY_READY_STATUS), true);
  assert.equal(isBoardMinifiableColumn(RELAY_IN_PROGRESS_STATUS), true);
  assert.equal(isBoardMinifiableColumn(RELAY_TODO_STATUS), false);
  assert.equal(isBoardMinifiableColumn(RELAY_COMPLETED_STATUS), false);
});

test("empty minifiable columns minify unless they are active drag drop targets", () => {
  assert.equal(
    shouldMinifyBoardColumn(RELAY_IN_PROGRESS_STATUS, 0, { dragging: false, isDropTarget: false }),
    true
  );
  assert.equal(
    shouldMinifyBoardColumn(RELAY_READY_STATUS, 0, { dragging: true, isDropTarget: true }),
    false
  );
  assert.equal(
    shouldMinifyBoardColumn(RELAY_NOT_DOING_STATUS, 0, { dragging: true, isDropTarget: true }),
    false
  );
  assert.equal(
    shouldMinifyBoardColumn(RELAY_READY_STATUS, 2, { dragging: false, isDropTarget: false }),
    false
  );
});

test("board column grid tracks switch between minified and full widths", () => {
  assert.equal(boardColumnGridTrack(true), "var(--board-column-minified-width)");
  assert.equal(boardColumnGridTrack(false), "minmax(304px, 338px)");
});
