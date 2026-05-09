// Initial stub. Overwritten by scripts/gen-videos.ts when Veo videos are generated.
export interface NivVideo {
  slug: string;
  src: string;
  role: string;
  caption: string;
}

export const NIV_VIDEOS: {
  version: 1;
  generatedAt: string;
  videos: NivVideo[];
} = {
  version: 1,
  generatedAt: "",
  videos: [],
};
