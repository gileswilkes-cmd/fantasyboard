interface Stat {
  value: string;
  label: string;
}

interface StatsStripProps {
  stats: Stat[];
}

export default function StatsStrip({ stats }: StatsStripProps) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      background: "var(--bg-primary)",
      borderBottom: "1px solid var(--border)",
    }}>
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            padding: "16px 20px",
            borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
