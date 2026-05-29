"use client";

import { useState, useRef, useCallback } from "react";
import type { Player } from "@/lib/data";
import { runOneSeason, precomputeStats, aggregateResults } from "@/lib/simulate";
import type { SeasonOutcome, SimulationResult } from "@/lib/simulate";

const NUM_TEAMS = 14;
const SIM_COUNT = 1000;
const CHUNK_SIZE = 50;

interface Props {
  allTeamStarters: Player[][];
  myTeamIdx: number;
}

export default function SeasonSimulator({ allTeamStarters, myTeamIdx }: Props) {
  const [simState, setSimState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const outcomesRef = useRef<SeasonOutcome[]>([]);
  const cancelRef = useRef(false);

  const runSimulation = useCallback(() => {
    setSimState("running");
    setProgress(0);
    setResult(null);
    setAiSentence(null);
    outcomesRef.current = [];
    cancelRef.current = false;

    // Pre-compute player stats once — Box-Muller draws happen inside runOneSeason
    const allStats = precomputeStats(allTeamStarters);
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
        setTimeout(runChunk, 0); // yield to browser between chunks
      } else {
        const simResult = aggregateResults(outcomesRef.current, NUM_TEAMS);
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
          }),
        })
          .then((r) => r.json())
          .then((d) => { setAiSentence(d.sentence); setAiLoading(false); })
          .catch(() => { setAiSentence("Simulation complete."); setAiLoading(false); });
      }
    }

    setTimeout(runChunk, 0);
  }, [allTeamStarters, myTeamIdx]);

  const playoffColor = result
    ? result.playoffRate >= 0.6 ? "#4ade80"
      : result.playoffRate >= 0.4 ? "#EF9F27"
      : "#E24B4A"
    : "var(--teal)";

  const maxFrac = result ? Math.max(...result.finishDist, 0.01) : 0.01;

  return (
    <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
        Simulate Season
      </div>

      {simState === "idle" && (
        <button
          onClick={runSimulation}
          style={{
            padding: "12px 28px", borderRadius: 6, fontSize: 14, fontWeight: 700,
            background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
          }}
        >
          ▶ Run 1000 Simulations
        </button>
      )}

      {simState === "running" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Simulating {SIM_COUNT.toLocaleString()} seasons… {progress}%
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${progress}%`, background: "var(--teal)", transition: "width 0.1s" }} />
          </div>
        </div>
      )}

      {simState === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Key stats — 4-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div style={{ background: "var(--bg-card)", border: `1px solid ${playoffColor}`, borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Playoff Odds</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: playoffColor, lineHeight: 1 }}>
                {(result.playoffRate * 100).toFixed(0)}%
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Title Odds</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--amber-tag)", lineHeight: 1 }}>
                {(result.champRate * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Avg Wins</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {result.avgWins.toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>of 17</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pts / Week</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {result.avgPtsPerWeek.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Best / worst case */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            In your best 10% of seasons you averaged{" "}
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{result.top10PctWins.toFixed(1)} wins</span>.{" "}
            In your worst 10% you averaged{" "}
            <span style={{ color: "var(--red)", fontWeight: 700 }}>{result.bot10PctWins.toFixed(1)} wins</span>.
          </div>

          {/* Finish distribution chart */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Finish Distribution — 1,000 simulations
            </div>
            <svg width="100%" height={NUM_TEAMS * 22} style={{ display: "block", overflow: "visible" }}>
              {result.finishDist.map((frac, i) => {
                const BAR_MAX_PCT = 75; // % of SVG width used for bars
                const barW = `${(frac / maxFrac) * BAR_MAX_PCT}%`;
                const y = i * 22;
                const barColor = i === 0 ? "#EF9F27" : i < 6 ? "#1D9E75" : "#374151";
                const pctLabel = frac >= 0.001 ? `${(frac * 100).toFixed(1)}%` : "—";
                return (
                  <g key={i}>
                    <text x="20" y={y + 14} fontSize={10} fill="#6b7280" textAnchor="end" fontFamily="-apple-system,sans-serif">
                      {i + 1}
                    </text>
                    <rect x="24" y={y + 3} width={barW} height={15} fill={barColor} rx={2} />
                    <text y={y + 14} fontSize={10} fill="#9ca3af" fontFamily="-apple-system,sans-serif">
                      <tspan dx={`calc(24px + ${barW} + 4px)`}>{pctLabel}</tspan>
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

          {/* AI outlook */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--teal-dim)", borderRadius: 8, padding: "14px 20px" }}>
            <div style={{ fontSize: 10, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
              AI Outlook
            </div>
            {aiLoading ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Generating outlook…</div>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, fontStyle: "italic", margin: 0 }}>
                {aiSentence}
              </p>
            )}
          </div>

          <button
            onClick={() => { setSimState("idle"); setResult(null); cancelRef.current = true; }}
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
