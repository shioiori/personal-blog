"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { Sparkles, BookMarked, Repeat } from "lucide-react";
import { dupsNeededToEvolve } from "@/src/lib/pokemon-evolutions";
import type { GachaCollectionEntry, GachaPullResult, PokemonSpecies } from "@/src/declaration/english";

const POKE_SPRITE_URL = (dexId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;

const POKEBALL_GIF = "/assets/gacha/ball_open.gif";
const REVEAL_DELAY_MS = 1720; // matches the frame durations baked into ball_open.gif
const EXCHANGE_COST = 5;

type View = "gacha" | "dex";

function resultMessage(result: GachaPullResult): string {
  switch (result.type) {
    case "new":
      return `Mới! Bạn đã bắt được ${result.species.name}!`;
    case "dup":
      return `Trùng ${result.species.name}! Tiến độ tiến hóa: ${result.progress}/${result.needed}.`;
    case "evolve":
      return `Tiến hóa thành công! Chào mừng ${result.species.name}!`;
    case "maxed":
      return `Trùng ${result.species.name} (đã tiến hóa tối đa).`;
    case "choose_evolution":
      return "Pokémon của bạn có thể tiến hóa theo nhiều hướng. Hãy chọn một:";
  }
}

export function GachaTab() {
  const [view, setView] = useState<View>("gacha");
  const [tickets, setTickets] = useState<number | null>(null);
  const [exchangeTickets, setExchangeTickets] = useState<number | null>(null);
  const [collection, setCollection] = useState<GachaCollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [revealedSpecies, setRevealedSpecies] = useState<PokemonSpecies | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [choice, setChoice] = useState<{ chainKey: string; options: PokemonSpecies[]; source: "pull" | "exchange" } | null>(null);
  const [pullId, setPullId] = useState(0);
  const [detailChainKey, setDetailChainKey] = useState<string | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<{ species: PokemonSpecies; message: string } | null>(null);
  const [exchangeBusy, setExchangeBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/english/gacha");
      const data = (await res.json()) as { tickets: number; exchangeTickets: number; collection: GachaCollectionEntry[] };
      setTickets(data.tickets);
      setExchangeTickets(data.exchangeTickets);
      setCollection(data.collection);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function doPull() {
    if (pulling || !tickets || tickets <= 0) return;
    setPulling(true);
    setChoice(null);
    setRevealedSpecies(null);
    setPullId((id) => id + 1);
    setMessage("Đang mở Poké Ball...");

    try {
      const res = await fetch("/api/english/gacha/pull", { method: "POST" });
      if (!res.ok) {
        setMessage("Không còn vé để quay.");
        return;
      }
      const data = (await res.json()) as { result: GachaPullResult };
      await new Promise((r) => setTimeout(r, REVEAL_DELAY_MS));
      reveal(data.result);
    } finally {
      await load();
      setPulling(false);
    }
  }

  function reveal(result: GachaPullResult) {
    if (result.type === "choose_evolution") {
      setChoice({ chainKey: result.chainKey, options: result.options, source: "pull" });
      setMessage(resultMessage(result));
      return;
    }
    setRevealedSpecies(result.species);
    setMessage(resultMessage(result));
  }

  async function chooseEvolution(chainKey: string, speciesId: number) {
    const source = choice?.source ?? "pull";
    const res = await fetch("/api/english/gacha/choose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainKey, speciesId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { species: PokemonSpecies };
    setChoice(null);
    const evolveMessage = `Tiến hóa thành công! Chào mừng ${data.species.name}!`;
    if (source === "exchange") {
      setExchangeResult({ species: data.species, message: evolveMessage });
    } else {
      setRevealedSpecies(data.species);
      setMessage(evolveMessage);
    }
    void load();
  }

  async function doExchange(chainKey: string) {
    if (exchangeBusy || !exchangeTickets || exchangeTickets < EXCHANGE_COST) return;
    setExchangeBusy(true);
    setExchangeResult(null);
    try {
      const res = await fetch("/api/english/gacha/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainKey }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { result: GachaPullResult };
      if (data.result.type === "choose_evolution") {
        setChoice({ chainKey: data.result.chainKey, options: data.result.options, source: "exchange" });
      } else {
        setExchangeResult({ species: data.result.species, message: resultMessage(data.result) });
      }
      void load();
    } finally {
      setExchangeBusy(false);
    }
  }

  const detailEntry = collection.find((e) => e.chainKey === detailChainKey) ?? null;

  if (view === "dex") {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-4">
        <Button variant="outline" size="sm" onClick={() => setView("gacha")}>
          ← Quay lại Gacha
        </Button>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {collection.map((entry) => {
            const { progress } = entry;
            const discovered = progress.stage > 0 && progress.currentId !== null;
            const name = discovered
              ? entry.chain[progress.stage - 1].find((s) => s.id === progress.currentId)?.name ??
                entry.chain[progress.stage - 1][0].name
              : "???";
            const needed = progress.stage > 0 && progress.stage < entry.chain.length ? dupsNeededToEvolve(progress.stage) : null;
            return (
              <button
                key={entry.chainKey}
                onClick={() => setDetailChainKey(entry.chainKey)}
                className="flex flex-col items-center gap-1 border rounded-lg p-2 text-center bg-background hover:bg-accent transition-colors"
              >
                {discovered && progress.currentId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={POKE_SPRITE_URL(progress.currentId)} alt={name} width={64} height={64} style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center text-lg font-bold text-muted-foreground">?</div>
                )}
                <span className="text-xs font-medium truncate w-full">{name}</span>
                {needed !== null && (
                  <span className="text-[10px] text-muted-foreground">{progress.dup}/{needed}</span>
                )}
                {progress.stage > 0 && progress.stage >= entry.chain.length && (
                  <span className="text-[10px] text-muted-foreground">Tối đa</span>
                )}
              </button>
            );
          })}
        </div>

        <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailChainKey(null)}>
          <DialogContent className="max-w-sm">
            {detailEntry && (() => {
              const { progress, chain } = detailEntry;
              const discovered = progress.stage > 0 && progress.currentId !== null;
              const name = discovered
                ? chain[progress.stage - 1].find((s) => s.id === progress.currentId)?.name ?? chain[progress.stage - 1][0].name
                : "???";
              const needed = progress.stage > 0 && progress.stage < chain.length ? dupsNeededToEvolve(progress.stage) : null;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{name}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center gap-3">
                    {discovered && progress.currentId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={POKE_SPRITE_URL(progress.currentId)} alt={name} width={96} height={96} style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-3xl font-bold text-muted-foreground">?</div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      {needed !== null
                        ? `Số mảnh đang có: ${progress.dup}/${needed}`
                        : discovered
                        ? "Đã tiến hóa tối đa"
                        : "Chưa bắt được"}
                    </p>

                    <div className="w-full">
                      <p className="text-xs font-medium text-muted-foreground mb-2 text-center">Quá trình tiến hóa</p>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {chain.map((stageOptions, stageIdx) => {
                          const stageNumber = stageIdx + 1;
                          const unlocked = stageNumber <= progress.stage;
                          const species = unlocked
                            ? stageOptions.find((s) => s.id === progress.currentId) ?? stageOptions[0]
                            : null;
                          return (
                            <div key={stageIdx} className="flex items-center gap-2">
                              {stageIdx > 0 && <span className="text-muted-foreground">→</span>}
                              <div className="flex flex-col items-center gap-1">
                                {unlocked && species ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={POKE_SPRITE_URL(species.id)} alt={species.name} width={48} height={48} style={{ imageRendering: "pixelated" }} />
                                ) : (
                                  <div className="w-12 h-12 flex items-center justify-center text-xl font-bold text-muted-foreground">?</div>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {unlocked && species ? species.name : "???"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8 px-4">
      <div className="text-lg font-medium flex items-center gap-4">
        <span>🎟️ Vé Gacha: <span className="font-semibold">{loading ? "…" : tickets}</span></span>
        <span>🔄 Vé đổi: <span className="font-semibold">{loading ? "…" : exchangeTickets}</span></span>
      </div>
      <p className="text-xs text-muted-foreground text-center -mt-4">
        Ôn thẻ đạt mức &quot;Tốt&quot; hoặc &quot;Dễ&quot; lần đầu để nhận vé. Quay trúng Pokémon đã tiến hóa tối đa sẽ nhận 1 vé đổi — {EXCHANGE_COST} vé đổi lấy 1 mảnh Pokémon tùy chọn.
      </p>

      <div className="w-full min-h-[200px] rounded-2xl flex flex-col items-center justify-center gap-3 p-6 bg-background">
        {choice && choice.source === "pull" ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-sm text-center">{message}</p>
            <div className="flex gap-4 justify-center flex-wrap">
              {choice.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => void chooseEvolution(choice.chainKey, opt.id)}
                  className="flex flex-col items-center gap-1 border rounded-lg p-3 hover:bg-accent transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={POKE_SPRITE_URL(opt.id)} alt={opt.name} width={72} height={72} style={{ imageRendering: "pixelated" }} />
                  <span className="text-xs font-medium">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {pulling && !revealedSpecies && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={pullId} src={POKEBALL_GIF} alt="" width={160} height={160} />
            )}
            {revealedSpecies && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={POKE_SPRITE_URL(revealedSpecies.id)}
                alt={revealedSpecies.name}
                width={128}
                height={128}
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <p className="text-sm text-center text-muted-foreground">
              {message ?? 'Nhấn "Quay Gacha" để dùng 1 vé.'}
            </p>
          </>
        )}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={() => void doPull()} disabled={pulling || !tickets || tickets <= 0}>
          <Sparkles className="h-4 w-4" />
          Quay Gacha (1 vé)
        </Button>
        <Button variant="outline" onClick={() => setView("dex")}>
          <BookMarked className="h-4 w-4" />
          Pokédex
        </Button>
        <Button
          variant="outline"
          onClick={() => { setExchangeResult(null); setExchangeOpen(true); }}
          disabled={!exchangeTickets || exchangeTickets < EXCHANGE_COST}
        >
          <Repeat className="h-4 w-4" />
          Đổi mảnh ({EXCHANGE_COST} vé đổi)
        </Button>
      </div>

      <Dialog open={exchangeOpen} onOpenChange={(open) => { setExchangeOpen(open); if (!open) { setChoice(null); setExchangeResult(null); } }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đổi mảnh Pokémon</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Vé đổi hiện có: <span className="font-semibold">{exchangeTickets}</span>. Mỗi lần đổi tốn {EXCHANGE_COST} vé.
          </p>

          {choice && choice.source === "exchange" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-center">Pokémon của bạn có thể tiến hóa theo nhiều hướng. Hãy chọn một:</p>
              <div className="flex gap-4 justify-center flex-wrap">
                {choice.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => void chooseEvolution(choice.chainKey, opt.id)}
                    className="flex flex-col items-center gap-1 border rounded-lg p-3 hover:bg-accent transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={POKE_SPRITE_URL(opt.id)} alt={opt.name} width={72} height={72} style={{ imageRendering: "pixelated" }} />
                    <span className="text-xs font-medium">{opt.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : exchangeResult ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={POKE_SPRITE_URL(exchangeResult.species.id)} alt={exchangeResult.species.name} width={96} height={96} style={{ imageRendering: "pixelated" }} />
              <p className="text-sm text-center">{exchangeResult.message}</p>
              <Button size="sm" variant="outline" onClick={() => setExchangeResult(null)}>
                Đổi tiếp
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {collection
                .filter((entry) => entry.progress.stage > 0 && entry.progress.stage < entry.chain.length)
                .map((entry) => {
                  const { progress, chain } = entry;
                  const name = chain[progress.stage - 1].find((s) => s.id === progress.currentId)?.name ?? chain[progress.stage - 1][0].name;
                  return (
                    <button
                      key={entry.chainKey}
                      onClick={() => void doExchange(entry.chainKey)}
                      disabled={exchangeBusy || !exchangeTickets || exchangeTickets < EXCHANGE_COST}
                      className="flex flex-col items-center gap-1 border rounded-lg p-2 text-center hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {progress.currentId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={POKE_SPRITE_URL(progress.currentId)} alt={name} width={48} height={48} style={{ imageRendering: "pixelated" }} />
                      )}
                      <span className="text-[10px] font-medium truncate w-full">{name}</span>
                    </button>
                  );
                })}
              {collection.every((entry) => !(entry.progress.stage > 0 && entry.progress.stage < entry.chain.length)) && (
                <p className="col-span-4 text-sm text-center text-muted-foreground py-4">
                  Chưa có Pokémon nào có thể tích thêm mảnh.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
