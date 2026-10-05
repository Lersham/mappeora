import { create } from 'zustand';
import { temporal } from 'zundo';
import type { ConceptMap, MapEdge, MapNode } from '../types/map';
import { newId } from '../lib/id';
import { colorForDepth } from '../lib/palette';
import { collapseInfo } from '../lib/collapse';
import { fromOutline, type OutlineRow } from '../lib/outline';
import { spanningTree } from '../lib/tree';

type Size = { width: number; height: number };

interface MapState {
  map: ConceptMap | null;
  selectedId: string | null;
  /** Rendered node sizes reported by React Flow (not part of the document). */
  sizes: Record<string, Size>;

  load(map: ConceptMap | null): void;
  setTitle(title: string): void;
  /** Concepts placed by hand (true) or kept in order on an A4 sheet. */
  setFreeLayout(free: boolean): void;
  select(id: string | null): void;
  /** Adds a node linked under `parentId` (or unlinked if null). Returns its id. */
  addChild(parentId: string | null, label?: string): string;
  updateNode(id: string, patch: Partial<Omit<MapNode, 'id'>>): void;
  /** Hides or shows the concepts below `id`. */
  toggleCollapsed(id: string): void;
  moveNode(id: string, position: MapNode['position']): void;
  /** `auto`: placed by the automatic layout, not an edit by the child. */
  applyPositions(positions: Record<string, MapNode['position']>, opts?: { auto?: boolean }): void;
  removeNodes(ids: string[]): void;
  connect(source: string, target: string): void;
  updateEdge(id: string, patch: Partial<Omit<MapEdge, 'id'>>): void;
  removeEdges(ids: string[]): void;
  /** Rebuilds the map from the "scaletta" (see lib/outline.ts), as one undo step. */
  applyOutline(rows: OutlineRow[]): void;
  setSize(id: string, size: Size): void;
}

const CHILD_OFFSET_Y = 140;
const HISTORY_LIMIT = 200;

/** Level of a concept, counted from the main one (a link back to it doesn't count). */
const depthOf = (map: ConceptMap, id: string) => spanningTree(map).depth.get(id) ?? 0;

/**
 * Applies `fn` to the current map and bumps updatedAt. Nothing happens (no
 * undo step, no save) without a map or when `fn` changes nothing.
 */
function edit(state: MapState, fn: (map: ConceptMap) => Partial<ConceptMap>, opts: { touch?: boolean } = {}): Partial<MapState> {
  if (!state.map) return {};
  const patch = fn(state.map);
  if (Object.keys(patch).length === 0) return {};
  return { map: { ...state.map, ...patch, ...(opts.touch !== false && { updatedAt: Date.now() }) } };
}

/** The concepts above `id`, nearest first. */
function ancestors(map: ConceptMap, id: string): string[] {
  const seen = new Set([id]);
  const queue = [id];
  for (let i = 0; i < queue.length; i++) {
    for (const e of map.edges) {
      if (e.target !== queue[i] || seen.has(e.source)) continue;
      seen.add(e.source);
      queue.push(e.source);
    }
  }
  return queue.slice(1);
}

