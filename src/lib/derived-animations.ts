// Common animations generated from existing animations by mods or the engine

import {
  BoomSheet,
  BoomSheetsAnimation,
  BoomSheetsFrame,
} from "../boomsheets-animations";

const ANIMATIONS = [
  {
    state: "CHARACTER_SHOOT",
    frameData: [
      [1, 1],
      [2, 2],
      [3, 2],
      [1, 1],
    ],
  },
  {
    state: "CHARACTER_THROW",
    frameData: [
      [1, 5],
      [2, 4],
      [3, 3],
      [4, 5],
      [5, 4],
    ],
  },
  {
    state: "CHARACTER_SWING_HILT",
    frameData: [
      [1, 8],
      [2, 2],
      [3, 2],
      [4, 15],
    ],
  },
  {
    state: "CHARACTER_SWING_HAND",
    frameData: [
      [1, 8],
      [2, 2],
      [3, 2],
      [4, 15],
    ],
  },
  {
    state: "CHARACTER_MOVE",
    frameData: [
      [1, 2],
      [2, 1],
      [3, 1],
      [4, 1],
      [3, 1],
      [2, 1],
      [1, 2],
    ],
  },
];

export function generateDerivedAnimations(boomSheet: BoomSheet) {
  const animations = boomSheet.animations;

  if (!animations) {
    return;
  }

  const animsByState: { [state: string]: BoomSheetsAnimation } = {};

  for (const anim of animations) {
    animsByState[anim.state] = anim;
  }

  for (const { state, frameData } of ANIMATIONS) {
    const anim = animsByState[state];

    if (!anim) {
      continue;
    }

    const frames: BoomSheetsFrame[] = [];

    for (const [i, duration] of frameData) {
      const originalFrame =
        anim.frames[i - 1] ?? anim.frames[anim.frames.length - 1];

      if (!originalFrame) {
        // no frames?
        break;
      }

      frames.push({
        ...originalFrame,
        duration: duration + "f",
      });
    }

    animations.push({
      state: "*" + state,
      frames,
    });
  }
}
