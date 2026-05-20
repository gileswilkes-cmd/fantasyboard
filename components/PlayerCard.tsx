import type { Player } from "@/lib/data";

const VERDICT_CONFIG = {
  "Draft now": { bg: "var(--teal-bg)", color: "var(--teal)", border: "var(--teal-dim)" },
  "Wait":       { bg: "var(--amber-tag-bg)", color: "var(--amber-tag)", border: "var(--amber-tag)" },
  "Monitor":    { bg: "var(--bg-card)", color: "var(--text-secondary)", border: "var(--border)" },
  "Avoid":      { bg: "var(--red-bg)", color: "var(--red)", border: "var(--red)" },
} as const;

type Verdict = keyof typeof VERDICT_CONFIG;

function getVerdict(player: Player): Verdict {
  if (player.risk_flag) return "Avoid";
  if (player.value_delta != null && player.value_delta > 10) return "Draft now";
  if (player.value_delta != null && player.value_delta >= 0) return "Wait";
  return "Monitor";
}

interface PlayerCardProps {
  player: Player;
}

const WEEK_COUNT = 18;
const BAR_W = 14;
const GAP = 2;
const CHART_H = 48;
const TOTAL_W = WEEK_COUNT * (BAR_W + GAP);

export default function PlayerCard({ player }: PlayerCardProps) {
  const verdict = getVerdict(player);
  const vs = VERDICT_CONFIG[verdict];

  const boomPct =
    player.boom_weeks != null ? Math.round((player.boom_weeks / 16) * 100) : 0;

  const statBoxes = [
    { label: "Avg PPR",  value: player.avg_ppr_2025?.toFixed(1) ?? "—" },
    { label: "Median",   value: player.avg_ppr_2025?.toFixed(1) ?? "—" },
    { label: "Boom%",    value: `${boomPct}%` },
    { label: "Std Dev",  value: player.std_dev?.toFixed(1) ?? "—" },
    { label: "Bust Wks", value: String(player.bust_weeks ?? "—") },
  ];

  const scores = player.weekly_scores.slice(0, WEEK_COUNT);
  const numericScores = scores.filter((s): s is number => s !== null);
  const maxScore = numericScores.length ? Math.max(...numericScores) : 1;

  return (
    <div
      style={{
        background: "#0d1f1a",
        borderLeft: "2px solid var(--teal)",
        padding: 16,
      }}
    >
      {/* One-liner */}
      <p style={{ fontStyle: "italic", color: "var(--teal)", fontSize: 13, marginBottom: 12 }}>
        2025 avg: {player.avg_ppr_2025?.toFixed(1) ?? "—"} pts/game · {player.boom_weeks ?? 0} boom weeks · std dev {player.std_dev?.toFixed(1) ?? "—"}
      </p>

      {/* Stat boxes */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {statBoxes.map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: 1,
              background: "var(--bg-secondary)",
              borderRadius: 6,
              padding: "8px 10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {value}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Strengths / Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Strengths
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Strengths will be generated
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Weaknesses
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Weaknesses will be generated
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Weekly Scores
        </div>
        <svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 ${TOTAL_W} ${CHART_H}`}
          preserveAspectRatio="none"
          style={{ display: "block" }}
        >
          {scores.map((score, i) => {
            if (score === null) return null;
            const barH = Math.max(4, (score / maxScore) * CHART_H);
            const color = score >= 20 ? "#378ADD" : score < 10 ? "#E24B4A" : "#1e2330";
            return (
              <rect
                key={i}
                x={i * (BAR_W + GAP)}
                y={CHART_H - barH}
                width={BAR_W}
                height={barH}
                fill={color}
                rx={1}
              />
            );
          })}
        </svg>
      </div>

      {/* Verdict row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            background: vs.bg,
            color: vs.color,
            border: `1px solid ${vs.border}`,
          }}
        >
          {verdict}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          Full analysis coming — AI cards generate in Session 5
        </span>
      </div>
    </div>
  );
}
