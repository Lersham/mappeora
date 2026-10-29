import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import { enterFullscreen, exitFullscreen, fullscreenProps, isFullscreen, useFullscreen } from '../../lib/fullscreen';
import { FullscreenButton, FullscreenHint, fullscreenKind, homeFullscreenProps } from '../../components/FullscreenButton';
import {
  Background,
  type EdgeTypes,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { useStore } from 'zustand';
import { beginStep, endStep, mapHistory, untracked, useMapStore } from '../../store/mapStore';
import { reviewVisibility, ripetimiSummary, useReview, type ReviewMode } from '../../store/reviewStore';
import { ConceptNode, type ConceptActions, type ConceptFlowNode } from './ConceptNode';
import { FreeEdge } from './FreeEdge';
import { BusEdge } from './BusEdge';
import { TreeEdge } from './TreeEdge';
import { sheetLayout, type SheetResult } from '../../lib/sheetLayout';
import { DEFAULT_SIZE, labelScale } from '../../lib/ladder';
import { useSettings } from '../../store/settingsStore';
import { NodeStyleDialog } from './NodeStyleDialog';
import { LinkWordDialog } from './LinkWordDialog';
import { ExportDialog, type ExportChoice } from './ExportDialog';
import { ReviewBar } from './ReviewBar';
import { PhotoTextDialog } from '../ocr/PhotoTextDialog';
import { BigButton } from '../../components/BigButton';
import { Dialog } from '../../components/Dialog';
import { DictationOverlay } from '../../components/DictationOverlay';
import { useReadAloud } from '../../hooks/useReadAloud';
import { DICTATION_ERRORS, useDictation } from '../../hooks/useDictation';
import { useRipetimi } from '../../hooks/useRipetimi';
import { speech } from '../../services/speech';
import { useCrowded } from '../../hooks/useCrowded';
import { autoLayout } from '../../services/layout';
import { exportMap, saveMapFile } from '../../services/export';
import { readingOrder } from '../../lib/readingOrder';
import { carryHidden, collapseInfo, visiblePart } from '../../lib/collapse';
import { spanningTree } from '../../lib/tree';
import { branchOf as branchIds, cannotMoveUnder, childrenOf } from '../../lib/branch';
import { layoutOf, templateInfo } from '../../lib/templates';
import { NEW_MAP_TITLE } from '../../lib/mapFactory';
import { DEFAULT_COLOR, branchColors } from '../../lib/palette';
import { closeUpView, MAX_READ_ZOOM, MIN_ZOOM, pageView as pageViewOf, READABLE_PX, revealView } from './camera';
import { spostaHintDue, spostaHintShown, spostaHintText, spostaUsed } from './spostaHint';
import { closeUpGroup, isUntouchedNewMap, movedPositions, paintedBranches, parentForNear, parentForNew as parentFor, sheetAnchor, stillInPlace } from './concepts';
import { parseVoiceCommand } from '../../lib/voiceCommands';
import { useBackHandler } from '../../lib/backButton';
import { motion } from '../../lib/motion';
import { TOUCH } from '../../lib/touch';
import { MAP_ARIA_LABELS, edgeAriaLabel, spokenLabel } from './a11yLabels';
import { SaveProblemNotice } from './SaveProblemNotice';
import { UpdateNotice } from './UpdateNotice';
import { OptionCard } from '../../components/OptionCard';
import { TutorialCoach } from '../tutorial/TutorialCoach';
import { TUTORIAL_STEPS, type TutorialProgress, type TutorialTarget, type TutorialTool } from '../tutorial/steps';
import { Icon } from '../../components/Icon';

const nodeTypes = { concept: ConceptNode };

/** A failed share sheet the child closed is not an error. */
const isCancel = (e: unknown) => e instanceof Error && /cancel/i.test(e.message);
const edgeTypes: EdgeTypes = { bus: BusEdge, free: FreeEdge, tree: TreeEdge };

/**
 * How a cross-link («Collega») is drawn on a sheet. To a concept wholly
 * beside it, from side to side. Otherwise from the bottom-left to the
 * other's left; towards a concept higher up from the left too: from the
 * bottom it would loop behind its own box. A line that crosses other
 * concepts goes over them: behind, its pieces would seem to link those.
 */
function crossLink(positions: Record<string, XYPosition>, sizes: Record<string, { width: number; height: number }>, source: string, target: string) {
  const from = positions[source];
  const to = positions[target];
  if (!from || !to) return { sourceHandle: 's-spine', targetHandle: 't-left' };
  const size = (id: string) => sizes[id] ?? DEFAULT_SIZE;
  const centre = (p: XYPosition, id: string) => ({ x: p.x + size(id).width / 2, y: p.y + size(id).height / 2 });
  const [a, b] = [centre(from, source), centre(to, target)];
  const crosses = Object.entries(positions).some(([id, p]) => {
    if (id === source || id === target) return false;
    const { width, height } = size(id);
    for (let t = 0; t <= 1; t += 1 / 32) {
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (x > p.x && x < p.x + width && y > p.y && y < p.y + height) return true;
    }
    return false;
  });
  const over = crosses ? { zIndex: 1001 } : {};
  if (to.x >= from.x + size(source).width) return { sourceHandle: 's-right', targetHandle: 't-left', ...over };
  if (to.x + size(target).width <= from.x) return { sourceHandle: 's-left', targetHandle: 't-right', ...over };
  return { sourceHandle: to.y < from.y ? 's-left' : 's-spine', targetHandle: 't-left', ...over };
}

/** Class names, leaving out the empty ones. */
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
/** The tools that may end up in «Altro», by key, and the tutorial's name for each. */
const TOOL_TARGETS: Record<string, TutorialTarget> = {
  photo: 'libro',
  layout: 'sposta',
  tidy: 'riordina',
  save: 'salva',
  settings: 'aspetto',
};
/** Where «Salva e manda» and Aspetto leave the top bar for «Altro» (see .topbar-map). */
const PHONE = '(max-width: 560px)';
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia?.(query);
      m?.addEventListener('change', onChange);
      return () => m?.removeEventListener('change', onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
  );
}

type DialogState =
  | { kind: 'style' }
  | { kind: 'link'; edgeId: string }
  | { kind: 'export' }
  | { kind: 'review' }
  | { kind: 'photo' }
  | { kind: 'more' }
  | { kind: 'fullscreen' }
  | { kind: 'delete'; id: string }
  | null;

interface Props {
  onBack(): void;
  onOpenSettings(): void;
  /** Opens straight on a tool, e.g. «Dal libro» from the welcome. */
  initialDialog?: 'photo';
  /** «Impara facendo»: a guide below the map, one step at a time. */
  tutorial?: boolean;
}

