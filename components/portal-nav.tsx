"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Student Filter" },
  { href: "/gradebook", label: "Gradebook" },
  { href: "/duties", label: "Duty" },
  { href: "/directory", label: "Directory" },
  { href: "/admin/gradebook", label: "Setup" }
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="portal-nav" aria-label="Staff portal navigation">
      {NAV_ITEMS.map((item) => {
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
