/**
 * Vendored from https://github.com/chenyuncai/tiptap-track-change-extension
 * Adapted: removed LOG_ENABLED console spam, removed IME composition hacks,
 * cleaned up for tiptap v3 compatibility.
 */
import { ReplaceStep, Step } from "@tiptap/pm/transform";
import { TextSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Slice, Fragment } from "@tiptap/pm/model";
import {
  Extension,
  Mark,
  getMarkRange,
  getMarksBetween,
  isMarkActive,
  mergeAttributes,
} from "@tiptap/core";
import type { CommandProps, Editor, MarkRange } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";

export const MARK_DELETION = "deletion";
export const MARK_INSERTION = "insertion";
export const EXTENSION_NAME = "trackchange";

export const TRACK_COMMAND_ACCEPT = "accept";
export const TRACK_COMMAND_ACCEPT_ALL = "accept-all";
export const TRACK_COMMAND_REJECT = "reject";
export const TRACK_COMMAND_REJECT_ALL = "reject-all";

export type TRACK_COMMAND_TYPE =
  | "accept"
  | "accept-all"
  | "reject"
  | "reject-all";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trackchange: {
      setTrackChangeStatus: (enabled: boolean) => ReturnType;
      getTrackChangeStatus: () => ReturnType;
      toggleTrackChangeStatus: () => ReturnType;
      acceptChange: () => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectChange: () => ReturnType;
      rejectAllChanges: () => ReturnType;
      updateOpUserOption: (
        opUserId: string,
        opUserNickname: string,
      ) => ReturnType;
    };
  }
}

