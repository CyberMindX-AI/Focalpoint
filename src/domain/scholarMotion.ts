export type ScholarState = 'idle' | 'study' | 'thinking' | 'waiting' | 'celebrate' | 'encourage';
export type ScholarFrame = { row: number; frame: number; hold: number; blend: number; action: string };
type KeyPose = [row: number, frame: number, hold: number, blend?: number];

function gesture(action: string, poses: KeyPose[]): ScholarFrame[] {
  return poses.map(([row, frame, hold, blend = 160]) => ({ action, row, frame, hold, blend }));
}

/** Same pose sequence as the website scholar spritesheet. */
export function scholarMotion(state: ScholarState, turn: number): ScholarFrame[] {
  if (state === 'celebrate') return gesture('celebrate', [[3, 0, 180], [3, 1, 200], [3, 2, 380], [3, 1, 180], [3, 3, 240], [8, 5, 1700, 200]]);
  if (turn % 2 === 0 || state === 'idle') return gesture('idle', [[0, 0, 2500], [0, 2, 150, 100], [0, 3, 100, 60], [0, 4, 150, 80], [0, 0, 2900, 120]]);
  if (state === 'waiting') return gesture('waiting', [[0, 0, 220], [6, 0, 220], [6, 2, 450], [6, 3, 300], [6, 4, 400], [6, 5, 350], [0, 0, 220, 200]]);
  if (state === 'encourage') return gesture('encourage', [[0, 0, 220], [5, 4, 220], [5, 5, 600], [5, 6, 220], [0, 0, 220, 200]]);
  if (turn % 6 === 5) return gesture('wave', [[3, 0, 200], [3, 1, 220], [3, 2, 420], [3, 1, 200], [3, 3, 250], [0, 0, 200]]);
  if (state === 'thinking' || turn % 4 === 3) return gesture('thinking', [[0, 0, 220], [7, 0, 400], [7, 2, 480], [7, 3, 160, 100], [7, 4, 500], [7, 5, 250], [0, 0, 240, 200]]);
  return gesture('study', [[0, 0, 220], [8, 0, 240], [8, 1, 1000], [8, 3, 140, 80], [8, 1, 800, 100], [8, 0, 240], [0, 0, 220, 200]]);
}
