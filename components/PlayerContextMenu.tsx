"use client";

import { useEffect } from "react";
import { TIERS } from "@/lib/tiers";

interface PlayerContextMenuProps {
  x: number;
  y: number;
  playerName: string;
  isStarred: boolean;
  isDnd: boolean;
  tierOverride: number | null;
  onStar: () => void;
  onTier: (tier: number) => void;
  onDnd: () => void;
  onClose: () => void;
}

export default function PlayerContextMenu({
  x, y, playerName, isStarred, isDnd, tierOverride,
  onStar, onTier, onDnd, onClose,
}: PlayerContextMenuProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleMouseDown() { onClose(); }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 215);
  const adjustedY = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 320);

  const menuBase: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "7px 12px",
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 13,
    color: "#ffffff",
    fontFamily: "inherit",
    transition: "background 0.1s",
  };

  const divider: React.CSSProperties = {
    height: 1,
    background: "#2e3140",
    margin: "3px 0",
  };

  return (
    <>
      <style>{`.pcm-btn:hover { background: rgba(29,158,117,0.18) !important; }`}</style>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: adjustedX,
          top: adjustedY,
          width: 200,
          background: "#1e2028",
          border: "1px solid #2e3140",
          borderRadius: 6,
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          zIndex: 9999,
          overflow: "hidden",
        }}
      >
        {/* Star */}
        <button
          className="pcm-btn"
          onClick={() => { onStar(); onClose(); }}
          style={{ ...menuBase, color: isStarred ? "#EF9F27" : "#ffffff" }}
        >
          {isStarred ? "★ Remove star" : "☆ Star player"}
        </button>

        <div style={divider} />

        {/* Tier label */}
        <div style={{ padding: "5px 12px 2px", fontSize: 10, color: "#7b7f8f", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Move to tier:
        </div>

        {TIERS.map((t) => {
          const isActive = tierOverride === t.tier;
          return (
            <button
              key={t.tier}
              className="pcm-btn"
              onClick={() => { onTier(t.tier); onClose(); }}
              style={{
                ...menuBase,
                color: isActive ? t.color : "#c8cad4",
                background: isActive ? "rgba(29,158,117,0.12)" : "none",
              }}
            >
              <span style={{ color: t.color, marginRight: 6 }}>◆</span>
              {t.label} — {t.description}
            </button>
          );
        })}

        <div style={divider} />

        {/* Do not draft */}
        <button
          className="pcm-btn"
          onClick={() => { onDnd(); onClose(); }}
          style={{ ...menuBase, color: isDnd ? "#E24B4A" : "#ffffff" }}
        >
          ✕ {isDnd ? "Remove DND flag" : "Do not draft"}
        </button>
      </div>
    </>
  );
}