export const InsertionMark = Mark.create({
  name: MARK_INSERTION,
  addAttributes() {
    return {
      "data-op-user-id": { type: "string", default: () => "" },
      "data-op-user-nickname": { type: "string", default: () => "" },
      "data-op-date": { type: "string", default: () => "" },
    };
  },
  parseHTML() {
    return [{ tag: "insert" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "insert",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const DeletionMark = Mark.create({
  name: MARK_DELETION,
  addAttributes() {
    return {
      "data-op-user-id": { type: "string", default: () => "" },
      "data-op-user-nickname": { type: "string", default: () => "" },
      "data-op-date": { type: "string", default: () => "" },
    };
  },
  parseHTML() {
    return [{ tag: "delete" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "delete",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

const getSelfExt = (editor: Editor) =>
  editor.extensionManager.extensions.find(
    (item) => item.type === "extension" && item.name === EXTENSION_NAME,
  ) as Extension;

const getMinuteTime = () =>
  Math.round(new Date().getTime() / 1000 / 60) * 1000 * 60;

const changeTrack = (opType: TRACK_COMMAND_TYPE, param: CommandProps) => {
  // Use view.state (not param.editor.state) because onTransaction
  // updates view state directly via updateState(), making param.tr stale.
  const viewState = param.editor.view.state;
  const from = viewState.selection.from;
  const to = viewState.selection.to;

  let markRanges: Array<MarkRange> = [];

  if (
    (opType === TRACK_COMMAND_ACCEPT || opType === TRACK_COMMAND_REJECT) &&
    from === to
  ) {
    const isInsertBeforeCursor = isMarkActive(viewState, MARK_INSERTION);
    const isDeleteBeforeCursor = isMarkActive(viewState, MARK_DELETION);
    let leftRange;
    if (isInsertBeforeCursor) {
      leftRange = getMarkRange(
        viewState.selection.$from,
        viewState.doc.type.schema.marks.insertion,
      );
    } else if (isDeleteBeforeCursor) {
      leftRange = getMarkRange(
        viewState.selection.$from,
        viewState.doc.type.schema.marks.deletion,
      );
    }
    if (leftRange) {
      markRanges = getMarksBetween(
        leftRange.from,
        leftRange.to,
        viewState.doc,
      );
    }
  } else if (
    opType === TRACK_COMMAND_ACCEPT_ALL ||
    opType === TRACK_COMMAND_REJECT_ALL
  ) {
    markRanges = getMarksBetween(
      0,
      viewState.doc.content.size,
      viewState.doc,
    );
    opType =
      opType === TRACK_COMMAND_ACCEPT_ALL
        ? TRACK_COMMAND_ACCEPT
        : TRACK_COMMAND_REJECT;
  } else {
    markRanges = getMarksBetween(from, to, viewState.doc);
  }

  markRanges = markRanges.filter(
    (markRange) =>
      markRange.mark.type.name === MARK_DELETION ||
      markRange.mark.type.name === MARK_INSERTION,
  );
  if (!markRanges.length) return false;

  const currentTr = viewState.tr;
  let offset = 0;
  const removeInsertMark =
    viewState.doc.type.schema.marks.insertion.create();
  const removeDeleteMark =
    viewState.doc.type.schema.marks.deletion.create();

  markRanges.forEach((markRange) => {
    const isAcceptInsert =
      opType === TRACK_COMMAND_ACCEPT &&
      markRange.mark.type.name === MARK_INSERTION;
    const isRejectDelete =
      opType === TRACK_COMMAND_REJECT &&
      markRange.mark.type.name === MARK_DELETION;
    if (isAcceptInsert || isRejectDelete) {
      currentTr.removeMark(
        markRange.from - offset,
        markRange.to - offset,
        removeInsertMark.type,
      );
      currentTr.removeMark(
        markRange.from - offset,
        markRange.to - offset,
        removeDeleteMark.type,
      );
    } else {
      currentTr.deleteRange(markRange.from - offset, markRange.to - offset);
      offset += markRange.to - markRange.from;
    }
  });

  if (currentTr.steps.length) {
    currentTr.setMeta("trackManualChanged", true);
    const newState = viewState.apply(currentTr);
    param.editor.view.updateState(newState);
  }
  return false;
};

export const TrackChangeExtension = Extension.create<{
  enabled: boolean;
  onStatusChange?: (enabled: boolean) => void;
  dataOpUserId?: string;
  dataOpUserNickname?: string;
}>({
  name: EXTENSION_NAME,

  addOptions() {
    return {
      enabled: false,
      onStatusChange: undefined,
      dataOpUserId: "",
      dataOpUserNickname: "",
      _skipTracking: false,
    };
  },

  onCreate() {
    if (this.options.onStatusChange) {
      this.options.onStatusChange(this.options.enabled);
    }
  },

  addExtensions() {
    return [InsertionMark, DeletionMark];
  },

  addCommands: () => {
    return {
      setTrackChangeStatus:
        (enabled: boolean) => (param: CommandProps) => {
          const thisExtension = getSelfExt(param.editor);
          thisExtension.options.enabled = enabled;
          if (thisExtension.options.onStatusChange) {
            thisExtension.options.onStatusChange(thisExtension.options.enabled);
          }
          return false;
        },
      toggleTrackChangeStatus: () => (param: CommandProps) => {
        const thisExtension = getSelfExt(param.editor);
        thisExtension.options.enabled = !thisExtension.options.enabled;
        if (thisExtension.options.onStatusChange) {
          thisExtension.options.onStatusChange(thisExtension.options.enabled);
        }
        return false;
      },
      getTrackChangeStatus: () => (param: CommandProps) => {
        const thisExtension = getSelfExt(param.editor);
        return thisExtension.options.enabled;
      },
      acceptChange: () => (param: CommandProps) => {
        changeTrack("accept", param);
        return false;
      },
      acceptAllChanges: () => (param: CommandProps) => {
        changeTrack("accept-all", param);
        return false;
      },
      rejectChange: () => (param: CommandProps) => {
        changeTrack("reject", param);
        return false;
      },
      rejectAllChanges: () => (param: CommandProps) => {
        changeTrack("reject-all", param);
        return false;
      },
      updateOpUserOption:
        (opUserId: string, opUserNickname: string) =>
        (param: CommandProps) => {
          const thisExtension = getSelfExt(param.editor);
          thisExtension.options.dataOpUserId = opUserId;
          thisExtension.options.dataOpUserNickname = opUserNickname;
          return false;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("track-change-noop"),
      }),
    ];
  },

  onTransaction: (props: { editor: Editor; transaction: Transaction }) => {
    const { transaction, editor } = props;

    if (!transaction.docChanged) return;
    if (transaction.getMeta("trackManualChanged")) return;
    if (transaction.getMeta("history$")) return;
    const syncMeta = transaction.getMeta("y-sync$");
    if (syncMeta && syncMeta.isChangeOrigin) return;
    if (!transaction.steps.length) return;

    const isThisTrApplied = transaction.before !== editor.state.tr.doc;
    const thisExtension = getSelfExt(editor);
    if (thisExtension.options._skipTracking) return;
    const trackChangeEnabled = thisExtension.options.enabled;

    const allSteps = transaction.steps.map((step) =>
      Step.fromJSON(editor.state.doc.type.schema, step.toJSON()),
    );
    const currentNewPos = transaction.selection.from;

    let posOffset = 0;
    let hasAddAndDelete = false;

    allSteps.forEach((step: Step) => {
      if (step instanceof ReplaceStep) {
        let delCount = 0;
        if (step.from !== step.to) {
          const slice = transaction.docs[allSteps.indexOf(step)].slice(
            step.from,
            step.to,
          );
          slice.content.forEach((node) => {
            const isInsertNode = node.marks.find(
              (m) => m.type.name === MARK_INSERTION,
            );
            if (!isInsertNode) {
              delCount += node.nodeSize;
            }
          });
        }
        posOffset += delCount;
        const newCount = step.slice ? step.slice.size : 0;
        if (newCount && delCount) {
          hasAddAndDelete = true;
        }
      }
    });

    if (!hasAddAndDelete) {
      posOffset = 0;
    }

    const newChangeTr = isThisTrApplied ? editor.state.tr : transaction;

    let reAddOffset = 0;
    allSteps.forEach((step: Step, index: number) => {
      if (step instanceof ReplaceStep) {
        const invertedStep = step.invert(transaction.docs[index]);
        if (step.slice.size) {
          const insertionMark =
            editor.state.doc.type.schema.marks.insertion.create({
              "data-op-user-id": thisExtension.options.dataOpUserId,
              "data-op-user-nickname": thisExtension.options.dataOpUserNickname,
              "data-op-date": getMinuteTime(),
            });
          const deletionMark =
            editor.state.doc.type.schema.marks.deletion.create();
          const from = step.from + reAddOffset;
          const to = step.from + reAddOffset + step.slice.size;
          if (trackChangeEnabled) {
            newChangeTr.addMark(from, to, insertionMark);
          } else {
            newChangeTr.removeMark(from, to, insertionMark.type);
          }
          newChangeTr.removeMark(from, to, deletionMark.type);
        }
        if (step.from !== step.to && trackChangeEnabled) {
          const skipSteps: Array<ReplaceStep> = [];

          const reAddStep = new ReplaceStep(
            invertedStep.from + reAddOffset,
            invertedStep.from + reAddOffset,
            invertedStep.slice,
            // @ts-expect-error internal field
            invertedStep.structure,
          );

          let addedEmptyOffset = 0;
          const travelContent = (content: Fragment, parentOffset: number) => {
            content.forEach((node, offset) => {
              const start = parentOffset + offset;
              const end = start + node.nodeSize;
              if (node.content && node.content.size) {
                travelContent(node.content, start);
              } else {
                if (node.marks.find((m) => m.type.name === MARK_INSERTION)) {
                  skipSteps.push(
                    new ReplaceStep(
                      start - addedEmptyOffset,
                      end - addedEmptyOffset,
                      Slice.empty,
                    ),
                  );
                  addedEmptyOffset += node.nodeSize;
                  reAddOffset -= node.nodeSize;
                }
              }
            });
          };
          travelContent(invertedStep.slice.content, invertedStep.from);
          reAddOffset += invertedStep.slice.size;

          newChangeTr.step(reAddStep);
          const { from } = reAddStep;
          const to = from + reAddStep.slice.size;
          newChangeTr.addMark(
            from,
            to,
            newChangeTr.doc.type.schema.marks.deletion.create({
              "data-op-user-id": thisExtension.options.dataOpUserId,
              "data-op-user-nickname": thisExtension.options.dataOpUserNickname,
              "data-op-date": getMinuteTime(),
            }),
          );
          skipSteps.forEach((s) => {
            newChangeTr.step(s);
          });
        }
        const newState = editor.state.apply(newChangeTr);
        editor.view.updateState(newState);
      }
    });

    const finalNewPos = trackChangeEnabled
      ? currentNewPos + posOffset
      : currentNewPos;
    if (trackChangeEnabled) {
      const trWithChange = editor.view.state.tr;
      trWithChange.setSelection(
        TextSelection.create(editor.view.state.doc, finalNewPos),
      );
      const newStateWithNewSelection =
        editor.view.state.apply(trWithChange);
      editor.view.updateState(newStateWithNewSelection);
    }
  },
});

export default TrackChangeExtension;
