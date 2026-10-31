"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

// Left-hand nav (desktop). Groups and links come from siteConfig.nav; on
// narrow screens the header's mobile menu shows the same links.
const Sidebar = () => {
  const pathname = usePathname();

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
              </Link>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
