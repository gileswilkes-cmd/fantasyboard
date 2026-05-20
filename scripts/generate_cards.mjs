import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.local so ANTHROPIC_API_KEY is available
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey === 'your_key_here') {
  console.error('ERROR: Set a real ANTHROPIC_API_KEY in .env.local or as an environment variable.');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const playersPath = join(ROOT, 'data', 'players.json');
const cardsPath  = join(ROOT, 'data', 'cards.json');

const players = JSON.parse(readFileSync(playersPath, 'utf8'));
let cards = existsSync(cardsPath) ? JSON.parse(readFileSync(cardsPath, 'utf8')) : {};

const pending = players.filter(p => !cards[p.player_name]);
const alreadyDone = players.length - pending.length;
console.log(`${alreadyDone} cards already in cache. Generating ${pending.length} remaining...`);

if (pending.length === 0) {
  console.log('All cards already generated!');
  process.exit(0);
}

let generated = alreadyDone;
let failed = 0;

for (let i = 0; i < pending.length; i++) {
  const player = pending[i];

  const weeklyStr = player.weekly_scores
    .map(s => s === null ? 'DNP' : Number(s).toFixed(1))
    .join(', ');

  const prompt = `You are a terse, data-driven fantasy football analyst writing for an experienced drafter.
Given these stats for ${player.player_name} (${player.position}, ${player.team}):
- 2025 avg PPR: ${player.avg_ppr_2025 ?? 'N/A'}, 2024 avg: ${player.avg_ppr_2024 ?? 'N/A'}
- Boom weeks (≥20 pts): ${player.boom_weeks ?? 0}/16, Bust weeks (<10 pts): ${player.bust_weeks ?? 0}/16
- Std dev: ${player.std_dev ?? 'N/A'} (consistency measure — lower is more consistent)
- VOR rank: ${player.rank}, ADP rank: ${player.adp_rank ?? 'N/A'}, Value delta: ${player.value_delta ?? 'N/A'}
- Risk flag: ${player.risk_flag ?? 'none'}
- 2025 weekly scores: ${weeklyStr}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "one_liner": "single sentence under 18 words — the one thing to know about this player",
  "strengths": ["concrete strength 1", "concrete strength 2", "concrete strength 3"],
  "weaknesses": ["concrete weakness 1", "concrete weakness 2", "concrete weakness 3"],
  "comp": "FirstName LastName YYYY — one clause explaining why",
  "verdict_badge": "Draft now" or "Strong pick" or "Monitor" or "Late round" or "Avoid",
  "verdict_text": "one instruction under 20 words for draft day"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    // Strip any accidental markdown fences
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    const card = JSON.parse(text);
    cards[player.player_name] = card;
    generated++;

    if (generated % 10 === 0) {
      console.log(`Generated ${generated}/${players.length}...`);
      writeFileSync(cardsPath, JSON.stringify(cards, null, 2));
    }
  } catch (err) {
    console.error(`  FAILED ${player.player_name}: ${err.message}`);
    failed++;
  }

  // 400ms between calls (skip delay after last player)
  if (i < pending.length - 1) {
    await new Promise(r => setTimeout(r, 400));
  }
}

// Final save
writeFileSync(cardsPath, JSON.stringify(cards, null, 2));

const total = Object.keys(cards).length;
console.log(`\nDone! New cards: ${generated - alreadyDone}, Failed: ${failed}, Total: ${total}/${players.length} in cards.json`);
