"use client";

import { useRef, useState } from "react";
import { Maximize2, Play, RotateCw } from "lucide-react";
import { Game } from "@/lib/types";

export default function GamePlayer({ game }: { game: Game }) {
  const [started, setStarted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isPlaceholder =
    game.embedUrl.includes("demo/") || game.embedUrl.includes("REPLACE");

  const aspect =
    game.aspect === "4/3"
      ? "aspect-[4/3]"
      : game.aspect === "9/16"
        ? "aspect-[9/16]"
        : game.aspect === "1/1"
          ? "aspect-square"
          : "aspect-video";

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-bg-line bg-black ${aspect}`}
    >
      {!started && (
        <button
          onClick={() => setStarted(true)}
          className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-sm transition hover:bg-black/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.thumbnail}
            alt={game.title}
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-gradient shadow-glow">
              <Play className="h-9 w-9 fill-white text-white" />
            </span>
            <span className="text-2xl font-bold text-white">{game.title}</span>
            <span className="text-sm text-white/70">Click to start playing</span>
          </div>
        </button>
      )}

      {started && (
        isPlaceholder ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300">
              Placeholder game
            </span>
            <h3 className="text-xl font-bold text-white">
              Add your real embed URL
            </h3>
            <p className="max-w-md text-sm text-white/60">
              Edit{" "}
              <code className="rounded bg-bg-soft px-1.5 py-0.5 text-xs text-brand-400">
                lib/games.ts
              </code>{" "}
              and replace this game&apos;s{" "}
              <code className="rounded bg-bg-soft px-1.5 py-0.5 text-xs text-brand-400">
                embedUrl
              </code>{" "}
              with a real iframe URL from{" "}
              <a
                href="https://gamemonetize.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 underline"
              >
                gamemonetize.com
              </a>{" "}
              or{" "}
              <a
                href="https://gamedistribution.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 underline"
              >
                gamedistribution.com
              </a>
              .
            </p>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={game.embedUrl}
            title={game.title}
            allow="autoplay; fullscreen; gamepad; microphone; camera"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )
      )}

      {started && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="pointer-events-auto grid h-9 w-9 place-items-center rounded-lg bg-bg/70 text-white/80 backdrop-blur transition hover:bg-bg hover:text-white"
            aria-label="Restart game"
            title="Restart"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={goFullscreen}
            className="pointer-events-auto grid h-9 w-9 place-items-center rounded-lg bg-bg/70 text-white/80 backdrop-blur transition hover:bg-bg hover:text-white"
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
