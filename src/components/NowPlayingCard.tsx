import Vinyl from "./Vinyl";

export interface TrackView {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  artworkUrl?: string | null;
  recognizedAt: string | Date;
}

function timeOf(t: string | Date) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function NowPlayingCard({
  track,
  size = "page",
}: {
  track: TrackView | null;
  size?: "page" | "projector";
}) {
  const big = size === "projector";
  const art = big ? 280 : 168;
  return (
    <div
      className={`flex items-center gap-6 rounded-2xl border border-line bg-surface p-6 ${
        big ? "md:gap-12 md:p-12" : ""
      }`}
    >
      {track?.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.artworkUrl}
          alt=""
          width={art}
          height={art}
          className="rounded-xl shrink-0 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          style={{ width: art, height: art, objectFit: "cover" }}
        />
      ) : (
        <Vinyl size={art} spinning={!!track} label={track ? null : "waiting"} />
      )}
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">
          {track ? "Now playing" : "Listening"}
        </p>
        {track ? (
          <>
            <h2
              className={`mt-2 font-semibold tracking-tight ${
                big ? "text-4xl md:text-6xl" : "text-2xl md:text-3xl"
              }`}
            >
              {track.title}
            </h2>
            <p className={`mt-1 text-muted ${big ? "text-2xl md:text-3xl" : "text-lg"}`}>
              {track.artist}
            </p>
            <p className="mt-3 font-mono text-xs text-muted">
              dropped {timeOf(track.recognizedAt)}
              {track.album ? ` · ${track.album}` : ""}
            </p>
          </>
        ) : (
          <p className={`mt-2 text-muted ${big ? "text-2xl" : ""}`}>
            Waiting for the needle to drop…
          </p>
        )}
      </div>
    </div>
  );
}