function Editor({ onBack, onOpenSettings, initialDialog, tutorial }: Props) {
  const map = useMapStore((s) => s.map)!;
  const selectedId = useMapStore((s) => s.selectedId);
  const sizes = useMapStore((s) => s.sizes);
  const actions = useMapStore.getState();
  const canUndo = useStore(useMapStore.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(useMapStore.temporal, (t) => t.futureStates.length > 0);
  const review = useReview();
  const { fitView, getNodes, getNodesBounds, getEdges, setCenter, getZoom, getInternalNode, getViewport, setViewport } = useReactFlow();
  const reader = useReadAloud();
  const dictation = useDictation();
  const [arranging, setArranging] = useState(false);
  // After «Riordina»: the offer to colour the branches too, for a while.
  const [colorOffer, setColorOffer] = useState(false);
  useEffect(() => {
    if (!colorOffer) return;
    const t = setTimeout(() => setColorOffer(false), 10000);
    return () => clearTimeout(t);
  }, [colorOffer]);
  const [exporting, setExporting] = useState(false);
  /** Bumped by «Annulla»: an export still running then stops before saving. */
  const exportRun = useRef(0);
  const [exportError, setExportError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The browser scrolls whatever hides a field being typed in, even boxes
  // that can't scroll for the child (the map): the view then no longer
  // matches what React Flow thinks it shows. Put them back; reveal() moves
  // the view the right way.
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const back = (e: Event) => {
      const el = e.target;
      if (!(el instanceof Element) || !canvas.contains(el)) return;
      if (el.scrollTop || el.scrollLeft) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    };
    canvas.addEventListener('scroll', back, true);
    return () => canvas.removeEventListener('scroll', back, true);
  }, []);
  /** A line is being drawn from a concept: every connection point shows. */
  const noticeTimer = useRef<number | undefined>(undefined);
  /** A short message that goes away by itself. */
  const showNotice = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice((now) => (now === text ? null : now)), 5000);
  };
  /**
   * «Cambia ramo» and «Collega»: the next concept tapped is the one to put
   * it under, or to draw a line to.
   */
  const [picking, setPicking] = useState<{ from: string; mode: 'ramo' | 'collega' } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(initialDialog ? { kind: initialDialog } : null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(tutorial ? 0 : null);
  /** The tutorial coloured the map only to show how: it ends white, as it began («Annulla» brings the colours back). */
  const endTutorial = () => {
    setTutorialStep(null);
    actions.clearColors();
  };
  /** Set by the coach: it knows when a step must first ask for something else. */
  const [coachTarget, setCoachTarget] = useState<TutorialTarget>();
  const tutorialTarget = tutorialStep === null ? undefined : coachTarget;
  /** The button the tutorial is asking for stands out. */
  const target = (name: typeof tutorialTarget) => (name && tutorialTarget === name ? 'tutorial-target' : undefined);
  /** How many times each tool has been opened: the tutorial notices the ones it asks for. */
  const [used, setUsed] = useState<TutorialProgress['used']>({});
  const markUsed = useCallback((tool: TutorialTool) => setUsed((u) => ({ ...u, [tool]: (u[tool] ?? 0) + 1 })), []);
  useEffect(() => {
    const kind = dialog?.kind;
    if (kind === 'photo' || kind === 'review' || kind === 'export' || kind === 'style') markUsed(kind);
  }, [dialog?.kind]);
  // Libera and 5 W fill an A4 sheet by themselves, unless the child chose
  // to place the concepts by hand.
  const sheetTemplate = templateInfo(map.template).layout === 'foglio';
  const layout = layoutOf(map);
  const sheetMode = layout === 'foglio';
  /**
   * «Sposta» is on: every concept can be dragged where the child wants. Off
   * again, they stay where they were put (only «Riordina» puts them back on
   * the sheet). Not saved with the map: it opens with the concepts still.
   */
  const [movingOn, setMoving] = useState(false);
  // «Annulla» may have put the map back on the sheet: nothing is being moved then.
  const moving = movingOn && !sheetMode;
  /**
   * On a touch screen the concepts stay where they are, on the A4 sheet or
   * where the child put them: a finger moves and zooms the map, a tap
   * selects. Only the concept in hand can be dragged (on the sheet, to change
   * its place in the branch). «Sposta» frees them all. Maps not made for the
   * sheet have no «Sposta»: there the concepts are always free.
   */
  const locked = TOUCH && sheetTemplate && !moving;
  /** The concept a finger went down on, if any: when the map moves instead, it may have meant to drag it. */
  const grabbed = useRef<string | null>(null);
  /** Where «Sposta» is, said once per map at most (see spostaHint.ts). */
  const spostaHinted = useRef(false);
  /** A finger went down on a concept not in hand: if the map now moves, say where «Sposta» is. */
  const spostaCandidate = useRef(false);
  const collapse = useMemo(() => collapseInfo(map), [map]);
  // Only a concept on screen can be the one in hand.
  const selectedNode = map.nodes.find((n) => n.id === selectedId && !collapse.hidden.has(n.id));
  // A link back to the main concept doesn't give a «−» that would hide nothing.
  const tree = useMemo(() => spanningTree(map), [map.nodes, map.edges]);
  const parents = useMemo(() => new Set(tree.forward.map((e) => e.source)), [tree]);

  const dragging = useRef(false);
  // While a concept is in hand the lines stay as they were: the new sheet
  // is worked out once it is dropped.
  const held = useRef<SheetResult | null>(null);
  const [dragTick, setDragTick] = useState(0);

  // "Foglio": where every visible concept should be. Anchored to the main
  // concept, so dragging it moves the whole map.
  const scale = labelScale(useSettings((s) => s.textScale));
  const sheet = useMemo(() => {
    if (!sheetMode) return null;
    // Not worked out again at every frame of a drag: nothing would show it.
    if (dragging.current && held.current) return held.current;
    const part = visiblePart(map);
    return sheetLayout(part.nodes, part.edges, sizes, sheetAnchor(part), scale);
  }, [sheetMode, map, sizes, scale, dragTick]);

  // Keep the sheet in order after every change (adding, deleting,
  // collapsing, dropping a dragged concept). Not an edit by the child, so
  // it stays out of the undo history.
  const shown = held.current ?? sheet;
  const painted = useMemo(() => paintedBranches(map.nodes, shown?.heads ?? {}), [map.nodes, shown]);
  const paint = (branch?: number) => (branch !== undefined && painted.has(branch) ? branch : undefined);
  // A drop on a sheet is recorded once the sheet has put the concept in its
  // place: a concept that snaps back leaves no empty undo step.
  const dropPending = useRef(false);
  useEffect(() => {
    if (dragging.current) return;
    const finishDrop = () => {
      if (!dropPending.current) return;
      dropPending.current = false;
      endStep();
    };
    if (!sheet || review.active) return finishDrop();
    const moved = movedPositions(map.nodes, sheet.positions);
    if (Object.keys(moved).length > 0) untracked(() => actions.applyPositions(moved, { auto: true }));
    finishDrop();
  }, [sheet, dragTick, review.active]);

  // What a concept can ask of the editor: one object for all of them, so a
  // change elsewhere (a drag, a selection) doesn't re-render every concept.
  const latest = useRef({ toggleInPlace: (_id: string) => {}, addNear: (_id: string, _where: 'child' | 'sibling') => {} });
  const conceptActions = useMemo<ConceptActions>(
    () => ({
      toggle: (id) => latest.current.toggleInPlace(id),
      addNear: (id, where) => latest.current.addNear(id, where),
    }),
    [],
  );

  // The store holds our document model; React Flow nodes are derived from it.
  // At «Indovina» the concept to guess has no name, not even for a screen reader.
  // A concept whose inputs did not change keeps the same object: during a
  // drag only the concept in hand is new, and only it renders again.
  const secret = map.nodes.find((n) => reviewVisibility(review, n.id) === 'mystery')?.id;
  const flowCache = useRef(new Map<string, { key: unknown[]; node: ConceptFlowNode }>());
  const nodes = useMemo<ConceptFlowNode[]>(() => {
    const next = new Map<string, { key: unknown[]; node: ConceptFlowNode }>();
    const result = map.nodes.map((n) => {
      const key = [
        n,
        n.id === secret,
        !review.active && n.id === selectedId,
        collapse.hidden.has(n.id) || reviewVisibility(review, n.id) === 'hidden',
        sizes[n.id],
        layout,
        shown?.roles[n.id],
        shown?.heads[n.id],
        paint(shown?.heads[n.id]),
        parents.has(n.id),
        collapse.hiddenBelow[n.id] ?? 0,
      ];
      const before = flowCache.current.get(n.id);
      if (before && before.key.every((v, i) => v === key[i])) {
        next.set(n.id, before);
        return before.node;
      }
      const node: ConceptFlowNode = {
        id: n.id,
        type: 'concept',
        ariaLabel: n.id === secret ? 'Concetto nascosto' : spokenLabel(n.label),
        position: n.position,
        selected: !review.active && n.id === selectedId,
        ...(locked && { draggable: !review.active && n.id === selectedId }),
        hidden: collapse.hidden.has(n.id) || reviewVisibility(review, n.id) === 'hidden',
        measured: sizes[n.id],
        data: {
          label: n.label,
          color: n.color,
          wordColors: n.wordColors,
          shape: n.shape,
          image: n.image,
          width: n.width,
          layout,
          role: shown?.roles[n.id],
          branch: shown?.heads[n.id],
          tinted: paint(shown?.heads[n.id]) !== undefined,
          hasChildren: parents.has(n.id),
          collapsed: n.collapsed,
          hiddenBelow: collapse.hiddenBelow[n.id] ?? 0,
          actions: conceptActions,
        },
      };
      next.set(n.id, { key, node });
      return node;
    });
    flowCache.current = next;
    return result;
  }, [map.nodes, selectedId, sizes, review, layout, collapse, parents, shown, painted, secret, conceptActions]);
  // The links' spoken names need the concepts' names, not their positions:
  // a string that stays the same while a concept is dragged.
  const nodeNames = useMemo(() => JSON.stringify(map.nodes.map((n) => [n.id, n.label])), [map.nodes]);
  const edges = useMemo<Edge[]>(() => {
    const onEdit = (edgeId: string) => (review.active ? undefined : () => setDialog({ kind: 'link', edgeId }));
    const labels = new Map<string, string>(JSON.parse(nodeNames));
    if (secret) labels.set(secret, '?');
    return map.edges.map((e) => {
      const ariaLabel = edgeAriaLabel(labels.get(e.source) ?? '', labels.get(e.target) ?? '', e.label);
      // A line blocks moving the map where a finger lands on it: narrower
      // while the concepts are locked (its «+» and words stay easy to tap).
      const base = { id: e.id, source: e.source, target: e.target, label: e.label, ariaLabel, interactionWidth: locked ? 16 : 40, className: 'concept-edge' };
      // The «+» for linking words stands out on the lines of the concept in hand.
      const near = !review.active && (e.source === selectedId || e.target === selectedId);
      const bus = shown?.edges[e.id];
      if (bus) {
        return {
          ...base,
          type: 'bus',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          data: { points: bus.points, own: bus.own, branch: paint(bus.branch), column: bus.column, onEdit: onEdit(e.id), near },
        };
      }
      if (sheetTemplate && !shown) return { ...base, type: 'free', data: { onEdit: onEdit(e.id), near } }; // placed by hand
      return {
        ...base,
        ...(shown && { className: 'concept-edge cross-link', ...crossLink(shown.positions, sizes, e.source, e.target) }),
        type: 'tree',
        data: { onEdit: onEdit(e.id), near },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 6,
      };
    });
  }, [map.edges, nodeNames, shown, painted, sheetTemplate, review.active, secret, selectedId, locked, sizes]);

  const onNodesChange = useCallback((changes: NodeChange<ConceptFlowNode>[]) => {
    const s = useMapStore.getState();
    const removed: string[] = [];
    for (const c of changes) {
      if (c.type === 'dimensions' && c.dimensions) s.setSize(c.id, c.dimensions);
      else if (c.type === 'position' && c.position) {
        // On a sheet only a drag moves a concept (it then finds its place in
        // the list); arrow keys would add undo steps that change nothing.
        if (c.dragging !== true && layoutOf(s.map!) === 'foglio') continue;
        s.moveNode(c.id, c.position);
      }
      else if (c.type === 'select') {
        if (c.selected) s.select(c.id);
        else if (useMapStore.getState().selectedId === c.id) s.select(null);
      } else if (c.type === 'remove') removed.push(c.id);
    }
    if (removed.length) s.removeNodes(removed);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removed.length) useMapStore.getState().removeEdges(removed);
  }, []);

  const parentForNew = () => {
    const { map: current, selectedId: selected } = useMapStore.getState();
    return current ? parentFor(current, selected) : null;
  };

  /** Size on screen (px) of a concept's name at the current zoom, and at zoom 1. */
  const textOnScreen = (id: string) => {
    const at = `.react-flow__node[data-id="${CSS.escape(id)}"]`;
    const label = document.querySelector(`${at} .concept-label, ${at} .concept-input`);
    const px = (label && parseFloat(getComputedStyle(label).fontSize)) || 18;
    return { px, onScreen: px * getZoom() };
  };

  /**
   * Room around the whole map when it is fitted to the screen: `p` of the
   * screen on each side, and at the bottom at least what the floating bars
   * hide, so no concept ends up under them.
   */
  const fitPadding = (p: number) => {
    const box = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!box) return p;
    // What floats over the bottom of the map: the toolbar on a wide screen,
    // the tools of the concept in hand.
    const over = [...document.querySelectorAll('.editor.has-dock .dock, .selection-bar')].filter(
      (el) => getComputedStyle(el).position === 'absolute',
    );
    if (over.length === 0) return p;
    const hidden = box.bottom - Math.min(...over.map((el) => el.getBoundingClientRect().top)) + 16;
    return { x: p, top: p, bottom: `${Math.max(p * box.height, hidden)}px` as const };
  };

  /** The map seen like a page, when it needs it (see camera.ts). */
  const pageView = (mustFit = false) => {
    const box = document.querySelector('.react-flow')?.getBoundingClientRect();
    const visible = getNodes().filter((n) => !n.hidden);
    if (!box || visible.length === 0) return null;
    return pageViewOf({
      area: box,
      bounds: getNodesBounds(visible),
      concepts: visible,
      textPx: Math.min(...visible.map((n) => textOnScreen(n.id).px)),
      landscape: window.innerWidth > window.innerHeight,
      mustFit,
    });
  };

  const fromTopIfTooBig = () => {
    const page = pageView(true);
    if (page) void setViewport(page);
  };

  /** After «Riordina», a review: the page view if the map needs it, else all of it. */
  const showMap = (delay: number) =>
    setTimeout(() => {
      following.current = true;
      const page = pageView();
      if (page) void setViewport(page, { duration: motion(400) });
      else void fitView({ padding: fitPadding(0.2), duration: motion(400) });
    }, delay);

  // Opening a map: its concepts take their final size bit by bit (pictures
  // load, the sheet makes room for them), and a view worked out at the
  // first frame cut the sides of a large map. The first view follows them
  // for a moment, until the child touches the map.
  const measured = useNodesInitialized();
  const openedAt = useRef(performance.now());
  const touched = useRef(false);
  useEffect(() => {
    if (!measured || touched.current || performance.now() - openedAt.current > 1500) return;
    const t = setTimeout(() => {
      if (touched.current) return;
      const page = pageView();
      if (page) void setViewport(page);
      else void fitView({ padding: fitPadding(0.3), maxZoom: MAX_READ_ZOOM });
    }, 50);
    return () => clearTimeout(t);
  }, [measured, sizes, map.nodes]);
  const touch = () => void (touched.current = true);

  // The map's area can change size after the view was made for it: in the
  // guide «Ben fatto!» adds a line below the map, and the last branch ended
  // up under the tools of the concept in hand. Until the child moves the map
  // or adds to it, that view follows the area.
  const following = useRef(false);
  const showMapNow = useRef(showMap);
  showMapNow.current = showMap;
  useEffect(() => void (following.current = false), [map.nodes.length]);
  useEffect(() => {
    const flow = document.querySelector('.editor .react-flow');
    if (!flow) return;
    let last = flow.getBoundingClientRect();
    let t: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const box = flow.getBoundingClientRect();
      if (Math.abs(box.width - last.width) < 1 && Math.abs(box.height - last.height) < 1) return;
      last = box;
      if (!following.current) return;
      clearTimeout(t);
      t = showMapNow.current(100);
    });
    observer.observe(flow);
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, []);

  /**
   * A new concept can land outside the visible part of the map: once the
   * layout has placed it, move the view just enough to show it. One about
   * to be written also comes close enough to read what is typed.
   */
  const reveal = (id: string, { readable = false } = {}) =>
    setTimeout(() => {
      const n = getInternalNode(id);
      const box = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!n || n.hidden || !box) return;
      const { width = 180, height = 72 } = n.measured;
      // The bars floating over the map (on a wide screen, the toolbar; the
      // tools of the concept in hand) hide what is under them.
      const bottom = Math.min(
        box.height,
        ...[...document.querySelectorAll('.editor.has-dock .dock, .selection-bar')].map((el) => el.getBoundingClientRect().top - box.top),
      );
      const concept = { ...n.internals.positionAbsolute, width, height };
      const to = revealView(concept, getViewport(), { width: box.width, bottom }, textOnScreen(id).px, readable);
      if (to) void setCenter(to.x, to.y, { zoom: to.zoom, duration: motion(300) });
    }, 150);

  /**
   * On a map seen from afar (a phone, a long map) the names are too small
   * to read: a tap on a concept brings its branch close, or just the
   * concept if the branch is too long for the screen. It waits a moment,
   * so that a quick second tap (to restyle it) still lands on the same concept.
   */
  const closer = useRef<number | undefined>(undefined);
  const cancelCloser = () => window.clearTimeout(closer.current);
  /** The concept in hand when the finger went down: a tap on it again is a request to restyle it. */
  const heldOnPress = useRef<string | null>(null);
  const bringCloser = (id: string) => {
    cancelCloser();
    closer.current = window.setTimeout(() => {
      if (useReview.getState().active || dragging.current) return;
      const text = textOnScreen(id);
      const box = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (text.onScreen >= READABLE_PX || !box) return;
      const current = useMapStore.getState().map;
      const group = current ? closeUpGroup(current, id, shown) : [id];
      const boxes = group.flatMap((b) => {
        const n = getInternalNode(b);
        if (!n || n.hidden) return [];
        const { width = 180, height = 72 } = n.measured;
        return [{ id: b, x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, width, height }];
      });
      const to = closeUpView(boxes, id, box, text.px);
      if (to) void setCenter(to.x, to.y, { zoom: to.zoom, duration: motion(400) });
    }, 350);
  };

  /** From the toolbar (or Tab) a concept opens ready for typing; a dictated one already has its name. */
  const addConcept = (label?: string, parent = parentForNew()) => {
    cancelCloser();
    const id = actions.addChild(parent, label);
    if (label === undefined) actions.startEditing(id);
    reveal(id, { readable: label === undefined });
  };

  /** Tab while writing a concept: one under it. Maiusc+Tab: one next to it. */
  const addNear = (id: string, where: 'child' | 'sibling') => {
    const current = useMapStore.getState().map;
    if (current) addConcept(undefined, parentForNear(current, id, where));
  };

  /**
   * Opening or closing a branch rearranges the sheet: move the view so the
   * tapped concept stays under the finger instead of jumping away.
   */
  const toggleInPlace = (id: string) => {
    const before = getInternalNode(id)?.internals.positionAbsolute;
    useMapStore.getState().toggleCollapsed(id);
    if (!before) return;
    setTimeout(() => {
      const after = getInternalNode(id)?.internals.positionAbsolute;
      if (!after) return;
      const { x, y, zoom } = getViewport();
      void setViewport({ x: x - (after.x - before.x) * zoom, y: y - (after.y - before.y) * zoom, zoom }, { duration: motion(200) });
    }, 150);
  };

  latest.current = { toggleInPlace, addNear };

  /** «Riordina»: the order at once, colours untouched; colouring the branches is offered after. */
  const tidyAndOffer = () => {
    const { nodes, edges } = map;
    const colors = branchColors(nodes, edges);
    setColorOffer(nodes.some((n) => (n.color ?? DEFAULT_COLOR) !== colors[n.id]));
    void tidy();
  };

  const tidy = async () => {
    // A "foglio" map is always in order: just show all of it. One placed by
    // hand goes back on the sheet.
    if (sheetTemplate) {
      setMoving(false);
      if (!sheetMode) actions.setFreeLayout(false);
      return void showMap(150);
    }
    await arrange();
  };

  /**
   * Top-down layout (elkjs) of the concepts on screen. `followUp`: it
   * completes the step just made («Dal libro»), so one «Annulla» undoes
   * both.
   */
  const arrange = async ({ followUp = false } = {}) => {
    setArranging(true);
    try {
      // Read fresh state: this also runs right after adding concepts.
      const { map: current, sizes: measured } = useMapStore.getState();
      if (!current) return;
      // Collapsed branches are not laid out: they move with their concept.
      const part = visiblePart(current);
      const positions = await autoLayout(part.nodes, part.edges, measured);
      // The child may have moved on meanwhile: leave alone another map and
      // any concept moved since.
      const now = useMapStore.getState().map;
      if (!now || now.id !== current.id) return;
      const fresh = stillInPlace(carryHidden(current, positions), current, now);
      if (followUp) untracked(() => actions.applyPositions(fresh));
      else actions.applyPositions(fresh);
      // Give React Flow a frame to render the new positions before fitting.
      showMap(50);
    } catch {
      setNotice('Non sono riuscito a riordinare la mappa. Riprova.');
    } finally {
      setArranging(false);
    }
  };

  /** After «Dal libro»: a sheet orders itself, a map placed by hand stays so. */
  const afterBulkEdit = () => (sheetTemplate ? showMap(150) : setTimeout(() => void arrange({ followUp: true }), 150));

  const dictate = async () => {
    const command = parseVoiceCommand(await dictation.start());
    if (!command) return;
    if (command.type === 'add') addConcept(command.label);
    else if (command.type === 'read') reader.readMap();
    else if (command.type === 'tidy') tidyAndOffer();
    else if (command.type === 'undo') mapHistory().undo();
    else if (command.type === 'redo') mapHistory().redo();
  };

  const addFromPhoto = (concepts: string[]) => {
    const parent = parentForNew();
    let rest = concepts;
    // All the words chosen are one undo step.
    beginStep();
    // A map just made and still empty: the first word chosen is its main
    // concept and its title, the others hang from it.
    if (isUntouchedNewMap(map) && concepts.length > 0) {
      actions.updateNode(map.nodes[0].id, { label: concepts[0] });
      actions.setTitle(concepts[0]);
      rest = concepts.slice(1);
    }
    for (const label of rest) actions.addChild(parent, label);
    actions.select(parent);
    endStep();
    setDialog(null);
    // Let React Flow measure the new nodes, then lay the map out again.
    afterBulkEdit();
  };

  const doExport = async ({ kind, paper, pages, simple, print }: ExportChoice) => {
    const run = ++exportRun.current;
    const cancelled = () => exportRun.current !== run;
    setExporting(true);
    setExportError(false);
    try {
      if (kind === 'file') {
        await saveMapFile(map);
      } else {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
        await exportMap(getNodes(), bg, {
          format: kind,
          paper,
          pages,
          print,
          simple,
          title: map.title,
          usesPictograms: map.nodes.some((n) => n.image?.kind === 'arasaac'),
          cancelled,
        });
      }
      // Only this dialog: the child may have opened another meanwhile.
      if (!cancelled()) setDialog((d) => (d?.kind === 'export' ? null : d));
    } catch (e) {
      if (!cancelled() && !isCancel(e)) setExportError(true);
    } finally {
      if (!cancelled()) setExporting(false);
    }
  };
  const closeExport = () => {
    exportRun.current++;
    setExporting(false);
    setExportError(false);
    setDialog(null);
  };

  const startReview = (mode: ReviewMode) => {
    setDialog(null);
    actions.select(null);
    // Full screen helps on the class whiteboard; not every WebView allows it.
    // Only if the child is not already in full screen: then they keep it when leaving.
    if (mode === 'interrogazione' && fullscreenKind() === 'api' && !isFullscreen()) {
      enteredFullscreen.current = true;
      void enterFullscreen();
    }
    const steps = readingOrder(visiblePart(map), { depthFirst: sheetTemplate });
    if (mode !== 'ripetimi') return review.start(steps, mode);
    // The child names the concepts, not the whole propositions.
    const labels = new Map(map.nodes.map((n) => [n.id, n.label.replace(/\s+/g, ' ').trim()]));
    review.start(
      steps.map((s) => ({ nodeId: s.nodeId, text: labels.get(s.nodeId) ?? s.text })),
      mode,
    );
    showMap(50);
  };

  /** True if the review itself put the page in full screen, so only then it takes it out. */
  const enteredFullscreen = useRef(false);
  const leaveReviewFullscreen = () => {
    if (!enteredFullscreen.current) return;
    enteredFullscreen.current = false;
    if (isFullscreen()) void exitFullscreen();
  };

  const exitReview = () => {
    void reader.stop();
    review.exit();
    leaveReviewFullscreen();
    showMap(50);
  };

  useBackHandler(exitReview, review.active);
  const ripetimi = useRipetimi(review.active && review.mode === 'ripetimi' && !review.done);
  const finishRipetimi = () => {
    review.finish();
    void reader.readText(ripetimiSummary(useReview.getState()));
  };
  const overview = () => void fitView({ padding: fitPadding(0.15), duration: motion(500) }).then(fromTopIfTooBig);

  // Review: follow the current concept and read it once it is visible.
  const current = review.active ? review.steps[review.index] : undefined;
  useEffect(() => {
    // At «Ripetimi» the whole map stays in view.
    if (!current || review.mode === 'ripetimi') return;
    const node = useMapStore.getState().map?.nodes.find((n) => n.id === current.nodeId);
    if (!node) return;
    const size = useMapStore.getState().sizes[node.id] ?? { width: 180, height: 72 };
    void setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
      zoom: Math.max(getZoom(), 1),
      duration: motion(500),
    });
    // At the "interrogazione" the child speaks: the app reads only on request.
    if (review.mode === 'interrogazione') return;
    if (review.revealed) void reader.readSteps([current]);
    else void reader.readText('Che cosa c’è qui?');
  }, [current, review.revealed]);

  // Arrows, Page Up/Down (presentation clickers) and Space move through the map.
  useEffect(() => {
    if (!review.active) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useReview.getState();
      const onControl = e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select');
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) {
        e.preventDefault();
        if (s.mode === 'quiz' && !s.revealed) s.reveal();
        else s.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        s.prev();
      } else if (e.key === 'Escape') exitReview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review.active]);

  // Leaving the editor must not leave a half-finished review (or full
  // screen, or an open undo step) behind.
  useEffect(
    () => () => {
      useReview.getState().exit();
      leaveReviewFullscreen();
      endStep();
      window.clearTimeout(closer.current);
      window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  // Delete or Backspace removes the concept in hand (with its links) and
  // the selected links, as one undo step. Enter or F2 renames it.
  const dialogOpen = dialog !== null;
  useEffect(() => {
    if (review.active || dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"]')) return;
      const s = useMapStore.getState();
      // Enter on a link (reached with Tab) writes its linking words.
      const edgeId = target?.closest('.react-flow__edge')?.getAttribute('data-id');
      if ((e.key === 'Enter' || e.key === 'F2') && edgeId) {
        e.preventDefault();
        setDialog({ kind: 'link', edgeId });
        return;
      }
      const node = s.map?.nodes.find((n) => n.id === s.selectedId);
      if ((e.key === 'Enter' || e.key === 'F2') && node) {
        const el = target?.closest('.react-flow__node')?.querySelector('.concept-node');
        if (!el || target?.closest('.react-flow__node')?.getAttribute('data-id') !== node.id) return;
        e.preventDefault();
        s.startEditing(node.id);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const links = getEdges()
        .filter((x) => x.selected)
        .map((x) => x.id);
      if (!node && links.length === 0) return;
      e.preventDefault();
      // With others under it, the same question as «Elimina»: never a branch
      // left floating without its concept.
      if (node && s.map && childrenOf(s.map, node.id).length > 0) return setDialog({ kind: 'delete', id: node.id });
      beginStep();
      if (links.length) s.removeEdges(links);
      if (node) s.removeNodes([node.id]);
      endStep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review.active, dialogOpen]);

  const editing = !review.active;

  const labelOf = (id: string) => useMapStore.getState().map?.nodes.find((n) => n.id === id)?.label ?? '';
  /** Where «Cambia ramo» puts the concept, or what «Collega» links it to: the one tapped on the map. */
  const pickTarget = (id: string) => {
    const pick = picking;
    setPicking(null);
    if (!pick || id === pick.from) return;
    const current = useMapStore.getState().map;
    if (!current) return;
    if (pick.mode === 'collega') {
      const linked = current.edges.some((e) => (e.source === pick.from && e.target === id) || (e.source === id && e.target === pick.from));
      if (linked) return showNotice(`«${labelOf(pick.from)}» e «${labelOf(id)}» sono già collegati.`);
      // A line only: each concept stays in its own branch.
      actions.connect(pick.from, id);
      setTimeout(() => actions.select(pick.from));
      return;
    }
    const why = cannotMoveUnder(current, pick.from, id);
    if (why === 'below') return showNotice(`«${labelOf(id)}» è nel ramo di «${labelOf(pick.from)}»: scegli un concetto fuori dal ramo.`);
    if (why === 'already') return showNotice(`«${labelOf(pick.from)}» è già sotto «${labelOf(id)}».`);
    actions.moveUnder(pick.from, id);
    // After React Flow has selected the concept tapped: the one the child
    // started from stays in hand.
    setTimeout(() => actions.select(pick.from));
    reveal(pick.from);
  };
  // Esc, or the back button, puts «Cambia ramo» and «Collega» away.
  useBackHandler(() => setPicking(null), picking !== null);
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  // Nothing to pick from any more (deleted, undone, a review began).
  useEffect(() => {
    if (picking && (!editing || !map.nodes.some((n) => n.id === picking.from))) setPicking(null);
  }, [picking, editing, map.nodes]);

  /** «Elimina»: a concept with others under it asks what to do with them. */
  const deleteConcept = (id: string) => {
    const current = useMapStore.getState().map;
    if (!current) return;
    if (childrenOf(current, id).length === 0) return actions.removeNodes([id]);
    setDialog({ kind: 'delete', id });
  };

  // The tools of the concept in hand cover the bottom of the map: a concept
  // under them comes up just enough to be seen.
  useEffect(() => {
    if (!selectedId || !editing) return;
    const t = setTimeout(() => {
      const bar = document.querySelector('.selection-bar')?.getBoundingClientRect();
      const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(selectedId)}"]`)?.getBoundingClientRect();
      if (!bar || !el || el.bottom <= bar.top - 8 || el.top >= bar.bottom) return;
      const { x, y, zoom } = getViewport();
      void setViewport({ x, y: y - (el.bottom - bar.top + 16), zoom }, { duration: motion(200) });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedId, editing]);

  const [toolbarRef, crowded] = useCrowded();
  const [topbarRef, topbarCrowded] = useCrowded();
  const phone = useMediaQuery(PHONE);
  // Where they do not all fit (a phone, large text): these go in «Altro» (see .toolbar-more).
  // Where they all fit they are in groups ('group-start'): what goes into the map,
  // then where it stays on the sheet.
  const moreTools: (ComponentProps<typeof BigButton> & { key: string })[] = [
    { key: 'photo', icon: 'camera', label: 'Dal libro', className: 'group-start', onClick: () => setDialog({ kind: 'photo' }) },
    // Lit up while the concepts can be dragged: pressed again, they stay
    // where they were put. «Riordina» puts them back on the sheet.
    ...(sheetTemplate
      ? [
          {
            key: 'layout',
            icon: 'hand' as const,
            label: 'Sposta',
            title: moving
              ? 'Hai finito? Premi di nuovo: i concetti restano dove li hai messi.'
              : 'Metti i concetti dove vuoi. «Riordina» li rimette a misura di foglio A4.',
            'aria-pressed': moving,
            className: 'group-start',
            onClick: () => {
              if (moving) return setMoving(false);
              spostaUsed();
              if (sheetMode) actions.setFreeLayout(true);
              setMoving(true);
            },
          },
        ]
      : []),
    {
      key: 'tidy',
      icon: 'tidy',
      label: 'Riordina',
      title: sheetTemplate ? 'Rimetti la mappa in ordine, a misura di foglio A4. I colori restano come sono.' : 'Rimetti la mappa in ordine. I colori restano come sono.',
      className: sheetTemplate ? undefined : 'group-start',
      onClick: tidyAndOffer,
      disabled: arranging,
    },
  ];
  const inFullscreen = useFullscreen();
  // The map as a whole: in the top bar (on a phone, in «Altro»).
  const mapTools: (ComponentProps<typeof BigButton> & { key: string })[] = [
    { key: 'save', icon: 'share', label: 'Salva e manda', onClick: () => setDialog({ kind: 'export' }) },
    {
      key: 'settings',
      icon: 'palette',
      label: 'Aspetto',
      onClick: () => {
        markUsed('settings');
        onOpenSettings();
      },
    },
    ...(fullscreenKind() === 'api' ? [{ key: 'fullscreen', ...fullscreenProps(inFullscreen) }] : []),
    ...(fullscreenKind() === 'home' ? [{ key: 'fullscreen', ...homeFullscreenProps(() => setDialog({ kind: 'fullscreen' })) }] : []),
  ];
  // The tool the tutorial asks for may be in «Altro»: then «Altro» stands out too.
  const inMore =
    tutorialTarget !== undefined &&
    ((crowded && moreTools.some((t) => TOOL_TARGETS[t.key] === tutorialTarget)) || (phone && mapTools.some((t) => TOOL_TARGETS[t.key] === tutorialTarget)));

  /**
   * «Solo la mappa»: every bar goes away, for studying the map or showing it
   * on the classroom board. One button, Esc or the back button bring them back.
   */
  const [focus, setFocus] = useState(false);
  const focusMode = focus && editing;
  useEffect(() => {
    if (focusMode) markUsed('focus');
  }, [focusMode]);
  useBackHandler(() => setFocus(false), focusMode);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  return (
    <div
      className={`editor${picking ? ' is-picking' : ''}${review.active ? ' is-reviewing' : ''}${locked ? ' is-locked' : ''}${focusMode ? ' is-focus' : ''}${crowded || tutorialStep !== null ? '' : ' has-dock'}`}
      onPointerDownCapture={(e) => {
        touch();
        if ((e.target as Element).closest('.react-flow')) following.current = false;
        grabbed.current = (e.target as Element).closest('.react-flow__node')?.getAttribute('data-id') ?? null;
        // Any press, on a concept too, stops the branch tapped a moment ago from
        // coming closer: the view must not glide under a finger that may be about
        // to drag. If the press turns out to be a tap, onNodeClick starts it again.
        cancelCloser();
        // A glide already under way stops where it is. On the empty map d3-zoom
        // does it, but a concept that can be dragged is out of its reach (nopan).
        if ((e.target as Element).closest('.react-flow__node.draggable')) void setViewport(getViewport());
      }}
      onKeyDownCapture={touch}
      onWheelCapture={() => {
        touch();
        following.current = false;
      }}
    >
      <header ref={topbarRef} className={cx('topbar', topbarCrowded && 'is-crowded')}>
        <BigButton icon="back" label="Mappe" aria-label="Mappe" title="Mappe" onClick={onBack} />
        {/* The pencil says the title can be changed: there is no hover on a tablet. */}
        <label className="title-field">
          <input
            className="title-input"
            value={map.title}
            maxLength={1000}
            aria-label="Titolo della mappa"
            readOnly={!editing}
            // The whole title is one undo step, not one per letter.
            onFocus={() => editing && beginStep()}
            onBlur={() => {
              if (!map.title.trim()) actions.setTitle(map.nodes[0]?.label.trim() || NEW_MAP_TITLE);
              endStep();
            }}
            onChange={(e) => actions.setTitle(e.target.value)}
          />
          {editing && <Icon name="edit" className="title-edit-icon" />}
        </label>
        {editing ? (
          <>
            <BigButton
              icon="undo"
              label="Annulla"
              aria-label="Annulla"
              title="Annulla"
              className={target('annulla')}
              disabled={!canUndo}
              onClick={() => mapHistory().undo()}
            />
            <BigButton icon="redo" label="Ripeti" aria-label="Ripeti" title="Ripeti" disabled={!canRedo} onClick={() => mapHistory().redo()} />
            {mapTools.map(({ key, ...t }) => (
              <BigButton key={key} {...t} className={cx('topbar-map', key === 'save' && 'group-start', key === 'fullscreen' && 'icon-only', target(TOOL_TARGETS[key]))} />
            ))}
          </>
        ) : (
          <>
            {/* On a phone the bar is tight: there the way out is the system's (back gesture) or «Altro» in the editor. */}
            <FullscreenButton className="topbar-map icon-only" />
            <BigButton icon="close" label="Esci" aria-label="Esci" title="Esci" onClick={exitReview} />
          </>
        )}
      </header>

      <div className="canvas" ref={canvasRef} onPointerDownCapture={() => (heldOnPress.current = useMapStore.getState().selectedId)}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => {
            cancelCloser();
            dragging.current = true;
            held.current = sheet;
            beginStep();
          }}
          onNodeDragStop={() => {
            dragging.current = false;
            held.current = null;
            if (sheetMode) {
              dropPending.current = true;
              setDragTick((t) => t + 1); // a dropped concept may have changed place in the list
            } else endStep();
          }}
          onPaneClick={() => {
            cancelCloser();
            // Tapping the empty map puts «Cambia ramo» or «Collega» away, nothing else.
            if (picking) return setPicking(null);
            actions.select(null);
          }}
          onNodeClick={(e, node) => {
            if (picking && !review.active) return pickTarget(node.id);
            if (!review.active) {
              const again = heldOnPress.current === node.id && !(e.target as Element).closest('button, textarea, input');
              if (!again) return bringCloser(node.id);
              cancelCloser();
              return setDialog({ kind: 'style' });
            }
            // Ripetimi: a tap lights up (or turns off) a concept the microphone missed.
            if (review.mode === 'ripetimi') return review.toggleHeard(node.id);
            if (review.mode !== 'interrogazione') return;
            const i = review.order[node.id];
            if (i !== undefined) review.goTo(i);
          }}
          // With a mouse, a double click opens the concept's window (the second
          // click usually does already, but not when the first one was still
          // being turned into a selection).
          onNodeDoubleClick={(e, node) => {
            if (!editing || picking || (e.target as Element).closest('button, textarea, input')) return;
            cancelCloser();
            actions.select(node.id);
            setDialog({ kind: 'style' });
          }}
          onEdgeClick={(_, edge) => editing && setDialog({ kind: 'link', edgeId: edge.id })}
          nodesDraggable={editing && !locked}
          // Lines come from the tree itself («Cambia ramo»): no dots to drag new ones.
          nodesConnectable={false}
          elementsSelectable={editing}
          // Our own handler (above): one undo step, and never behind a dialog.
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          // A tap focuses the concept, and React Flow would scroll it fully
          // into view: the concept moved away from under the finger while it
          // was held to rename it, so renaming failed.
          autoPanOnNodeFocus={false}
          // A held finger always trembles a little: not enough to drag the concept (see HOLD_SLOP).
          nodeDragThreshold={6}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: MAX_READ_ZOOM }}
          // One finger on a concept that is not in hand moved the map, not the
          // concept: on the sheet they stay put until «Sposta». Said where it is,
          // once the map really moves (the start comes with every tap too).
          onMoveStart={(e) => {
            const oneFinger = !!e && !('touches' in e && e.touches.length > 1);
            spostaCandidate.current =
              oneFinger && locked && editing && !picking && tutorialStep === null && !!grabbed.current && grabbed.current !== selectedId && !spostaHinted.current;
          }}
          onMove={() => {
            if (!spostaCandidate.current) return;
            spostaCandidate.current = false;
            if (!spostaHintDue()) return;
            spostaHinted.current = true;
            spostaHintShown();
            showNotice(spostaHintText(crowded));
          }}
          onMoveEnd={() => void (spostaCandidate.current = false)}
          minZoom={MIN_ZOOM}
          // The wheel and two fingers on a touchpad scroll the sheet, like a
          // page; Ctrl + wheel, a pinch and the buttons zoom.
          panOnScroll
          panOnScrollSpeed={1}
          proOptions={{ hideAttribution: true }}
          ariaLabelConfig={MAP_ARIA_LABELS}
        >
          <Background gap={24} />
          <Controls
            showInteractive={false}
            // A map too big to be seen whole: its top, not its middle (once
            // React Flow has done its own fit, which waits for a render).
            onFitView={() => void fitView({ padding: fitPadding(0.1) }).then(fromTopIfTooBig)}
          >
            {editing && (
              <ControlButton
                className={cx('focus-button', target('solo-mappa'))}
                onClick={() => setFocus(true)}
                aria-label="Solo la mappa: nascondi i pulsanti"
                title="Solo la mappa: nascondi i pulsanti"
              >
                <Icon name="focus" />
              </ControlButton>
            )}
          </Controls>
        </ReactFlow>
        {editing && selectedNode && !picking && (
          // Everything about the concept in hand, in one place.
          <div className="selection-bar" role="toolbar" aria-label="Concetto scelto">
            <BigButton icon="edit" label="Nome" onClick={() => useMapStore.getState().startEditing(selectedNode.id)} />
            {tree.parent.has(selectedNode.id) && <BigButton icon="plus" label="Accanto" aria-label="Concetto accanto" onClick={() => addNear(selectedNode.id, 'sibling')} />}
            <BigButton icon="image" label="Immagine" className={target('immagine')} onClick={() => setDialog({ kind: 'style' })} />
            <BigButton icon="join" label="Collega" onClick={() => setPicking({ from: selectedNode.id, mode: 'collega' })} />
            <BigButton icon="branch" label="Cambia ramo" className={target('cambia-ramo')} onClick={() => setPicking({ from: selectedNode.id, mode: 'ramo' })} />
            <BigButton icon="trash" label="Elimina" variant="danger" className={target('elimina')} onClick={() => deleteConcept(selectedNode.id)} />
          </div>
        )}
        {colorOffer && !picking && (
          <div className="pick-banner color-offer" role="status">
            <p>Mappa in ordine.</p>
            <button
              type="button"
              className="color-offer-button"
              onClick={() => {
                setColorOffer(false);
                actions.colorBranches();
              }}
            >
              <Icon name="palette" /> Colora i rami
            </button>
            <button type="button" className="pick-banner-close" aria-label="Chiudi" title="Chiudi" onClick={() => setColorOffer(false)}>
              <Icon name="close" />
            </button>
          </div>
        )}
        {picking && (
          <div className="pick-banner" role="status">
            <p>
              {picking.mode === 'collega'
                ? `Tocca il concetto da collegare a «${labelOf(picking.from)}».`
                : `Tocca il concetto sotto cui mettere «${labelOf(picking.from)}».`}
            </p>
            <button type="button" className="pick-banner-close" aria-label="Esci" title="Esci" onClick={() => setPicking(null)}>
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>

      {review.active && review.mode === 'interrogazione' && current && (
        <p className="present-caption" aria-live="polite">
          {current.text}
        </p>
      )}
      {review.active && review.mode === 'ripetimi' && (
        <p className="present-caption ripetimi-caption" aria-live="polite">
          {review.done
            ? ripetimiSummary(review)
            : ripetimi.error
              ? DICTATION_ERRORS[ripetimi.error]
              : ripetimi.said || 'Spiega la mappa a voce: i concetti che nomini si accendono.'}
        </p>
      )}
      {tutorialStep !== null && (
        <TutorialCoach
          key={tutorialStep}
          index={tutorialStep}
          used={used}
          hidden={review.active}
          onNext={() =>
            tutorialStep + 1 >= TUTORIAL_STEPS.length ? endTutorial() : setTutorialStep(tutorialStep + 1)
          }
          onClose={endTutorial}
          onTarget={setCoachTarget}
        />
      )}
      {review.active ? (
        <ReviewBar
          onRepeat={() => current && void reader.readSteps([current])}
          onOverview={overview}
          onExit={exitReview}
          onFinish={finishRipetimi}
        />
      ) : (
        <div className="dock">
          <nav ref={toolbarRef} className={`toolbar${crowded ? ' is-crowded' : ''}`} aria-label="Strumenti">
            <BigButton icon="plus" label="Concetto" variant="primary" className={target('concetto')} onClick={() => addConcept()} />
            <BigButton icon="mic" label="Detta" className={target('detta')} onClick={dictate} disabled={dictation.listening} />
            {reader.active ? (
              <BigButton icon="stop" label="Stop" onClick={() => void reader.stop()} />
            ) : (
              <BigButton icon="speak" label="Leggi" className={target('leggi')} onClick={reader.readMap} />
            )}
            <BigButton icon="brain" label="Ripassa" className={target('ripassa')} onClick={() => setDialog({ kind: 'review' })} />
            {moreTools.map(({ key, className = '', ...t }) => (
              <BigButton key={key} {...t} className={cx('toolbar-extra', className, target(TOOL_TARGETS[key]))} />
            ))}
            <BigButton icon="menu" label="Altro" className={cx('toolbar-more', inMore && 'tutorial-target')} aria-haspopup="dialog" onClick={() => setDialog({ kind: 'more' })} />
          </nav>
        </div>
      )}
      {focusMode && (
        <BigButton icon="close" label="Mostra i pulsanti" className="focus-exit" onClick={() => setFocus(false)} />
      )}

      <div className="editor-notices">
        <SaveProblemNotice />
        {editing && !focusMode && tutorialStep === null && <UpdateNotice />}
        {notice && (
          <div className="editor-notice" role="alert">
            <span>{notice}</span>
            <button type="button" className="editor-notice-close" aria-label="Chiudi il messaggio" onClick={() => setNotice(null)}>
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>

      <DictationOverlay
        listening={dictation.listening}
        partial={dictation.partial}
        error={dictation.error}
        onStop={() => void dictation.stop()}
        onClose={dictation.clearError}
      />

      {dialog?.kind === 'style' && selectedNode && <NodeStyleDialog node={selectedNode} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'link' &&
        (() => {
          const edge = map.edges.find((e) => e.id === dialog.edgeId);
          return edge ? <LinkWordDialog edge={edge} onClose={() => setDialog(null)} /> : null;
        })()}
      {dialog?.kind === 'export' && (
        <ExportDialog
          busy={exporting}
          error={exportError}
          onExport={doExport}
          onClose={closeExport}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          id={dialog.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'photo' && <PhotoTextDialog mapId={map.id} onAdd={addFromPhoto} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'review' && <ReviewStartDialog onStart={startReview} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'fullscreen' && <FullscreenHint onClose={() => setDialog(null)} />}
      {dialog?.kind === 'more' && (
        <Dialog title="Altro" onClose={() => setDialog(null)} className="more-tools" sheet>
          <div className="more-grid">
            {[...moreTools, ...mapTools].map(({ key, onClick, className: _group, ...t }) => (
              <BigButton
                key={key}
                {...t}
                className={target(TOOL_TARGETS[key])}
                onClick={(e) => {
                  setDialog(null); // a tool may open its own dialog right after
                  onClick?.(e);
                }}
              />
            ))}
          </div>
          <div className="dialog-actions">
            <BigButton icon="close" label="Chiudi" onClick={() => setDialog(null)} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** A concept with others under it: only it (they go up a level), or all of them. */
function DeleteDialog({ id, onClose }: { id: string; onClose(): void }) {
  const map = useMapStore((s) => s.map);
  if (!map) return null;
  const label = map.nodes.find((n) => n.id === id)?.label ?? '';
  const below = branchIds(map, id).size - 1;
  const parent = spanningTree(map).parent.get(id);
  const parentLabel = map.nodes.find((n) => n.id === parent)?.label;
  const { removeLiftingChildren, removeBranch } = useMapStore.getState();
  const n = below === 1 ? 'il concetto' : `i ${below} concetti`;
  return (
    <Dialog title={`Elimina «${label}»`} onClose={onClose} className="delete-dialog" sheet>
      {parentLabel ? (
        <>
          <OptionCard
            icon={<Icon name="lift" />}
            name={`Solo «${label}»`}
            description={`${below === 1 ? 'Il concetto che c’è sotto sale' : `I ${below} concetti che ci sono sotto salgono`} di un livello, sotto «${parentLabel}».`}
            onClick={() => {
              removeLiftingChildren(id);
              onClose();
            }}
          />
          <OptionCard
            icon={<Icon name="trash" />}
            name="Tutto il ramo"
            description={`«${label}» e ${n} sotto.`}
            onClick={() => {
              removeBranch(id);
              onClose();
            }}
          />
        </>
      ) : (
        <p>È l’idea principale della mappa: finché ha concetti sotto non si può eliminare. Puoi cambiarle nome con «Nome».</p>
      )}
      <div className="dialog-actions">
        <BigButton icon="close" label="Annulla" onClick={onClose} />
      </div>
    </Dialog>
  );
}

function ReviewStartDialog({ onStart, onClose }: { onStart(mode: ReviewMode): void; onClose(): void }) {
  return (
    <Dialog title="Ripassa" onClose={onClose} className="review-start" sheet>
      <OptionCard icon={<Icon name="footprints" />} name="Un passo alla volta" description="La mappa appare un concetto alla volta, letto ad alta voce." onClick={() => onStart('passo')} />
      <OptionCard icon={<Icon name="eye-off" />} name="Indovina" description="Il concetto è nascosto: prova a ricordarlo, poi premi «Scopri»." onClick={() => onStart('quiz')} />
      <OptionCard
        icon={<Icon name="hand" />}
        name="Interrogazione"
        description="Tutta la mappa davanti a te, a schermo intero: spiega un concetto alla volta e vai avanti con le frecce."
        onClick={() => onStart('interrogazione')}
      />
      {speech().sttSupported && (
        <OptionCard
          icon={<Icon name="speech" />}
          name="Ripetimi"
          description="Spiega la mappa a voce: i concetti che nomini si accendono. Alla fine ti dico cosa hai saltato."
          onClick={() => onStart('ripetimi')}
        />
      )}
      <div className="dialog-actions">
        <BigButton icon="close" label="Annulla" onClick={onClose} />
      </div>
    </Dialog>
  );
}

export function MapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
