"""Append kicker and DST entries to data/players.json."""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
players_path = ROOT / "data" / "players.json"

kickers = [
    {"player_name": "B.Aubrey",    "position": "K", "team": "DAL", "age": 26, "projected_pts": 145, "vor_score": 45, "adp_rank": 155, "adp": 155.0, "value_delta": 0, "avg_ppr_2025": 8.5, "avg_ppr_2024": 8.1, "std_dev": 3.2, "boom_weeks": 2, "bust_weeks": 3, "risk_flag": None},
    {"player_name": "E.McPherson", "position": "K", "team": "CIN", "age": 26, "projected_pts": 138, "vor_score": 38, "adp_rank": 162, "adp": 162.0, "value_delta": 0, "avg_ppr_2025": 8.1, "avg_ppr_2024": 7.9, "std_dev": 3.4, "boom_weeks": 2, "bust_weeks": 3, "risk_flag": None},
    {"player_name": "J.Tucker",    "position": "K", "team": "BAL", "age": 36, "projected_pts": 135, "vor_score": 35, "adp_rank": 165, "adp": 165.0, "value_delta": 0, "avg_ppr_2025": 7.9, "avg_ppr_2024": 8.2, "std_dev": 3.1, "boom_weeks": 2, "bust_weeks": 3, "risk_flag": "Age Risk"},
    {"player_name": "T.Bass",      "position": "K", "team": "BUF", "age": 28, "projected_pts": 132, "vor_score": 32, "adp_rank": 168, "adp": 168.0, "value_delta": 0, "avg_ppr_2025": 7.8, "avg_ppr_2024": 7.5, "std_dev": 3.3, "boom_weeks": 2, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "H.Butker",    "position": "K", "team": "KC",  "age": 30, "projected_pts": 130, "vor_score": 30, "adp_rank": 170, "adp": 170.0, "value_delta": 0, "avg_ppr_2025": 7.6, "avg_ppr_2024": 7.8, "std_dev": 3.0, "boom_weeks": 2, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "J.Sanders",   "position": "K", "team": "NO",  "age": 31, "projected_pts": 128, "vor_score": 28, "adp_rank": 172, "adp": 172.0, "value_delta": 0, "avg_ppr_2025": 7.5, "avg_ppr_2024": 7.3, "std_dev": 3.5, "boom_weeks": 1, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "E.Wolf",      "position": "K", "team": "GB",  "age": 25, "projected_pts": 125, "vor_score": 25, "adp_rank": 175, "adp": 175.0, "value_delta": 0, "avg_ppr_2025": 7.4, "avg_ppr_2024": 7.0, "std_dev": 3.6, "boom_weeks": 1, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "C.Boswell",   "position": "K", "team": "PIT", "age": 30, "projected_pts": 122, "vor_score": 22, "adp_rank": 178, "adp": 178.0, "value_delta": 0, "avg_ppr_2025": 7.2, "avg_ppr_2024": 7.4, "std_dev": 3.2, "boom_weeks": 1, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "W.Lutz",      "position": "K", "team": "DEN", "age": 31, "projected_pts": 120, "vor_score": 20, "adp_rank": 180, "adp": 180.0, "value_delta": 0, "avg_ppr_2025": 7.1, "avg_ppr_2024": 6.9, "std_dev": 3.4, "boom_weeks": 1, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "G.Gano",      "position": "K", "team": "NYG", "age": 37, "projected_pts": 115, "vor_score": 15, "adp_rank": 185, "adp": 185.0, "value_delta": 0, "avg_ppr_2025": 6.8, "avg_ppr_2024": 7.0, "std_dev": 3.5, "boom_weeks": 1, "bust_weeks": 5, "risk_flag": "Age Risk"},
]

