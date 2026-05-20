interface PositionHeroProps {
  position: string;
  summary: string;
}

export default function PositionHero({ position, summary }: PositionHeroProps) {
  const words = position.trim().split(" ");
  const lastWord = words[words.length - 1];
  const leadWords = words.slice(0, -1).join(" ");

  return (
    <div style={{
      padding: "28px 24px",
      borderBottom: "1px solid var(--border)",
    }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, marginBottom: 10, letterSpacing: "-0.02em" }}>
        {leadWords && (
          <span style={{ color: "var(--text-primary)" }}>{leadWords} </span>
        )}
        <span style={{ color: "var(--teal)" }}>{lastWord}</span>
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 560 }}>
        {summary}
      </p>
    </div>
  );
}
