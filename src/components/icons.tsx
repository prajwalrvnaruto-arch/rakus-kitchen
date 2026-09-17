interface IconProps {
  className?: string;
}

/** Professional inline SVG icons for Raku's Kitchen */

export const LogoMark = () => (
  <span className="grid h-9 w-9 place-items-center rounded-xl bg-chili text-cream shadow-card" aria-hidden>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2a4 4 0 0 0-4 4H5a1 1 0 0 0-1 1v1a7 7 0 0 0 7 7 7 7 0 0 0 7-7V7a1 1 0 0 0-1-1h-3a4 4 0 0 0-4-4z" />
      <path d="M8 21h8" />
      <path d="M12 18v3" />
    </svg>
  </span>
);

/* ── FSSAI Food Type Indicators (Authentic Indian Standards) ────────── */

/** FSSAI Green Square with Dot for Vegetarian items */
export const VegBadge = ({ className }: IconProps) => (
  <span
    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ok/60 bg-paper ${className ?? ""}`}
    title="Vegetarian"
    aria-label="Vegetarian"
  >
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="#16a34a" strokeWidth="2" />
      <circle cx="8" cy="8" r="3.5" fill="#16a34a" />
    </svg>
  </span>
);

/** FSSAI Red Square with Triangle for Non-Vegetarian items */
export const NonVegBadge = ({ className }: IconProps) => (
  <span
    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-chili/60 bg-paper ${className ?? ""}`}
    title="Non-Vegetarian"
    aria-label="Non-Vegetarian"
  >
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="#dc2626" strokeWidth="2" />
      <polygon points="8,4 12.5,11.5 3.5,11.5" fill="#dc2626" />
    </svg>
  </span>
);

/* ── UI Action Icons ─────────────────────────────────────────────────── */

export const CartIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

export const WhatsAppIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

export const PhoneIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const MapPinIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/* ── Navigation Bar Vector Icons ─────────────────────────────────────── */

export const HomeIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const MenuBookIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="11" x2="13" y2="11" />
  </svg>
);

export const BiryaniPotIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2a4 4 0 0 0-4 4v1H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3V6a4 4 0 0 0-4-4z" />
    <path d="M4 11v6a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-6" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

export const CateringIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v4" />
    <path d="M7 3v3" />
    <path d="M17 3v3" />
    <path d="M2 13h20" />
    <path d="M20 13a8 8 0 0 1-16 0" />
    <path d="M4 17v4" />
    <path d="M20 17v4" />
  </svg>
);

export const OrdersReceiptIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
  </svg>
);

export const SettingsIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ── Menu Category Filter Icons ───────────────────────────────────────── */

export const ChickenCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15.5 4.5A4.5 4.5 0 0 0 11 9v.5a2.5 2.5 0 0 1-2.5 2.5H7.5A4.5 4.5 0 0 0 3 16.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5a4.5 4.5 0 0 0-4.5-4.5h-1" />
    <circle cx="15.5" cy="4.5" r="2" />
  </svg>
);

export const MuttonCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="10" cy="10" r="7" />
    <path d="M15 15l6 6" />
    <path d="M17 13l4 4" />
  </svg>
);

export const OtherCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 13.87A8 8 0 0 1 12 4a8 8 0 0 1 6 9.87" />
    <path d="M4 17h16" />
    <path d="M12 17v5" />
  </svg>
);

/* ── Homepage Category Tile Icons ─────────────────────────────────────────── */

/** Chicken tile icon — stylised drumstick */
export const ChickenTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M14.5 4a3.5 3.5 0 0 1 5.5 5.5L8 20.5" />
    <path d="M8 20.5A3.5 3.5 0 0 1 2.5 15L8 9" />
    <path d="M4.5 19.5 6 21" />
  </svg>
);

/** Mutton tile icon — claypot / handi */
export const MuttonTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 11h16l-2 9H6z" />
    <path d="M2 11h20" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    <path d="M10 4.5c0-1 .7-1.5 2-1.5" />
  </svg>
);

/** Fish tile icon */
export const FishTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M6.5 12C6.5 8.5 9.5 6 14 6c3 0 5 2.5 5 6s-2 6-5 6c-4.5 0-7.5-2.5-7.5-6z" />
    <path d="M6.5 12 2 8v8z" />
    <circle cx="16.5" cy="10" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** Rice & Sides tile icon — bowl with steam */
export const RiceSidesTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 12a8 8 0 0 0 16 0H4z" />
    <path d="M2 12h20" />
    <path d="M8.5 5c0-1.5 1-2.5 3.5-2.5S15.5 3.5 15.5 5" />
    <path d="M4 22h16" />
  </svg>
);

/* ── Homepage Pillar / Trust Icons ────────────────────────────────────────── */

/** Fresh Ingredients — leaf sprout */
export const FreshIngredientsIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 22V12" />
    <path d="M12 12C12 7 7 4 3 5c0 5 3 8 9 7z" />
    <path d="M12 12c0-5 5-8 9-7 0 5-3 8-9 7z" />
  </svg>
);

/** Authentic Taste — flame */
export const AuthenticTasteIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z" />
    <path d="M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z" />
  </svg>
);

/** Hygienic Preparation — shield with checkmark */
export const HygienicPrepIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

/* ── Cart / Empty State Icons ─────────────────────────────────────────────── */

/** Empty cart state — dinner plate with cutlery */
export const EmptyPlateIcon = ({ className = "h-14 w-14" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="12" cy="13" r="7" />
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <path d="M8 6a2 2 0 0 0 0 4" />
    <path d="M12 2v4" /><path d="M12 6v7" />
  </svg>
);

/** Cart item fallback — fork and knife */
export const DishPlaceholderIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M8 2v6a3 3 0 0 0 6 0V2" />
    <path d="M11 8v14" />
    <path d="M16 2v14" />
  </svg>
);