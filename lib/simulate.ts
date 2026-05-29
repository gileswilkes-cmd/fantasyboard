export interface SimPlayer {
  projected_pts: number | null;
  std_dev: number | null;
  weekly_scores: (number | null)[];
}

export interface SeasonOutcome {
  wins: number;
  ptsFor: number;
  madePlayoffs: boolean;
  wonChamp: boolean;
  finish: number; // 1-14
}

export interface SimulationResult {
  playoffRate: number;
  champRate: number;
  avgWins: number;
  avgPtsPerWeek: number;
  finishDist: number[];    // 14 elements — fraction finishing at each rank
  top10PctWins: number;
  bot10PctWins: number;
}

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

function teamScore(stats: { mean: number; std: number }[]): number {
  return stats.reduce((s, p) => s + sampleNormal(p.mean, p.std), 0);
}

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

  const wins = new Array(NUM_TEAMS).fill(0);
  const ptsFor = new Array(NUM_TEAMS).fill(0);

  for (let w = 0; w < NUM_WEEKS; w++) {
    const scores = allTeamStats.map((s) => teamScore(s));
    for (let i = 0; i < NUM_TEAMS; i++) ptsFor[i] += scores[i];

    const matchups = randomPairing(NUM_TEAMS);
    for (let i = 0; i < NUM_TEAMS; i++) {
      const opp = matchups[i];
      if (i < opp) {
        if (scores[i] > scores[opp]) wins[i]++;
        else wins[opp]++;
      }
    }
  }

  const standings = Array.from({ length: NUM_TEAMS }, (_, i) => i)
    .sort((a, b) => wins[b] - wins[a] || ptsFor[b] - ptsFor[a]);
  const myPos = standings.indexOf(myTeamIdx);
  const madePlayoffs = myPos < PLAYOFF_SPOTS;

  let wonChamp = false;
  if (madePlayoffs) {
    const bracket = standings.slice(0, PLAYOFF_SPOTS);
    // Round 1: seeds 3v6, 4v5 (indices 2v5, 3v4); seeds 1+2 get byes
    const r1W: number[] = [bracket[0], bracket[1]];
    for (const [a, b] of [[2, 5], [3, 4]] as const) {
      r1W.push(teamScore(allTeamStats[bracket[a]]) >= teamScore(allTeamStats[bracket[b]]) ? bracket[a] : bracket[b]);
    }
    // Semis: 0v2, 1v3 in r1W
    const r2W: number[] = [];
    for (const [a, b] of [[0, 2], [1, 3]] as const) {
      r2W.push(teamScore(allTeamStats[r1W[a]]) >= teamScore(allTeamStats[r1W[b]]) ? r1W[a] : r1W[b]);
    }
    // Final
    wonChamp = (teamScore(allTeamStats[r2W[0]]) >= teamScore(allTeamStats[r2W[1]]) ? r2W[0] : r2W[1]) === myTeamIdx;
  }

  return { wins: wins[myTeamIdx], ptsFor: ptsFor[myTeamIdx], madePlayoffs, wonChamp, finish: myPos + 1 };
}

export function aggregateResults(
  outcomes: SeasonOutcome[],
  numTeams: number
): SimulationResult {
  const n = outcomes.length;
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

  return {
    playoffRate,
    champRate,
    avgWins,
    avgPtsPerWeek,
    finishDist: finishCounts.map((c) => c / n),
    top10PctWins,
    bot10PctWins,
  };
}
