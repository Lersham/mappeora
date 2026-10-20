import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, useStoreApi, type Node, type NodeProps } from '@xyflow/react';
import type { MapNode } from '../../types/map';
import type { MapLayout } from '../../lib/templates';
import type { NodeRole } from '../../lib/sheetLayout';
import { LADDER } from '../../lib/ladder';
import { beginStep, endStep, useMapStore } from '../../store/mapStore';
import { NODE_WIDTH } from '../../lib/mapFile';
import { useReading } from '../../store/readingStore';
import { readNodeAloud } from '../../hooks/useReadAloud';
import { reviewVisibility, useReview } from '../../store/reviewStore';
import { illustrationUrl } from '../../services/illustrations';
import { Icon } from '../../components/Icon';
import { BRANCH_COLORS } from './branchColor';

/** Holding a concept this long (ms), then letting go, opens it for renaming. */
const HOLD_MS = 500;
/** A finger or mouse that moves more than this (px) is dragging or panning, not holding. */
const HOLD_SLOP = 5;

/** What a concept can ask of the editor. The same object for every concept, so they don't re-render for it. */
export interface ConceptActions {
  /** Collapses/expands, keeping the concept where it is on screen. */
  toggle(id: string): void;
  /** A new concept under this one (`child`) or next to it (`sibling`), ready for typing. */
  addNear(id: string, where: 'child' | 'sibling'): void;
}

export type ConceptNodeData = Pick<MapNode, 'label' | 'color' | 'shape' | 'image' | 'collapsed' | 'width'> & {
  layout: MapLayout;
  /** "Foglio" maps: which lines the concept has (see NodeRole). */
  role?: NodeRole;
  /** "Foglio" maps: the number of the main concept's branch this concept starts. */
  branch?: number;
  /** The branch has a colour: its first concept's border takes it. */
  tinted?: boolean;
  hasChildren?: boolean;
  /** How many concepts this one hides while collapsed. */
  hiddenBelow?: number;
  actions?: ConceptActions;
};
export type ConceptFlowNode = Node<ConceptNodeData, 'concept'>;

/** Splits the label so the word being spoken can be highlighted ("karaoke"). */
function HighlightedLabel({ id, label }: { id: string; label: string }) {
  // Renamed while being read: the spoken range belongs to the old text, so no highlight.
  const word = useReading((s) => (s.nodeId === id && s.label === label ? s.word : null));
  const offset = useReading((s) => (s.nodeId === id ? s.offset : 0));
  if (!word || word.start < offset) return <>{label}</>;
  const start = word.start - offset;
  const end = word.end - offset;
  return (
    <>
      {label.slice(0, start)}
      {/* Its padding must not widen the concept: that moves the whole sheet at every word. */}
      <mark className="spoken-word" style={{ margin: '0 -2px' }}>
        {label.slice(start, end)}
      </mark>
      {label.slice(end)}
    </>
  );
}

function NodeImageView({ image }: { image: NonNullable<ConceptNodeData['image']> }) {
  // A web picture that cannot load (offline) leaves no empty box behind.
  const [failed, setFailed] = useState<string | null>(null);
  const onError = () => setFailed(image.src ?? image.ref);
  if (failed !== null && failed === (image.src ?? image.ref)) return null;
  if (image.kind === 'emoji') {
    return (
      <span className="concept-emoji" aria-hidden>
        {image.ref}
      </span>
    );
  }
  if (image.kind === 'arasaac') {
    // Symbols are no longer offered: older maps show the copy saved inside them.
    return image.src ? <img className="concept-picto" src={image.src} alt="" draggable={false} onError={onError} /> : null;
  }
  if (image.kind === 'illustrazione') {
    return (
      <img className="concept-illustration" src={image.src ?? illustrationUrl(image.ref)} alt="" crossOrigin="anonymous" draggable={false} onError={onError} />
    );
  }
  return <img className="concept-photo" src={image.ref} alt="" draggable={false} onError={onError} />;
}

