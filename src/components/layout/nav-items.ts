import { Compass, Globe, LayoutDashboard, Library, Lock, Settings, type LucideIcon } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  match: "exact" | "prefix";
};

export const dashboardNav: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    description: "Storage, activity, and recent work",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    href: "/dashboard/repositories",
    label: "All repositories",
    shortLabel: "All repos",
    description: "Every repository you own",
    icon: Library,
    match: "exact",
  },
  {
    href: "/dashboard/repositories/public",
    label: "My public repositories",
    shortLabel: "Public",
    description: "Repositories anyone can open",
    icon: Globe,
    match: "exact",
  },
  {
    href: "/dashboard/repositories/private",
    label: "My private repositories",
    shortLabel: "Private",
    description: "Only you can see these",
    icon: Lock,
    match: "exact",
  },
  {
    href: "/public-repositories",
    label: "Explore public",
    shortLabel: "Explore",
    description: "Browse repositories shared by others",
    icon: Compass,
    match: "prefix",
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    description: "Profile, username, and avatar",
    icon: Settings,
    match: "prefix",
  },
];

export function isNavActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
