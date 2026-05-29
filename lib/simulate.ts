export interface SimPlayer {
  projected_pts: number | null;
  std_dev: number | null;
  weekly_scores: (number | null)[];
}

// SimPlayer + identity fields needed for aggregation output
export interface PlayerSimInput extends SimPlayer {
  player_name: string;
  position: string;
}

export interface PlayerSimStats {
  player_name: string;
  position: string;
  projected_pts: number;
  avg_weekly_pts: number;
  avg_season_pts: number;
  std_dev: number;
  boom_rate: number;
  bust_rate: number;
  letdown_weeks: number;
  contribution_rank: number;
  champion_avg: number;
  nonplayoff_avg: number;
  variance_impact: number;
  // for insight cards
  good_season_avg: number;
  bad_season_avg: number;
  good_season_champ_rate: number;
  bad_season_miss_rate: number;
}

export interface SeasonOutcome {
  wins: number;
  ptsFor: number;
  madePlayoffs: boolean;
  wonChamp: boolean;
  finish: number;
  playerWeeklyScores: number[][];  // [playerIdx][weekIdx]
  weekWins: boolean[];             // [weekIdx] — did myTeam win each week?
}

export interface SimulationResult {
  playoffRate: number;
  champRate: number;
  avgWins: number;
  avgPtsPerWeek: number;
  finishDist: number[];
  top10PctWins: number;
  bot10PctWins: number;
  playerStats: PlayerSimStats[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sampleNormal(mean: number, std: number): number {
  const u1 = Math.max(Math.random(), 1e-10);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * std);
}

function getStats(p: SimPlayer): { mean: number; std: number } {
  const valid = p.weekly_scores.filter((s): s is number => s !== null && s >= 0);
  if (valid.length >= 4) {
    const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
    const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
    return { mean, std: Math.max(Math.sqrt(variance), 1) };
  }
  const mean = (p.projected_pts ?? 0) / 17;
  const std = p.std_dev ?? Math.max(mean * 0.3, 2);
  return { mean, std };
}

function randomPairing(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const result = new Array(n);
  for (let i = 0; i < n; i += 2) {
    result[order[i]] = order[i + 1];
    result[order[i + 1]] = order[i];
  }
  return result;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ─── Core simulation ──────────────────────────────────────────────────────────

export function precomputeStats(
  allTeamStarters: SimPlayer[][]
): { mean: number; std: number }[][] {
  return allTeamStarters.map((team) => team.map(getStats));
}

export function runOneSeason(
  allTeamStats: { mean: number; std: number }[][],
  myTeamIdx: number
): SeasonOutcome {
  const NUM_WEEKS = 17;
  const NUM_TEAMS = allTeamStats.length;
  const PLAYOFF_SPOTS = 6;
  const myPlayerCount = allTeamStats[myTeamIdx]?.length ?? 0;

  const wins = new Array(NUM_TEAMS).fill(0);
  const ptsFor = new Array(NUM_TEAMS).fill(0);

  // Track myTeam's per-player, per-week scores and per-week win outcome
  const playerWeeklyScores: number[][] = Array.from({ length: myPlayerCount }, () => []);
  const weekWins: boolean[] = [];

  for (let w = 0; w < NUM_WEEKS; w++) {
    const scores: number[] = [];

    for (let t = 0; t < NUM_TEAMS; t++) {
      if (t === myTeamIdx) {
        // Sample each player individually so we can record their scores
        const indiv = allTeamStats[t].map((p) => sampleNormal(p.mean, p.std));
        for (let pi = 0; pi < myPlayerCount; pi++) {
          playerWeeklyScores[pi].push(indiv[pi]);
        }
        scores.push(indiv.reduce((s, v) => s + v, 0));
      } else {
        scores.push(allTeamStats[t].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0));
      }
    }

    for (let i = 0; i < NUM_TEAMS; i++) ptsFor[i] += scores[i];

    const matchups = randomPairing(NUM_TEAMS);
    let myWonThisWeek = false;
    for (let i = 0; i < NUM_TEAMS; i++) {
      const opp = matchups[i];
      if (i < opp) {
        if (scores[i] > scores[opp]) {
          wins[i]++;
          if (i === myTeamIdx) myWonThisWeek = true;
        } else {
          wins[opp]++;
          if (opp === myTeamIdx) myWonThisWeek = true;
        }
      }
    }
    weekWins.push(myWonThisWeek);
  }

  const standings = Array.from({ length: NUM_TEAMS }, (_, i) => i)
    .sort((a, b) => wins[b] - wins[a] || ptsFor[b] - ptsFor[a]);
  const myPos = standings.indexOf(myTeamIdx);
  const madePlayoffs = myPos < PLAYOFF_SPOTS;

  let wonChamp = false;
  if (madePlayoffs) {
    const bracket = standings.slice(0, PLAYOFF_SPOTS);
    const r1W: number[] = [bracket[0], bracket[1]];
    for (const [a, b] of [[2, 5], [3, 4]] as const) {
      const sA = allTeamStats[bracket[a]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
      const sB = allTeamStats[bracket[b]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
      r1W.push(sA >= sB ? bracket[a] : bracket[b]);
    }
    const r2W: number[] = [];
    for (const [a, b] of [[0, 2], [1, 3]] as const) {
      const sA = allTeamStats[r1W[a]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
      const sB = allTeamStats[r1W[b]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
      r2W.push(sA >= sB ? r1W[a] : r1W[b]);
    }
    const sA = allTeamStats[r2W[0]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
    const sB = allTeamStats[r2W[1]].reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
    wonChamp = (sA >= sB ? r2W[0] : r2W[1]) === myTeamIdx;
  }

  return {
    wins: wins[myTeamIdx],
    ptsFor: ptsFor[myTeamIdx],
    madePlayoffs,
    wonChamp,
    finish: myPos + 1,
    playerWeeklyScores,
    weekWins,
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export function aggregateResults(
  outcomes: SeasonOutcome[],
  numTeams: number,
  myStarters: PlayerSimInput[]
): SimulationResult {
  const n = outcomes.length;
  const NUM_WEEKS = 17;
  const numPlayers = myStarters.length;

  // ── Team-level stats ────────────────────────────────────────────────────────
  const playoffRate = outcomes.filter((o) => o.madePlayoffs).length / n;
  const champRate = outcomes.filter((o) => o.wonChamp).length / n;
  const avgWins = outcomes.reduce((s, o) => s + o.wins, 0) / n;
  const avgPtsPerWeek = outcomes.reduce((s, o) => s + o.ptsFor, 0) / n / 17;

  const finishCounts = new Array(numTeams).fill(0);
  outcomes.forEach((o) => { finishCounts[o.finish - 1]++; });

  const sortedWins = outcomes.map((o) => o.wins).sort((a, b) => a - b);
  const top10Start = Math.floor(n * 0.9);
  const bot10End = Math.ceil(n * 0.1);
  const top10PctWins = sortedWins.slice(top10Start).reduce((s, v) => s + v, 0) / (n - top10Start);
  const bot10PctWins = sortedWins.slice(0, bot10End).reduce((s, v) => s + v, 0) / bot10End;

  // ── Per-player stats ────────────────────────────────────────────────────────
  const playerStats: PlayerSimStats[] = myStarters.map((starter, pi) => {
    const bustThreshold = ["TE", "K", "DEF"].includes(starter.position) ? 5 : 10;
    const boomBuffer = getStats(starter);

    // Collect all (score, winOutcome) observations across all sims + weeks
    const allScores: number[] = [];
    const allWins: number[] = [];        // 1 = win, 0 = loss
    const champScores: number[] = [];
    const nonPlayoffScores: number[] = [];

    for (const outcome of outcomes) {
      const scores = outcome.playerWeeklyScores[pi] ?? [];
      for (let w = 0; w < scores.length; w++) {
        allScores.push(scores[w]);
        allWins.push(outcome.weekWins[w] ? 1 : 0);
        if (outcome.wonChamp) champScores.push(scores[w]);
        if (!outcome.madePlayoffs) nonPlayoffScores.push(scores[w]);
      }
    }

    const totalObs = allScores.length;
    const avg_weekly_pts = totalObs > 0
      ? allScores.reduce((s, v) => s + v, 0) / totalObs : 0;

    const variance = totalObs > 1
      ? allScores.reduce((s, v) => s + (v - avg_weekly_pts) ** 2, 0) / totalObs : 0;
    const std_dev = Math.sqrt(variance);

    const boomThreshold = avg_weekly_pts + Math.max(std_dev, boomBuffer.std);
    const boom_rate = totalObs > 0
      ? allScores.filter((s) => s > boomThreshold).length / totalObs : 0;
    const bust_rate = totalObs > 0
      ? allScores.filter((s) => s < bustThreshold).length / totalObs : 0;

    const champion_avg = champScores.length > 0
      ? champScores.reduce((s, v) => s + v, 0) / champScores.length : avg_weekly_pts;
    const nonplayoff_avg = nonPlayoffScores.length > 0
      ? nonPlayoffScores.reduce((s, v) => s + v, 0) / nonPlayoffScores.length : avg_weekly_pts;

    const variance_impact = pearsonCorrelation(allScores, allWins);

    return {
      player_name: starter.player_name,
      position: starter.position,
      projected_pts: starter.projected_pts ?? 0,
      avg_weekly_pts,
      avg_season_pts: avg_weekly_pts * 17,
      std_dev,
      boom_rate,
      bust_rate,
      letdown_weeks: bust_rate * NUM_WEEKS,
      contribution_rank: 0, // computed in second pass
      champion_avg,
      nonplayoff_avg,
      variance_impact,
      good_season_avg: 0,
      bad_season_avg: 0,
      good_season_champ_rate: 0,
      bad_season_miss_rate: 0,
    };
  });

  // ── Second pass: contribution_rank + per-season split ─────────────────────
  const rankSums = new Array(numPlayers).fill(0);
  const rankObs = n * NUM_WEEKS;

  for (const outcome of outcomes) {
    for (let w = 0; w < NUM_WEEKS; w++) {
      const weekScores = outcome.playerWeeklyScores.map((s) => s[w] ?? 0);
      for (let pi = 0; pi < numPlayers; pi++) {
        rankSums[pi] += 1 + weekScores.filter((s, i) => i !== pi && s > weekScores[pi]).length;
      }
    }
  }
  for (let pi = 0; pi < numPlayers; pi++) {
    playerStats[pi].contribution_rank = rankObs > 0 ? rankSums[pi] / rankObs : numPlayers / 2;
  }

  // Per-season avg split (good season = above player's overall mean)
  for (let pi = 0; pi < numPlayers; pi++) {
    const overallMean = playerStats[pi].avg_weekly_pts;
    let gTotal = 0, gChamps = 0, gCount = 0;
    let bTotal = 0, bMissed = 0, bCount = 0;

    for (const outcome of outcomes) {
      const scores = outcome.playerWeeklyScores[pi] ?? [];
      if (scores.length === 0) continue;
      const seasonAvg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (seasonAvg >= overallMean) {
        gTotal += seasonAvg; gCount++;
        if (outcome.wonChamp) gChamps++;
      } else {
        bTotal += seasonAvg; bCount++;
        if (!outcome.madePlayoffs) bMissed++;
      }
    }

    playerStats[pi].good_season_avg = gCount > 0 ? gTotal / gCount : overallMean;
    playerStats[pi].bad_season_avg = bCount > 0 ? bTotal / bCount : overallMean;
    playerStats[pi].good_season_champ_rate = gCount > 0 ? gChamps / gCount : 0;
    playerStats[pi].bad_season_miss_rate = bCount > 0 ? bMissed / bCount : 0;
  }

  return {
    playoffRate,
    champRate,
    avgWins,
    avgPtsPerWeek,
    finishDist: finishCounts.map((c) => c / n),
    top10PctWins,
    bot10PctWins,
    playerStats,
  };
}
