"""Add 2026 NFL rookie projections to data/players.json."""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
players_path = ROOT / "data" / "players.json"

rookies = [
    {"player_name": "J.Love", "position": "RB", "team": "ARI", "age": 21,
     "projected_pts": 172, "vor_score": 28, "adp_rank": 45, "adp": 45.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 8.5, "boom_weeks": 4, "bust_weeks": 5, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "C.Tate", "position": "WR", "team": "TEN", "age": 21,
     "projected_pts": 145, "vor_score": 15, "adp_rank": 65, "adp": 65.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 9.0, "boom_weeks": 3, "bust_weeks": 6, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "J.Tyson", "position": "WR", "team": "NO", "age": 21,
     "projected_pts": 138, "vor_score": 12, "adp_rank": 72, "adp": 72.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 9.5, "boom_weeks": 3, "bust_weeks": 6, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "O.Cooper", "position": "WR", "team": "LAR", "age": 21,
     "projected_pts": 132, "vor_score": 10, "adp_rank": 80, "adp": 80.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 9.0, "boom_weeks": 3, "bust_weeks": 6, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "J.Price", "position": "RB", "team": "KC", "age": 21,
     "projected_pts": 148, "vor_score": 18, "adp_rank": 58, "adp": 58.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 10.0, "boom_weeks": 3, "bust_weeks": 6, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "F.Mendoza", "position": "QB", "team": "LV", "age": 22,
     "projected_pts": 285, "vor_score": 18, "adp_rank": 52, "adp": 52.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 7.0, "boom_weeks": 5, "bust_weeks": 4, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "A.Williams", "position": "WR", "team": "WAS", "age": 21,
     "projected_pts": 105, "vor_score": 5, "adp_rank": 110, "adp": 110.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 10.5, "boom_weeks": 2, "bust_weeks": 7, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "Z.Branch", "position": "WR", "team": "ATL", "age": 21,
     "projected_pts": 98, "vor_score": 3, "adp_rank": 118, "adp": 118.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 11.0, "boom_weeks": 2, "bust_weeks": 7, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "K.Black", "position": "RB", "team": "SF", "age": 21,
     "projected_pts": 88, "vor_score": 2, "adp_rank": 130, "adp": 130.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 12.0, "boom_weeks": 2, "bust_weeks": 8, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},

    {"player_name": "S.Roush", "position": "TE", "team": "CHI", "age": 22,
     "projected_pts": 78, "vor_score": 1, "adp_rank": 145, "adp": 145.0,
     "value_delta": 0, "avg_ppr_2025": 0, "avg_ppr_2024": 0,
     "std_dev": 8.0, "boom_weeks": 1, "bust_weeks": 8, "risk_flag": "Rookie",
     "weekly_scores": [None] * 18, "rookie": True},
]

players = json.loads(players_path.read_text(encoding="utf-8"))

existing_names = {p["player_name"] for p in players}
next_rank = max(p["rank"] for p in players) + 1

added = 0
for rookie in rookies:
    if rookie["player_name"] in existing_names:
        print(f"  SKIP {rookie['player_name']} — already exists")
        continue
    rookie["rank"] = next_rank
    players.append(rookie)
    next_rank += 1
    added += 1

players_path.write_text(json.dumps(players, indent=2), encoding="utf-8")
print(f"Added {added} rookies. Total players: {len(players)}")