/**
 * "Foglio" maps: lines reach a concept from above and leave from the bottom
 * centre. Two more, never seen: an extra line leaves from the bottom-left,
 * or from the left towards a concept higher up (from the bottom it would
 * loop behind its own box), and reaches the other concept from the left.
 */
function SheetHandles({ role, kind }: { role: NodeRole; kind: 'source' | 'target' }) {
  const hidden = (shown: boolean) => (shown ? undefined : 'handle-hidden');
  return kind === 'target' ? (
    <>
      <Handle id="t-top" type="target" position={Position.Top} className={hidden(role !== 'root')} />
      <Handle id="t-left" type="target" position={Position.Left} className="handle-hidden" />
    </>
  ) : (
    <>
      <Handle id="s-bottom" type="source" position={Position.Bottom} className={hidden(role !== 'item')} />
      <Handle id="s-spine" type="source" position={Position.Bottom} style={{ left: LADDER.spine }} className="handle-hidden" />
      <Handle id="s-left" type="source" position={Position.Left} className="handle-hidden" />
    </>
  );
}

const clampWidth = (w: number) => Math.round(Math.min(NODE_WIDTH.max, Math.max(NODE_WIDTH.min, w)));

/**
 * Drag it sideways and the concept gets wider or narrower: its words go on
 * other lines and the height follows. With the keyboard: ← and →.
 */
function WidthGrip({ id, label }: { id: string; label: string }) {
  const flow = useStoreApi();
  const drag = useRef<{ x: number; width: number; zoom: number } | null>(null);
  const setWidth = (w: number) => useMapStore.getState().updateNode(id, { width: clampWidth(w) });
  const box = (el: Element) => el.closest('.concept-node')!.getBoundingClientRect().width;
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    endStep();
  };
  // Gone mid-drag (the concept deleted, the map closed): the undo history must not stay paused.
  useEffect(() => () => end(), []);
  return (
    <button
      type="button"
      className="concept-resize nodrag nopan"
      aria-label={`Larghezza di ${label}: frecce sinistra e destra`}
      title="Trascina per allargare o stringere"
      onPointerDown={(e) => {
        if (!e.isPrimary) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const zoom = flow.getState().transform[2];
        drag.current = { x: e.clientX, width: box(e.currentTarget) / zoom, zoom };
        beginStep();
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) setWidth(d.width + (e.clientX - d.x) / d.zoom);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        const zoom = flow.getState().transform[2];
        setWidth(box(e.currentTarget) / zoom + (e.key === 'ArrowRight' ? 20 : -20));
      }}
    >
      <Icon name="resize" />
    </button>
  );
}

/** "Foglio" maps: the main concept and the first concept of each branch stand out, like headings. */
const sheetClass = (data: ConceptNodeData) =>
  data.layout !== 'foglio' ? '' : data.role === 'root' ? ' sheet-root' : data.branch === undefined ? '' : data.tinted ? ` sheet-branch branch-${data.branch % BRANCH_COLORS}` : ' sheet-branch';

