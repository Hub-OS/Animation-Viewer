import { RenderItem, RenderTree } from "../components/render-order";
import { BoomSheetsAnimation, BoomSheetsFrame } from "../boomsheets-animations";
import lcm from "compute-lcm";

function checkedLcm(values: number[]) {
  console.log(values);
  values = values.filter((n) => Number.isFinite(n) && n > 0);
  console.log(values);

  const defaultValue = values[0] ?? 0;
  return values.length == 0 ? defaultValue : (lcm(...values) ?? defaultValue);
}

export function calculateLoopDuration(renderTree: RenderTree) {
  let loopingDurations: number[] = [];
  let constantDuration = 0;

  for (const node of Object.values(renderTree.nodes)) {
    if (node.playback == "SYNC") {
      // the duration of this node is decided by a different node
      continue;
    }

    const animations = node.sheet.animations;

    if (!animations) {
      continue;
    }

    const anim = animations.find((anim) => anim.state == node.state);

    if (!anim) {
      continue;
    }

    let duration = anim.frames.reduce(
      (acc, frame) => acc + parseFrameDuration(frame.duration),
      0,
    );

    if (node.playback == "ONCE") {
      constantDuration = Math.max(duration, constantDuration);
      continue;
    }

    if (node.playback == "BG") {
      // we must calculate when this BG returns to its original position for a clean loop
      const velPoint = anim.frames[0]?.points.find(
        (point) => point.label == "VELOCITY",
      );

      if (velPoint) {
        const firstFrame = anim.frames[0];

        duration = checkedLcm([
          duration,
          Math.abs(firstFrame.w / velPoint.x),
          Math.abs(firstFrame.h / velPoint.y),
        ]);
      }
    }

    if (duration > 0) {
      loopingDurations.push(duration);
    }
  }

  let loopDuration = checkedLcm(loopingDurations);

  if (loopDuration == 0) {
    // no loop, just use the constant duration
    return constantDuration;
  }

  if (constantDuration > loopDuration) {
    // loop more times to play the full the constant animation with a clean loop
    loopDuration = Math.max(constantDuration / loopDuration) * loopDuration;
  }

  return loopDuration;
}

function parseFrameDuration(durationString: string) {
  const duration =
    durationString.endsWith("f") || durationString.endsWith("F")
      ? parseInt(durationString)
      : Math.round(parseFloat(durationString) * 60);

  // prevent negative values
  return Math.max(duration, 0);
}

function getAnim(renderItem: RenderItem) {
  const { animations } = renderItem.sheet;

  return animations?.find((anim) => anim.state == renderItem.state);
}

function frameAt(
  renderItem: RenderItem,
  anim: BoomSheetsAnimation,
  frameTime: number,
  parentFrameIndex: number,
) {
  switch (renderItem.playback) {
    case "LOOP":
    case "BG":
      frameTime %= anim.frames.reduce(
        (acc, frame) => acc + parseFrameDuration(frame.duration),
        0,
      );
      break;
    case "SYNC":
      return (
        anim.frames[parentFrameIndex] ?? anim.frames[anim.frames.length - 1]
      );
  }

  let visibleFrame;

  for (const frame of anim.frames) {
    let duration = parseFrameDuration(frame.duration);

    frameTime -= duration;

    visibleFrame = frame;

    if (frameTime < 0) {
      break;
    }
  }

  return visibleFrame;
}

export default function createRenderer(
  canvas: HTMLCanvasElement,
  renderTree: RenderTree,
) {
  const offscreenCanvases: { [id: string]: HTMLCanvasElement } = {};
  const ctx = canvas.getContext("2d")!;

  return function (
    frameTime: number,
    originX: number,
    originY: number,
    scale: number,
  ) {
    const resolutionX = canvas.width / scale;
    const resolutionY = canvas.height / scale;

    // must reset in case the canvas was modified
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(scale, scale);

    type ParentData = {
      frame?: BoomSheetsFrame;
      frameIndex: number;
      top: number;
      left: number;
    };

    const rootData: ParentData = {
      frameIndex: 0,
      left: Math.floor(resolutionX * originX),
      top: Math.floor(resolutionY * originY),
    };

    // depth first search
    const renderQueue: [string[], number, ParentData][] = [
      [renderTree.rootOrder, 0, rootData],
    ];

    while (renderQueue.length > 0) {
      const [list, index, parentData] = renderQueue[renderQueue.length - 1];

      const id = list[index];

      if (id == undefined) {
        renderQueue.pop();
        continue;
      }

      // advance index for the revisit
      renderQueue[renderQueue.length - 1][1] += 1;

      const renderItem = renderTree.nodes[id];

      if (renderItem.hidden) {
        continue;
      }

      const anim = getAnim(renderItem);

      if (!anim) {
        continue;
      }

      const frame = frameAt(renderItem, anim, frameTime, parentData.frameIndex);

      if (!frame) {
        continue;
      }

      // resolve position
      let x = parentData.left - frame.originx;
      let y = parentData.top - frame.originy;

      if (parentData.frame) {
        if (renderItem.parentPoint == "ORIGIN") {
          x += parentData.frame.originx;
          y += parentData.frame.originy;
        } else {
          const point = parentData.frame.points.find(
            (point) => point.label == renderItem.parentPoint,
          );

          if (!point) {
            continue;
          }

          x += point.x;
          y += point.y;
        }
      }

      if (renderItem.children.length > 0) {
        // queue children
        const frameIndex = anim.frames.indexOf(frame);

        renderQueue.push([
          renderItem.children,
          0,
          { frame, frameIndex, left: x, top: y },
        ]);
      }

      // render item
      const { image } = renderItem.sheet;

      if (!image) {
        continue;
      }

      if (renderItem.playback == "BG") {
        // render frame to offscreen canvas
        let offscreenCanvas = offscreenCanvases[id];

        if (!offscreenCanvas) {
          offscreenCanvas = document.createElement("canvas");
          offscreenCanvases[id] = offscreenCanvas;
        }

        const offscreenCtx = offscreenCanvas.getContext("2d")!;

        offscreenCanvas.width = frame.w;
        offscreenCanvas.height = frame.h;

        // must reset after the canvas is modified
        offscreenCtx.imageSmoothingEnabled = false;

        drawFrameAt(offscreenCtx, image, frame, 0, 0);

        // render to main canvas as a repeating pattern
        const pattern = ctx.createPattern(offscreenCanvas, "repeat")!;

        const velPoint = anim.frames[0].points.find(
          (point) => point.label == "VELOCITY",
        );

        if (velPoint) {
          x += Math.floor(velPoint.x * frameTime * scale) / scale;
          y += Math.floor(velPoint.y * frameTime * scale) / scale;
        }

        ctx.translate(x, y);
        ctx.fillStyle = pattern;
        ctx.fillRect(-x, -y, resolutionX, resolutionY);

        ctx.translate(-x, -y);
        continue;
      }

      drawFrameAt(ctx, image, frame, x, y);
    }

    ctx.restore();
  };
}

function drawFrameAt(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: BoomSheetsFrame,
  x: number,
  y: number,
) {
  if (frame.flipx || frame.flipy) {
    let xScale = 1;
    let yScale = 1;

    if (frame.flipx) {
      xScale = -1;
      x = -x - frame.originx * 2;
    }

    if (frame.flipy) {
      yScale = -1;
      y = -y - frame.originy * 2;
    }

    ctx.save();
    ctx.scale(xScale, yScale);
  }

  ctx.drawImage(
    image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    x,
    y,
    frame.w,
    frame.h,
  );

  if (frame.flipx || frame.flipy) {
    ctx.restore();
  }
}
