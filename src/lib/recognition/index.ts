import type { RecognitionProvider } from "./types";
import { mockProvider } from "./mock";
import { auddProvider } from "./audd";
import { acrCloudProvider } from "./acrcloud";

export function getProvider(): RecognitionProvider {
  const explicit = process.env.RECOGNITION_PROVIDER?.toLowerCase();
  switch (explicit) {
    case "audd":
      return auddProvider;
    case "acrcloud":
      return acrCloudProvider;
    case "mock":
      return mockProvider;
  }
  // No explicit choice: use AudD when a token is present, otherwise mock.
  return process.env.AUDD_API_TOKEN ? auddProvider : mockProvider;
}

export type { Match, RecognitionProvider } from "./types";