function ConceptNodeView({ id, data, selected }: NodeProps<ConceptFlowNode>) {
  const updateNode = useMapStore((s) => s.updateNode);
  const isReading = useReading((s) => s.nodeId === id);
  const visibility = useReview((s) => reviewVisibility(s, id));
  const reviewing = useReview((s) => s.active);
  // The «Indovina» summary shows the whole map: no concept is the one in hand any more.
  const isReviewStep = useReview((s) => s.active && !(s.mode === 'quiz' && s.done) && s.steps[s.index]?.nodeId === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hold to rename (there is no double tap): after HOLD_MS the concept shows it is
  // ready («armed»); renaming starts when the finger is lifted, so that the keyboard
  // opens inside the gesture. What the lift sends after it (mouse events, click) is
  // swallowed: it would select the concept again and take the focus off the field.
  const hold = useRef<{ x: number; y: number; ready: boolean; timer: number } | null>(null);
  const swallow = useRef(false);
  const [armed, setArmed] = useState(false);
  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
    setArmed(false);
  };
  useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

  useEffect(() => {
    if (!editing) return;
    // A concept just added stays invisible until React Flow has measured
    // it, and an invisible field cannot take the focus: try for a few frames.
    // No scrolling: the view is moved on purpose (see reveal() in the editor).
    let frame = 0;
    let tries = 0;
    const focus = () => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      if (document.activeElement === input) return input.select();
      if (++tries < 30) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  // A concept just made opens ready for typing: no long press needed.
  const editRequested = useMapStore((s) => s.editingId === id);
  useEffect(() => {
    if (!editRequested) return;
    useMapStore.getState().startEditing(null);
    if (reviewing) return;
    setDraft(data.label);
    setEditing(true);
  }, [editRequested]);

  const commit = () => {
    const label = draft.trim();
    if (label && label !== data.label) updateNode(id, { label });
    setEditing(false);
  };

  return (
    <div
      className={`concept-node shape-${data.shape ?? 'rettangolo'}${sheetClass(data)}${selected ? ' is-selected' : ''}${isReading ? ' is-reading' : ''}${armed ? ' is-armed' : ''} review-${visibility}`}
      style={{ background: data.color, ...(data.width && { width: data.width, minWidth: 'min-content', maxWidth: 'none' }) }}
      onPointerDown={(e) => {
        swallow.current = false;
        cancelHold();
        if (reviewing || editing || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        // Holding 🔊 or «−», or the field itself, is not a request to rename.
        if (e.target instanceof Element && e.target.closest('button, textarea')) return;
        const h = { x: e.clientX, y: e.clientY, ready: false, timer: 0 };
        h.timer = window.setTimeout(() => {
          h.ready = true;
          setArmed(true);
        }, HOLD_MS);
        hold.current = h;
      }}
      onPointerMove={(e) => {
        const h = hold.current;
        if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) cancelHold();
      }}
      onPointerUp={(e) => {
        const ready = hold.current?.ready;
        cancelHold();
        if (!ready) return;
        swallow.current = true;
        const open = () => {
          useMapStore.getState().select(id);
          setDraft(data.label);
          setEditing(true);
        };
        // With a mouse, Safari drops the mouseup of a label replaced during
        // pointerup, and the map's drag then eats the next click: open after it.
        // A finger opens now, or the keyboard would not come up.
        if (e.pointerType === 'mouse') window.setTimeout(open);
        else open();
      }}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onMouseDownCapture={(e) => {
        if (swallow.current) e.preventDefault();
      }}
      onClickCapture={(e) => {
        if (!swallow.current) return;
        swallow.current = false;
        e.stopPropagation();
      }}
      // A long press on a touch screen would open the browser's own menu.
      onContextMenu={(e) => e.preventDefault()}
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
                // As in an outline: Tab goes on with a concept under this
                // one, Maiusc+Tab with one next to it.
                if (e.key === 'Tab' && data.actions) {
                  e.preventDefault();
                  commit();
                  data.actions.addNear(id, e.shiftKey ? 'sibling' : 'child');
                }
              }}
            />
          ) : (
            <span className="concept-label">
              <HighlightedLabel id={id} label={data.label} />
            </span>
          )}
          {/* Only on the concept in hand: on every one they cluttered the map. */}
          {(selected || isReviewStep) && (
            <button
              type="button"
              className="concept-speak nodrag"
              aria-label={`Leggi: ${data.label}`}
              onClick={(e) => {
                e.stopPropagation();
                readNodeAloud(id);
              }}
            >
              <Icon name="speak" />
            </button>
          )}
        </>
      )}
      {selected && !reviewing && !editing && <WidthGrip id={id} label={data.label} />}
      {data.hasChildren && !reviewing && (
        <button
          type="button"
          className={`concept-toggle nodrag${data.collapsed ? ' is-collapsed' : ''}`}
          aria-expanded={!data.collapsed}
          aria-label={data.collapsed ? `Mostra ${data.hiddenBelow} concetti nascosti` : 'Nascondi i concetti sotto'}
          onClick={(e) => {
            e.stopPropagation();
            data.actions?.toggle(id);
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
