import { useId, useState } from "react";
import { Signal, useSignal, useSignalValue } from "../hooks/use-signal";
import {
  BoomSheet,
  BoomSheetsAnimation,
  parseSheet,
} from "../boomsheets-animations";
import { logError } from "../lib/log-error";
import { loadImageFile, loadTextFile } from "../lib/file-loading";
import Spacer from "./spacer";
import * as classes from "./render-order.module.css";
import { v4 as uuidv4 } from "uuid";
import CopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ChevronRight";
import PointIcon from "@mui/icons-material/MyLocation";
import AnimationIcon from "@mui/icons-material/Animation";
import PlaybackIcon from "@mui/icons-material/Loop";
import AttachIcon from "@mui/icons-material/Add";
import * as headlessTreeCore from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import classNames from "classnames";
import { generateDerivedAnimations } from "../lib/derived-animations";
import { ATTACHMENTS, createAttachment } from "../lib/common-attachments";

export type RenderTree = {
  rootOrder: string[];
  nodes: { [id: string]: RenderItem };
};
export type RenderItem = {
  id: string;
  sheet: InputSheet;
  parentPoint: string;
  state: string;
  playback: "ONCE" | "SYNC" | "LOOP" | "BG";
  children: string[];
};

export type InputSheets = { [name: string]: InputSheet };
export type InputSheet = {
  name: string;
  image?: HTMLImageElement;
  imageError?: string;
  boomsheet?: BoomSheet;
  animations?: BoomSheetsAnimation[];
  animationError?: string;
};

function baseName(name: string) {
  return name.slice(0, name.lastIndexOf("."));
}

function updateRenderTreeChildren(
  treeData: RenderTree,
  id: string,
  updateChildren: (children: string[]) => string[],
) {
  const parentNode = treeData.nodes[id];

  if (parentNode) {
    parentNode.children = updateChildren(parentNode.children);
  } else {
    treeData.rootOrder = updateChildren(treeData.rootOrder);
  }
}

function resolveError(item: RenderItem) {
  if (item.sheet.animationError) {
    return item.sheet.animationError;
  } else if (item.sheet.imageError) {
    return item.sheet.imageError;
  } else if (!item.sheet.animations) {
    return "Missing .animation file";
  } else if (!item.sheet.image) {
    return "Missing image file";
  }
}

async function loadFiles(
  sheetsSignal: Signal<InputSheets>,
  renderTreeSignal: Signal<RenderTree>,
  target: headlessTreeCore.DragTarget<RenderItem>,
  files: File[],
) {
  const sheetMap = { ...sheetsSignal.get() };
  const renderTree = { ...renderTreeSignal.get() };
  const pendingInsert: string[] = [];

  function findOrInsert(name: string) {
    let sheet = sheetMap[name];

    if (sheet) {
      return sheet;
    }

    sheet = { name };
    sheetMap[name] = sheet;

    const id = uuidv4();

    pendingInsert.push(id);

    renderTree.nodes[id] = {
      id,
      sheet,
      parentPoint: "ORIGIN",
      state: "DEFAULT",
      playback:
        name == "bg" || name.endsWith("_bg") || name.includes("background")
          ? "BG"
          : "ONCE",
      children: [],
    };

    return sheet;
  }

  for (const file of files) {
    const name = baseName(file.name);
    const sheet = findOrInsert(name);

    if (file.name.endsWith(".png")) {
      try {
        sheet.image = await loadImageFile(file);
        sheet.imageError = undefined;
      } catch (error) {
        console.error(error);
        sheet.imageError = error!.toString();
      }
    } else if (
      file.name.endsWith(".animation") ||
      file.name.endsWith(".anim")
    ) {
      try {
        const text = await loadTextFile(file);

        sheet.boomsheet = parseSheet(text);
        sheet.animations = sheet.boomsheet.animations;
        sheet.animationError = undefined;

        generateDerivedAnimations(sheet.boomsheet);
      } catch (error) {
        console.error(error);
        sheet.animationError = error!.toString();
      }

      if (sheet.animations && sheet.animations.length > 0) {
        // update every node to a valid state
        for (const node of Object.values(renderTree.nodes)) {
          if (
            node.sheet == sheet &&
            !sheet.animations.some((anim) => anim.state == node.state)
          ) {
            // default to the first state
            node.state = sheet.animations[0].state;
          }
        }
      }
    }
  }

  await headlessTreeCore.insertItemsAtTarget(
    pendingInsert,
    target,
    (item, newChildren) => {
      updateRenderTreeChildren(renderTree, item.getId(), () => newChildren);
    },
  );
  target.item.expand();

  sheetsSignal.set(sheetMap);
  renderTreeSignal.set(renderTree);
}

