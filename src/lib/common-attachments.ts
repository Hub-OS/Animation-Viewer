import { BoomSheet, BoomSheetsFrame } from "../boomsheets-animations";
import {
  InputSheet,
  InputSheets,
  RenderItem,
  RenderTree,
} from "../components/render-order";
import { v4 as uuidv4 } from "uuid";

type CommonAttachment = {
  name: string;
  parentPoint: string;
  playback: RenderItem["playback"];
  root?: boolean;
  reparents?: boolean;
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
  // can't be added until we add a delay feature
  // {
  //   name: "BLADE",
  //   parentPoint: "ENDPOINT",
  //   playback: "ONCE",
  // },
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
    name: "<TILE",
    parentPoint: "ORIGIN",
    playback: "ONCE",
    root: true,
    reparents: true,
    image: loadImage(new URL("../../public/tile.png", import.meta.url)),
    frames: [
      {
        ...FRAME_DEFAULTS,
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        originx: 20,
        originy: 12,
      },
    ],
  },
  {
    name: "^BG",
    parentPoint: "ORIGIN",
    playback: "BG",
    root: true,
    image: loadImage(new URL("../../public/PLAIN_GRID.png", import.meta.url)),
    frames: [
      {
        ...FRAME_DEFAULTS,
        x: 0,
        y: 0,
        w: 16,
        h: 16,
        points: [{ label: "VELOCITY", x: -0.32, y: 0.0 }],
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

  if (parentId == "root") {
    renderTree.rootOrder = [...renderTree.rootOrder, id];
  } else if (attachment.root) {
    const index = renderTree.rootOrder.indexOf(parentId);
    renderTree.rootOrder = renderTree.rootOrder.toSpliced(
      index,
      attachment.reparents ? 1 : 0,
      id,
    );
  } else {
    const parentNode = renderTree.nodes[parentId];
    parentNode.children = [...parentNode.children, id];
  }

  let sheet: InputSheet | undefined;
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
        image: attachment.image,
      };

      sheets[attachment.name] = sheet;
    }

    state = "DEFAULT";
  } else {
    sheet = renderTree.nodes[parentId]?.sheet;
  }

  renderTree.nodes[id] = {
    id,
    sheet,
    parentPoint: attachment.parentPoint,
    state,
    playback: attachment.playback,
    children: attachment.reparents && parentId != "root" ? [parentId] : [],
  };

  return id;
}
