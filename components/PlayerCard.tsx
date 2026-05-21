"use client";

import type { Player } from "@/lib/data";
import { getCard } from "@/lib/data";
import NflLogo from "./NflLogo";

const POSITION_TAGS: Record<string, { color: string; bg: string }> = {
  WR: { color: "var(--teal)",        bg: "var(--teal-bg)" },
  RB: { color: "var(--green-tag)",   bg: "var(--green-tag-bg)" },
  QB: { color: "var(--amber-tag)",   bg: "var(--amber-tag-bg)" },
  TE: { color: "var(--amber-light)", bg: "var(--amber-tag-bg2)" },
};

const BORDER = "1px solid #2e3140";

const CHART_H = 52;
const BAR_W = 14;
const BAR_GAP = 2;
const TOTAL_BARS = 18;
const CHART_W = TOTAL_BARS * BAR_W + (TOTAL_BARS - 1) * BAR_GAP;

function getVerdict(rank: number): { label: string; bg: string; color: string } {
  if (rank <= 10)  return { label: "Draft now",   bg: "#0d2d1f", color: "#1D9E75" };
  if (rank <= 50)  return { label: "Strong pick", bg: "#185FA5", color: "#5DCAA5" };
  if (rank <= 150) return { label: "Monitor",     bg: "#2a1206", color: "#EF9F27" };
  return                  { label: "Late round",  bg: "#2e3140", color: "#6b7280" };
}

function getBadgeStyle(badge: string): { bg: string; color: string } {
  switch (badge) {
    case "Draft now":   return { bg: "#0d2d1f", color: "#1D9E75" };
    case "Strong pick": return { bg: "#185FA5", color: "#5DCAA5" };
    case "Monitor":     return { bg: "#2a1206", color: "#EF9F27" };
    case "Late round":  return { bg: "#2e3140", color: "#6b7280" };
    case "Avoid":       return { bg: "#2d0d0d", color: "#E24B4A" };
    default:            return { bg: "#2e3140", color: "#6b7280" };
  }
}

interface PlayerCardProps {
  player: Player;
}

export default function PlayerCard({ player }: PlayerCardProps) {
  const posTag = POSITION_TAGS[player.position] ?? { color: "var(--text-secondary)", bg: "var(--bg-card)" };
  const card = getCard(player.player_name);
  const boomPct = player.boom_weeks != null ? Math.round((player.boom_weeks / 16) * 100) : 0;

  const statBoxes = [
    { label: "Avg PPR",    value: player.avg_ppr_2025?.toFixed(1) ?? "—" },
    { label: "2024 Avg",   value: player.avg_ppr_2024?.toFixed(1) ?? "—" },
    { label: "Boom %",     value: `${boomPct}%` },
    { label: "Std Dev",    value: player.std_dev?.toFixed(1) ?? "—" },
    { label: "Bust Weeks", value: String(player.bust_weeks ?? "—") },
  ];

  const scores = player.weekly_scores.slice(0, TOTAL_BARS);
  const numericScores = scores.filter((s): s is number => s !== null);
  const maxScore = numericScores.length ? Math.max(...numericScores) : 1;

  const fallbackVerdict = getVerdict(player.rank);
  const verdictBadge = card?.verdict_badge ?? fallbackVerdict.label;
  const badgeStyle = card ? getBadgeStyle(card.verdict_badge) : { bg: fallbackVerdict.bg, color: fallbackVerdict.color };

  const strengths = card?.strengths ?? ["—", "—", "—"];
  const weaknesses = card?.weaknesses ?? ["—", "—", "—"];

  return (
    <div style={{ background: "#0d1f1a", borderLeft: "2px solid #1D9E75" }}>

      {/* 0. Header: logo + player name + position + team */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: BORDER }}>
        <NflLogo team={player.team} size={32} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
              {player.player_name}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 5px", borderRadius: 3,
              color: posTag.color, background: posTag.bg,
            }}>
              {player.position}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#c8cad4", fontWeight: 500, marginTop: 3 }}>
            {player.team}
          </div>
        </div>
      </div>

      {/* 1. One-liner */}
      <div style={{ padding: "10px 14px", borderBottom: BORDER }}>
        <span style={{ fontStyle: "italic", color: "#1D9E75", fontSize: 13 }}>
          {card
            ? card.one_liner
            : `2025 avg ${player.avg_ppr_2025?.toFixed(1) ?? "—"} pts · ${player.boom_weeks ?? 0} boom weeks · std dev ${player.std_dev?.toFixed(1) ?? "—"} · ${player.bust_weeks ?? 0} bust weeks`
          }
        </span>
      </div>

      {/* 2. Five stat boxes */}
      <div style={{ display: "flex", borderBottom: BORDER }}>
        {statBoxes.map((box, i) => (
          <div
            key={box.label}
            style={{
              flex: 1,
              padding: "12px 8px",
              textAlign: "center",
              borderRight: i < statBoxes.length - 1 ? BORDER : "none",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#ffffff" }}>
              {box.value}
            </div>
            <div style={{
              fontSize: 11,
              color: "#7b7f8f",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginTop: 4,
            }}>
              {box.label}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Strengths / Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: BORDER }}>
        <div style={{ padding: "12px 14px", borderRight: BORDER }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#1D9E75",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}>
            Strengths
          </div>
          {strengths.slice(0, 3).map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1D9E75", flexShrink: 0, marginTop: 5 }} />
              <span style={{ fontSize: 13, color: card ? "#c8cad4" : "#7b7f8f" }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#E24B4A",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}>
            Weaknesses
          </div>
          {weaknesses.slice(0, 3).map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#E24B4A", flexShrink: 0, marginTop: 5 }} />
              <span style={{ fontSize: 13, color: card ? "#c8cad4" : "#7b7f8f" }}>{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Bottom row: Comp + Sparkline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: BORDER }}>
        <div style={{ padding: "12px 14px", borderRight: BORDER }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#7b7f8f",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}>
            Comp
          </div>
          <span style={{ fontSize: 13, color: card ? "#c8cad4" : "#7b7f8f" }}>
            {card ? card.comp : "Historical comp generated in Session 5"}
          </span>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <svg
            width="100%"
            height={CHART_H}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            <rect x={0} y={CHART_H - 1} width={CHART_W} height={1} fill="#2e3140" />
            {scores.map((score, i) => {
              if (score === null) return null;
              const barH = Math.max(3, (score / maxScore) * (CHART_H - 2));
              const color = score >= 20 ? "#378ADD" : score < 10 ? "#E24B4A" : "#2a3a4a";
              return (
                <rect
                  key={i}
                  x={i * (BAR_W + BAR_GAP)}
                  y={CHART_H - 1 - barH}
                  width={BAR_W}
                  height={barH}
                  fill={color}
                  rx={1}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* 5. Verdict row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <span style={{
          padding: "4px 10px",
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          background: badgeStyle.bg,
          color: badgeStyle.color,
          flexShrink: 0,
        }}>
          {verdictBadge}
        </span>
        <span style={{ fontSize: 13, color: "#7b7f8f" }}>
          {card
            ? card.verdict_text
            : `Pick ${player.rank} overall · Proj ${player.projected_pts.toFixed(0)} pts · ADP ${player.adp_rank ?? "—"}`
          }
        </span>
      </div>

    </div>
  );
}
