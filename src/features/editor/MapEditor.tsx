import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  type EdgeTypes,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { useStore } from 'zustand';
import { beginDrag, endDrag, mapHistory, useMapStore } from '../../store/mapStore';
import { reviewVisibility, useReview, type ReviewMode } from '../../store/reviewStore';
import { ConceptNode, type ConceptFlowNode } from './ConceptNode';
import { LadderEdge } from './LadderEdge';
import { ladderLayout } from '../../lib/ladder';
import { NodeStyleDialog } from './NodeStyleDialog';
import { LinkWordDialog } from './LinkWordDialog';
import { ExportDialog, type ExportChoice } from './ExportDialog';
import { ReviewBar } from './ReviewBar';
import { PhotoTextDialog } from '../ocr/PhotoTextDialog';
import { BigButton } from '../../components/BigButton';
import { Dialog } from '../../components/Dialog';
import { DictationOverlay } from '../../components/DictationOverlay';
import { useReadAloud } from '../../hooks/useReadAloud';
import { useDictation } from '../../hooks/useDictation';
import { autoLayout } from '../../services/layout';
import { exportMap, saveMapFile } from '../../services/export';
import { readingOrder } from '../../lib/readingOrder';
import { collapseInfo, visiblePart } from '../../lib/collapse';
import { templateInfo } from '../../lib/templates';
import type { MapNode } from '../../types/map';
import { parseVoiceCommand } from '../../lib/voiceCommands';

const nodeTypes = { concept: ConceptNode };
const edgeTypes: EdgeTypes = { ladder: LadderEdge };

type DialogState =
  | { kind: 'style' }
  | { kind: 'link'; edgeId: string }
  | { kind: 'export' }
  | { kind: 'review' }
  | { kind: 'photo' }
  | null;

interface Props {
  onBack(): void;
  onOpenSettings(): void;
}

