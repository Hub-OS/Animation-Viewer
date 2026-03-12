import { double as quote, unquote } from "quote-unquote";

export type BoomSheet = {
  version: "legacy" | "modern";
  animations: BoomSheetsAnimation[];
};

export type BoomSheetsPoint = {
  label: string;
  x: number;
  y: number;
};

export type BoomSheetsFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  originx: number;
  originy: number;
  flipx: boolean;
  flipy: boolean;
  duration: string;
  points: BoomSheetsPoint[];
};

export type BoomSheetsAnimation = {
  state: string;
  frames: BoomSheetsFrame[];
};

type Attributes = { [key: string]: string };
const nonSpaceRegex = /\S/g;
const keyEndRegex = /[\s=]/g;

function matchGRegexFrom(
  text: string,
  regex: RegExp,
  index: number
): RegExpMatchArray | null {
  regex.lastIndex = index;
  return regex.exec(text);
}

function stringCharIsEscaped(text: string, index: number): boolean {
  let escaped = false;

  while (index > 0) {
    index -= 1;

    if (text[index] != "\\") {
      break;
    }

    escaped = !escaped;
  }

  return escaped;
}

function findClosingQuote(text: string, index: number): number {
  // search for non escaped quote
  while (true) {
    if ((index = text.indexOf('"', index)) < 0) {
      return -1;
    }

    if (!stringCharIsEscaped(text, index)) {
      break;
    }

    index += 1;
  }

  return index;
}

function parseAttributes(
  line: string,
  lineNumber: number,
  attributeStart?: number
): Attributes {
  const attributes: Attributes = {};

  let index = attributeStart ?? line.indexOf(" ");

  if (index < 0) {
    // no attributes
    return attributes;
  }

  let match: RegExpMatchArray | null;

  while ((match = matchGRegexFrom(line, nonSpaceRegex, index))) {
    index = match.index!;

    // find key end
    match = matchGRegexFrom(line, keyEndRegex, index);

    if (!match) {
      throw new Error(
        `Unexpected "${line.slice(index)}" on line ${lineNumber}`
      );
    }

    const key = line.slice(index, match.index!);

    // find "="
    const eqIndex = line.indexOf("=", match.index);

    if (eqIndex < 0) {
      throw new Error(`Attribute is missing "=" on line ${lineNumber}`);
    }

    // find value start
    match = matchGRegexFrom(line, nonSpaceRegex, eqIndex + 1);

    if (!match) {
      throw new Error(`Attribute is missing value on line ${lineNumber}`);
    }

    // find value end
    let valueStart = match.index!;
    let value = "";

    if (line[valueStart] == '"') {
      // quoted value
      let valueEnd = findClosingQuote(line, valueStart + 1);

      if (valueEnd < 0) {
        throw new Error(`String missing closing quote on line ${lineNumber}`);
      }

      valueEnd += 1;

      value = unquote(line.slice(valueStart, valueEnd));
      index = valueEnd;
    } else {
      // no quotes
      let valueEnd = line.indexOf(" ", valueStart);

      if (valueEnd < 0) {
        valueEnd = line.length;
      }

      value = line.slice(valueStart, valueEnd);
      index = valueEnd;
    }

    attributes[key] = value;
  }

  return attributes;
}

function nextWord(text: string, position?: number): [number, string, string] {
  let startIndex = text.length;

  for (let i = position ?? 0; i < text.length; i++) {
    if (text[i] != " ") {
      startIndex = i;
      break;
    }
  }

  let endIndex = text.length;

  for (let i = startIndex; i < text.length; i++) {
    if (text[i] == " ") {
      endIndex = i;
      break;
    }
  }

  return [startIndex, text.slice(startIndex, endIndex), text.slice(endIndex)];
}

