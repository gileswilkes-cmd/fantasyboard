"use client";

import { useState, useEffect, useRef } from "react";

interface Counts {
  starred: number;
  tiers: number;
  dnd: number;
  drafts: number;
}

function loadCounts(): Counts {
  try {
    const starred = (JSON.parse(localStorage.getItem("ff_starred_players") ?? "[]") as unknown[]).length;
    const tiers = Object.keys(JSON.parse(localStorage.getItem("ff_tier_overrides") ?? "{}")).length;
    const dnd = (JSON.parse(localStorage.getItem("ff_dnd_players") ?? "[]") as unknown[]).length;
    const drafts = Number(localStorage.getItem("ff_drafts_run") ?? "0");
    return { starred, tiers, dnd, drafts };
  } catch {
    return { starred: 0, tiers: 0, dnd: 0, drafts: 0 };
  }
}

export default function GuidePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ starred: 0, tiers: 0, dnd: 0, drafts: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setCounts(loadCounts());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", handleMouseDown), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen]);

  const steps = [
    {
      icon: "📋",
      title: "Research",
      desc: "Browse players, click to read cards, right-click to set your personal tiers and star targets",
    },
    {
      icon: "🧩",
      title: "Strategy",
      desc: "Go to Think Board to build hypothetical rosters and test draft strategies",
    },
    {
      icon: "🎯",
      title: "Practice",
      desc: "Go to Draft Room to run practice drafts against 13 bot opponents",
    },
  ];

  const progress = [
    { label: "Players starred", value: counts.starred },
    { label: "Custom tiers set", value: counts.tiers },
    { label: "Do not draft", value: counts.dnd },
    { label: "Practice drafts run", value: counts.drafts },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        alignItems: "stretch",
        zIndex: 200,
      }}
    >
      {/* Tab */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "14px 8px",
          background: "#1e2028",
          border: "1px solid #2e3140",
          borderRight: isOpen ? "none" : "1px solid #2e3140",
          borderRadius: "6px 0 0 6px",
          cursor: "pointer",
          minHeight: 80,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: "#c8cad4" }}>{isOpen ? "▶" : "◀"}</span>
        <span style={{
          writingMode: "vertical-rl",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "#ffffff",
          textTransform: "uppercase",
        }}>
          Guide
        </span>
      </button>

      {/* Sliding panel */}
      <div style={{
        width: isOpen ? 280 : 0,
        overflow: "hidden",
        transition: "width 0.2s ease",
        flexShrink: 0,
      }}>
        <div style={{
          width: 280,
          background: "#1e2028",
          borderLeft: "1px solid #2e3140",
          maxHeight: "calc(100vh - 80px)",
          overflowY: "auto",
          padding: "16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>
            How to use this board
          </div>

          {/* Steps */}
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{step.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffff", marginBottom: 3 }}>
                  {i + 1}. {step.title}
                </div>
                <div style={{ fontSize: 11, color: "#c8cad4", lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: "#2e3140", margin: "4px 0 14px" }} />

          {/* Progress */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7b7f8f", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Your progress
          </div>
          {progress.map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#c8cad4" }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: item.value > 0 ? "#1D9E75" : "#7b7f8f" }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
