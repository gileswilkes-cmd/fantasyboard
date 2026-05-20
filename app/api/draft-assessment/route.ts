import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { roster } = await req.json() as {
      roster: { name: string; position: string; team: string; projectedPts: number }[];
    };

    const client = new Anthropic();

    const rosterText = roster
      .map((p) => `${p.name} (${p.position}, ${p.team}) — ${p.projectedPts?.toFixed(0)} proj pts`)
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 320,
      messages: [
        {
          role: "user",
          content: `You are a fantasy football analyst. I just completed a PPR fantasy football draft in a 14-team league. Here is my roster:\n\n${rosterText}\n\nIn exactly one paragraph (3–5 sentences), assess my team's strengths, weaknesses, and identify one key player to watch this season. Be specific and analytical.`,
        },
      ],
    });

    const text =
      message.content.find((b) => b.type === "text")?.text ?? "Assessment unavailable.";

    return NextResponse.json({ assessment: text });
  } catch (err) {
    console.error("Draft assessment error:", err);
    return NextResponse.json({ assessment: "Unable to generate assessment at this time." }, { status: 500 });
  }
}
