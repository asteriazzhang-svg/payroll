// Hortor logo mark — minimalist tree emblem (black silhouette).
// A tiered conifer tree (layered triangles) with a trunk, in solid black.
// Used as the app icon in headers. Monochrome, inherits text color via fill.

export function Logo({ className = '', height = 40 }: { className?: string; height?: number }) {
  const w = height * 1.2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 100"
      width={w}
      height={height}
      fill="currentColor"
      className={className}
      aria-label="Hortor"
    >
      {/* Tree silhouette: three stacked triangle tiers + trunk.
          Centered horizontally on x=60. */}
      {/* Top tier (smallest) */}
      <path d="M60 8 L46 36 L74 36 Z" />
      {/* Middle tier */}
      <path d="M60 26 L42 58 L78 58 Z" />
      {/* Bottom tier (largest) */}
      <path d="M60 46 L36 80 L84 80 Z" />
      {/* Trunk */}
      <rect x="54" y="80" width="12" height="14" />
      {/* Optional ground line */}
      <rect x="34" y="93" width="52" height="3" rx="1" opacity="0.7" />
    </svg>
  );
}

// Logo with wordmark for the login page / wider headers.
export function LogoWithText({ className = '', height = 36 }: { className?: string; height?: number }) {
  const w = height * 5.2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 100"
      width={w}
      height={height}
      fill="currentColor"
      className={className}
      aria-label="Hortor"
    >
      {/* Tree icon (same geometry as Logo, offset to left) */}
      <g transform="translate(-10,0)">
        <path d="M60 8 L46 36 L74 36 Z" />
        <path d="M60 26 L42 58 L78 58 Z" />
        <path d="M60 46 L36 80 L84 80 Z" />
        <rect x="54" y="80" width="12" height="14" />
      </g>
      {/* Wordmark */}
      <text
        x="100"
        y="50"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="22"
        fontWeight="700"
        letterSpacing="2"
      >
        BAUHINIA
      </text>
      <text
        x="100"
        y="74"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="18"
        fontWeight="400"
        letterSpacing="6"
        opacity="0.6"
      >
        AI
      </text>
    </svg>
  );
}
