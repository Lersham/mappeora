import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { useReadAloud } from '../../hooks/useReadAloud';
import { Mascot } from '../../components/Mascot';

const SEEN_KEY = 'mappeora-welcome';

/** True until the welcome has been closed once on this device. */
export function welcomeNeeded(): boolean {
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'visto');
  } catch {
    // Private mode: the welcome simply shows again next time.
  }
}

interface Page {
  icon: ReactNode;
  title: string;
  text: string;
  /** Shows «Provalo adesso», which opens «Dal libro» on a new map. */
  tryBook?: boolean;
}

const PAGES: Page[] = [
  {
    icon: <Mascot pose="mappa" className="welcome-mascot" />,
    title: 'Benvenuto in MappAmi',
    text: 'Qui costruisci da solo le tue mappe per studiare. Scrivi o detta i concetti, collegali tra loro, e la mappa si mette in ordine su un foglio.',
  },
  {
    icon: '📷',
    title: 'Dal libro alla mappa',
    text: 'Fotografa una pagina del libro: MappAmi legge il testo per te. Poi passi il dito sulle parole importanti, come un evidenziatore, e diventano la tua mappa.',
    tryBook: true,
  },
  {
    icon: '🎤',
    title: 'Scrivi o detta',
    text: 'Con «Concetto» aggiungi un riquadro. Con «Detta» parli e MappAmi scrive per te. Tocca un riquadro per sceglierlo: toccalo ancora per cambiare immagine e colore, tienilo premuto per cambiare il nome.',
  },
  {
    icon: '🔊',
    title: 'Ascolta la mappa',
    text: 'Con «Leggi» MappAmi legge la mappa ad alta voce e colora la parola che sta dicendo. Tocca un concetto e premi l’altoparlante per sentire solo quello.',
  },
  {
    icon: '🧠',
    title: 'Ripassa e personalizza',
    text: 'Con «Ripassa» la mappa appare un concetto alla volta, oppure si nasconde e tu provi a ricordare. Con «Aspetto» scegli il carattere, i colori e la voce che ti piacciono.',
  },
];

interface Props {
  onClose(): void;
  onExamples(): void;
  /** Makes a new map and opens «Dal libro» on it. */
  onTryBook(): void;
}

/** A few pages that show what the app does: on first launch and from «Come funziona». */
export function WelcomeDialog({ onClose, onExamples, onTryBook }: Props) {
  const [index, setIndex] = useState(0);
  const { readText, stop } = useReadAloud();
  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  const close = (then?: () => void) => {
    void stop();
    markSeen();
    onClose();
    then?.();
  };
  const go = (to: number) => {
    void stop();
    setIndex(to);
  };

  // The button that had the focus can disappear («Indietro» on the first
  // page) and the focus would fall to the page: it goes to the main button,
  // which is always there. Opening the dialog is left to the dialog itself.
  const actions = useRef<HTMLDivElement>(null);
  const shown = useRef(index);
  useLayoutEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    const at = document.activeElement;
    if (at && at !== document.body && actions.current?.closest('[role="dialog"]')?.contains(at)) return;
    actions.current?.querySelector<HTMLElement>('.big-button.primary')?.focus({ preventScroll: true });
  }, [index]);

  return (
    <Dialog title="Come funziona" onClose={() => close()} className="welcome">
      <div className="welcome-page" aria-live="polite">
        <div className="welcome-icon" aria-hidden>
          {page.icon}
        </div>
        <h3 className="welcome-title">{page.title}</h3>
        <p className="welcome-text">{page.text}</p>
        <div className="welcome-tools">
          <BigButton icon="speak" label="Ascolta" onClick={() => void readText(`${page.title}. ${page.text}`)} />
          {page.tryBook && <BigButton icon="camera" label="Provalo adesso" variant="primary" onClick={() => close(onTryBook)} />}
        </div>
      </div>
      <p className="welcome-dots">
        <span className="sr-only">
          Pagina {index + 1} di {PAGES.length}
        </span>
        {PAGES.map((p, i) => (
          <span key={p.title} className={i === index ? 'current' : ''} aria-hidden>
            ●
          </span>
        ))}
      </p>
      <div className="dialog-actions" ref={actions}>
        {!last && <BigButton key="skip" icon="skip" label="Salta" onClick={() => close()} />}
        {index > 0 && <BigButton key="back" icon="back" label="Indietro" onClick={() => go(index - 1)} />}
        {last && <BigButton key="examples" icon="book" label="Guarda un esempio" onClick={() => close(onExamples)} />}
        {/* One button for «Avanti» and «Inizia»: the focus stays on it from page to page. */}
        <BigButton
          key="next"
          icon={last ? 'check' : 'forward'}
          label={last ? 'Inizia' : 'Avanti'}
          variant="primary"
          onClick={() => (last ? close() : go(index + 1))}
        />
      </div>
    </Dialog>
  );
}