function duplicateItem(
  renderTreeSignal: Signal<RenderTree>,
  item: headlessTreeCore.ItemInstance<RenderItem>,
) {
  const treeData = { ...renderTreeSignal.get() };

  const id = uuidv4();
  treeData.nodes[id] = { ...item.getItemData(), children: [], id };

  const prevId = item.getId();
  updateRenderTreeChildren(treeData, item.getParent()!.getId(), (c) =>
    c.toSpliced(c.indexOf(prevId) + 1, 0, id),
  );

  renderTreeSignal.set(treeData);
}

function removeItem(
  renderTreeSignal: Signal<RenderTree>,
  sheetsSignal: Signal<InputSheets>,
  item: headlessTreeCore.ItemInstance<RenderItem>,
) {
  const treeData = { ...renderTreeSignal.get() };

  const sheet = item.getItemData().sheet;

  headlessTreeCore.removeItemsFromParents([item], (parentItem, newChildren) => {
    updateRenderTreeChildren(treeData, parentItem.getId(), () => newChildren);
  });

  const pendingRemoval = [item.getId()];
  let nextId;

  while ((nextId = pendingRemoval.pop()) != undefined) {
    pendingRemoval.push(...treeData.nodes[nextId].children);
    delete treeData.nodes[nextId];
  }

  renderTreeSignal.set(treeData);

  // possibly expensive to use Object.values, but we're expecting only a few nodes for quick viewing
  // if there's a need for larger scenes, we could switch to reference counting
  // but it's likely going to be fast enough even with hundreds of nodes

  if (!Object.values(treeData.nodes).some((node) => node.sheet == sheet)) {
    // delete the sheet if no render items are using it
    const sheetsMap = { ...sheetsSignal.get() };
    delete sheetsMap[sheet.name];
    sheetsSignal.set(sheetsMap);
  }
}

