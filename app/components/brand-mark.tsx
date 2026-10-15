/** The two solid forms share one contour, rotated around the viewBox centre. */
export function BrandMark() {
  return (
    <svg className="brand-symbol" viewBox="0 0 64 64" width="43" height="43" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16 5H32C36 5 38 7 38 11V15C38 19 36 20 32 20C24 20 20 26 20 34V42C20 45 19 46 16 46H12C6 46 2 42 2 36V20C2 11 8 5 16 5Z"/>
      <path d="M16 5H32C36 5 38 7 38 11V15C38 19 36 20 32 20C24 20 20 26 20 34V42C20 45 19 46 16 46H12C6 46 2 42 2 36V20C2 11 8 5 16 5Z" transform="rotate(180 32 32)"/>
    </svg>
  );
}
