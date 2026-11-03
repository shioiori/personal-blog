"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { Sparkles, BookMarked, Repeat, Ticket } from "lucide-react";
import { dupsNeededToEvolve } from "@/src/lib/pokemon-evolutions";
import type { GachaCollectionEntry, GachaPullResult, PokemonSpecies } from "@/src/declaration/english";

const POKE_SPRITE_URL = (dexId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;

const POKEBALL_GIF = "/assets/gacha/ball_open.gif";
const REVEAL_DELAY_MS = 1720; // matches the frame durations baked into ball_open.gif
const EXCHANGE_COST = 5;

type View = "gacha" | "dex";

function resultMessage(result: GachaPullResult, t: ReturnType<typeof useTranslations>): string {
  switch (result.type) {
    case "new":
      return t("Gacha.newCatch", { name: result.species.name });
    case "dup":
      return t("Gacha.duplicate", { name: result.species.name, progress: result.progress, needed: result.needed });
    case "evolve":
      return t("Gacha.evolved", { name: result.species.name });
    case "maxed":
      return t("Gacha.duplicateMax", { name: result.species.name });
    case "choose_evolution":
      return t("Gacha.chooseBranch");
  }
}

export function GachaTab() {
  const t = useTranslations("English");
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
  const [exchangeTicketToast, setExchangeTicketToast] = useState(false);

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
    setMessage(t("Gacha.opening"));

    try {
      const res = await fetch("/api/english/gacha/pull", { method: "POST" });
      if (!res.ok) {
        setMessage(t("Gacha.noTickets"));
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
      setMessage(resultMessage(result, t));
      return;
    }
    if (result.type === "maxed") {
      setExchangeTicketToast(true);
      setTimeout(() => setExchangeTicketToast(false), 1800);
    }
    setRevealedSpecies(result.species);
    setMessage(resultMessage(result, t));
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
    const evolveMessage = t("Gacha.evolved", { name: data.species.name });
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
        setExchangeResult({ species: data.result.species, message: resultMessage(data.result, t) });
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
          {t("Gacha.back")}
        </Button>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                  <img src={POKE_SPRITE_URL(progress.currentId)} alt={name} width={128} height={128} style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center text-3xl font-bold text-muted-foreground">?</div>
                )}
                <span className="text-xs font-medium truncate w-full">{name}</span>
                {needed !== null && (
                  <span className="text-[10px] text-muted-foreground">{progress.dup}/{needed}</span>
                )}
                {progress.stage > 0 && progress.stage >= entry.chain.length && (
                  <span className="text-[10px] text-muted-foreground">{t("Gacha.max")}</span>
                )}
              </button>
            );
          })}
        </div>

        <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailChainKey(null)}>
          <DialogContent className="max-w-md">
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
                      <img src={POKE_SPRITE_URL(progress.currentId)} alt={name} width={192} height={192} style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-5xl font-bold text-muted-foreground">?</div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      {needed !== null
                        ? t("Gacha.shards", { count: progress.dup, needed })
                        : discovered
                        ? t("Gacha.fullyEvolved")
                        : t("Gacha.notCaught")}
                    </p>

                    <div className="w-full">
                      <p className="text-xs font-medium text-muted-foreground mb-2 text-center">{t("Gacha.evolutionChain")}</p>
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
                                  <img src={POKE_SPRITE_URL(species.id)} alt={species.name} width={96} height={96} style={{ imageRendering: "pixelated" }} />
                                ) : (
                                  <div className="w-24 h-24 flex items-center justify-center text-3xl font-bold text-muted-foreground">?</div>
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
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8 px-4 relative">
      {exchangeTicketToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2">
          <Ticket className="h-4 w-4" />
          {t("Gacha.plusExchange")}
        </div>
      )}
      <div className="text-lg font-medium flex items-center gap-4">
        <span>{t("Gacha.tickets")} <span className="font-semibold">{loading ? "…" : tickets}</span></span>
        <span>{t("Gacha.exchangeTickets")} <span className="font-semibold">{loading ? "…" : exchangeTickets}</span></span>
      </div>
      <p className="text-xs text-muted-foreground text-center -mt-4">
        {t("Gacha.info", { cost: EXCHANGE_COST })}
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
              {message ?? t("Gacha.idle")}
            </p>
          </>
        )}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={() => void doPull()} disabled={pulling || !tickets || tickets <= 0}>
          <Sparkles className="h-4 w-4" />
          {t("Gacha.spin")}
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
          {t("Gacha.exchange", { cost: EXCHANGE_COST })}
        </Button>
      </div>

      <Dialog open={exchangeOpen} onOpenChange={(open) => { setExchangeOpen(open); if (!open) { setChoice(null); setExchangeResult(null); } }}>
        <DialogContent className="max-w-sm max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Gacha.exchangeTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {t.rich("Gacha.exchangeBalance", { count: exchangeTickets ?? 0, cost: EXCHANGE_COST, b: (chunks) => <span className="font-semibold">{chunks}</span> })}
          </p>

          {choice && choice.source === "exchange" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-center">{t("Gacha.chooseBranch")}</p>
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
                {t("Gacha.exchangeAgain")}
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
                  {t("Gacha.noExchangeTargets")}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