dst_units = [
    {"player_name": "San Francisco 49ers",  "position": "DEF", "team": "SF",  "age": 0, "projected_pts": 120, "vor_score": 40, "adp_rank": 190, "adp": 190.0, "value_delta": 0, "avg_ppr_2025": 7.1, "avg_ppr_2024": 6.8, "std_dev": 4.2, "boom_weeks": 3, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "Baltimore Ravens",      "position": "DEF", "team": "BAL", "age": 0, "projected_pts": 118, "vor_score": 38, "adp_rank": 192, "adp": 192.0, "value_delta": 0, "avg_ppr_2025": 6.9, "avg_ppr_2024": 7.2, "std_dev": 4.0, "boom_weeks": 3, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "Dallas Cowboys",        "position": "DEF", "team": "DAL", "age": 0, "projected_pts": 115, "vor_score": 35, "adp_rank": 194, "adp": 194.0, "value_delta": 0, "avg_ppr_2025": 6.8, "avg_ppr_2024": 6.5, "std_dev": 4.3, "boom_weeks": 3, "bust_weeks": 4, "risk_flag": None},
    {"player_name": "Buffalo Bills",         "position": "DEF", "team": "BUF", "age": 0, "projected_pts": 112, "vor_score": 32, "adp_rank": 196, "adp": 196.0, "value_delta": 0, "avg_ppr_2025": 6.6, "avg_ppr_2024": 6.4, "std_dev": 4.1, "boom_weeks": 2, "bust_weeks": 5, "risk_flag": None},
    {"player_name": "Cleveland Browns",      "position": "DEF", "team": "CLE", "age": 0, "projected_pts": 110, "vor_score": 30, "adp_rank": 198, "adp": 198.0, "value_delta": 0, "avg_ppr_2025": 6.5, "avg_ppr_2024": 6.8, "std_dev": 4.4, "boom_weeks": 2, "bust_weeks": 5, "risk_flag": None},
    {"player_name": "Pittsburgh Steelers",   "position": "DEF", "team": "PIT", "age": 0, "projected_pts": 108, "vor_score": 28, "adp_rank": 200, "adp": 200.0, "value_delta": 0, "avg_ppr_2025": 6.4, "avg_ppr_2024": 6.2, "std_dev": 4.2, "boom_weeks": 2, "bust_weeks": 5, "risk_flag": None},
    {"player_name": "New England Patriots",  "position": "DEF", "team": "NE",  "age": 0, "projected_pts": 105, "vor_score": 25, "adp_rank": 202, "adp": 202.0, "value_delta": 0, "avg_ppr_2025": 6.2, "avg_ppr_2024": 5.9, "std_dev": 4.5, "boom_weeks": 2, "bust_weeks": 5, "risk_flag": None},
    {"player_name": "Los Angeles Rams",      "position": "DEF", "team": "LAR", "age": 0, "projected_pts": 103, "vor_score": 23, "adp_rank": 204, "adp": 204.0, "value_delta": 0, "avg_ppr_2025": 6.1, "avg_ppr_2024": 5.8, "std_dev": 4.3, "boom_weeks": 2, "bust_weeks": 6, "risk_flag": None},
    {"player_name": "Minnesota Vikings",     "position": "DEF", "team": "MIN", "age": 0, "projected_pts": 100, "vor_score": 20, "adp_rank": 206, "adp": 206.0, "value_delta": 0, "avg_ppr_2025": 5.9, "avg_ppr_2024": 6.1, "std_dev": 4.4, "boom_weeks": 2, "bust_weeks": 6, "risk_flag": None},
    {"player_name": "Denver Broncos",        "position": "DEF", "team": "DEN", "age": 0, "projected_pts":  98, "vor_score": 18, "adp_rank": 208, "adp": 208.0, "value_delta": 0, "avg_ppr_2025": 5.8, "avg_ppr_2024": 5.6, "std_dev": 4.5, "boom_weeks": 1, "bust_weeks": 6, "risk_flag": None},
    {"player_name": "Green Bay Packers",     "position": "DEF", "team": "GB",  "age": 0, "projected_pts":  95, "vor_score": 15, "adp_rank": 210, "adp": 210.0, "value_delta": 0, "avg_ppr_2025": 5.6, "avg_ppr_2024": 5.4, "std_dev": 4.3, "boom_weeks": 1, "bust_weeks": 6, "risk_flag": None},
    {"player_name": "Kansas City Chiefs",    "position": "DEF", "team": "KC",  "age": 0, "projected_pts":  92, "vor_score": 12, "adp_rank": 212, "adp": 212.0, "value_delta": 0, "avg_ppr_2025": 5.4, "avg_ppr_2024": 5.8, "std_dev": 4.2, "boom_weeks": 1, "bust_weeks": 7, "risk_flag": None},
    {"player_name": "Philadelphia Eagles",   "position": "DEF", "team": "PHI", "age": 0, "projected_pts":  90, "vor_score": 10, "adp_rank": 214, "adp": 214.0, "value_delta": 0, "avg_ppr_2025": 5.3, "avg_ppr_2024": 5.5, "std_dev": 4.4, "boom_weeks": 1, "bust_weeks": 7, "risk_flag": None},
    {"player_name": "Detroit Lions",         "position": "DEF", "team": "DET", "age": 0, "projected_pts":  88, "vor_score":  8, "adp_rank": 216, "adp": 216.0, "value_delta": 0, "avg_ppr_2025": 5.2, "avg_ppr_2024": 5.0, "std_dev": 4.5, "boom_weeks": 1, "bust_weeks": 7, "risk_flag": None},
]

players = json.loads(players_path.read_text(encoding="utf-8"))
existing = {p["player_name"] for p in players}
next_rank = max(p["rank"] for p in players) + 1

added = 0
for entry in kickers + dst_units:
    if entry["player_name"] in existing:
        print(f"  SKIP {entry['player_name']} — already exists")
        continue
    entry["weekly_scores"] = [None] * 18
    entry["rank"] = next_rank
    players.append(entry)
    next_rank += 1
    added += 1

players_path.write_text(json.dumps(players, indent=2), encoding="utf-8")
print(f"Added {added} entries. Total players: {len(players)}")
k_count = sum(1 for p in players if p["position"] == "K")
d_count = sum(1 for p in players if p["position"] == "DEF")
print(f"  K: {k_count}, DEF: {d_count}")
