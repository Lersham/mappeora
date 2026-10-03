import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MapNode } from '../../types/map';
import { useMapStore } from '../../store/mapStore';
import { useReading } from '../../store/readingStore';
import { useReadAloud } from '../../hooks/useReadAloud';

export type ConceptNodeData = Pick<MapNode, 'label' | 'color' | 'shape' | 'image'>;
export type ConceptFlowNode = Node<ConceptNodeData, 'concept'>;

/** Splits the label so the word being spoken can be highlighted ("karaoke"). */
function HighlightedLabel({ id, label }: { id: string; label: string }) {
  const word = useReading((s) => (s.nodeId === id ? s.word : null));
  const offset = useReading((s) => (s.nodeId === id ? s.offset : 0));
  if (!word || word.start < offset) return <>{label}</>;
  const start = word.start - offset;
  const end = word.end - offset;
  return (
    <>
      {label.slice(0, start)}
      <mark className="spoken-word">{label.slice(start, end)}</mark>
      {label.slice(end)}
    </>
  );
}

function ConceptNodeView({ id, data, selected }: NodeProps<ConceptFlowNode>) {
  const updateNode = useMapStore((s) => s.updateNode);
  const isReading = useReading((s) => s.nodeId === id);
  const { readNode } = useReadAloud();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const label = draft.trim();
    if (label && label !== data.label) updateNode(id, { label });
    setEditing(false);
  };

  return (
    <div
      className={`concept-node shape-${data.shape ?? 'rettangolo'}${selected ? ' is-selected' : ''}${isReading ? ' is-reading' : ''}`}
      style={{ background: data.color }}
      onDoubleClick={() => {
        setDraft(data.label);
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Top} />
      {data.image?.kind === 'emoji' && (
        <span className="concept-emoji" aria-hidden>
          {data.image.ref}
        </span>
      )}
      {editing ? (
        <textarea
          ref={inputRef}
          className="concept-input nodrag"
          value={draft}
          aria-label="Testo del concetto"
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="concept-label">
          <HighlightedLabel id={id} label={data.label} />
        </span>
      )}
      <button
        type="button"
        className="concept-speak nodrag"
        aria-label={`Leggi: ${data.label}`}
        onClick={(e) => {
          e.stopPropagation();
          readNode(id);
        }}
      >
        🔊
      </button>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeView);