export const useMapStore = create<MapState>()(
  temporal(
    (set, get) => ({
      map: null,
      selectedId: null,
      sizes: {},

      load: (map) => set({ map, selectedId: null, sizes: {} }),

      setTitle: (title) => set((s) => edit(s, (map) => (map.title === title ? {} : { title }))),

      setFreeLayout: (free) => set((s) => edit(s, () => ({ freeLayout: free || undefined }))),

      select: (selectedId) => set({ selectedId }),

      addChild: (parentId, label = 'Nuovo concetto') => {
        const id = newId();
        set((s) =>
          edit(s, (map) => {
            const parent = map.nodes.find((n) => n.id === parentId);
            const siblings = parent ? map.edges.filter((e) => e.source === parent.id).length : 0;
            // Below every existing sibling, so the automatic layout lists it last.
            const siblingYs = parent ? map.edges.filter((e) => e.source === parent.id).map((e) => map.nodes.find((n) => n.id === e.target)?.position.y ?? 0) : [];
            const position = parent
              ? { x: parent.position.x + siblings * 200 - 100, y: Math.max(parent.position.y + CHILD_OFFSET_Y, ...siblingYs.map((y) => y + 1)) }
              : { x: 0, y: Math.max(0, ...map.nodes.map((n) => n.position.y)) + CHILD_OFFSET_Y };
            const depth = parent ? depthOf(map, parent.id) + 1 : 0;
            const node: MapNode = { id, label, position, color: colorForDepth(depth), shape: 'rettangolo' };
            const edges = parent ? [...map.edges, { id: newId(), source: parent.id, target: id }] : map.edges;
            // A new child must be visible: open whatever collapsed concept hides it.
            const above = new Set(ancestors({ ...map, edges }, id));
            const nodes = map.nodes.map((n) => (above.has(n.id) && n.collapsed ? { ...n, collapsed: false } : n));
            return { nodes: [...nodes, node], edges };
          }),
        );
        set({ selectedId: id });
        return id;
      },

      updateNode: (id, patch) =>
        set((s) =>
          edit(s, (map) => (map.nodes.some((n) => n.id === id) ? { nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) } : {})),
        ),

      toggleCollapsed: (id) => {
        const node = get().map?.nodes.find((n) => n.id === id);
        if (!node) return;
        // A selected concept that disappears hands the selection to this one
        // (see the subscription below).
        get().updateNode(id, { collapsed: !node.collapsed });
      },

      moveNode: (id, position) => get().updateNode(id, { position }),

      applyPositions: (positions, opts = {}) =>
        set((s) =>
          edit(
            s,
            (map) => {
              const moves = (n: MapNode) => positions[n.id] && (positions[n.id].x !== n.position.x || positions[n.id].y !== n.position.y);
              if (!map.nodes.some(moves)) return {};
              return { nodes: map.nodes.map((n) => (moves(n) ? { ...n, position: positions[n.id] } : n)) };
            },
            // Laying out a map just opened must not make it look "changed today".
            { touch: !opts.auto },
          ),
        ),

      removeNodes: (ids) => {
        const gone = new Set(ids);
        set((s) => ({
          ...edit(s, (map) =>
            map.nodes.some((n) => gone.has(n.id))
              ? {
                  nodes: map.nodes.filter((n) => !gone.has(n.id)),
                  edges: map.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
                }
              : {},
          ),
          selectedId: s.selectedId && gone.has(s.selectedId) ? null : s.selectedId,
        }));
      },

      connect: (source, target) =>
        set((s) =>
          edit(s, (map) => {
            const exists = map.edges.some((e) => e.source === source && e.target === target);
            if (exists || source === target) return {};
            return { edges: [...map.edges, { id: newId(), source, target }] };
          }),
        ),

      updateEdge: (id, patch) =>
        set((s) =>
          edit(s, (map) => (map.edges.some((e) => e.id === id) ? { edges: map.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : {})),
        ),

      removeEdges: (ids) => {
        const gone = new Set(ids);
        set((s) => edit(s, (map) => (map.edges.some((e) => gone.has(e.id)) ? { edges: map.edges.filter((e) => !gone.has(e.id)) } : {})));
      },

      applyOutline: (rows) =>
        set((s) => {
          const next = edit(s, (map) => fromOutline(map, rows));
          const gone = s.selectedId && !next.map?.nodes.some((n) => n.id === s.selectedId);
          return gone ? { ...next, selectedId: null } : next;
        }),

      setSize: (id, size) => set((s) => ({ sizes: { ...s.sizes, [id]: size } })),
    }),
    {
      // Only the document is undoable; selection and sizes are not.
      partialize: (s) => ({ map: s.map }),
      equality: (a, b) => a.map === b.map,
      limit: HISTORY_LIMIT,
    },
  ),
);

export const mapHistory = () => useMapStore.temporal.getState();

/**
 * The selection is not part of the undo history. After «Annulla», a load or
 * a collapse it may point to a concept that is gone or hidden: move it to
 * the nearest visible concept above, or clear it.
 */
function repairedSelection(map: ConceptMap | null, selectedId: string | null): string | null {
  if (!map || !selectedId) return null;
  if (!map.nodes.some((n) => n.id === selectedId)) return null;
  if (!map.nodes.some((n) => n.collapsed)) return selectedId;
  const { hidden } = collapseInfo(map);
  if (!hidden.has(selectedId)) return selectedId;
  return ancestors(map, selectedId).find((id) => !hidden.has(id)) ?? null;
}

useMapStore.subscribe((s, prev) => {
  if (s.map === prev.map && s.selectedId === prev.selectedId) return;
  const selectedId = repairedSelection(s.map, s.selectedId);
  if (selectedId !== s.selectedId) useMapStore.setState({ selectedId });
});

/** Same document, apart from updatedAt and positions that ended where they started. */
function sameDocument(a: ConceptMap | null, b: ConceptMap | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.id !== b.id || a.title !== b.title || a.freeLayout !== b.freeLayout || a.edges !== b.edges) return false;
  if (a.nodes.length !== b.nodes.length) return false;
  return a.nodes.every((n, i) => {
    const m = b.nodes[i];
    if (n === m) return true;
    const keys = new Set([...Object.keys(n), ...Object.keys(m)]) as Set<keyof MapNode>;
    return [...keys].every((k) =>
      k === 'position' ? n.position.x === m.position.x && n.position.y === m.position.y : n[k] === m[k],
    );
  });
}

/**
 * Some gestures send many updates: a drag (one per frame), typing the
 * title (one per letter). History is paused in between and the gesture is
 * recorded as a single undo step when it ends, if it changed anything.
 */
let stepSnapshot: { map: ConceptMap | null } | null = null;

export function beginStep() {
  if (stepSnapshot) return;
  stepSnapshot = { map: useMapStore.getState().map };
  mapHistory().pause();
}

export function endStep() {
  const snapshot = stepSnapshot;
  if (!snapshot) return;
  stepSnapshot = null;
  mapHistory().resume();
  if (sameDocument(snapshot.map, useMapStore.getState().map)) return;
  useMapStore.temporal.setState((t) => ({ pastStates: [...t.pastStates, snapshot].slice(-HISTORY_LIMIT), futureStates: [] }));
}

/** Runs `fn` without recording it in the undo history (e.g. an automatic layout). */
export function untracked(fn: () => void) {
  const history = mapHistory();
  if (!history.isTracking) return fn();
  history.pause();
  try {
    fn();
  } finally {
    mapHistory().resume();
  }
}
