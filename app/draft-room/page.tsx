"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import TabNav from "@/components/TabNav";
import { getPlayers } from "@/lib/data";
import type { Player } from "@/lib/data";
import { getTier, getTierConfig } from "@/lib/tiers";

const NUM_TEAMS = 14;

// ─── Position roster limits (full draft) ─────────────────────────────────────

const POS_LIMITS: Record<string, number> = {
  QB: 2, RB: 6, WR: 6, TE: 3, K: 1, DEF: 1,
};

// ─── Saved draft state shape ──────────────────────────────────────────────────

interface SavedDraftState {
  picks: (Player | null)[];
  currentPickIndex: number;
  userSlot: number;
  totalRounds: number;
  phase: "drafting" | "report";
}

// ─── Snake-draft helpers ──────────────────────────────────────────────────────

function getTeamSlot(pickIndex: number): number {
  const round = Math.floor(pickIndex / NUM_TEAMS) + 1;
  const pos = pickIndex % NUM_TEAMS;
  return round % 2 === 1 ? pos + 1 : NUM_TEAMS - pos;
}

function pickIndexForCell(round: number, slot: number): number {
  if (round % 2 === 1) return (round - 1) * NUM_TEAMS + (slot - 1);
  return (round - 1) * NUM_TEAMS + (NUM_TEAMS - slot);
}

function getBotIndex(slot: number, userSlot: number): number {
  let idx = 0;
  for (let s = 1; s <= NUM_TEAMS; s++) {
    if (s === userSlot) continue;
    if (s === slot) return idx;
    idx++;
  }
  return 0;
}

function bestBy<K extends keyof Player>(
  arr: Player[],
  key: K,
  dir: "asc" | "desc" = "desc"
): Player {
  return arr.reduce((best, p) => {
    const bv = best[key] ?? (dir === "desc" ? -Infinity : Infinity);
    const pv = p[key] ?? (dir === "desc" ? -Infinity : Infinity);
    return (dir === "desc" ? (pv as number) > (bv as number) : (pv as number) < (bv as number)) ? p : best;
  });
}

// ─── Bot personalities ────────────────────────────────────────────────────────

interface Bot {
  name: string;
  pick(available: Player[], roster: Player[], round: number): Player;
}

const BOT_PERSONALITIES: Bot[] = [
  {
    name: "RB Hoarder",
    pick(available, _roster, round) {
      if (round <= 4) {
        const rbs = available.filter((p) => p.position === "RB");
        if (rbs.length) return rbs[0];
      }
      return available[0];
    },
  },
  {
    name: "QB Rusher",
    pick(available, _roster, round) {
      if (round === 1) {
        const qbs = available.filter((p) => p.position === "QB");
        if (qbs.length) return qbs[0];
      }
      return available[0];
    },
  },
  {
    name: "Zero RB",
    pick(available, _roster, round) {
      if (round <= 4) {
        const wrte = available.filter((p) => p.position === "WR" || p.position === "TE");
        if (wrte.length) return wrte[0];
      }
      return available[0];
    },
  },
  {
    name: "Value Lurker",
    pick(available) {
      const positive = available.filter((p) => (p.value_delta ?? 0) > 0);
      if (positive.length) return bestBy(positive, "value_delta", "desc");
      return available[0];
    },
  },
  {
    name: "Safe Stan",
    pick(available) {
      const safe = available.filter((p) => !p.risk_flag);
      return (safe.length ? safe : available)[0];
    },
  },
  {
    name: "Boom Chaser",
    pick(available) {
      const withBoom = available.filter((p) => p.boom_weeks != null);
      return withBoom.length ? bestBy(withBoom, "boom_weeks", "desc") : available[0];
    },
  },
  {
    name: "ADP Slave",
    pick(available) {
      const withAdp = available.filter((p) => p.adp_rank != null);
      return withAdp.length ? bestBy(withAdp, "adp_rank", "asc") : available[0];
    },
  },
  {
    name: "Name Drafter",
    pick(available) {
      const with24 = available.filter((p) => p.avg_ppr_2024 != null);
      return with24.length ? bestBy(with24, "avg_ppr_2024", "desc") : available[0];
    },
  },
  {
    name: "TE Ignorer",
    pick(available, _roster, round) {
      if (round < 14) {
        const nonTE = available.filter((p) => p.position !== "TE" && p.position !== "K" && p.position !== "DEF");
        if (nonTE.length) return nonTE[0];
      }
      return available[0];
    },
  },
  {
    name: "Sleeper Hunter",
    pick(available) {
      const sleepers = available.filter((p) => (p.adp_rank ?? 0) > 100 && p.value_delta != null);
      if (sleepers.length) return bestBy(sleepers, "value_delta", "desc");
      const withDelta = available.filter((p) => p.value_delta != null);
      return withDelta.length ? bestBy(withDelta, "value_delta", "desc") : available[0];
    },
  },
  {
    name: "Panic Filler",
    pick(available, roster, round) {
      if (round >= 6) {
        const have = new Set(roster.map((p) => p.position));
        const coreNeeds = ["QB", "RB", "WR", "TE"];
        const lateNeeds = round >= 13 ? ["K", "DEF"] : [];
        const missing = [...coreNeeds, ...lateNeeds].find((pos) => !have.has(pos));
        if (missing) {
          const posPlayers = available.filter((p) => p.position === missing);
          if (posPlayers.length) return posPlayers[0];
        }
      }
      return available[0];
    },
  },
  {
    name: "Contrarian",
    pick(available) {
      const withDelta = available.filter((p) => p.value_delta != null);
      return withDelta.length ? bestBy(withDelta, "value_delta", "asc") : available[0];
    },
  },
  {
    name: "The Sleepwalker",
    pick(available) {
      const top = available.slice(0, Math.min(40, available.length));
      return top[Math.floor(Math.random() * top.length)];
    },
  },
];

