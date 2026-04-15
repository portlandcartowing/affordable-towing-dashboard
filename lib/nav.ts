// Central navigation config — used by Sidebar and MobileNav so both stay
// in sync when links are added or reordered.

export type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** Show in the mobile bottom nav (limited to 5 slots for thumb reach). */
  mobile?: boolean;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: "▦", mobile: true },
  { href: "/call-center", label: "Call Center", icon: "🎧", mobile: true },
  { href: "/calls",       label: "Calls",       icon: "☎" },
  { href: "/leads",       label: "Leads",       icon: "◉", mobile: true },
  { href: "/jobs",        label: "Jobs",        icon: "✦", mobile: true },
  { href: "/dispatch",    label: "Dispatch",    icon: "➤", mobile: true },
  { href: "/marketing",   label: "Marketing",   icon: "◈" },
  { href: "/settings",    label: "Settings",    icon: "✿" },
];
