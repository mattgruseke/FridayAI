"use client";

import Header from "./Header";
import Footer from "./Footer";
import type { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <>
      <header><Header/></header>

      <main>
        {children}
      </main>

      <footer><Footer/></footer>
    </>
  );
};

export default Layout;
