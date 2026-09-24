/* Tracks which tutorial pieces a user has already seen. Stored per user in
   localStorage, like the dashboard preferences, so it survives reloads but
   is reset on a new device or browser. */

const TUTORIAL_KEY_PREFIX = "stowed.tutorial";

function getKey(userId) {
  return `${TUTORIAL_KEY_PREFIX}.${userId || "anonymous"}`;
}

function load(userId) {
  try {
    return JSON.parse(window.localStorage.getItem(getKey(userId))) || {};
  } catch {
    return {};
  }
}

function save(userId, state) {
  try {
    window.localStorage.setItem(getKey(userId), JSON.stringify(state));
  } catch {
    // Storage blocked (private mode etc.) — the tutorial just shows again next time.
  }
}

export function hasSeenTour(userId) {
  return !!load(userId).tourDone;
}

export function markTourSeen(userId) {
  save(userId, { ...load(userId), tourDone: true });
}

export function hasSeenPage(userId, path) {
  return !!load(userId).pages?.[path];
}

export function markPageSeen(userId, path) {
  const state = load(userId);
  save(userId, { ...state, pages: { ...state.pages, [path]: true } });
}

/* Fired on window when the tutorial is reset, so the already-mounted
   <Tutorial> knows to start the tour again. */
export const TUTORIAL_RESET_EVENT = "stowed:tutorial-reset";

/* Used by the "Replay tutorial" button in Settings to start everything again. */
export function resetTutorial(userId) {
  try {
    window.localStorage.removeItem(getKey(userId));
  } catch {
    // Nothing stored to clear.
  }
  window.dispatchEvent(new Event(TUTORIAL_RESET_EVENT));
}
