import type { ReactNode } from "react";

// Holds a page's place in the new structure until it's built. It has no controls, so
// nothing here can look like it saved.
const ComingSoon = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="container">
    <div className="main">
      <div className="section">
        <div className="section-header">
          <span>{title}</span>
        </div>
        <div className="list-item">
          <div className="item-content">
            <div className="item-title muted">Not built yet</div>
            <div className="item-meta coming-soon-text">{children}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ComingSoon;
