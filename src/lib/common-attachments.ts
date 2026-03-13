import { BoomSheet, BoomSheetsFrame } from "../boomsheets-animations";
import {
  InputSheets,
  RenderItem,
  RenderTree,
} from "../components/render-order";
import { v4 as uuidv4 } from "uuid";

type CommonAttachment = {
  name: string;
  parentPoint: string;
  playback: RenderItem["playback"];
} & (
  | {}
  | {
      image: HTMLImageElement;
      frames: BoomSheetsFrame[];
    }
);

const FRAME_DEFAULTS = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  originx: 0,
  originy: 0,
  flipx: false,
  flipy: false,
  duration: "0f",
  points: [],
};

export const ATTACHMENTS: CommonAttachment[] = [
  {
    name: "BUSTER",
    parentPoint: "BUSTER",
    playback: "SYNC",
  },
  {
    name: "*FLARE",
    parentPoint: "ENDPOINT",
    playback: "ONCE",
    image: loadImage(new URL("../../public/buster_flare.png", import.meta.url)),
    frames: [
      { ...FRAME_DEFAULTS, duration: "3f" },
      {
        ...FRAME_DEFAULTS,
        x: 2,
        y: 2,
        w: 24,
        h: 13,
        originx: 0,
        originy: 6,
        duration: "1f",
      },
      {
        ...FRAME_DEFAULTS,
        x: 2,
        y: 19,
        w: 24,
        h: 13,
        originx: 0,
        originy: 6,
        duration: "1f",
      },
      {
        ...FRAME_DEFAULTS,
        x: 2,
        y: 36,
        w: 14,
        h: 3,
        originx: 0,
        originy: 1,
        duration: "2f",
      },
      { ...FRAME_DEFAULTS, duration: "1f" },
    ],
  },
  // can't be added until we add some delay
  // {
  //   name: "BLADE",
  //   parentPoint: "ENDPOINT",
  //   playback: "ONCE",
  // },
  {
    name: "*BOMB",
    parentPoint: "HAND",
    playback: "SYNC",
    image: loadImage(new URL("../../public/bomb.png", import.meta.url)),
    frames: [
      {
        ...FRAME_DEFAULTS,
        x: 1,
        y: 1,
        w: 11,
        h: 11,
        originx: 7,
        originy: 6,
      },
      {
        ...FRAME_DEFAULTS,
        x: 1,
        y: 1,
        w: 11,
        h: 11,
        originx: 7,
        originy: 6,
      },
      {
        ...FRAME_DEFAULTS,
      },
    ],
  },
  {
    name: "*BLADE",
    parentPoint: "ENDPOINT",
    playback: "ONCE",
    image: loadImage(new URL("../../public/blade.png", import.meta.url)),
    frames: [
      {
        ...FRAME_DEFAULTS,
        // delay the first frame since it spawns later
        duration: "8f",
      },
      {
        ...FRAME_DEFAULTS,
        x: 67,
        y: 26,
        w: 24,
        h: 17,
        originx: 1,
        originy: 4,
        duration: "0.033",
      },
      {
        ...FRAME_DEFAULTS,
        x: 67,
        y: 1,
        w: 32,
        h: 23,
        originx: 1,
        originy: 8,
        duration: "0.033",
      },
      {
        ...FRAME_DEFAULTS,
        x: 1,
        y: 1,
        w: 64,
        h: 26,
        originx: 14,
        originy: 14,
        duration: "0.033",
      },
      {
        ...FRAME_DEFAULTS,
        x: 1,
        y: 29,
        w: 47,
        h: 20,
        originx: 13,
        originy: 14,
        duration: "0.033",
      },
      {
        ...FRAME_DEFAULTS,
        x: 1,
        y: 51,
        w: 37,
        h: 18,
        originx: 13,
        originy: 14,
        duration: "0.033",
      },
      {
        ...FRAME_DEFAULTS,
        x: 40,
        y: 51,
        w: 16,
        h: 16,
        originx: 13,
        originy: 14,
        duration: "0.067",
      },
    ],
  },
];

export const ATTACHMENT_MAP: { [name: string]: CommonAttachment } = {};

function loadImage(url: URL) {
  const image = new Image();
  image.src = url.toString();
  return image;
}

export function createAttachment(
  sheets: InputSheets,
  renderTree: RenderTree,
  parentId: string,
  attachment: CommonAttachment,
) {
  const id = uuidv4();
  const parentNode = renderTree.nodes[parentId];

  parentNode.children = [...parentNode.children, id];

  let sheet = parentNode.sheet;
  let state = attachment.name;

  if ("image" in attachment) {
    sheet = sheets[attachment.name];

    if (!sheet) {
      const boomSheet: BoomSheet = {
        version: "legacy",
        animations: [{ state: "DEFAULT", frames: attachment.frames }],
      };

      sheet = {
        name: attachment.name,
        boomsheet: boomSheet,
        animations: boomSheet.animations,
      };

      try {
        // load image

        sheet.image = attachment.image;
        sheet.imageError = undefined;
      } catch (error) {
        console.error(error);
        sheet.imageError = error!.toString();
      }

      sheets[attachment.name] = sheet;
    }

    state = "DEFAULT";
  }

  renderTree.nodes[id] = {
    id,
    sheet,
    parentPoint: attachment.parentPoint,
    state,
    playback: attachment.playback,
    children: [],
  };
}
