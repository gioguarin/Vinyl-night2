export interface Match {
  title: string;
  artist: string;
  album?: string | null;
  artworkUrl?: string | null;
  isrc?: string | null;
  spotifyId?: string | null;
  confidence?: number | null;
  provider: string;
}

export interface RecognitionProvider {
  name: string;
  /** Returns a Match or null when nothing was recognized in the clip. */
  recognize(audio: Buffer, mime: string): Promise<Match | null>;
}
