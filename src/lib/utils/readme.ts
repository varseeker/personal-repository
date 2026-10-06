const README_PRIORITY = ["readme.md", "readme"] as const;

export function readmeRank(name: string): number {
  const index = README_PRIORITY.indexOf(name.toLowerCase() as (typeof README_PRIORITY)[number]);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function pickReadme<T extends { name: string }>(files: T[]): T | null {
  let best: T | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const file of files) {
    const rank = readmeRank(file.name);
    if (rank < bestRank) {
      best = file;
      bestRank = rank;
    }
  }

  return best;
}

export function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
