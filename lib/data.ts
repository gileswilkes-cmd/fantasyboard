import playersData from "@/data/players.json";
import positionsSummaryData from "@/data/positions_summary.json";

export interface Player {
  rank: number;
  player_name: string;
  position: string;
  team: string;
  age: number;
  vor_score: number;
  projected_pts: number;
  adp: number | null;
  adp_rank: number | null;
  value_delta: number | null;
  avg_ppr_2025: number | null;
  avg_ppr_2024: number | null;
  std_dev: number | null;
  boom_weeks: number | null;
  bust_weeks: number | null;
  risk_flag: string | null;
  weekly_scores: (number | null)[];
}

export interface PositionSummary {
  position: string;
  player_count: number;
  avg_vor: number | null;
  top_player_name: string | null;
  top_player_vor: number | null;
  position_cliff_rank: number | null;
}

export function getPlayers(): Player[] {
  return playersData as unknown as Player[];
}

export function getPlayersByPosition(position: string): Player[] {
  return (playersData as unknown as Player[]).filter(
    (p) => p.position.toLowerCase() === position.toLowerCase()
  );
}

export function getPositionSummary(position: string): PositionSummary | undefined {
  return (positionsSummaryData as unknown as PositionSummary[]).find(
    (ps) => ps.position.toLowerCase() === position.toLowerCase()
  );
}

export function getAllPositionsSummary(): PositionSummary[] {
  return positionsSummaryData as unknown as PositionSummary[];
}

export function searchPlayers(query: string, players: Player[]): Player[] {
  const q = query.toLowerCase().trim();
  if (!q) return players;
  return players.filter(
    (p) =>
      p.player_name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q)
  );
}
