"use client";

import { useState, useEffect, useMemo } from "react";
import TabNav from "@/components/TabNav";
import { getPlayers } from "@/lib/data";
import type { Player } from "@/lib/data";

// 2026 NFL bye weeks — estimated (official schedule not yet released)
const BYE_WEEKS_2026: Record<string, number> = {
  ARI: 5,  CAR: 5,  CHI: 5,  DAL: 5,
  CLE: 6,  HOU: 6,  MIN: 6,  TEN: 6,
  ATL: 7,  BAL: 7,  BUF: 7,  NYJ: 7,
  CIN: 8,  DEN: 8,  LAC: 8,  NO: 8,
  GB: 9,   IND: 9,  LA: 9,   LAR: 9,   SF: 9,
  JAX: 10, NE: 10,  NYG: 10, PIT: 10,
  DET: 11, KC: 11,  MIA: 11, SEA: 11,
  PHI: 12, TB: 12,  WAS: 12, LV: 12,
};

const STARTER_SLOT_IDS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "Flex", "K", "DEF"];

const SLOT_POSITIONS: Record<string, string[] | null> = {
  QB:   ["QB"],
  RB1:  ["RB"],
  RB2:  ["RB"],
  WR1:  ["WR"],
  WR2:  ["WR"],
  TE:   ["TE"],
  Flex: ["RB", "WR", "TE"],
  K:    ["K"],
  DEF:  ["DEF"],
};

function playersForSlot(players: Player[], slotId: string): Player[] {
  const allowed = SLOT_POSITIONS[slotId];
  if (!allowed) return players; // bench slots — show all
  return players.filter((p) => allowed.includes(p.position));
}

const ROSTER_SLOTS = [
  { id: "QB",   label: "QB",      starter: true  },
  { id: "RB1",  label: "RB 1",    starter: true  },
  { id: "RB2",  label: "RB 2",    starter: true  },
  { id: "WR1",  label: "WR 1",    starter: true  },
  { id: "WR2",  label: "WR 2",    starter: true  },
  { id: "TE",   label: "TE",      starter: true  },
  { id: "Flex", label: "Flex",    starter: true  },
  { id: "K",    label: "K",       starter: true  },
  { id: "DEF",  label: "DEF",     starter: true  },
  { id: "B1",   label: "Bench 1", starter: false },
  { id: "B2",   label: "Bench 2", starter: false },
  { id: "B3",   label: "Bench 3", starter: false },
  { id: "B4",   label: "Bench 4", starter: false },
  { id: "B5",   label: "Bench 5", starter: false },
  { id: "B6",   label: "Bench 6", starter: false },
];

type RosterState = Record<string, Player | null>;

function emptyRoster(): RosterState {
  const r: RosterState = {};
  ROSTER_SLOTS.forEach((s) => { r[s.id] = null; });
  return r;
}

const POSITION_COLORS: Record<string, string> = {
  QB: "var(--amber-tag)",
  RB: "var(--green-tag)",
  WR: "var(--teal)",
  TE: "var(--amber-light)",
  K:  "var(--text-secondary)",
  DEF: "var(--text-secondary)",
};

function projectedTotal(roster: RosterState): number {
  return STARTER_SLOT_IDS.reduce((sum, id) => {
    return sum + (roster[id]?.projected_pts ?? 0);
  }, 0);
}

function positionCounts(roster: RosterState): Record<string, number> {
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  Object.values(roster).forEach((p) => {
    if (p && counts[p.position] !== undefined) counts[p.position]++;
  });
  return counts;
}

function riskCount(roster: RosterState): number {
  return Object.values(roster).filter((p) => p?.risk_flag).length;
}

function byeConflicts(roster: RosterState): { week: number; players: string[] }[] {
  const byeMap: Record<number, string[]> = {};
  STARTER_SLOT_IDS.forEach((id) => {
    const p = roster[id];
    if (!p) return;
    const week = BYE_WEEKS_2026[p.team];
    if (!week) return;
    if (!byeMap[week]) byeMap[week] = [];
    byeMap[week].push(p.player_name);
  });
  return Object.entries(byeMap)
    .filter(([, players]) => players.length >= 3)
    .map(([week, players]) => ({ week: Number(week), players }));
}

function biggestValue(roster: RosterState): Player | null {
  const players = Object.values(roster).filter(Boolean) as Player[];
  if (!players.length) return null;
  return players.reduce((best, p) =>
    (p.value_delta ?? -Infinity) > (best.value_delta ?? -Infinity) ? p : best
  );
}

function weakestStarter(roster: RosterState): Player | null {
  const starters = STARTER_SLOT_IDS.map((id) => roster[id]).filter(Boolean) as Player[];
  if (!starters.length) return null;
  return starters.reduce((worst, p) =>
    (p.projected_pts ?? Infinity) < (worst.projected_pts ?? Infinity) ? p : worst
  );
}

interface PlayerPickerProps {
  players: Player[];
  assigned: Set<string>;
  onSelect: (player: Player) => void;
  onClose: () => void;
  slotLabel: string;
}

