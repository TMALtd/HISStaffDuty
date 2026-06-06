"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_NAV_ITEMS, type PortalView } from "@/lib/access";

type PortalNavProps = {
  allowedViews?: PortalView[];
};

export function PortalNav({ allowedViews }: PortalNavProps) {
  const pathname = usePathname();
  const allowedViewSet = allowedViews ? new Set(allowedViews) : null;
  const navItems = allowedViewSet
    ? PORTAL_NAV_ITEMS.filter((item) => allowedViewSet.has(item.view))
    : PORTAL_NAV_ITEMS;

  return (
    <nav className="portal-nav" aria-label="Staff portal navigation">
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`portal-nav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