// ─── Roster slot helpers ──────────────────────────────────────────────────────

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

function assignToSlots(playerList: Player[]): RosterState {
  const roster = emptyRoster();
  const c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  let bench = 0;
  let flexFilled = false;

  for (const p of playerList) {
    const pos = p.position;
    if (pos === "QB" && c.QB === 0) { roster.QB = p; c.QB++; }
    else if (pos === "RB" && c.RB < 2) { roster[`RB${c.RB + 1}`] = p; c.RB++; }
    else if (pos === "WR" && c.WR < 2) { roster[`WR${c.WR + 1}`] = p; c.WR++; }
    else if (pos === "TE" && c.TE === 0) { roster.TE = p; c.TE++; }
    else if (!flexFilled && (pos === "RB" || pos === "WR" || pos === "TE")) { roster.Flex = p; flexFilled = true; }
    else if (pos === "K" && c.K === 0) { roster.K = p; c.K++; }
    else if (pos === "DEF" && c.DEF === 0) { roster.DEF = p; c.DEF++; }
    else if (bench < 6) { roster[`B${bench + 1}`] = p; bench++; }
  }
  return roster;
}

// ─── Bot short codes for grid header ─────────────────────────────────────────

const BOT_CODES: Record<string, string> = {
  "RB Hoarder":     "RBH",
  "QB Rusher":      "QBR",
  "Zero RB":        "ZRB",
  "Value Lurker":   "VAL",
  "Safe Stan":      "SAF",
  "Boom Chaser":    "BMC",
  "ADP Slave":      "ADP",
  "Name Drafter":   "NAM",
  "TE Ignorer":     "TEI",
  "Sleeper Hunter": "SLP",
  "Panic Filler":   "PAN",
  "Contrarian":     "CON",
  "The Sleepwalker":"ZZZ",
};

// ─── UI constants ─────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  QB: "var(--amber-tag)",
  RB: "var(--green-tag)",
  WR: "var(--teal)",
  TE: "var(--amber-light)",
  K:  "var(--text-secondary)",
  DEF:"var(--text-secondary)",
};

