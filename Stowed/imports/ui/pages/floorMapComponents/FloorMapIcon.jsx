const ICONS = {
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  expand: (
    <>
      <path d="M15 3h6v6" />
      <path d="m14 10 7-7" />
      <path d="M9 21H3v-6" />
      <path d="m10 14-7 7" />
    </>
  ),
  collapse: (
    <>
      <path d="M4 14h6v6" />
      <path d="m10 14-7 7" />
      <path d="M20 10h-6V4" />
      <path d="m14 10 7-7" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
      <path d="m9 9-3 3 3 3" />
    </>
  ),
  "panel-close": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
      <path d="M6 12h5" />
      <path d="m9 9 3 3-3 3" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h12l2 2v16H5z" />
      <path d="M8 3v6h8V3" />
      <path d="M8 21v-7h8v7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h6" />
      <path d="M14 6h6" />
      <circle cx="12" cy="6" r="2" />
      <path d="M4 18h6" />
      <path d="M14 18h6" />
      <circle cx="12" cy="18" r="2" />
    </>
  ),
  units: (
    <>
      <rect x="3" y="4" width="8" height="7" rx="1" />
      <rect x="13" y="4" width="8" height="7" rx="1" />
      <rect x="3" y="13" width="18" height="7" rx="1" />
    </>
  ),
  templates: (
    <>
      <rect x="3" y="4" width="8" height="8" rx="1" />
      <circle cx="17" cy="8" r="4" />
      <path d="m7 15-4 6h8z" />
      <path d="m17 14 4 7h-8z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  fit: (
    <>
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M16 21h5v-5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 14h10l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
};

export function FloorMapIcon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={`floor-map-icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
