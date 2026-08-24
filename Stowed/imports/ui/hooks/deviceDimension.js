import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Everything that depends on the size of the device screen lives here, so the
 * app has one answer to "how big is this screen?" instead of scattered
 * `window.innerWidth` checks that drift apart from the CSS.
 *
 * Note this file is about the *viewport*, not the size of an individual
 * element. Measuring a specific DOM node (the floor-map canvas, for example)
 * still belongs next to that component.
 */

/**
 * Named widths, in pixels. These mirror the breakpoints already used in the
 * stylesheets — change a number here and in the matching @media rule together.
 */
export const BREAKPOINTS = {
  phone: 640,
  phoneWide: 760,
  tablet: 900,
  desktop: 1024,
};

/** Laptops and larger. Below this the app is treated as hand-held. */
export const DESKTOP_MIN_WIDTH = BREAKPOINTS.desktop;

/** Build a media query string from a breakpoint. */
export const minWidth = (px) => `(min-width: ${px}px)`;
export const maxWidth = (px) => `(max-width: ${px}px)`;

export const DESKTOP_QUERY = minWidth(DESKTOP_MIN_WIDTH);

function getMediaQueryList(query) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

/**
 * One-shot check, safe to call from event handlers and callbacks.
 *
 * Server renders (and the pageRendering tests) have no `window`, so this
 * reports false there — the hand-held layout is the safe default because it
 * works at every width.
 */
export function matchesMediaQuery(query) {
  const mediaQueryList = getMediaQueryList(query);
  return mediaQueryList ? mediaQueryList.matches : false;
}

function createSubscriber(query) {
  return (onChange) => {
    const mediaQueryList = getMediaQueryList(query);
    if (!mediaQueryList) return () => {};

    // Safari below 14 only has the deprecated addListener API.
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    }
    mediaQueryList.addListener(onChange);
    return () => mediaQueryList.removeListener(onChange);
  };
}

const getServerSnapshot = () => false;

/**
 * Reactive media query for render logic. Re-renders when the viewport crosses
 * the query, e.g. a tablet rotating or a window being dragged wider.
 */
export function useMediaQuery(query) {
  const subscribe = useMemo(() => createSubscriber(query), [query]);
  const getSnapshot = useCallback(() => matchesMediaQuery(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True on laptops and wider. */
export function isDesktopViewport() {
  return matchesMediaQuery(DESKTOP_QUERY);
}

/** Reactive version of isDesktopViewport, for use during render. */
export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY);
}
