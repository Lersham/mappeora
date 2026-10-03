import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MapNode } from '../../types/map';
import { useMapStore } from '../../store/mapStore';
import { useReading } from '../../store/readingStore';
import { useReadAloud } from '../../hooks/useReadAloud';
import { reviewVisibility, useReview } from '../../store/reviewStore';
import { pictogramUrl } from '../../services/pictograms';

export type ConceptNodeData = Pick<MapNode, 'label' | 'color' | 'shape' | 'image'> & {
  /** Timelines flow left → right, everything else top → bottom. */
  horizontal?: boolean;
};
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

function NodeImageView({ image }: { image: NonNullable<ConceptNodeData['image']> }) {
  if (image.kind === 'emoji') {
    return (
      <span className="concept-emoji" aria-hidden>
        {image.ref}
      </span>
    );
  }
  if (image.kind === 'arasaac') {
    return <img className="concept-picto" src={pictogramUrl(image.ref)} alt="" crossOrigin="anonymous" draggable={false} />;
  }
  return null;
}

function ConceptNodeView({ id, data, selected }: NodeProps<ConceptFlowNode>) {
  const updateNode = useMapStore((s) => s.updateNode);
  const isReading = useReading((s) => s.nodeId === id);
  const visibility = useReview((s) => reviewVisibility(s, id));
  const reviewing = useReview((s) => s.active);
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
      className={`concept-node shape-${data.shape ?? 'rettangolo'}${selected ? ' is-selected' : ''}${isReading ? ' is-reading' : ''} review-${visibility}`}
      style={{ background: data.color }}
      onDoubleClick={() => {
        if (reviewing) return;
        setDraft(data.label);
        setEditing(true);
      }}
    >
      <Handle type="target" position={data.horizontal ? Position.Left : Position.Top} />
      {visibility === 'mystery' ? (
        <span className="concept-mystery" aria-label="Concetto nascosto">
          ?
        </span>
      ) : (
        <>
          {data.image && <NodeImageView image={data.image} />}
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
        </>
      )}
      <Handle type="source" position={data.horizontal ? Position.Right : Position.Bottom} />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeView);
