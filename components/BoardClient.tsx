"use client";

import { useState } from "react";
import type { Player } from "@/lib/data";
import SearchBar from "./SearchBar";
import PlayerTable from "./PlayerTable";

function filterPlayers(query: string, players: Player[]): Player[] {
  const q = query.toLowerCase().trim();
  if (!q) return players;
  return players.filter(
    (p) =>
      p.player_name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q)
  );
}

interface BoardClientProps {
  players: Player[];
}

export default function BoardClient({ players }: BoardClientProps) {
  const [query, setQuery] = useState("");
  const filtered = filterPlayers(query, players);

  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <PlayerTable players={filtered} />
    </>
  );
}
