import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { playoffRate, champRate, avgWins, avgPtsPerWeek, top10PctWins, bot10PctWins } =
      await req.json() as {
        playoffRate: number; champRate: number; avgWins: number;
        avgPtsPerWeek: number; top10PctWins: number; bot10PctWins: number;
      };

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `You are a terse fantasy football analyst. A team ran 1000 season simulations:
- Playoff rate: ${(playoffRate * 100).toFixed(1)}%
- Championship rate: ${(champRate * 100).toFixed(1)}%
- Avg wins: ${avgWins.toFixed(1)}/17
- Avg pts/week: ${avgPtsPerWeek.toFixed(1)}
- Best 10% of seasons: ${top10PctWins.toFixed(1)} avg wins
- Worst 10% of seasons: ${bot10PctWins.toFixed(1)} avg wins

Write exactly ONE punchy sentence (under 25 words) assessing ceiling, floor, and playoff outlook.`,
      }],
    });

    const sentence = message.content.find((b) => b.type === "text")?.text?.trim() ?? "Simulation complete.";
    return NextResponse.json({ sentence });
  } catch (err) {
    console.error("Sim assessment error:", err);
    return NextResponse.json({ sentence: "Simulation complete." }, { status: 500 });
  }
}
