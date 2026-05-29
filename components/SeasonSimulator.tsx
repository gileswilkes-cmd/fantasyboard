"use client";

import { useState, useRef, useCallback } from "react";
import type { Player } from "@/lib/data";
import { runOneSeason, precomputeStats, aggregateResults } from "@/lib/simulate";
import type { SeasonOutcome, SimulationResult, PlayerSimStats } from "@/lib/simulate";

const NUM_TEAMS = 14;
const SIM_COUNT = 1000;
const CHUNK_SIZE = 50;
const COMPETITIVE_BOT_COUNT = 8;

type Difficulty = "standard" | "competitive";
type SortKey = keyof Pick<
  PlayerSimStats,
  "avg_weekly_pts" | "avg_season_pts" | "boom_rate" | "letdown_weeks" | "champion_avg" | "variance_impact" | "contribution_rank"
>;

interface Props {
  allTeamStarters: Player[][];
  myTeamIdx: number;
  allPlayers: Player[];
}

// ─── Build strong VOR-optimal teams for competitive mode ─────────────────────

function buildCompetitiveTeams(
  allPlayers: Player[],
  excludeNames: Set<string>,
  numTeams: number
): Player[][] {
  const POS_LIMITS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };
  const pool = [...allPlayers]
    .filter((p) => !excludeNames.has(p.player_name))
    .sort((a, b) => (b.vor_score ?? -999) - (a.vor_score ?? -999));

  const teams: Player[][] = Array.from({ length: numTeams }, () => []);

  // Round-robin fill: for each position, assign top players across all teams
  for (const [pos, n] of Object.entries(POS_LIMITS)) {
    const posPool = pool.filter((p) => p.position === pos);
    for (let pick = 0; pick < n * numTeams && pick < posPool.length; pick++) {
      teams[pick % numTeams].push(posPool[pick]);
    }
  }

  // Flex: best remaining RB/WR/TE round-robin
  const usedNames = new Set(teams.flat().map((p) => p.player_name));
  const flexPool = pool.filter(
    (p) => ["RB", "WR", "TE"].includes(p.position) && !usedNames.has(p.player_name)
  );
  for (let i = 0; i < numTeams && i < flexPool.length; i++) {
    teams[i].push(flexPool[i]);
    usedNames.add(flexPool[i].player_name);
  }

  return teams;
}

// ─── Sortable table column header ─────────────────────────────────────────────

