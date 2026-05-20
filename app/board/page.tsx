import TabNav from "@/components/TabNav";
import PositionHero from "@/components/PositionHero";
import StatsStrip from "@/components/StatsStrip";
import BoardClient from "@/components/BoardClient";
import { getPlayers } from "@/lib/data";

export default function BoardPage() {
  const players = getPlayers();

  const withAdp = players.filter((p) => p.adp != null).length;
  const boomPlayers = players.filter(
    (p) => p.avg_ppr_2025 != null && p.avg_ppr_2025 >= 20
  ).length;
  const avgProjPts = Math.round(
    players.reduce((sum, p) => sum + (p.projected_pts ?? 0), 0) / players.length
  );

  const stats = [
    { value: String(players.length), label: "Total Players" },
    { value: String(withAdp),        label: "Have ADP" },
    { value: String(boomPlayers),    label: "Boom Players" },
    { value: String(avgProjPts),     label: "Avg Proj Pts" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)" }}>
      <TabNav position="all" />
      <PositionHero
        position="All Players"
        summary="The complete 2026 PPR draft board, ranked by Value Over Replacement. Click any player to see their full profile."
      />
      <StatsStrip stats={stats} />
      <BoardClient players={players} />
    </div>
  );
}
