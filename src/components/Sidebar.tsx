"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/api/client";
import { siteConfig } from "@/config/site";
import { needsSorting, SORTING_EVENT } from "@/config/tasks";
import { COUNTS_EVENT } from "@/config/lists";

// Left-hand nav (desktop). Groups and links come from siteConfig.nav; on
// narrow screens the header's mobile menu shows the same links.
const Sidebar = () => {
  const pathname = usePathname();
  const [toSort, setToSort] = useState(0);
  const [inDump, setInDump] = useState(0);

  const refresh = () => {
    api.items
      .getAll()
      .then((items) => setToSort(needsSorting(items)))
      .catch(() => {});
    api.lists.dump
      .getAll()
      .then((items) => setInDump(items.filter((i) => i.state === "open").length))
      .catch(() => {});
  };

  useEffect(refresh, [pathname]);

  useEffect(() => {
    window.addEventListener(COUNTS_EVENT, refresh);
    return () => window.removeEventListener(COUNTS_EVENT, refresh);
  }, []);

  const countFor = (href: string) => (href === "/tasks" ? toSort : href === "/brain-dump" ? inDump : 0);

  // The Tasks page says when the count changes, so the badge keeps up as you sort.
  useEffect(() => {
    const update = (e: Event) => setToSort((e as CustomEvent<number>).detail);
    window.addEventListener(SORTING_EVENT, update);
    return () => window.removeEventListener(SORTING_EVENT, update);
  }, []);

  return (
    <aside className="sidebar">
      {siteConfig.nav.map((group, i) => (
        <div key={group.label ?? i}>
          {i > 0 && <div className="nav-divider" />}
          <div className="nav-group">
            {group.label && <div className="nav-group-label">{group.label}</div>}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                    ? " nav-item--active"
                    : ""
                }`}
              >
                <span className="nav-dot" />
                {item.label}
                {countFor(item.href) > 0 && (
                  <span className="nav-count" aria-label={`${countFor(item.href)} to sort`}>
                    {countFor(item.href)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
