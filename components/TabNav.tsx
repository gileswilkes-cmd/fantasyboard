"use client";

import Link from "next/link";

const TABS = [
  { label: "All", href: "/board", key: "all" },
  { label: "QB", href: "/board/qb", key: "qb" },
  { label: "RB", href: "/board/rb", key: "rb" },
  { label: "WR", href: "/board/wr", key: "wr" },
  { label: "TE", href: "/board/te", key: "te" },
  { label: "K", href: "/board/k", key: "k" },
  { label: "DEF", href: "/board/def", key: "def" },
];

interface TabNavProps {
  position: string;
}

export default function TabNav({ position }: TabNavProps) {
  const active = position.toLowerCase();

  return (
    <div style={{
      height: 44,
      background: "var(--bg-secondary)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "stretch",
      padding: "0 24px",
      gap: 4,
      flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--teal)" : "var(--text-secondary)",
              borderBottom: isActive ? "2px solid var(--teal)" : "2px solid transparent",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