function PlayerPicker({ players, assigned, onSelect, onClose, slotLabel }: PlayerPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return players.filter((p) =>
      !q ||
      p.player_name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q)
    );
  }, [players, query]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        width: 480,
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 14 }}>
            Pick player for {slotLabel}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, team, position…"
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "8px 12px",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.slice(0, 80).map((p) => {
            const isAssigned = assigned.has(p.player_name);
            return (
              <div
                key={p.player_name}
                onClick={() => !isAssigned && onSelect(p)}
                style={{
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: "1px solid #161a24",
                  cursor: isAssigned ? "default" : "pointer",
                  opacity: isAssigned ? 0.35 : 1,
                  background: "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isAssigned) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ color: POSITION_COLORS[p.position] ?? "var(--text-muted)", fontSize: 10, fontWeight: 700, width: 28 }}>{p.position}</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, flex: 1 }}>{p.player_name}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.team}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 11, width: 48, textAlign: "right" }}>
                  {p.projected_pts?.toFixed(0) ?? "—"} pts
                </span>
                {isAssigned && (
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>assigned</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RosterPanelProps {
  roster: RosterState;
  label: string;
  onSlotClick: (slotId: string) => void;
  onSlotClear: (slotId: string) => void;
}

function RosterPanel({ roster, label, onSlotClick, onSlotClear }: RosterPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ROSTER_SLOTS.map((slot, i) => {
          const player = roster[slot.id];
          const isStarter = slot.starter;
          if (i === 9 && roster["B1"] === null) {
            // Bench divider
          }
          return (
            <div key={slot.id}>
              {i === 9 && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "6px 0 4px", paddingLeft: 2 }}>
                  Bench
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 4,
                  border: `1px solid ${player ? "var(--border)" : "#1e2330"}`,
                  background: player ? "var(--bg-card)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  minHeight: 38,
                }}
                onClick={() => onSlotClick(slot.id)}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  color: isStarter ? "var(--teal-dim)" : "var(--text-muted)",
                  width: 32, flexShrink: 0,
                }}>
                  {slot.label}
                </span>
                {player ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{player.player_name}</span>
                    <span style={{ fontSize: 10, color: POSITION_COLORS[player.position] ?? "var(--text-muted)" }}>{player.position}</span>
                    <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{player.team}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{player.projected_pts?.toFixed(0)} pts</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSlotClear(slot.id); }}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px", marginLeft: 2 }}
                      title="Clear slot"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Empty — click to fill</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AnalysisPanelProps {
  roster: RosterState;
  label?: string;
}

function AnalysisPanel({ roster, label }: AnalysisPanelProps) {
  const total = projectedTotal(roster);
  const posCounts = positionCounts(roster);
  const risk = riskCount(roster);
  const conflicts = byeConflicts(roster);
  const bestValue = biggestValue(roster);
  const weakest = weakestStarter(roster);

  const riskColor = risk === 0 ? "#4ade80" : risk <= 2 ? "#EF9F27" : "#E24B4A";
  const riskBarWidth = Math.min(100, (risk / 6) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label}
        </div>
      )}

      {/* Projected total */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Projected Season Total</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: total > 0 ? "var(--teal)" : "var(--text-muted)" }}>
          {total > 0 ? total.toFixed(1) : "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>starter points</div>
      </div>

      {/* Position balance */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Position Balance</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["QB", "RB", "WR", "TE"].map((pos) => (
            <div key={pos} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 4,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: POSITION_COLORS[pos] }}>{pos}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{posCounts[pos]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk score */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Risk Score</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: riskColor }}>{risk}</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>flagged players</span>
        </div>
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${riskBarWidth}%`, background: riskColor, borderRadius: 3, transition: "width 0.3s, background 0.3s" }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {risk === 0 ? "Clean roster" : risk <= 2 ? "Monitor closely" : "High risk — reconsider"}
        </div>
      </div>

      {/* Bye week conflicts */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Bye Week Conflicts</div>
        <div style={{ fontSize: 10, color: "var(--amber-tag)", marginBottom: 6 }}>★ Weeks estimated — 2026 schedule pending</div>
        {conflicts.length === 0 ? (
          <div style={{ fontSize: 12, color: "#4ade80" }}>✓ No critical conflicts</div>
        ) : (
          conflicts.map((c) => (
            <div key={c.week} style={{
              padding: "6px 10px", borderRadius: 4,
              background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)",
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#E24B4A" }}>⚠ Week {c.week}: </span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.players.join(", ")}</span>
            </div>
          ))
        )}
      </div>

      {/* Best value / Weakest link */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Best Value</div>
          {bestValue ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{bestValue.player_name}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>↑{bestValue.value_delta} value delta</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>—</div>
          )}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Weakest Link</div>
          {weakest ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--red)" }}>{weakest.player_name}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{weakest.projected_pts?.toFixed(0)} proj pts</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>—</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThinkBoardPage() {
  const allPlayers = useMemo(() => getPlayers(), []);

  const [rosterA, setRosterA] = useState<RosterState>(emptyRoster);
  const [rosterB, setRosterB] = useState<RosterState>(emptyRoster);
  const [showComparison, setShowComparison] = useState(false);
  const [savedA, setSavedA] = useState(false);

  // picker state
  const [pickerSlot, setPickerSlot] = useState<{ slotId: string; rosterKey: "A" | "B" } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("think_board_strategy_a");
      if (saved) {
        const parsed = JSON.parse(saved);
        setRosterA(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const assignedNamesA = useMemo(
    () => new Set(Object.values(rosterA).filter(Boolean).map((p) => p!.player_name)),
    [rosterA]
  );
  const assignedNamesB = useMemo(
    () => new Set(Object.values(rosterB).filter(Boolean).map((p) => p!.player_name)),
    [rosterB]
  );

  function handleSlotClick(slotId: string, rosterKey: "A" | "B") {
    setPickerSlot({ slotId, rosterKey });
  }

  function handleSlotClear(slotId: string, rosterKey: "A" | "B") {
    if (rosterKey === "A") {
      setRosterA((prev) => ({ ...prev, [slotId]: null }));
    } else {
      setRosterB((prev) => ({ ...prev, [slotId]: null }));
    }
  }

  function handlePlayerSelect(player: Player) {
    if (!pickerSlot) return;
    if (pickerSlot.rosterKey === "A") {
      setRosterA((prev) => ({ ...prev, [pickerSlot.slotId]: player }));
    } else {
      setRosterB((prev) => ({ ...prev, [pickerSlot.slotId]: player }));
    }
    setPickerSlot(null);
  }

  function saveStrategyA() {
    try {
      localStorage.setItem("think_board_strategy_a", JSON.stringify(rosterA));
    } catch { /* ignore */ }
    setSavedA(true);
    setTimeout(() => setSavedA(false), 2000);
  }

  function activateStrategyB() {
    setRosterB({ ...rosterA });
    setShowComparison(true);
  }

  const pickerAssigned = pickerSlot?.rosterKey === "A" ? assignedNamesA : assignedNamesB;
  const pickerSlotLabel = pickerSlot ? ROSTER_SLOTS.find((s) => s.id === pickerSlot.slotId)?.label ?? pickerSlot.slotId : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)" }}>
      <TabNav position="think-board" />

      <div style={{ padding: "16px 24px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Think Board</h1>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            Build and analyse your draft strategy before the draft room
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={saveStrategyA}
            style={{
              padding: "7px 16px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: savedA ? "#0d2d1f" : "var(--bg-card)",
              border: `1px solid ${savedA ? "var(--teal)" : "var(--border)"}`,
              color: savedA ? "var(--teal)" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            {savedA ? "Saved ✓" : "Save as Strategy A"}
          </button>
          {!showComparison ? (
            <button
              onClick={activateStrategyB}
              style={{
                padding: "7px 16px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: "var(--teal)",
                border: "1px solid var(--teal)",
                color: "#fff",
              }}
            >
              Strategy B
            </button>
          ) : (
            <button
              onClick={() => setShowComparison(false)}
              style={{
                padding: "7px 16px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Exit Comparison
            </button>
          )}
        </div>
      </div>

      {!showComparison ? (
        /* Single roster mode */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: roster */}
          <div style={{ width: "60%", padding: 24, overflowY: "auto", borderRight: "1px solid var(--border)" }}>
            <RosterPanel
              roster={rosterA}
              label="Strategy A"
              onSlotClick={(id) => handleSlotClick(id, "A")}
              onSlotClear={(id) => handleSlotClear(id, "A")}
            />
          </div>
          {/* Right: analysis */}
          <div style={{ width: "40%", padding: 24, overflowY: "auto" }}>
            <AnalysisPanel roster={rosterA} />
          </div>
        </div>
      ) : (
        /* Comparison mode */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Strategy A */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto", borderRight: "1px solid var(--border)" }}>
            <RosterPanel
              roster={rosterA}
              label="Strategy A"
              onSlotClick={(id) => handleSlotClick(id, "A")}
              onSlotClear={(id) => handleSlotClear(id, "A")}
            />
            <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Projected Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--teal)", marginTop: 2 }}>{projectedTotal(rosterA).toFixed(1)}</div>
            </div>
            <div style={{ marginTop: 12 }}><AnalysisPanel roster={rosterA} /></div>
          </div>
          {/* Strategy B */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            <RosterPanel
              roster={rosterB}
              label="Strategy B"
              onSlotClick={(id) => handleSlotClick(id, "B")}
              onSlotClear={(id) => handleSlotClear(id, "B")}
            />
            <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Projected Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--teal)", marginTop: 2 }}>{projectedTotal(rosterB).toFixed(1)}</div>
            </div>
            <div style={{ marginTop: 12 }}><AnalysisPanel roster={rosterB} /></div>
          </div>
        </div>
      )}

      {pickerSlot && (
        <PlayerPicker
          players={playersForSlot(allPlayers, pickerSlot.slotId)}
          assigned={pickerAssigned}
          onSelect={handlePlayerSelect}
          onClose={() => setPickerSlot(null)}
          slotLabel={pickerSlotLabel}
        />
      )}
    </div>
  );
}