export default function InputSheetList({
  sheetsSignal,
  renderTreeSignal,
  recording,
}: {
  sheetsSignal: Signal<InputSheets>;
  renderTreeSignal: Signal<RenderTree>;
  recording: boolean;
}) {
  const treeData = useSignalValue(renderTreeSignal);

  const tree = useTree<RenderItem>({
    rootItemId: "root",
    canReorder: true,
    getItemName: (item) => item.getItemData().sheet.name,
    isItemFolder: () => true,
    dataLoader: {
      getItem: (itemId) => {
        const treeData = renderTreeSignal.get();
        return treeData.nodes[itemId];
      },
      getChildren: (itemId) => {
        const treeData = renderTreeSignal.get();

        return itemId == "root"
          ? treeData.rootOrder
          : treeData.nodes[itemId].children;
      },
    },
    onDrop: headlessTreeCore.createOnDropHandler((item, newChildren) => {
      const treeData = { ...renderTreeSignal.get() };
      updateRenderTreeChildren(treeData, item.getId(), () => newChildren);
      renderTreeSignal.set(treeData);
    }),
    canDropForeignDragObject: () => true,
    onDropForeignDragObject: async (dataTransfer, target) => {
      const items = dataTransfer.items;

      if (!items) {
        return;
      }

      const files: File[] = [];

      for (const item of items) {
        const file = item.getAsFile();

        if (file) {
          files.push(file);
        }
      }

      await loadFiles(sheetsSignal, renderTreeSignal, target, files).catch(
        logError,
      );

      // maybe this: https://github.com/lukasbach/headless-tree/issues/112
      tree.rebuildTree();
    },
    indent: 20,
    features: [
      headlessTreeCore.syncDataLoaderFeature,
      // headlessTreeCore.selectionFeature,
      headlessTreeCore.dragAndDropFeature,
      // headlessTreeCore.hotkeysCoreFeature, // a little annoying to use dropdowns when this is enabled
    ],
  });

  const [popoverItem, setPopoverItem] =
    useState<headlessTreeCore.ItemInstance<RenderItem> | null>(null);
  const popoverId = useId();

  return (
    <div className={classes.listBorder}>
      <div className={classes.list} {...tree.getContainerProps()}>
        {tree.getItems().map((item) => {
          const renderItem = item.getItemData();
          const errorMessage = resolveError(renderItem);
          const ExpandIcon = item.isExpanded()
            ? ExpandMoreIcon
            : ExpandLessIcon;

          const parent = item.getParent();
          const parentRenderItem =
            parent && parent.getId() != "root"
              ? parent.getItemData()
              : undefined;

          // resolve unique parent points
          const existingPoints: { [label: string]: boolean } = {};
          const parentAnim = parentRenderItem?.sheet.animations?.find(
            (anim) => anim.state == parentRenderItem.state,
          );
          const parentPoints = parentAnim?.frames
            .flatMap((frame) => frame.points)
            .filter((point) => {
              if (existingPoints[point.label]) {
                // already seen
                return false;
              }

              existingPoints[point.label] = true;
              return true;
            });

          return (
            <div
              key={item.getId()}
              {...item.getProps()}
              style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}
              className={classNames(classes.listRow, {
                [classes.dropTarget]: item.isDragTarget(),
              })}
            >
              {/* name */}
              <div>
                <ExpandIcon
                  className={
                    renderItem.children.length == 0 ? classes.hidden : undefined
                  }
                />
                <span className={classes.name}>{item.getItemName()}</span>
              </div>

              {/* point */}
              {parentRenderItem && (
                <>
                  <PointIcon />

                  <select
                    title="Point"
                    disabled={recording}
                    value={renderItem.parentPoint}
                    onChange={(e) => {
                      const treeData = { ...renderTreeSignal.get() };
                      treeData.nodes[item.getId()].parentPoint = e.target.value;
                      renderTreeSignal.set(treeData);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option>ORIGIN</option>

                    {parentPoints?.map((point) => (
                      <option key={point.label}>{point.label}</option>
                    ))}
                  </select>
                </>
              )}

              {/* state */}
              <>
                <AnimationIcon />

                <select
                  title="Animation State"
                  disabled={recording}
                  value={renderItem.state}
                  onChange={(e) => {
                    const treeData = { ...renderTreeSignal.get() };
                    treeData.nodes[item.getId()].state = e.target.value;
                    renderTreeSignal.set(treeData);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderItem.sheet.animations?.map((anim) => (
                    <option key={anim.state}>{anim.state}</option>
                  ))}
                </select>
              </>

              {/* playback */}
              <>
                <PlaybackIcon />

                <select
                  title="Playback"
                  disabled={recording}
                  value={renderItem.playback}
                  onChange={(e) => {
                    const treeData = { ...renderTreeSignal.get() };
                    treeData.nodes[item.getId()].playback = e.target
                      .value as RenderItem["playback"];
                    renderTreeSignal.set(treeData);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option>ONCE</option>
                  <option>SYNC</option>
                  <option>LOOP</option>
                  <option>BG</option>
                </select>
              </>

              <Spacer />

              {/* error */}
              {errorMessage && (
                <div className={classes.error} title={errorMessage}>
                  {errorMessage}
                </div>
              )}

              {/* actions */}
              <div>
                <button
                  title="Add Attachment"
                  className="icon-button"
                  disabled={recording}
                  popoverTarget={popoverId}
                  onClick={(e) => {
                    setPopoverItem(item);
                    e.stopPropagation();
                  }}
                >
                  <AttachIcon />
                </button>

                <button
                  title="Duplicate"
                  className="icon-button"
                  disabled={recording}
                  onClick={(e) => {
                    duplicateItem(renderTreeSignal, item);
                    tree.rebuildTree();
                    e.stopPropagation();
                  }}
                >
                  <CopyIcon />
                </button>

                <button
                  title="Delete"
                  className="icon-button"
                  disabled={recording}
                  onClick={(e) => {
                    removeItem(renderTreeSignal, sheetsSignal, item);
                    tree.rebuildTree();
                    e.stopPropagation();
                  }}
                >
                  <DeleteIcon />
                </button>
              </div>
            </div>
          );
        })}

        <div style={tree.getDragLineStyle()} className={classes.dragLine} />
      </div>

      <div id={popoverId} popover="auto" className={classes.attachmentPopover}>
        <div className={classes.attachmentList}>
          {ATTACHMENTS.filter((attachment) => {
            if (!popoverItem) {
              return false;
            }

            const selectedRoot = popoverItem.getId() == "root";

            return selectedRoot == !!attachment.root;
          }).map((attachment) => (
            <button
              key={attachment.name}
              popoverTarget={popoverId}
              onClick={() => {
                if (!popoverItem) {
                  return;
                }

                const parentId = popoverItem.getId();
                const renderTree = { ...renderTreeSignal.get() };
                const sheets = { ...sheetsSignal.get() };

                createAttachment(sheets, renderTree, parentId, attachment);

                sheetsSignal.set(sheets);
                renderTreeSignal.set(renderTree);

                tree.rebuildTree();
                popoverItem.expand();
              }}
            >
              {attachment.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
