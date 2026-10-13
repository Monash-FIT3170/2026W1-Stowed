import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_INTROS, SIDEBAR_TOUR_STEPS } from "./tutorialContent";
import {
  TUTORIAL_RESET_EVENT,
  hasSeenPage,
  hasSeenTour,
  markPageSeen,
  markTourSeen,
} from "./tutorialStorage";
import { BREAKPOINTS, matchesMediaQuery, maxWidth } from "../hooks/deviceDimension";
import "./Tutorial.css";

const POPOVER_WIDTH = 300;
const GAP = 14;
// Starting guess for a step popover's height until it has been measured. Only
// used for phone/tablet placement; laptop placement never reads it.
const POPOVER_HEIGHT_ESTIMATE = 200;
// Set on a collapsed dock menu so CSS shows it while its link is the current
// step (phone/tablet only — see Tutorial.css).
const FORCE_OPEN_ATTR = "data-tutorial-open";
// Same width as the dock's @media (max-width: 1024px) in Sidebar.css.
const DOCK_QUERY = maxWidth(BREAKPOINTS.desktop);

/* Finds the visible sidebar link for a step. Returns null when the link isn't
   rendered for this role, or is hidden inside a collapsed dock menu. */
function findTarget(to) {
  const matches = document.querySelectorAll(`.sidebar a[href="${to}"]`);
  for (const el of matches) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

/* Phone/tablet: the dock menu (Workspace / Tools / Account) holding a link. */
function findDockMenu(to) {
  const link = document.querySelector(`.sidebar .sidebar-section-links a[href="${to}"]`);
  return link ? link.closest(".sidebar-section-links") : null;
}

/* Phone/tablet (dock layout): above the open dock menu when it fits, else to
   its left (landscape side rail), else to its right, else below. Always kept
   on screen. `anchor` is the open dock menu's box, or the link itself. */
function getDockPopoverPosition(rect, anchor, height) {
  const maxTop = window.innerHeight - height - GAP;
  const clampTop = (top) => Math.max(GAP, Math.min(top, maxTop));
  const centredLeft = Math.min(
    Math.max(GAP, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - GAP,
  );
  if (anchor.top - GAP - height >= GAP) {
    return { bottom: window.innerHeight - anchor.top + GAP, left: centredLeft };
  }
  if (anchor.left - GAP - POPOVER_WIDTH >= GAP) {
    return { top: clampTop(rect.top - 8), left: anchor.left - GAP - POPOVER_WIDTH };
  }
  if (anchor.right + GAP + POPOVER_WIDTH <= window.innerWidth - GAP) {
    return { top: clampTop(rect.top - 8), left: anchor.right + GAP };
  }
  return { top: clampTop(rect.bottom + GAP), left: centredLeft };
}

/* Puts the popover to the right of the link (laptop sidebar), or above it
   when there's no room. Phone/tablet use the dock placement above. */
function getPopoverPosition(rect, anchor = rect, height = POPOVER_HEIGHT_ESTIMATE) {
  if (matchesMediaQuery(DOCK_QUERY)) return getDockPopoverPosition(rect, anchor, height);
  if (rect.right + GAP + POPOVER_WIDTH < window.innerWidth) {
    return { top: Math.max(GAP, rect.top - 8), left: rect.right + GAP };
  }
  const left = Math.min(
    Math.max(GAP, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - GAP,
  );
  return { bottom: window.innerHeight - rect.top + GAP, left };
}

function useEscape(onEscape) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onEscape]);
}