function Editor({ onBack, onOpenSettings }: Props) {
  const map = useMapStore((s) => s.map)!;
  const selectedId = useMapStore((s) => s.selectedId);
  const sizes = useMapStore((s) => s.sizes);
  const actions = useMapStore.getState();
  const canUndo = useStore(useMapStore.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(useMapStore.temporal, (t) => t.futureStates.length > 0);
  const review = useReview();
  const { fitView, getNodes, setCenter, getZoom } = useReactFlow();
  const reader = useReadAloud();
  const dictation = useDictation();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const layout = templateInfo(map.template).layout;
  const ladderMode = layout === 'scaletta';
  const selectedNode = map.nodes.find((n) => n.id === selectedId);

  const collapse = useMemo(() => collapseInfo(map), [map]);
  const parents = useMemo(() => new Set(map.edges.map((e) => e.source)), [map.edges]);

  // "Scaletta": where every visible concept should be. Anchored to the
  // first root, so dragging the main concept moves the whole map.
  const ladder = useMemo(() => {
    if (!ladderMode) return null;
    const part = visiblePart(map);
    const targets = new Set(part.edges.map((e) => e.target));
    const roots = part.nodes.filter((n) => !targets.has(n.id));
    const first = (roots.length ? roots : part.nodes).reduce<MapNode | undefined>(
      (best, n) => (!best || n.position.y < best.position.y || (n.position.y === best.position.y && n.position.x < best.position.x) ? n : best),
      undefined,
    );
    return ladderLayout(part.nodes, part.edges, sizes, first?.position);
  }, [ladderMode, map, sizes]);

  // Keep the "scaletta" in order after every change (adding, deleting,
  // collapsing, dropping a dragged concept). Not an edit by the child, so
  // it stays out of the undo history.
  const dragging = useRef(false);
  const [dragTick, setDragTick] = useState(0);
  useEffect(() => {
    if (!ladder || dragging.current || review.active) return;
    const moved = Object.entries(ladder.positions).filter(([id, p]) => {
      const n = map.nodes.find((x) => x.id === id);
      return n && (Math.abs(n.position.x - p.x) > 0.5 || Math.abs(n.position.y - p.y) > 0.5);
    });
    if (moved.length === 0) return;
    mapHistory().pause();
    actions.applyPositions(Object.fromEntries(moved));
    mapHistory().resume();
  }, [ladder, dragTick, review.active]);

  // The store holds our document model; React Flow nodes are derived from it.
  const nodes = useMemo<ConceptFlowNode[]>(
    () =>
      map.nodes.map((n) => ({
        id: n.id,
        type: 'concept',
        position: n.position,
        selected: !review.active && n.id === selectedId,
        hidden: collapse.hidden.has(n.id) || reviewVisibility(review, n.id) === 'hidden',
        measured: sizes[n.id],
        data: {
          label: n.label,
          color: n.color,
          shape: n.shape,
          image: n.image,
          layout,
          hasChildren: parents.has(n.id),
          collapsed: n.collapsed,
          hiddenBelow: collapse.hiddenBelow[n.id] ?? 0,
        },
      })),
    [map.nodes, selectedId, sizes, review, layout, collapse, parents],
  );
  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((e) =>
        ladder?.treeEdges.has(e.id)
          ? {
              id: e.id,
              type: 'ladder',
              source: e.source,
              target: e.target,
              label: e.label,
              interactionWidth: 32,
              className: 'concept-edge',
              data: { onEdit: review.active ? undefined : () => setDialog({ kind: 'link', edgeId: e.id }) },
            }
          : {
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
              labelBgPadding: [8, 4] as [number, number],
              labelBgBorderRadius: 6,
              interactionWidth: 32, // easier to tap with a finger
              className: 'concept-edge',
            },
      ),
    [map.edges, ladder, review.active],
  );

  const onNodesChange = useCallback((changes: NodeChange<ConceptFlowNode>[]) => {
    const s = useMapStore.getState();
    const removed: string[] = [];
    for (const c of changes) {
      if (c.type === 'dimensions' && c.dimensions) s.setSize(c.id, c.dimensions);
      else if (c.type === 'position' && c.position) s.moveNode(c.id, c.position);
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

  const parentForNew = () => selectedId ?? map.nodes[0]?.id ?? null;

  const tidy = async () => {
    // A "scaletta" is always in order: just show all of it.
    if (ladderMode) return void fitView({ padding: 0.2, duration: 400 });
    setBusy(true);
    try {
      // Read fresh state: tidy() also runs right after adding concepts.
      const { map: current, sizes: measured } = useMapStore.getState();
      if (!current) return;
      // Collapsed branches keep their place and are laid out when reopened.
      const part = visiblePart(current);
      actions.applyPositions(await autoLayout(part.nodes, part.edges, measured));
      // Give React Flow a frame to render the new positions before fitting.
      setTimeout(() => void fitView({ padding: 0.2, duration: 400 }), 50);
    } finally {
      setBusy(false);
    }
  };

  const dictate = async () => {
    const command = parseVoiceCommand(await dictation.start());
    if (!command) return;
    if (command.type === 'add') actions.addChild(parentForNew(), command.label);
    else if (command.type === 'read') reader.readMap();
    else if (command.type === 'tidy') await tidy();
    else if (command.type === 'undo') mapHistory().undo();
    else if (command.type === 'redo') mapHistory().redo();
  };

  const addFromPhoto = (concepts: string[]) => {
    const parent = parentForNew();
    for (const label of concepts) actions.addChild(parent, label);
    actions.select(parent);
    setDialog(null);
    // Let React Flow measure the new nodes, then lay the map out again.
    setTimeout(() => void tidy(), 150);
  };

  const doExport = async ({ kind, paper, pages, simple, print }: ExportChoice) => {
    setBusy(true);
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
        });
      }
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const startReview = (mode: ReviewMode) => {
    setDialog(null);
    actions.select(null);
    // Full screen helps on the class whiteboard; not every WebView allows it.
    if (mode === 'interrogazione') document.documentElement.requestFullscreen?.().catch(() => {});
    review.start(readingOrder(visiblePart(map), { depthFirst: ladderMode }), mode);
  };

  const exitReview = () => {
    void reader.stop();
    review.exit();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setTimeout(() => void fitView({ padding: 0.2, duration: 400 }), 50);
  };

  const overview = () => void fitView({ padding: 0.15, duration: 500 });

  // Review: follow the current concept and read it once it is visible.
  const current = review.active ? review.steps[review.index] : undefined;
  useEffect(() => {
    if (!current) return;
    const node = useMapStore.getState().map?.nodes.find((n) => n.id === current.nodeId);
    if (!node) return;
    const size = useMapStore.getState().sizes[node.id] ?? { width: 180, height: 72 };
    void setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
      zoom: Math.max(getZoom(), 1),
      duration: 500,
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

  // Leaving the editor must not leave a half-finished review behind.
  useEffect(() => () => useReview.getState().exit(), []);

  const editing = !review.active;

  return (
    <div className={`editor${review.active ? ' is-reviewing' : ''}`}>
      <header className="topbar">
        <BigButton icon="⬅️" label="Mappe" onClick={onBack} />
        <input
          className="title-input"
          value={map.title}
          aria-label="Titolo della mappa"
          readOnly={!editing}
          onChange={(e) => actions.setTitle(e.target.value)}
        />
        {editing ? (
          <>
            <BigButton icon="↩️" label="Annulla" disabled={!canUndo} onClick={() => mapHistory().undo()} />
            <BigButton icon="↪️" label="Ripeti" disabled={!canRedo} onClick={() => mapHistory().redo()} />
          </>
        ) : (
          <BigButton icon="✖️" label="Esci" onClick={exitReview} />
        )}
      </header>

      <div className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={({ source, target }) => actions.connect(source, target)}
          onNodeDragStart={() => {
            dragging.current = true;
            beginDrag();
          }}
          onNodeDragStop={() => {
            endDrag();
            dragging.current = false;
            setDragTick((t) => t + 1); // a dropped concept may have changed place in the list
          }}
          onPaneClick={() => actions.select(null)}
          onNodeClick={(_, node) => {
            if (review.mode !== 'interrogazione' || !review.active) return;
            const i = review.order[node.id];
            if (i !== undefined) review.goTo(i);
          }}
          onEdgeClick={(_, edge) => editing && setDialog({ kind: 'link', edgeId: edge.id })}
          nodesDraggable={editing}
          nodesConnectable={editing}
          elementsSelectable={editing}
          deleteKeyCode={editing ? ['Backspace', 'Delete'] : null}
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {review.active && review.mode === 'interrogazione' && current && (
        <p className="present-caption" aria-live="polite">
          {current.text}
        </p>
      )}
      {review.active ? (
        <ReviewBar onRepeat={() => current && void reader.readSteps([current])} onOverview={overview} onExit={exitReview} />
      ) : (
        <nav className="toolbar" aria-label="Strumenti">
          <BigButton icon="➕" label="Concetto" variant="primary" onClick={() => actions.addChild(parentForNew())} />
          <BigButton icon="🎤" label="Detta" onClick={dictate} disabled={dictation.listening} />
          {reader.active ? (
            <BigButton icon="⏹️" label="Stop" onClick={() => void reader.stop()} />
          ) : (
            <BigButton icon="🔊" label="Leggi" onClick={reader.readMap} />
          )}
          <BigButton icon="📷" label="Dal libro" onClick={() => setDialog({ kind: 'photo' })} />
          <BigButton icon="🖼️" label="Immagine" onClick={() => setDialog({ kind: 'style' })} disabled={!selectedNode} />
          {!ladderMode && <BigButton icon="✨" label="Riordina" onClick={tidy} disabled={busy} />}
          <BigButton icon="🧠" label="Ripassa" onClick={() => setDialog({ kind: 'review' })} />
          <BigButton icon="🗑️" label="Elimina" variant="danger" onClick={() => selectedId && actions.removeNodes([selectedId])} disabled={!selectedId} />
          <BigButton icon="💾" label="Salva" onClick={() => setDialog({ kind: 'export' })} />
          <BigButton icon="🎨" label="Aspetto" onClick={onOpenSettings} />
        </nav>
      )}

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
      {dialog?.kind === 'export' && <ExportDialog busy={busy} onExport={doExport} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'photo' && <PhotoTextDialog onAdd={addFromPhoto} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'review' && <ReviewStartDialog onStart={startReview} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ReviewStartDialog({ onStart, onClose }: { onStart(mode: ReviewMode): void; onClose(): void }) {
  return (
    <Dialog title="Ripassa" onClose={onClose} className="review-start">
      <button type="button" className="review-option" onClick={() => onStart('passo')}>
        <span className="template-icon" aria-hidden>
          👣
        </span>
        <span className="template-name">Un passo alla volta</span>
        <span className="template-desc">La mappa appare un concetto alla volta, letto ad alta voce.</span>
      </button>
      <button type="button" className="review-option" onClick={() => onStart('quiz')}>
        <span className="template-icon" aria-hidden>
          🙈
        </span>
        <span className="template-name">Indovina</span>
        <span className="template-desc">Il concetto è nascosto: prova a ricordarlo, poi premi «Scopri».</span>
      </button>
      <button type="button" className="review-option" onClick={() => onStart('interrogazione')}>
        <span className="template-icon" aria-hidden>
          🙋
        </span>
        <span className="template-name">Interrogazione</span>
        <span className="template-desc">
          Tutta la mappa davanti a te, a schermo intero: spiega un concetto alla volta e vai avanti con le frecce.
        </span>
      </button>
      <div className="dialog-actions">
        <BigButton icon="✖️" label="Annulla" onClick={onClose} />
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