function TH({
  label, sortKey, current, dir, onClick,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void;
}) {
  const active = sortKey === current;
  return (
    <th
      onClick={() => onClick(sortKey)}
      style={{
        padding: "7px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", textAlign: "right", whiteSpace: "nowrap",
        cursor: "pointer", userSelect: "none",
        color: active ? "var(--teal)" : "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SeasonSimulator({ allTeamStarters, myTeamIdx, allPlayers }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [simState, setSimState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("variance_impact");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const outcomesRef = useRef<SeasonOutcome[]>([]);
  const cancelRef = useRef(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const runSimulation = useCallback(() => {
    setSimState("running");
    setProgress(0);
    setResult(null);
    setAiSentence(null);
    outcomesRef.current = [];
    cancelRef.current = false;

    // Build effective team starters (possibly with competitive replacements)
    const effectiveStarters = [...allTeamStarters];
    if (difficulty === "competitive") {
      const myPlayerNames = new Set(
        (allTeamStarters[myTeamIdx] ?? []).map((p) => p.player_name)
      );
      const competitiveTeams = buildCompetitiveTeams(allPlayers, myPlayerNames, COMPETITIVE_BOT_COUNT);

      // Replace first COMPETITIVE_BOT_COUNT bot slots (skip myTeamIdx)
      let replaced = 0;
      for (let i = 0; i < NUM_TEAMS && replaced < COMPETITIVE_BOT_COUNT; i++) {
        if (i === myTeamIdx) continue;
        effectiveStarters[i] = competitiveTeams[replaced];
        replaced++;
      }
    }

    const allStats = precomputeStats(effectiveStarters);
    const myStarters = allTeamStarters[myTeamIdx] ?? [];
    let done = 0;

    function runChunk() {
      if (cancelRef.current) return;
      const end = Math.min(done + CHUNK_SIZE, SIM_COUNT);
      while (done < end) {
        outcomesRef.current.push(runOneSeason(allStats, myTeamIdx));
        done++;
      }
      setProgress(Math.round((done / SIM_COUNT) * 100));

      if (done < SIM_COUNT) {
        setTimeout(runChunk, 0);
      } else {
        const simResult = aggregateResults(outcomesRef.current, NUM_TEAMS, myStarters);
        setResult(simResult);
        setSimState("done");

        setAiLoading(true);
        fetch("/api/sim-assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playoffRate: simResult.playoffRate,
            champRate: simResult.champRate,
            avgWins: simResult.avgWins,
            avgPtsPerWeek: simResult.avgPtsPerWeek,
            top10PctWins: simResult.top10PctWins,
            bot10PctWins: simResult.bot10PctWins,
            difficulty,
          }),
        })
          .then((r) => r.json())
          .then((d) => { setAiSentence(d.sentence); setAiLoading(false); })
          .catch(() => { setAiSentence("Simulation complete."); setAiLoading(false); });
      }
    }

    setTimeout(runChunk, 0);
  }, [allTeamStarters, myTeamIdx, allPlayers, difficulty]);

  // ── Derived display values ──────────────────────────────────────────────────

  const playoffColor = result
    ? result.playoffRate >= 0.6 ? "#4ade80"
      : result.playoffRate >= 0.4 ? "#EF9F27"
      : "#E24B4A"
    : "var(--teal)";
  const maxFrac = result ? Math.max(...result.finishDist, 0.01) : 0.01;

  const sortedPlayers = result
    ? [...result.playerStats].sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
      })
    : [];

  // Insight players
  const mvp = result?.playerStats.length
    ? result.playerStats.reduce((b, p) => p.variance_impact > b.variance_impact ? p : b)
    : null;
  const weakLink = result?.playerStats.length
    ? result.playerStats.reduce((b, p) => p.bust_rate > b.bust_rate ? p : b)
    : null;
  const playoffPerformer = result?.playerStats.length
    ? result.playerStats.reduce((b, p) =>
        (p.champion_avg - p.nonplayoff_avg) > (b.champion_avg - b.nonplayoff_avg) ? p : b)
    : null;

  const bustThresholdFor = (pos: string) => ["TE", "K", "DEF"].includes(pos) ? 5 : 10;

  return (
    <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
        Simulate Season
      </div>

      {/* ── Idle — difficulty toggle + run button ─────────────────────────── */}
      {simState === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Bot difficulty:</span>
            {(["standard", "competitive"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", textTransform: "capitalize",
                  background: difficulty === d ? "var(--teal)" : "var(--bg-card)",
                  border: `1px solid ${difficulty === d ? "var(--teal)" : "var(--border)"}`,
                  color: difficulty === d ? "#fff" : "var(--text-secondary)",
                }}
              >
                {d}
              </button>
            ))}
            {difficulty === "competitive" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                8 bots draft by pure VOR — expect 8-15% title odds
              </span>
            )}
          </div>
          <button
            onClick={runSimulation}
            style={{
              alignSelf: "flex-start", padding: "12px 28px", borderRadius: 6, fontSize: 14,
              fontWeight: 700, background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            ▶ Run 1,000 Simulations
          </button>
        </div>
      )}

      {/* ── Running ──────────────────────────────────────────────────────────── */}
      {simState === "running" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Simulating {SIM_COUNT.toLocaleString()} seasons
            {difficulty === "competitive" ? " (competitive)" : ""}… {progress}%
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${progress}%`, background: "var(--teal)", transition: "width 0.1s" }} />
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {simState === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Key stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div style={{ background: "var(--bg-card)", border: `1px solid ${playoffColor}`, borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Playoff Odds</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: playoffColor, lineHeight: 1 }}>{(result.playoffRate * 100).toFixed(0)}%</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Title Odds</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--amber-tag)", lineHeight: 1 }}>{(result.champRate * 100).toFixed(1)}%</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Avg Wins</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{result.avgWins.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>of 17</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pts / Week</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{result.avgPtsPerWeek.toFixed(1)}</div>
            </div>
          </div>

          {/* Best / worst */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            In your best 10% of seasons you averaged{" "}
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{result.top10PctWins.toFixed(1)} wins</span>.{" "}
            In your worst 10% you averaged{" "}
            <span style={{ color: "var(--red)", fontWeight: 700 }}>{result.bot10PctWins.toFixed(1)} wins</span>.
          </div>

          {/* Finish distribution */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Finish Distribution — 1,000 simulations
            </div>
            <svg width="100%" height={NUM_TEAMS * 22} style={{ display: "block", overflow: "visible" }}>
              {result.finishDist.map((frac, i) => {
                const barW = `${(frac / maxFrac) * 74}%`;
                const y = i * 22;
                const barColor = i === 0 ? "#EF9F27" : i < 6 ? "#1D9E75" : "#374151";
                return (
                  <g key={i}>
                    <text x="20" y={y + 14} fontSize={10} fill="#6b7280" textAnchor="end" fontFamily="-apple-system,sans-serif">{i + 1}</text>
                    <rect x="24" y={y + 3} width={barW} height={15} fill={barColor} rx={2} />
                    <text y={y + 14} fontSize={10} fill="#9ca3af" fontFamily="-apple-system,sans-serif">
                      <tspan dx={`calc(24px + ${barW} + 4px)`}>{frac >= 0.001 ? `${(frac * 100).toFixed(1)}%` : "—"}</tspan>
                    </text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: "var(--text-muted)" }}>
              <span><span style={{ color: "#EF9F27" }}>■</span> Champion</span>
              <span><span style={{ color: "#1D9E75" }}>■</span> Playoff (top 6)</span>
              <span><span style={{ color: "#374151" }}>■</span> Missed playoffs</span>
            </div>
          </div>

          {/* ── Player breakdown ────────────────────────────────────────────── */}
          {sortedPlayers.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Player Breakdown — click headers to sort
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        Player
                      </th>
                      <th style={{ padding: "7px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                        Pos
                      </th>
                      <TH label="Avg/Wk" sortKey="avg_weekly_pts" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <TH label="Season" sortKey="avg_season_pts" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <TH label="Boom%" sortKey="boom_rate" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <TH label="Bust Wks" sortKey="letdown_weeks" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <TH label="Champ Avg" sortKey="champion_avg" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <TH label="Impact" sortKey="variance_impact" current={sortKey} dir={sortDir} onClick={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((p) => {
                      const isKeyPlayer = p.variance_impact > 0.3;
                      const hasBustConcern = p.letdown_weeks > 4;
                      const playoffSwing = p.nonplayoff_avg > 0
                        ? (p.champion_avg - p.nonplayoff_avg) / p.nonplayoff_avg
                        : 0;
                      const isPlayoffPerformer = playoffSwing > 0.15;

                      return (
                        <tr
                          key={p.player_name}
                          style={{
                            borderBottom: "1px solid #1e2330",
                            borderLeft: isKeyPlayer ? "2px solid var(--teal)" : "2px solid transparent",
                          }}
                        >
                          <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                            {p.player_name}
                            {isPlayoffPerformer && <span style={{ marginLeft: 5, color: "#EF9F27", fontSize: 11 }} title="Playoff performer">★</span>}
                          </td>
                          <td style={{ padding: "8px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{p.position}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "var(--text-primary)" }}>{p.avg_weekly_pts.toFixed(1)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>{p.avg_season_pts.toFixed(0)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "#4ade80" }}>{(p.boom_rate * 100).toFixed(0)}%</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: hasBustConcern ? "var(--amber-tag)" : "var(--text-secondary)" }}>
                            {hasBustConcern && <span style={{ marginRight: 3 }}>⚠</span>}
                            {p.letdown_weeks.toFixed(1)}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "var(--amber-tag)" }}>{p.champion_avg.toFixed(1)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isKeyPlayer ? "var(--teal)" : "var(--text-secondary)" }}>
                            {p.variance_impact.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "8px 16px", fontSize: 10, color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                <span style={{ color: "var(--teal)" }}>│</span> Key player (impact &gt; 0.3) &nbsp;·&nbsp;
                <span style={{ color: "var(--amber-tag)" }}>⚠</span> Reliability concern (bust wks &gt; 4) &nbsp;·&nbsp;
                <span style={{ color: "#EF9F27" }}>★</span> Playoff performer (&gt;15% pts swing)
              </div>
            </div>
          )}

          {/* ── Insight cards ────────────────────────────────────────────────── */}
          {mvp && weakLink && playoffPerformer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* MVP */}
              <div style={{ background: "rgba(29,158,117,0.06)", border: "1px solid var(--teal-dim)", borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Your MVP — {mvp.player_name}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                  In simulations where {mvp.player_name} averaged{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{mvp.good_season_avg.toFixed(1)} pts/week</strong>{" "}
                  you won the title{" "}
                  <strong style={{ color: "#4ade80" }}>{(mvp.good_season_champ_rate * 100).toFixed(1)}%</strong>{" "}
                  of the time. When they averaged{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{mvp.bad_season_avg.toFixed(1)} pts/week</strong>{" "}
                  you missed the playoffs{" "}
                  <strong style={{ color: "var(--red)" }}>{(mvp.bad_season_miss_rate * 100).toFixed(1)}%</strong>{" "}
                  of the time.
                </p>
              </div>

              {/* Weak link */}
              <div style={{ background: "rgba(239,159,39,0.05)", border: "1px solid rgba(239,159,39,0.3)", borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--amber-tag)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Your Weak Link — {weakLink.player_name}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                  {weakLink.player_name} busted below{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{bustThresholdFor(weakLink.position)} pts</strong>{" "}
                  an average of{" "}
                  <strong style={{ color: "var(--amber-tag)" }}>{weakLink.letdown_weeks.toFixed(1)} weeks</strong>{" "}
                  per season ({(weakLink.bust_rate * 100).toFixed(0)}% of weeks). Impact score:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{weakLink.variance_impact.toFixed(3)}</strong>.
                </p>
              </div>

              {/* Playoff performer */}
              <div style={{ background: "rgba(239,159,39,0.04)", border: "1px solid rgba(239,159,39,0.2)", borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#EF9F27", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Your Playoff Performer — {playoffPerformer.player_name}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                  {playoffPerformer.player_name} averaged{" "}
                  <strong style={{ color: "#EF9F27" }}>{playoffPerformer.champion_avg.toFixed(1)} pts/week</strong>{" "}
                  in your title-winning seasons vs{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{playoffPerformer.nonplayoff_avg.toFixed(1)} pts/week</strong>{" "}
                  when you missed the playoffs — the biggest performance swing on your roster.
                </p>
              </div>
            </div>
          )}

          {/* AI outlook */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--teal-dim)", borderRadius: 8, padding: "14px 20px" }}>
            <div style={{ fontSize: 10, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
              AI Outlook {difficulty === "competitive" ? "(competitive field)" : ""}
            </div>
            {aiLoading ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Generating outlook…</div>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, fontStyle: "italic", margin: 0 }}>{aiSentence}</p>
            )}
          </div>

          <button
            onClick={() => { cancelRef.current = true; setSimState("idle"); setResult(null); }}
            style={{
              alignSelf: "flex-start", padding: "8px 20px", borderRadius: 5, fontSize: 12,
              fontWeight: 600, cursor: "pointer", background: "var(--bg-card)",
              border: "1px solid var(--border)", color: "var(--text-secondary)",
            }}
          >
            ↺ Run Again
          </button>
        </div>
      )}
    </div>
  );
}
