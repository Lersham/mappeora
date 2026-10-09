import { useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { useReadAloud } from '../../hooks/useReadAloud';

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
    icon: <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="72" height="72" />,
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
    text: 'Con «Concetto» aggiungi un riquadro. Con «Detta» parli e MappAmi scrive per te. Se preferisci un elenco, apri «Scaletta» e scrivi un concetto per riga.',
  },
  {
    icon: '🔊',
    title: 'Ascolta la mappa',
    text: 'Con «Leggi» MappAmi legge la mappa ad alta voce e colora la parola che sta dicendo. Tocca un concetto e premi 🔊 per sentire solo quello.',
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

  return (
    <Dialog title="Come funziona" onClose={() => close()} className="welcome">
      <div className="welcome-page" aria-live="polite">
        <div className="welcome-icon" aria-hidden>
          {page.icon}
        </div>
        <h3 className="welcome-title">{page.title}</h3>
        <p className="welcome-text">{page.text}</p>
        <div className="welcome-tools">
          <BigButton icon="🔊" label="Ascolta" onClick={() => void readText(`${page.title}. ${page.text}`)} />
          {page.tryBook && <BigButton icon="📷" label="Provalo adesso" variant="primary" onClick={() => close(onTryBook)} />}
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
      <div className="dialog-actions">
        {!last && <BigButton icon="⏭️" label="Salta" onClick={() => close()} />}
        {index > 0 && <BigButton icon="⬅️" label="Indietro" onClick={() => go(index - 1)} />}
        {last ? (
          <>
            <BigButton icon="📚" label="Guarda un esempio" onClick={() => close(onExamples)} />
            <BigButton icon="✅" label="Inizia" variant="primary" onClick={() => close()} />
          </>
        ) : (
          <BigButton icon="➡️" label="Avanti" variant="primary" onClick={() => go(index + 1)} />
        )}
      </div>
    </Dialog>
  );
}
