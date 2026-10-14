"use client";

import { siteConfig } from "@/config/site";

const Footer = () => (
  <div className="footer">
    <p className="copyrightText">{siteConfig.footer}</p>
  </div>
);

export default Footer;
