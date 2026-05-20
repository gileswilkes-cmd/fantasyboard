"use client";

import { useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-card)",
        padding: "10px 16px",
      }}
    >
      <input
        type="text"
        placeholder="Search players by name, team, or position..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "var(--bg-card)",
          border: `1px solid ${focused ? "var(--teal)" : "var(--border)"}`,
          borderRadius: 6,
          padding: "10px 16px",
          fontSize: 14,
          color: "var(--text-primary)",
          outline: "none",
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}
