import { useCallback, useMemo, useState } from 'react';
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
import '@xyflow/react/dist/style.css';
import { beginDrag, endDrag, mapHistory, useMapStore } from '../../store/mapStore';
import { useStore } from 'zustand';
import { ConceptNode, type ConceptFlowNode } from './ConceptNode';
import { BigButton } from '../../components/BigButton';
import { DictationOverlay } from '../../components/DictationOverlay';
import { useReadAloud } from '../../hooks/useReadAloud';
import { useDictation } from '../../hooks/useDictation';
import { autoLayout } from '../../services/layout';
import { renderMapPng, shareImage } from '../../services/export';

const nodeTypes = { concept: ConceptNode };

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
  const { fitView, getNodes } = useReactFlow();
  const reader = useReadAloud();
  const dictation = useDictation();
  const [busy, setBusy] = useState(false);

  // The store holds our document model; React Flow nodes are derived from it.
  const nodes = useMemo<ConceptFlowNode[]>(
    () =>
      map.nodes.map((n) => ({
        id: n.id,
        type: 'concept',
        position: n.position,
        selected: n.id === selectedId,
        measured: sizes[n.id],
        data: { label: n.label, color: n.color, shape: n.shape, image: n.image },
      })),
    [map.nodes, selectedId, sizes],
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

  const addConcept = () => {
    actions.addChild(selectedId ?? map.nodes[0]?.id ?? null);
  };

  const dictate = async () => {
    const text = await dictation.start();
    if (text) actions.addChild(selectedId ?? map.nodes[0]?.id ?? null, text);
  };

  const tidy = async () => {
    setBusy(true);
    try {
      actions.applyPositions(await autoLayout(map.nodes, map.edges, sizes));
      // Give React Flow a frame to render the new positions before fitting.
      setTimeout(() => void fitView({ padding: 0.2, duration: 400 }), 50);
    } finally {
      setBusy(false);
    }
  };

  const exportPng = async () => {
    setBusy(true);
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
      await shareImage(await renderMapPng(getNodes(), bg), map.title);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (selectedId) actions.removeNodes([selectedId]);
  };

  return (
    <div className="editor">
      <header className="topbar">
        <BigButton icon="⬅️" label="Mappe" onClick={onBack} />
        <input
          className="title-input"
          value={map.title}
          aria-label="Titolo della mappa"
          onChange={(e) => actions.setTitle(e.target.value)}
        />
        <BigButton icon="↩️" label="Annulla" disabled={!canUndo} onClick={() => mapHistory().undo()} />
        <BigButton icon="↪️" label="Ripeti" disabled={!canRedo} onClick={() => mapHistory().redo()} />
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
          onEdgeDoubleClick={(_, edge) => {
            const label = window.prompt('Parola di collegamento (es. "è formato da")', String(edge.label ?? ''));
            if (label !== null) actions.updateEdge(edge.id, { label: label.trim() || undefined });
          }}
          deleteKeyCode={['Backspace', 'Delete']}
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

      <nav className="toolbar" aria-label="Strumenti">
        <BigButton icon="➕" label="Concetto" variant="primary" onClick={addConcept} />
        <BigButton icon="🎤" label="Detta" onClick={dictate} disabled={dictation.listening} />
        {reader.active ? (
          <BigButton icon="⏹️" label="Stop" onClick={() => void reader.stop()} />
        ) : (
          <BigButton icon="🔊" label="Leggi" onClick={reader.readMap} />
        )}
        <BigButton icon="✨" label="Riordina" onClick={tidy} disabled={busy} />
        <BigButton icon="🗑️" label="Elimina" variant="danger" onClick={remove} disabled={!selectedId} />
        <BigButton icon="📤" label="Esporta" onClick={exportPng} disabled={busy} />
        <BigButton icon="🎨" label="Aspetto" onClick={onOpenSettings} />
      </nav>

      <DictationOverlay
        listening={dictation.listening}
        partial={dictation.partial}
        error={dictation.error}
        onStop={() => void dictation.stop()}
        onClose={dictation.clearError}
      />
    </div>
  );
}

export function MapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
