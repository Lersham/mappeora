import { create } from 'zustand';
import { temporal } from 'zundo';
import type { ConceptMap, MapEdge, MapNode } from '../types/map';
import { newId } from '../lib/id';
import { colorForDepth } from '../lib/palette';
import { collapseInfo } from '../lib/collapse';

type Size = { width: number; height: number };

interface MapState {
  map: ConceptMap | null;
  selectedId: string | null;
  /** Rendered node sizes reported by React Flow (not part of the document). */
  sizes: Record<string, Size>;

  load(map: ConceptMap | null): void;
  setTitle(title: string): void;
  select(id: string | null): void;
  /** Adds a node linked under `parentId` (or unlinked if null). Returns its id. */
  addChild(parentId: string | null, label?: string): string;
  updateNode(id: string, patch: Partial<Omit<MapNode, 'id'>>): void;
  /** Hides or shows the concepts below `id`. */
  toggleCollapsed(id: string): void;
  moveNode(id: string, position: MapNode['position']): void;
  applyPositions(positions: Record<string, MapNode['position']>): void;
  removeNodes(ids: string[]): void;
  connect(source: string, target: string): void;
  updateEdge(id: string, patch: Partial<Omit<MapEdge, 'id'>>): void;
  removeEdges(ids: string[]): void;
  setSize(id: string, size: Size): void;
}

const CHILD_OFFSET_Y = 140;

function depthOf(map: ConceptMap, id: string): number {
  let depth = 0;
  let current = id;
  const seen = new Set<string>();
  for (;;) {
    const parent = map.edges.find((e) => e.target === current)?.source;
    if (!parent || seen.has(parent)) return depth;
    seen.add(parent);
    current = parent;
    depth++;
  }
}

/** Applies `fn` to the current map and bumps updatedAt; no-op without a map. */
function edit(state: MapState, fn: (map: ConceptMap) => Partial<ConceptMap>): Partial<MapState> {
  if (!state.map) return {};
  return { map: { ...state.map, ...fn(state.map), updatedAt: Date.now() } };
}

export const useMapStore = create<MapState>()(
  temporal(
    (set, get) => ({
      map: null,
      selectedId: null,
      sizes: {},

      load: (map) => set({ map, selectedId: null, sizes: {} }),

      setTitle: (title) => set((s) => edit(s, () => ({ title }))),

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
            // A new child must be visible: open its parent if it was collapsed.
            const nodes = map.nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n));
            return { nodes: [...nodes, node], edges };
          }),
        );
        set({ selectedId: id });
        return id;
      },

      updateNode: (id, patch) =>
        set((s) => edit(s, (map) => ({ nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))),

      toggleCollapsed: (id) => {
        const node = get().map?.nodes.find((n) => n.id === id);
        if (!node) return;
        get().updateNode(id, { collapsed: !node.collapsed });
        // Don't leave the selection on a concept that just disappeared.
        const selected = get().selectedId;
        if (selected && selected !== id && collapseInfo(get().map!).hidden.has(selected)) get().select(id);
      },

      moveNode: (id, position) => get().updateNode(id, { position }),

      applyPositions: (positions) =>
        set((s) =>
          edit(s, (map) => ({
            nodes: map.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n)),
          })),
        ),

      removeNodes: (ids) => {
        const gone = new Set(ids);
        set((s) => ({
          ...edit(s, (map) => ({
            nodes: map.nodes.filter((n) => !gone.has(n.id)),
            edges: map.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
          })),
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
        set((s) => edit(s, (map) => ({ edges: map.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))),

      removeEdges: (ids) => {
        const gone = new Set(ids);
        set((s) => edit(s, (map) => ({ edges: map.edges.filter((e) => !gone.has(e.id)) })));
      },

      setSize: (id, size) => set((s) => ({ sizes: { ...s.sizes, [id]: size } })),
    }),
    {
      // Only the document is undoable; selection and sizes are not.
      partialize: (s) => ({ map: s.map }),
      equality: (a, b) => a.map === b.map,
      limit: 200,
    },
  ),
);

export const mapHistory = () => useMapStore.temporal.getState();

/**
 * Dragging emits a position update per frame. We pause history while
 * dragging and record a single undo step (the pre-drag snapshot) on drop.
 */
let dragSnapshot: { map: ConceptMap | null } | null = null;

export function beginDrag() {
  dragSnapshot = { map: useMapStore.getState().map };
  mapHistory().pause();
}

export function endDrag() {
  mapHistory().resume();
  const snapshot = dragSnapshot;
  dragSnapshot = null;
  if (!snapshot || snapshot.map === useMapStore.getState().map) return;
  useMapStore.temporal.setState((t) => ({ pastStates: [...t.pastStates, snapshot], futureStates: [] }));
}