const POS_BG: Record<string, string> = {
  QB: "var(--amber-tag-bg)",
  RB: "var(--green-tag-bg)",
  WR: "var(--teal-bg)",
  TE: "var(--amber-tag-bg2)",
  K:  "var(--bg-secondary)",
  DEF:"var(--bg-secondary)",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function DraftRoomPage() {
  const allPlayers = useMemo(() => getPlayers(), []);

  // Setup
  const [phase, setPhase] = useState<"setup" | "drafting" | "report">("setup");
  const [userSlot, setUserSlot] = useState(7);
  const [totalRounds, setTotalRounds] = useState(16);
  const [slotInput, setSlotInput] = useState("7");

  // Draft state
  const [picks, setPicks] = useState<(Player | null)[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Saved draft resume
  const [savedDraftData, setSavedDraftData] = useState<SavedDraftState | null>(null);

  // Report
  const [assessment, setAssessment] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  // Left panel
  const [searchQuery, setSearchQuery] = useState("");

  // Stable refs to avoid stale closures in timers
  const stateRef = useRef({ picks, currentPickIndex, userSlot, totalRounds, phase });
  useEffect(() => {
    stateRef.current = { picks, currentPickIndex, userSlot, totalRounds, phase };
  });

  // ── Load saved draft on mount ────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ff_draft_state");
      if (saved) {
        const data: SavedDraftState = JSON.parse(saved);
        if ((data.phase === "drafting" || data.phase === "report") && Array.isArray(data.picks)) {
          setSavedDraftData(data);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Persist draft state on every pick ───────────────────────────────────
  useEffect(() => {
    if (phase !== "drafting" && phase !== "report") return;
    try {
      localStorage.setItem("ff_draft_state", JSON.stringify({
        picks, currentPickIndex, userSlot, totalRounds, phase,
      }));
    } catch { /* ignore */ }
  }, [picks, currentPickIndex, phase, userSlot, totalRounds]);

  // ── Increment draft counter when a draft session completes ───────────────
  const prevPhaseRef = useRef<string>("setup");
  useEffect(() => {
    if (phase === "report" && prevPhaseRef.current === "drafting") {
      try {
        const n = Number(localStorage.getItem("ff_drafts_run") ?? "0");
        localStorage.setItem("ff_drafts_run", String(n + 1));
      } catch { /* ignore */ }
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // ── Toast auto-dismiss ───────────────────────────────────────────────────
  const toastId = toast?.id;
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toastId]);

  // ── Bot turn engine ──────────────────────────────────────────────────────
  const isUserTurn =
    phase === "drafting" &&
    currentPickIndex < totalRounds * NUM_TEAMS &&
    getTeamSlot(currentPickIndex) === userSlot;

  useEffect(() => {
    if (phase !== "drafting") return;
    if (currentPickIndex >= totalRounds * NUM_TEAMS) {
      setPhase("report");
      return;
    }
    if (getTeamSlot(currentPickIndex) === userSlot) return;

    const timer = setTimeout(() => {
      const { picks: p, currentPickIndex: idx, userSlot: us, totalRounds: tr, phase: ph } = stateRef.current;
      if (ph !== "drafting") return;

      const draftedNames = new Set(p.slice(0, idx).filter(Boolean).map((x) => x!.player_name));
      const available = allPlayers.filter((x) => !draftedNames.has(x.player_name));
      if (!available.length) return;

      const slot = getTeamSlot(idx);
      const botIdx = getBotIndex(slot, us);
      const personality = BOT_PERSONALITIES[botIdx];

      // Build bot's current roster
      const botRoster: Player[] = [];
      for (let i = 0; i < idx; i++) {
        if (getTeamSlot(i) === slot && p[i]) botRoster.push(p[i]!);
      }

      // Filter available players by this bot's position limits
      const botPosCounts: Record<string, number> = {};
      botRoster.forEach((pl) => {
        botPosCounts[pl.position] = (botPosCounts[pl.position] ?? 0) + 1;
      });
      const availableForBot = available.filter(
        (pl) => (botPosCounts[pl.position] ?? 0) < (POS_LIMITS[pl.position] ?? 999)
      );
      const botPool = availableForBot.length > 0 ? availableForBot : available;

      const round = Math.floor(idx / NUM_TEAMS) + 1;
      const botPick = personality.pick(botPool, botRoster, round);

      const nextIdx = idx + 1;
      setPicks((prev) => {
        const next = [...prev];
        next[idx] = botPick;
        return next;
      });
      setCurrentPickIndex(nextIdx);
      setToast({ id: Date.now(), text: `${personality.name} takes ${botPick.player_name} (${botPick.position}, ${botPick.team})` });

      if (nextIdx >= tr * NUM_TEAMS) setPhase("report");
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentPickIndex, phase, userSlot, totalRounds, allPlayers]);

  // ── AI assessment on report ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "report") return;

    const userPicksForAssessment = picks
      .filter((p, i) => p != null && getTeamSlot(i) === userSlot)
      .map((p) => p!);

    setAssessmentLoading(true);
    fetch("/api/draft-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roster: userPicksForAssessment.map((p) => ({
          name: p.player_name,
          position: p.position,
          team: p.team,
          projectedPts: p.projected_pts,
        })),
      }),
    })
      .then((r) => r.json())
      .then((d) => { setAssessment(d.assessment); setAssessmentLoading(false); })
      .catch(() => { setAssessment("Unable to generate assessment at this time."); setAssessmentLoading(false); });
  }, [phase]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function randomiseSlot() {
    const s = Math.ceil(Math.random() * 14);
    setUserSlot(s);
    setSlotInput(String(s));
  }

  function startDraft() {
    try { localStorage.removeItem("ff_draft_state"); } catch { /* ignore */ }
    setSavedDraftData(null);
    const total = totalRounds * NUM_TEAMS;
    setPicks(Array(total).fill(null));
    setCurrentPickIndex(0);
    setPhase("drafting");
  }

  function resumeDraft() {
    if (!savedDraftData) return;
    setPicks(savedDraftData.picks);
    setCurrentPickIndex(savedDraftData.currentPickIndex);
    setUserSlot(savedDraftData.userSlot);
    setSlotInput(String(savedDraftData.userSlot));
    setTotalRounds(savedDraftData.totalRounds);
    setPhase(savedDraftData.phase);
    setSavedDraftData(null);
  }

  function clearAndReset() {
    try { localStorage.removeItem("ff_draft_state"); } catch { /* ignore */ }
    setSavedDraftData(null);
    setPhase("setup");
    setAssessment(null);
    setSearchQuery("");
  }

  const makeUserPick = useCallback((player: Player) => {
    const { currentPickIndex: idx, totalRounds: tr, picks: p, userSlot: us } = stateRef.current;

    // Enforce position limit for user
    let posCount = 0;
    for (let i = 0; i < idx; i++) {
      if (getTeamSlot(i) === us && p[i]?.position === player.position) posCount++;
    }
    if (posCount >= (POS_LIMITS[player.position] ?? 999)) return;

    const nextIdx = idx + 1;
    setPicks((prev) => {
      const next = [...prev];
      next[idx] = player;
      return next;
    });
    setCurrentPickIndex(nextIdx);
    if (nextIdx >= tr * NUM_TEAMS) setPhase("report");
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const draftedNames = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < currentPickIndex; i++) {
      if (picks[i]) s.add(picks[i]!.player_name);
    }
    return s;
  }, [picks, currentPickIndex]);

  const availablePlayers = useMemo(
    () => allPlayers.filter((p) => !draftedNames.has(p.player_name)),
    [allPlayers, draftedNames]
  );

  const filteredDisplay = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q
      ? allPlayers.filter(
          (p) =>
            p.player_name.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q) ||
            p.position.toLowerCase().includes(q)
        )
      : allPlayers;
  }, [allPlayers, searchQuery]);

  const userPicks = useMemo(
    () => picks.filter((p, i) => p != null && getTeamSlot(i) === userSlot).map((p) => p!),
    [picks, userSlot, currentPickIndex]
  );

  const userPosCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    userPicks.forEach((p) => {
      counts[p.position] = (counts[p.position] ?? 0) + 1;
    });
    return counts;
  }, [userPicks]);

  const userRosterSlots = useMemo(() => assignToSlots(userPicks), [userPicks]);

  const currentRound = Math.min(
    Math.floor(currentPickIndex / NUM_TEAMS) + 1,
    totalRounds
  );

  const top5Recommended = useMemo(() => {
    return availablePlayers
      .filter((p) => (userPosCounts[p.position] ?? 0) < (POS_LIMITS[p.position] ?? 999))
      .slice(0, 5);
  }, [availablePlayers, userPosCounts]);

  // K/DEF warnings from round 14 onward
  const rosterWarnings = useMemo(() => {
    if (phase !== "drafting" || currentRound < 14) return [];
    const msgs: string[] = [];
    if (!userPicks.some((p) => p.position === "K"))
      msgs.push("You have no Kicker — consider drafting one soon");
    if (!userPicks.some((p) => p.position === "DEF"))
      msgs.push("You have no Defense — consider drafting one soon");
    return msgs;
  }, [phase, currentRound, userPicks]);

  // ── Excel export ────────────────────────────────────────────────────────────

  async function downloadExcel() {
    const XLSX = await import("xlsx");

    const wb = XLSX.utils.book_new();

    // Summary sheet — all teams ranked by projected total
    const summaryRows: (string | number)[][] = [
      ["Rank", "Team", "Is You", "Projected Total"],
    ];
    const allTotals: { slot: number; name: string; total: number }[] = [];
    for (let slot = 1; slot <= NUM_TEAMS; slot++) {
      const slotPicks = picks.filter((p, i) => p != null && getTeamSlot(i) === slot).map((p) => p!);
      const total = slotPicks.reduce((s, p) => s + (p.projected_pts ?? 0), 0);
      const tName = slot === userSlot ? "You" : (BOT_PERSONALITIES[getBotIndex(slot, userSlot)]?.name ?? `Bot ${slot}`);
      allTotals.push({ slot, name: tName, total });
    }
    allTotals.sort((a, b) => b.total - a.total);
    allTotals.forEach((t, i) => {
      summaryRows.push([i + 1, t.name, t.slot === userSlot ? "YOU" : "", Number(t.total.toFixed(1))]);
    });
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // One sheet per team
    for (let slot = 1; slot <= NUM_TEAMS; slot++) {
      const tName = slot === userSlot ? "You" : (BOT_PERSONALITIES[getBotIndex(slot, userSlot)]?.name ?? `Bot ${slot}`);
      const rows: (string | number)[][] = [
        ["#", "Player", "Position", "Team", "Projected Pts", "Round"],
      ];
      let pickNum = 0;
      picks.forEach((p, idx) => {
        if (p != null && getTeamSlot(idx) === slot) {
          pickNum++;
          const round = Math.floor(idx / NUM_TEAMS) + 1;
          rows.push([pickNum, p.player_name, p.position, p.team, Number((p.projected_pts ?? 0).toFixed(1)), round]);
        }
      });
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, sheet, tName.slice(0, 31));
    }

    XLSX.writeFile(wb, "draft_results.xlsx");
  }

  // ── Team totals for report ─────────────────────────────────────────────────

  const teamTotals = useMemo(() => {
    if (phase !== "report") return [];
    const totals: { slot: number; name: string; total: number; picks: Player[] }[] = [];
    for (let slot = 1; slot <= NUM_TEAMS; slot++) {
      const slotPicks = picks.filter((p, i) => p != null && getTeamSlot(i) === slot).map((p) => p!);
      const total = slotPicks.reduce((sum, p) => sum + (p.projected_pts ?? 0), 0);
      const name = slot === userSlot ? "You" : (BOT_PERSONALITIES[getBotIndex(slot, userSlot)]?.name ?? `Bot ${slot}`);
      totals.push({ slot, name, total, picks: slotPicks });
    }
    return totals.sort((a, b) => b.total - a.total);
  }, [phase, picks, userSlot]);

  const userRank = teamTotals.findIndex((t) => t.slot === userSlot) + 1;

  const bestValuePick = useMemo(() => {
    if (!userPicks.length) return null;
    const withDelta = userPicks.filter((p) => p.value_delta != null);
    return withDelta.length ? withDelta.reduce((b, p) => (p.value_delta! > b.value_delta! ? p : b)) : null;
  }, [userPicks]);

  const biggestReach = useMemo(() => {
    if (!userPicks.length) return null;
    const withDelta = userPicks.filter((p) => p.value_delta != null);
    return withDelta.length ? withDelta.reduce((b, p) => (p.value_delta! < b.value_delta! ? p : b)) : null;
  }, [userPicks]);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (phase === "setup") {
    const resumeRound = savedDraftData
      ? Math.min(Math.floor(savedDraftData.currentPickIndex / NUM_TEAMS) + 1, savedDraftData.totalRounds)
      : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)" }}>
        <TabNav position="draft-room" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: 40, width: 380, display: "flex", flexDirection: "column", gap: 24,
          }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Draft Room</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                14-team PPR snake draft vs 13 bot opponents
              </p>
            </div>

            {/* Resume saved draft */}
            {savedDraftData && (
              <div style={{
                background: "rgba(29,158,117,0.08)",
                border: "1px solid var(--teal-dim)",
                borderRadius: 6,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  💾 Saved draft found
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {savedDraftData.phase === "report"
                    ? `Draft complete · ${savedDraftData.totalRounds} rounds · Slot ${savedDraftData.userSlot}`
                    : `Round ${resumeRound}/${savedDraftData.totalRounds} · Slot ${savedDraftData.userSlot} · Pick ${savedDraftData.currentPickIndex + 1}`}
                </div>
                <button
                  onClick={resumeDraft}
                  style={{
                    padding: "9px", borderRadius: 5, fontSize: 13, fontWeight: 700,
                    background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
                  }}
                >
                  {savedDraftData.phase === "report" ? "View Draft Report →" : "Resume Draft →"}
                </button>
              </div>
            )}

            {savedDraftData && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: -10 }}>
                — or start a new draft —
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                Your Pick Slot (1–14)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={slotInput}
                  onChange={(e) => {
                    setSlotInput(e.target.value);
                    const v = Math.max(1, Math.min(14, Number(e.target.value)));
                    if (!isNaN(v)) setUserSlot(v);
                  }}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 4,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    color: "var(--text-primary)", fontSize: 16, fontWeight: 700,
                    outline: "none", textAlign: "center",
                  }}
                />
                <button
                  onClick={randomiseSlot}
                  title="Randomise slot"
                  style={{
                    padding: "9px 14px", borderRadius: 4, fontSize: 20,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    cursor: "pointer", color: "var(--text-primary)",
                  }}
                >
                  🎲
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Pick slot {userSlot} — you pick {userSlot === 1 || userSlot === 14 ? "first/last" : `at position ${userSlot}`} in each round
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                Rounds
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {[10, 12, 14, 16].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTotalRounds(r)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 4, fontSize: 14, fontWeight: 600,
                      cursor: "pointer",
                      background: totalRounds === r ? "var(--teal)" : "var(--bg-secondary)",
                      border: `1px solid ${totalRounds === r ? "var(--teal)" : "var(--border)"}`,
                      color: totalRounds === r ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startDraft}
              style={{
                padding: "12px", borderRadius: 6, fontSize: 15, fontWeight: 700,
                background: savedDraftData ? "var(--bg-secondary)" : "var(--teal)",
                border: `1px solid ${savedDraftData ? "var(--border)" : "var(--teal)"}`,
                color: savedDraftData ? "var(--text-secondary)" : "#fff",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {savedDraftData ? "Start New Draft" : "Start Draft →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Draft Report ──────────────────────────────────────────────────────────
  if (phase === "report") {
    const myPicks = picks.filter((p, i) => p != null && getTeamSlot(i) === userSlot).map((p) => p!);
    const myTotal = myPicks.reduce((s, p) => s + (p.projected_pts ?? 0), 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)", overflow: "auto" }}>
        <TabNav position="draft-room" />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Draft Report</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 32 }}>
            {totalRounds}-round PPR draft complete · Pick slot {userSlot}
            {userRank > 0 && <> · You ranked <strong style={{ color: userRank <= 3 ? "var(--teal)" : "var(--text-primary)" }}>{userRank}/{NUM_TEAMS}</strong></>}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            {/* My roster */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Roster
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {myPicks.map((p, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 4,
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position], width: 28 }}>{p.position}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{p.player_name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.team}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.projected_pts?.toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ padding: "8px 10px", borderRadius: 4, background: "var(--bg-selected)", border: "1px solid var(--teal)", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700 }}>Projected Total: {myTotal.toFixed(1)} pts</span>
                </div>
              </div>
            </div>

            {/* Team rankings */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                League Rankings
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {teamTotals.map((t, i) => {
                  const isUser = t.slot === userSlot;
                  return (
                    <div key={t.slot} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 4,
                      background: isUser ? "var(--bg-selected)" : "var(--bg-card)",
                      border: `1px solid ${isUser ? "var(--teal)" : "var(--border)"}`,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? "var(--amber-tag)" : "var(--text-muted)", width: 20, textAlign: "center" }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: isUser ? 700 : 400, color: isUser ? "var(--teal)" : "var(--text-primary)" }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: 12, color: isUser ? "var(--teal)" : "var(--text-secondary)" }}>
                        {t.total.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Best value + biggest reach */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Best Value Pick</div>
              {bestValuePick ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{bestValuePick.player_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {bestValuePick.position} · {bestValuePick.team} · value delta +{bestValuePick.value_delta}
                  </div>
                </>
              ) : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>—</div>}
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 18px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Biggest Reach</div>
              {biggestReach ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--red)" }}>{biggestReach.player_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {biggestReach.position} · {biggestReach.team} · value delta {biggestReach.value_delta}
                  </div>
                </>
              ) : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>—</div>}
            </div>
          </div>

          {/* AI Assessment */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--teal)", borderRadius: 8, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              AI Assessment
            </div>
            {assessmentLoading ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Analysing your roster…</div>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65 }}>{assessment}</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            <button
              onClick={clearAndReset}
              style={{ padding: "10px 24px", borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              ← New Draft
            </button>
            <button
              onClick={downloadExcel}
              style={{ padding: "10px 24px", borderRadius: 5, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "var(--teal)", border: "1px solid var(--teal)", color: "#fff" }}
            >
              ↓ Download Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Draft Room (active) ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg-primary)", overflow: "hidden" }}>
      <TabNav position="draft-room" />

      {/* Status bar */}
      <div style={{
        height: 38, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 20, flexShrink: 0,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          Round {currentRound}/{totalRounds}
        </span>
        <span style={{ fontSize: 16, color: "var(--text-muted)" }}>
          Pick {currentPickIndex + 1} overall
        </span>
        {isUserTurn ? (
          <span style={{ fontSize: 16, fontWeight: 700, color: "#EF9F27", marginLeft: "auto" }}>
            ▶ Your turn — pick now
          </span>
        ) : (
          <span style={{ fontSize: 16, color: "var(--text-secondary)", marginLeft: "auto" }}>
            {BOT_PERSONALITIES[getBotIndex(getTeamSlot(currentPickIndex), userSlot)]?.name ?? "Bot"} is picking…
          </span>
        )}
      </div>

      {/* K/DEF warning banners */}
      {rosterWarnings.map((msg) => (
        <div key={msg} style={{
          background: "rgba(239,159,39,0.1)",
          borderBottom: "1px solid rgba(239,159,39,0.3)",
          padding: "6px 20px",
          fontSize: 12,
          color: "#EF9F27",
          flexShrink: 0,
        }}>
          ⚠ {msg}
        </div>
      ))}

      {/* 3-panel layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: Available players ──────────────────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players…"
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 4,
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: 12, outline: "none",
              }}
            />
          </div>

          {isUserTurn && !searchQuery && top5Recommended.length > 0 && (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "rgba(239,159,39,0.05)", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#EF9F27", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Top Recommendations
              </div>
              {top5Recommended.map((p) => (
                <div key={p.player_name} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position], width: 24 }}>{p.position}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.player_name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.team}</span>
                  <button
                    onClick={() => makeUserPick(p)}
                    style={{
                      padding: "3px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                      background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
                    }}
                  >
                    Pick
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {(() => {
                  let lastTier: number | null = null;
                  return filteredDisplay.map((player) => {
                    const tier = getTier(player.vor_score);
                    const showDiv = tier !== lastTier;
                    lastTier = tier;
                    const isDrafted = draftedNames.has(player.player_name);
                    const isPosBlocked = !isDrafted && (userPosCounts[player.position] ?? 0) >= (POS_LIMITS[player.position] ?? 999);
                    const canPick = !isDrafted && !isPosBlocked && isUserTurn;
                    const tierCfg = getTierConfig(tier);

                    return (
                      <Fragment key={player.rank}>
                        {showDiv && (
                          <tr style={{ background: "#111318" }}>
                            <td colSpan={3} style={{ padding: "4px 12px", borderTop: "1px solid var(--border)" }}>
                              <span style={{ color: tierCfg.color, fontSize: 10, fontWeight: 700 }}>
                                {tierCfg.icon} {tierCfg.label}
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr
                          style={{
                            borderBottom: "1px solid #22252f",
                            opacity: isDrafted ? 0.25 : isPosBlocked ? 0.4 : 1,
                          }}
                        >
                          <td style={{ padding: "5px 8px", width: 26 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: POS_COLORS[player.position] }}>
                              {player.position}
                            </span>
                          </td>
                          <td style={{ padding: "5px 4px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isPosBlocked ? "var(--text-muted)" : "var(--text-primary)" }}>
                              {player.player_name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{player.team}</div>
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "right" }}>
                            {canPick ? (
                              <button
                                onClick={() => makeUserPick(player)}
                                style={{
                                  padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                                  background: "var(--teal)", border: "none", color: "#fff", cursor: "pointer",
                                }}
                              >
                                Pick
                              </button>
                            ) : isPosBlocked && isUserTurn ? (
                              <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 600 }}>FULL</span>
                            ) : (
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                {player.projected_pts?.toFixed(0)}
                              </span>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Center: Draft grid ───────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
            Draft Board
          </div>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed", width: "100%", minWidth: `${32 + NUM_TEAMS * 52}px` }}>
              <colgroup>
                <col style={{ width: 32 }} />
                {Array.from({ length: NUM_TEAMS }, (_, i) => (
                  <col key={i} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 2 }}>
                  <th style={{
                    padding: "6px 4px", color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky", left: 0, zIndex: 3,
                    background: "var(--bg-secondary)", textAlign: "center",
                  }}>#</th>
                  {Array.from({ length: NUM_TEAMS }, (_, i) => i + 1).map((slot) => {
                    const isUser = slot === userSlot;
                    const bot = BOT_PERSONALITIES[getBotIndex(slot, userSlot)];
                    const code = isUser ? "YOU" : (BOT_CODES[bot?.name ?? ""] ?? "BOT");
                    const fullName = isUser ? "You" : (bot?.name ?? `Bot ${slot}`);
                    const youLeft = `calc(32px + ${(userSlot - 1) / NUM_TEAMS} * (100% - 32px))`;
                    return (
                      <th
                        key={slot}
                        title={fullName}
                        style={{
                          padding: "6px 2px",
                          color: isUser ? "var(--teal)" : "var(--text-muted)",
                          fontWeight: isUser ? 700 : 600,
                          borderBottom: "1px solid var(--border)",
                          borderLeft: "1px solid var(--border)",
                          textAlign: "center",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          ...(isUser ? {
                            position: "sticky",
                            left: youLeft,
                            zIndex: 3,
                            background: "#1a2228",
                          } : {}),
                        }}
                      >
                        {code}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalRounds }, (_, r) => {
                  const round = r + 1;
                  return (
                    <tr key={round}>
                      <td style={{
                        padding: "4px 4px", color: "var(--text-muted)", textAlign: "center",
                        fontSize: 11, borderBottom: "1px solid var(--bg-primary)", fontWeight: 600,
                        position: "sticky", left: 0, zIndex: 1, background: "var(--bg-primary)",
                      }}>
                        {round}
                      </td>
                      {Array.from({ length: NUM_TEAMS }, (_, s) => {
                        const slot = s + 1;
                        const pIdx = pickIndexForCell(round, slot);
                        const player = picks[pIdx];
                        const isCurrent = pIdx === currentPickIndex && phase === "drafting";
                        const isUser = slot === userSlot;
                        const youLeft = `calc(32px + ${(userSlot - 1) / NUM_TEAMS} * (100% - 32px))`;

                        let bg = "transparent";
                        let border = "1px solid #22252f";
                        if (isCurrent) { bg = "rgba(239,159,39,0.12)"; border = "1px solid #EF9F27"; }
                        else if (isUser && player) { bg = "rgba(13,45,31,0.6)"; border = "1px solid #1e3a2a"; }
                        else if (isUser) { bg = "rgba(13,45,31,0.15)"; }

                        return (
                          <td
                            key={slot}
                            style={{
                              padding: "3px 4px", background: bg, border, verticalAlign: "middle",
                              height: 36, overflow: "hidden",
                              ...(isUser ? {
                                position: "sticky",
                                left: youLeft,
                                zIndex: 1,
                              } : {}),
                            }}
                          >
                            {player ? (
                              <div style={{ overflow: "hidden" }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: "1px 3px", borderRadius: 2,
                                  color: POS_COLORS[player.position],
                                  background: POS_BG[player.position],
                                  marginRight: 3,
                                }}>
                                  {player.position}
                                </span>
                                <span style={{ fontSize: 11, color: isUser ? "var(--teal-light)" : "var(--text-primary)" }}>
                                  {player.player_name.length > 8 ? player.player_name.slice(0, 8) + "…" : player.player_name}
                                </span>
                              </div>
                            ) : isCurrent ? (
                              <div style={{ textAlign: "center", color: "#EF9F27", fontSize: 14, lineHeight: 1 }}>←</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "3px 12px", textAlign: "right", flexShrink: 0, borderTop: "1px solid var(--border)" }}>
            ← scroll →
          </div>
        </div>

        {/* ── Right: User's roster ─────────────────────────────────────────── */}
        <div style={{ width: 200, flexShrink: 0, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
            Your Roster
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            {ROSTER_SLOTS.map((slot, i) => {
              const player = userRosterSlots[slot.id];
              return (
                <div key={slot.id}>
                  {i === 9 && (
                    <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "5px 0 3px", paddingLeft: 2 }}>
                      Bench
                    </div>
                  )}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 7px", borderRadius: 3,
                    background: player ? "var(--bg-card)" : "rgba(255,255,255,0.01)",
                    border: `1px solid ${player ? "var(--border)" : "#1a1f2e"}`,
                    minHeight: 30,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: slot.starter ? "var(--teal-dim)" : "var(--text-muted)", width: 30, flexShrink: 0 }}>
                      {slot.label}
                    </span>
                    {player ? (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {player.player_name}
                        </span>
                        <span style={{ fontSize: 10, color: POS_COLORS[player.position], flexShrink: 0 }}>{player.position}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "10px 16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          fontSize: 14, color: "var(--text-primary)",
          maxWidth: 320,
          animation: "fadeIn 0.2s ease",
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
