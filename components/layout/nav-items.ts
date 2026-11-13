import {
  CalendarDays,
  FileText,
  History,
  LayoutDashboard,
  LayoutTemplate,
  PenSquare,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: PenSquare },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/history", label: "History", icon: History },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Items shown directly in the mobile bottom bar; the rest live in the "More" drawer. */
export const MOBILE_PRIMARY = ["/dashboard", "/create", "/drafts", "/calendar"];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
