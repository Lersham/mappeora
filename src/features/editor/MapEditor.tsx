import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
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
import { reviewVisibility, useReview } from '../../store/reviewStore';
import { ConceptNode, type ConceptFlowNode } from './ConceptNode';
import { NodeStyleDialog } from './NodeStyleDialog';
import { LinkWordDialog } from './LinkWordDialog';
import { ExportDialog } from './ExportDialog';
import { ReviewBar } from './ReviewBar';
import { BigButton } from '../../components/BigButton';
import { Dialog } from '../../components/Dialog';
import { DictationOverlay } from '../../components/DictationOverlay';
import { useReadAloud } from '../../hooks/useReadAloud';
import { useDictation } from '../../hooks/useDictation';
import { autoLayout } from '../../services/layout';
import { exportMap, type ExportFormat } from '../../services/export';
import { readingOrder } from '../../lib/readingOrder';
import { templateInfo } from '../../lib/templates';
import { parseVoiceCommand } from '../../lib/voiceCommands';

const nodeTypes = { concept: ConceptNode };

type DialogState = { kind: 'style' } | { kind: 'link'; edgeId: string } | { kind: 'export' } | { kind: 'review' } | null;

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
  const horizontal = templateInfo(map.template).direction === 'RIGHT';
  const selectedNode = map.nodes.find((n) => n.id === selectedId);

  // The store holds our document model; React Flow nodes are derived from it.
  const nodes = useMemo<ConceptFlowNode[]>(
    () =>
      map.nodes.map((n) => ({
        id: n.id,
        type: 'concept',
        position: n.position,
        selected: !review.active && n.id === selectedId,
        hidden: reviewVisibility(review, n.id) === 'hidden',
        measured: sizes[n.id],
        data: { label: n.label, color: n.color, shape: n.shape, image: n.image, horizontal },
      })),
    [map.nodes, selectedId, sizes, review, horizontal],
  );
  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 6,
        interactionWidth: 32, // easier to tap with a finger
        className: 'concept-edge',
      })),
    [map.edges],
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
    setBusy(true);
    try {
      actions.applyPositions(await autoLayout(map.nodes, map.edges, sizes, horizontal ? 'RIGHT' : 'DOWN'));
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

  const doExport = async (format: ExportFormat, simple: boolean) => {
    setBusy(true);
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
      await exportMap(getNodes(), bg, {
        format,
        simple,
        title: map.title,
        usesPictograms: map.nodes.some((n) => n.image?.kind === 'arasaac'),
      });
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const startReview = (quiz: boolean) => {
    setDialog(null);
    actions.select(null);
    review.start(readingOrder(map), quiz);
  };

  const exitReview = () => {
    void reader.stop();
    review.exit();
    setTimeout(() => void fitView({ padding: 0.2, duration: 400 }), 50);
  };

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
    if (review.revealed) void reader.readSteps([current]);
    else void reader.readText('Che cosa c’è qui?');
  }, [current, review.revealed]);

  // Leaving the editor must not leave a half-finished review behind.
  useEffect(() => () => useReview.getState().exit(), []);

  const editing = !review.active;

  return (
    <div className="editor">
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={({ source, target }) => actions.connect(source, target)}
          onNodeDragStart={beginDrag}
          onNodeDragStop={endDrag}
          onPaneClick={() => actions.select(null)}
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

      {review.active ? (
        <ReviewBar onRepeat={() => current && void reader.readSteps([current])} onExit={exitReview} />
      ) : (
        <nav className="toolbar" aria-label="Strumenti">
          <BigButton icon="➕" label="Concetto" variant="primary" onClick={() => actions.addChild(parentForNew())} />
          <BigButton icon="🎤" label="Detta" onClick={dictate} disabled={dictation.listening} />
          {reader.active ? (
            <BigButton icon="⏹️" label="Stop" onClick={() => void reader.stop()} />
          ) : (
            <BigButton icon="🔊" label="Leggi" onClick={reader.readMap} />
          )}
          <BigButton icon="🖼️" label="Immagine" onClick={() => setDialog({ kind: 'style' })} disabled={!selectedNode} />
          <BigButton icon="✨" label="Riordina" onClick={tidy} disabled={busy} />
          <BigButton icon="🧠" label="Ripasso" onClick={() => setDialog({ kind: 'review' })} />
          <BigButton icon="🗑️" label="Elimina" variant="danger" onClick={() => selectedId && actions.removeNodes([selectedId])} disabled={!selectedId} />
          <BigButton icon="📤" label="Esporta" onClick={() => setDialog({ kind: 'export' })} />
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
      {dialog?.kind === 'review' && <ReviewStartDialog onStart={startReview} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ReviewStartDialog({ onStart, onClose }: { onStart(quiz: boolean): void; onClose(): void }) {
  return (
    <Dialog title="Ripasso" onClose={onClose} className="review-start">
      <button type="button" className="review-option" onClick={() => onStart(false)}>
        <span className="template-icon" aria-hidden>
          👣
        </span>
        <span className="template-name">Un passo alla volta</span>
        <span className="template-desc">La mappa appare un concetto alla volta, letto ad alta voce.</span>
      </button>
      <button type="button" className="review-option" onClick={() => onStart(true)}>
        <span className="template-icon" aria-hidden>
          🙈
        </span>
        <span className="template-name">Indovina</span>
        <span className="template-desc">Il concetto è nascosto: prova a ricordarlo, poi premi «Scopri».</span>
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
