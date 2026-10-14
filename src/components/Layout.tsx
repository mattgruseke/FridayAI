"use client";

import Header from "./Header";
import Sidebar from "./Sidebar";
import type { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
};

// Signed-in shell: top bar, sidebar, scrolling main column.
const Layout = ({ children }: LayoutProps) => {
  return (
    <>
      <header>
        <Header />
      </header>

      <div className="app-body">
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>
    </>
  );
};

export default Layout;
