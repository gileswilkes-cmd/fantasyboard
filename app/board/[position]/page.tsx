import TabNav from "@/components/TabNav";
import PositionHero from "@/components/PositionHero";
import StatsStrip from "@/components/StatsStrip";
import BoardClient from "@/components/BoardClient";
import { getPlayersByPosition, getPositionSummary } from "@/lib/data";

const POSITION_META: Record<string, { title: string; summary: string }> = {
  qb: {
    title: "Quarterbacks",
    summary: "2026 PPR quarterback rankings by Value Over Replacement. Elite QBs offer a significant positional advantage in 14-team leagues.",
  },
  rb: {
    title: "Running Backs",
    summary: "2026 PPR running back rankings. RBs are the most volatile position — target workhorse backs and pass-catching specialists.",
  },
  wr: {
    title: "Wide Receivers",
    summary: "2026 PPR wide receiver rankings. WR depth wins championships — prioritise targets, air yards, and snap share.",
  },
  te: {
    title: "Tight Ends",
    summary: "2026 PPR tight end rankings. The position has elite separation at the top — securing a top-3 TE is a major edge.",
  },
  k: {
    title: "Kickers",
    summary: "2026 kicker rankings by projected points. Prioritise high-volume offenses and dome/warm-weather kickers.",
  },
  def: {
    title: "Defenses",
    summary: "2026 team defense rankings. Streaming D/ST is a viable strategy — target favorable matchups week to week.",
  },
};

interface PageProps {
  params: Promise<{ position: string }>;
}

export default async function PositionPage({ params }: PageProps) {
  const { position } = await params;
  const key = position.toLowerCase();
  const meta = POSITION_META[key] ?? {
    title: position.toUpperCase(),
    summary: `2026 PPR draft board for ${position.toUpperCase()}.`,
  };

  const players = getPlayersByPosition(key);
  const summary = getPositionSummary(key);

  const topProjPts =
    players.length > 0
      ? Math.max(...players.map((p) => p.projected_pts ?? 0)).toFixed(1)
      : "—";

  const stats = [
    { value: String(players.length),                                  label: "Players" },
    { value: summary?.top_player_name ?? "—",                         label: "Top Player" },
    { value: summary?.avg_vor != null ? summary.avg_vor.toFixed(1) : "—", label: "Avg VOR" },
    { value: topProjPts,                                               label: "Top Proj Pts" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)" }}>
      <TabNav position={key} />
      <PositionHero position={meta.title} summary={meta.summary} />
      <StatsStrip stats={stats} />
      <BoardClient players={players} />
    </div>
  );
}
