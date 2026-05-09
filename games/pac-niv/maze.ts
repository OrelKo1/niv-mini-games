// Pac-Niv maze layout — simplified classic Pac-Man, 28 wide × 31 tall.
// Legend:
//   #  wall
//   .  pellet
//   o  power pellet
//   ' 'empty (corridor without pellet, e.g. tunnels, ghost-house exit)
//   P  player spawn (single)
//   G  ghost spawn (in/near the ghost house)
//   -  ghost-house door (treated like a wall to the player but ghosts pass)
//
// Each row MUST be exactly 28 chars long. There are exactly 31 rows.

export const MAZE_W = 28;
export const MAZE_H = 31;

export const MAZE_LAYOUT: string[] = [
  "############################", //  0
  "#............##............#", //  1
  "#.####.#####.##.#####.####.#", //  2
  "#o####.#####.##.#####.####o#", //  3
  "#.####.#####.##.#####.####.#", //  4
  "#..........................#", //  5
  "#.####.##.########.##.####.#", //  6
  "#.####.##.########.##.####.#", //  7
  "#......##....##....##......#", //  8
  "######.##### ## #####.######", //  9
  "     #.##### ## #####.#     ", // 10
  "     #.##          ##.#     ", // 11
  "     #.## ###--### ##.#     ", // 12
  "######.## #GG  GG# ##.######", // 13
  "      .   #G    G#   .      ", // 14
  "######.## #GGGGGG# ##.######", // 15
  "     #.## ######## ##.#     ", // 16
  "     #.##          ##.#     ", // 17
  "     #.## ######## ##.#     ", // 18
  "######.## ######## ##.######", // 19
  "#............##............#", // 20
  "#.####.#####.##.#####.####.#", // 21
  "#.####.#####.##.#####.####.#", // 22
  "#o..##.......P .......##..o#", // 23
  "###.##.##.########.##.##.###", // 24
  "###.##.##.########.##.##.###", // 25
  "#......##....##....##......#", // 26
  "#.##########.##.##########.#", // 27
  "#.##########.##.##########.#", // 28
  "#..........................#", // 29
  "############################", // 30
];

export type TileKind = "wall" | "pellet" | "power" | "empty" | "door";

export interface ParsedMaze {
  tiles: TileKind[][]; // [y][x]
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  ghostSpawns: { x: number; y: number }[];
  pelletCount: number;
}

export function parseMaze(layout: string[] = MAZE_LAYOUT): ParsedMaze {
  const height = layout.length;
  const width = layout[0]?.length ?? 0;
  const tiles: TileKind[][] = [];
  let playerSpawn = { x: 1, y: 1 };
  const ghostSpawns: { x: number; y: number }[] = [];
  let pelletCount = 0;

  for (let y = 0; y < height; y++) {
    const row: TileKind[] = [];
    const line = layout[y];
    for (let x = 0; x < width; x++) {
      const ch = line[x] ?? "#";
      switch (ch) {
        case "#":
          row.push("wall");
          break;
        case ".":
          row.push("pellet");
          pelletCount++;
          break;
        case "o":
          row.push("power");
          pelletCount++;
          break;
        case "-":
          row.push("door");
          break;
        case "P":
          playerSpawn = { x, y };
          row.push("empty");
          break;
        case "G":
          ghostSpawns.push({ x, y });
          row.push("empty");
          break;
        default:
          row.push("empty");
          break;
      }
    }
    tiles.push(row);
  }

  return {
    tiles,
    width,
    height,
    playerSpawn,
    ghostSpawns,
    pelletCount,
  };
}
