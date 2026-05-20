import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  scheduleToastDismissal,
  TOAST_AUTO_DISMISS_MS,
  ToastNotification,
  type Toast
} from "../src/renderer/src/App";

type TimeoutHandle = ReturnType<typeof setTimeout>;
type PendingTimer = {
  id: number;
  callback: () => void;
  runAt: number;
  cleared: boolean;
};

const createFakeTimers = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, PendingTimer>();

  return {
    setTimeout(callback: () => void, delay: number): TimeoutHandle {
      const id = nextId++;
      timers.set(id, { id, callback, runAt: now + delay, cleared: false });
      return id as unknown as TimeoutHandle;
    },
    clearTimeout(timeoutId: TimeoutHandle): void {
      const timer = timers.get(Number(timeoutId));
      if (timer) timer.cleared = true;
    },
    advanceBy(duration: number): void {
      now += duration;
      const dueTimers = [...timers.values()]
        .filter((timer) => !timer.cleared && timer.runAt <= now)
        .sort((left, right) => left.runAt - right.runAt);
      for (const timer of dueTimers) {
        timer.cleared = true;
        timer.callback();
      }
    }
  };
};

test("toast notification renders a dedicated close button and preserves live-region roles", () => {
  const infoToast = { kind: "info", message: "Ticket update agent started: run_123" } satisfies Exclude<Toast, null>;
  const errorToast = { kind: "error", message: "Unable to start agent." } satisfies Exclude<Toast, null>;

  const infoElement = ToastNotification({
    toast: infoToast,
    onDismiss: () => undefined
  }) as ReactElement<{ onClick?: () => void }>;
  const infoMarkup = renderToStaticMarkup(infoElement);
  const errorMarkup = renderToStaticMarkup(<ToastNotification toast={errorToast} onDismiss={() => undefined} />);

  assert.equal(infoElement.type, "div");
  assert.equal(infoElement.props.onClick, undefined);
  assert.match(infoMarkup, /class="toast info"/);
  assert.match(infoMarkup, /role="status"/);
  assert.match(infoMarkup, /Dismiss notification/);
  assert.match(infoMarkup, /Ticket update agent started: run_123/);
  assert.match(errorMarkup, /role="alert"/);
  assert.match(errorMarkup, /Dismiss notification/);
});

test("toast dismissal schedules clearing after 5000 ms", () => {
  const timers = createFakeTimers();
  let dismissCount = 0;

  const timeoutId = scheduleToastDismissal(
    { kind: "success", message: "Ticket created." },
    () => {
      dismissCount += 1;
    },
    timers.setTimeout
  );

  assert.notEqual(timeoutId, null);
  timers.advanceBy(TOAST_AUTO_DISMISS_MS - 1);
  assert.equal(dismissCount, 0);
  timers.advanceBy(1);
  assert.equal(dismissCount, 1);
});

test("replacing a toast restarts the dismissal timer for a full new window", () => {
  const timers = createFakeTimers();
  const dismissals: string[] = [];

  const firstTimeoutId = scheduleToastDismissal(
    { kind: "info", message: "First toast" },
    () => {
      dismissals.push("first");
    },
    timers.setTimeout
  );
  assert.notEqual(firstTimeoutId, null);

  timers.advanceBy(3000);
  if (firstTimeoutId !== null) timers.clearTimeout(firstTimeoutId);

  const secondTimeoutId = scheduleToastDismissal(
    { kind: "success", message: "Second toast" },
    () => {
      dismissals.push("second");
    },
    timers.setTimeout
  );
  assert.notEqual(secondTimeoutId, null);

  timers.advanceBy(2000);
  assert.deepEqual(dismissals, []);
  timers.advanceBy(TOAST_AUTO_DISMISS_MS - 2000 - 1);
  assert.deepEqual(dismissals, []);
  timers.advanceBy(1);
  assert.deepEqual(dismissals, ["second"]);
});
