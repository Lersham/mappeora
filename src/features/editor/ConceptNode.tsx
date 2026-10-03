import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MapNode } from '../../types/map';
import type { MapLayout } from '../../lib/templates';
import type { NodeRole } from '../../lib/sheetLayout';
import { LADDER } from '../../lib/ladder';
import { useMapStore } from '../../store/mapStore';
import { useReading } from '../../store/readingStore';
import { useReadAloud } from '../../hooks/useReadAloud';
import { reviewVisibility, useReview } from '../../store/reviewStore';
import { pictogramUrl } from '../../services/pictograms';
import { illustrationUrl } from '../../services/illustrations';

export type ConceptNodeData = Pick<MapNode, 'label' | 'color' | 'shape' | 'image' | 'collapsed'> & {
  layout: MapLayout;
  /** "Foglio" maps: main concept, branch, or concept inside a branch. */
  role?: NodeRole;
  hasChildren?: boolean;
  /** How many concepts this one hides while collapsed. */
  hiddenBelow?: number;
  /** Collapses/expands, keeping the concept where it is on screen. */
  onToggle?: () => void;
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
    return <img className="concept-picto" src={image.src ?? pictogramUrl(image.ref)} alt="" crossOrigin="anonymous" draggable={false} />;
  }
  if (image.kind === 'illustrazione') {
    return (
      <img className="concept-illustration" src={image.src ?? illustrationUrl(image.ref)} alt="" crossOrigin="anonymous" draggable={false} />
    );
  }
  return <img className="concept-photo" src={image.ref} alt="" draggable={false} />;
}

/**
 * "Foglio" maps: lines reach a branch from above and the concepts inside it
 * from the left; they leave the main concept from the bottom centre and
 * the others from the bottom-left (the branch's vertical line). Every node
 * has all four, the ones its role doesn't use are invisible.
 */
function SheetHandles({ role, kind }: { role: NodeRole; kind: 'source' | 'target' }) {
  const hidden = (shown: boolean) => (shown ? undefined : 'handle-hidden');
  return kind === 'target' ? (
    <>
      <Handle id="t-top" type="target" position={Position.Top} className={hidden(role === 'head')} />
      <Handle id="t-left" type="target" position={Position.Left} className={hidden(role === 'item')} />
    </>
  ) : (
    <>
      <Handle id="s-bottom" type="source" position={Position.Bottom} className={hidden(role === 'root')} />
      <Handle id="s-spine" type="source" position={Position.Bottom} style={{ left: LADDER.spine }} className={hidden(role !== 'root')} />
    </>
  );
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
      {data.layout === 'foglio' ? <SheetHandles role={data.role ?? 'item'} kind="target" /> : <Handle type="target" position={Position.Top} />}
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
      {data.hasChildren && !reviewing && (
        <button
          type="button"
          className={`concept-toggle nodrag${data.collapsed ? ' is-collapsed' : ''}`}
          aria-expanded={!data.collapsed}
          aria-label={data.collapsed ? `Mostra ${data.hiddenBelow} concetti nascosti` : 'Nascondi i concetti sotto'}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle?.();
          }}
        >
          {data.collapsed ? `+${data.hiddenBelow}` : '−'}
        </button>
      )}
      {data.layout === 'foglio' ? <SheetHandles role={data.role ?? 'item'} kind="source" /> : <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeView);