function SidebarTour({ onFinish }) {
  // Filled in when the tour starts rather than on mount: the sidebar isn't in
  // the DOM yet on the first render, and its links depend on the user's role.
  const [steps, setSteps] = useState([]);
  // -1 is the centred welcome card shown before the first popover.
  const [index, setIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  // Box of the dock menu the link sits in (phone/tablet), for placing the popover.
  const [anchor, setAnchor] = useState(null);
  const nextRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverHeight, setPopoverHeight] = useState(POPOVER_HEIGHT_ESTIMATE);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const start = () => {
    const available = SIDEBAR_TOUR_STEPS.filter((s) =>
      document.querySelector(`.sidebar a[href="${s.to}"]`),
    );
    if (available.length === 0) {
      onFinish();
      return;
    }
    setSteps(available);
    setIndex(0);
  };

  useLayoutEffect(() => {
    if (!step) return undefined;
    // Phone/tablet: the link lives in a collapsed dock menu, so open that menu
    // for this step. On a laptop every link is already visible and this never
    // runs. Re-checked on resize so rotating or resizing across 1024px works.
    let forcedMenu = null;
    const releaseMenu = () => {
      forcedMenu?.removeAttribute(FORCE_OPEN_ATTR);
      forcedMenu = null;
    };
    const measure = () => {
      releaseMenu();
      let target = findTarget(step.to);
      if (!target) {
        const menu = findDockMenu(step.to);
        if (menu) {
          menu.setAttribute(FORCE_OPEN_ATTR, "");
          forcedMenu = menu;
          target = findTarget(step.to);
        }
      }
      const menuBox = forcedMenu ? forcedMenu.getBoundingClientRect() : null;
      setRect(target ? target.getBoundingClientRect() : null);
      setAnchor(target && menuBox ? menuBox : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      releaseMenu();
    };
  }, [step]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  // Real popover height (text length varies per step) so phone/tablet
  // placement keeps the whole card on screen.
  useLayoutEffect(() => {
    const height = popoverRef.current?.offsetHeight;
    if (height && height !== popoverHeight) setPopoverHeight(height);
  }, [index, popoverHeight]);

  useEscape(onFinish);

  const next = () => (isLast ? onFinish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => i - 1);

  if (index === -1) {
    return (
      <div className="tutorial-backdrop">
        <div
          className="tutorial-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          <h2 id="tour-title" className="tutorial-title">
            Welcome to Stowed<span className="tutorial-dot">.</span>
          </h2>
          <p className="tutorial-text">
            Take a 30-second tour of where everything lives. You can skip it at any time.
          </p>
          <div className="tutorial-actions">
            <button type="button" className="tutorial-btn-secondary" onClick={onFinish}>
              Skip
            </button>
            <button type="button" className="tutorial-btn-primary" ref={nextRef} onClick={start}>
              Show me around
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Link isn't visible (e.g. inside a closed dock menu): centre the card instead.
  const position = rect
    ? getPopoverPosition(rect, anchor ?? rect, popoverHeight)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : (
        <div className="tutorial-backdrop" />
      )}
      <div
        ref={popoverRef}
        className="tutorial-popover"
        role="dialog"
        aria-labelledby="tour-step-title"
        style={{ ...position, width: POPOVER_WIDTH }}
      >
        <div className="tutorial-step-count">
          {index + 1} of {steps.length}
        </div>
        <h3 id="tour-step-title" className="tutorial-popover-title">
          {step.title}
        </h3>
        <p className="tutorial-text">{step.body}</p>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn-link" onClick={onFinish}>
            Skip tour
          </button>
          {index > 0 && (
            <button type="button" className="tutorial-btn-secondary" onClick={back}>
              Back
            </button>
          )}
          <button type="button" className="tutorial-btn-primary" ref={nextRef} onClick={next}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

function PageIntroModal({ intro, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  useEscape(onClose);

  return (
    <div className="tutorial-backdrop" onClick={onClose}>
      <div
        className="tutorial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-intro-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="page-intro-title" className="tutorial-title">
          {intro.title}
        </h2>
        <ul className="tutorial-points">
          {intro.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn-primary" ref={buttonRef} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * First-time tutorial. Runs the sidebar tour once, then shows a short intro
 * modal the first time the user opens each sidebar page. Mounted once in App,
 * inside the router, only for logged-in users.
 */
export function Tutorial({ userId }) {
  const { pathname } = useLocation();
  const [tourDone, setTourDone] = useState(() => hasSeenTour(userId));
  // Bumped when a page intro is dismissed so the "seen" check re-runs.
  const [, setDismissed] = useState(0);

  // "Replay tutorial" in Settings clears storage and fires this event.
  useEffect(() => {
    const restart = () => setTourDone(false);
    window.addEventListener(TUTORIAL_RESET_EVENT, restart);
    return () => window.removeEventListener(TUTORIAL_RESET_EVENT, restart);
  }, []);

  if (!tourDone) {
    return (
      <SidebarTour
        onFinish={() => {
          markTourSeen(userId);
          setTourDone(true);
        }}
      />
    );
  }

  const intro = PAGE_INTROS[pathname];
  if (!intro || hasSeenPage(userId, pathname)) return null;

  return (
    <PageIntroModal
      key={pathname}
      intro={intro}
      onClose={() => {
        markPageSeen(userId, pathname);
        setDismissed((n) => n + 1);
      }}
    />
  );
}
