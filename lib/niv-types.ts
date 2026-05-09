export type UnlockTier = "bronze" | "silver" | "gold" | "platinum";

export type GameId =
  | "pac-niv"
  | "snake-niv"
  | "niv-memory"
  | "niv-tac-toe"
  | "brick-niv"
  | "whack-a-niv";

export interface NivAssetPaths {
  avatar64: string;
  avatar128: string;
  avatar256: string;
  portrait720: string;
  stylized?: Partial<
    Record<"pixel" | "renaissance" | "anime" | "mona", string>
  >;
}

export interface NivAsset {
  slug: string;
  caption: string;
  tier: UnlockTier;
  game: GameId;
  milestone: string;
  paths: NivAssetPaths;
}

export interface NivManifest {
  version: 1;
  generatedAt: string;
  assets: NivAsset[];
}
