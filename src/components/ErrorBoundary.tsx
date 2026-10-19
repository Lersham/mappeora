import { Component, type ReactNode } from 'react';
import { Mascot } from './Mascot';
import { CopyDetails } from './CopyDetails';
import { logError } from '../services/errorLog';

interface Props {
  children: ReactNode;
  /**
   * Back to a safe place (the list of maps) before trying again. Without it
   * (the boundary around the whole app) the only way out is a restart.
   */
  onReset?(): void | Promise<void>;
}

/** A crash shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    logError(error, 'react');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { onReset } = this.props;
    return (
      <main className="home crash">
        <Mascot pose="ops" className="crash-mascot" />
        <h1 className="home-title">Qualcosa è andato storto</h1>
        <p role="alert">
          {onReset
            ? 'Le mappe salvate sono al sicuro. Puoi tornare all’elenco e riaprirle.'
            : 'Le mappe salvate sono al sicuro. Riavvia l’app e riaprile.'}
        </p>
        <div className="crash-actions">
          {onReset && (
            <button
              type="button"
              className="big-button primary"
              onClick={() => void Promise.resolve(onReset()).then(() => this.setState({ failed: false }))}
            >
              <span className="big-button-label">Torna alle mappe</span>
            </button>
          )}
          <button type="button" className={`big-button${onReset ? '' : ' primary'}`} onClick={() => window.location.reload()}>
            <span className="big-button-label">Riavvia l’app</span>
          </button>
        </div>
        <CopyDetails />
      </main>
    );
  }
}