export function parseSheet(text: string): BoomSheet {
  const animations: BoomSheetsAnimation[] = [];
  const boomsheet: BoomSheet = {
    version: "modern",
    animations,
  };

  let lineNumber = 0;
  let currentAnimation: BoomSheetsAnimation | undefined;
  let currentFrame: BoomSheetsFrame | undefined;

  for (let line of text.split("\n")) {
    line = line.trim();
    lineNumber += 1;

    if (
      line == "" ||
      line.startsWith("#") ||
      line.startsWith("!") ||
      line.startsWith("imagePath") ||
      line.startsWith("version")
    ) {
      // skip
      continue;
    }

    if (line.startsWith("anim ") || line.startsWith("animation ")) {
      const spaceIndex = line.indexOf(" ");

      if (spaceIndex == -1) {
        throw new Error(
          `Animation is missing state name on line ${lineNumber}`
        );
      }

      let [_, word, remainingLine] = nextWord(line.slice(spaceIndex));
      let state;

      if (
        word.startsWith("state=") ||
        (word == "state" && nextWord(remainingLine)[1].startsWith("="))
      ) {
        // state="STATE"
        boomsheet.version = "legacy";

        const attributes = parseAttributes(line, lineNumber);
        state = attributes.state;
      } else if (word.startsWith('"')) {
        // quoted state
        remainingLine = line.slice(spaceIndex).trim();
        state = remainingLine.slice(1, findClosingQuote(remainingLine, 1));
      } else {
        // unquoted state
        state = line.slice(spaceIndex).trim();
      }

      if (state == undefined) {
        throw new Error(
          `Animation is missing state name on line ${lineNumber}`
        );
      }

      const animation: BoomSheetsAnimation = {
        state,
        frames: [],
      };

      animations.push(animation);
      currentAnimation = animation;
    } else if (line.startsWith("frame") || line.startsWith("blank")) {
      if (!currentAnimation) {
        throw new Error(
          `No animation state to associate frame with on line ${lineNumber}`
        );
      }

      const attributes = parseAttributes(line, lineNumber);

      const frame: BoomSheetsFrame = {
        x: parseFloat(attributes.x) || 0,
        y: parseFloat(attributes.y) || 0,
        w: parseFloat(attributes.w) || 0,
        h: parseFloat(attributes.h) || 0,
        originx: parseFloat(attributes.originx) || 0,
        originy: parseFloat(attributes.originy) || 0,
        flipx: parseInt(attributes.flipx) == 1,
        flipy: parseInt(attributes.flipy) == 1,
        duration: attributes.duration || attributes.dur || "",
        points: [],
      };

      currentAnimation.frames.push(frame);
      currentFrame = frame;
    } else if (line.startsWith("point ")) {
      if (!currentFrame) {
        throw new Error(
          `No frame to associate point with on line ${lineNumber}`
        );
      }

      let attributesIndex = "point ".length;

      // see if we start with a label in quotes or if we need to just read attributes
      const [wordIndex, word, _] = nextWord(line, attributesIndex);
      let label;

      if (word.startsWith('"')) {
        // point starts with label in quotes and not within a named attribute
        const labelEndIndex = findClosingQuote(line, wordIndex + 1);
        label = line.slice(wordIndex + 1, labelEndIndex);
        attributesIndex = labelEndIndex + 1;
      }

      // read attributes
      const attributes = parseAttributes(line, lineNumber, attributesIndex);
      label = label ?? attributes.label;

      if (!label) {
        throw new Error(`Point is missing label on line ${lineNumber}`);
      }

      const point: BoomSheetsPoint = {
        label,
        x: parseFloat(attributes.x),
        y: parseFloat(attributes.y),
      };

      currentFrame.points.push(point);
    } else {
      const wordEnd = line.indexOf(" ");
      const word = wordEnd < 0 ? line : line.slice(0, wordEnd);
      throw new Error(`Unexpected "${word}" on line ${lineNumber}`);
    }
  }

  return boomsheet;
}

type SerializeObjectOptions = {
  quoteAllValues?: boolean;
  renamedKeys?: { [key: string]: string };
};

function serializeObject(
  name: string,
  object: { [key: string]: any },
  options: SerializeObjectOptions = { quoteAllValues: true }
): string {
  const text: string[] = [name];

  for (const key in object) {
    const value = object[key];
    let renamedKey = key;

    if (options.renamedKeys) {
      renamedKey = options.renamedKeys[key] || key;
    }

    switch (typeof value) {
      case "string":
        if (value != "") {
          text.push(" ");
          text.push(renamedKey);
          text.push("=");
          if (
            options.quoteAllValues ||
            value.includes('"') ||
            value.includes(" ")
          ) {
            text.push(quote(value));
          } else {
            text.push(value);
          }
        }
        break;
      case "number":
        if (value != 0) {
          if (options.quoteAllValues) {
            text.push(` ${renamedKey}="${value}"`);
          } else {
            text.push(` ${renamedKey}=${value}`);
          }
        }
        break;
      case "boolean":
        if (value == true) {
          text.push(" ");
          text.push(renamedKey);

          if (options.quoteAllValues) {
            text.push('="1"');
          } else {
            text.push("=1");
          }
        }
        break;
      case "object":
        if (Array.isArray(value)) {
          // fall through to error if the value is not an array
          break;
        }
      default:
        throw new Error(`Unexpected ${typeof value} for ${renamedKey}`);
    }
  }

  return text.join("");
}

export function serializeSheet(boomsheet: BoomSheet): string {
  const lines: string[] = [];

  const options: SerializeObjectOptions = {
    quoteAllValues: true,
  };

  if (boomsheet.version == "modern") {
    options.quoteAllValues = false;
    options.renamedKeys = { duration: "dur" };
  }

  for (const animation of boomsheet.animations) {
    if (boomsheet.version == "modern") {
      lines.push("anim " + animation.state);
    } else {
      lines.push(serializeObject("animation", animation, options));
    }

    for (const frame of animation.frames) {
      lines.push(serializeObject("frame", frame, options));

      for (const point of frame.points) {
        lines.push(serializeObject("point", point, options));
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
