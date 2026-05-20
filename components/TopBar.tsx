export default function TopBar() {
  return (
    <div style={{
      height: 48,
      background: "var(--bg-secondary)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Fantasy
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--teal)", letterSpacing: "-0.02em" }}>
          Board
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
          · 2026 draft · PPR · 14 teams
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--teal-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--teal-light)",
        }}>
          GJ
        </div>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#0a3d2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "#5ab898",
        }}>
          SJ
        </div>
      </div>
    </div>
  );
}
