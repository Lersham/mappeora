import { Component, type ReactNode } from 'react';
import { Mascot } from './Mascot';

interface Props {
  children: ReactNode;
  /** Back to a safe place (the list of maps) before trying again. */
  onReset(): void | Promise<void>;
}

/** A crash shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="home crash" role="alert">
        <Mascot pose="ops" className="crash-mascot" />
        <h1 className="home-title">Qualcosa è andato storto</h1>
        <p>Le mappe salvate sono al sicuro. Puoi tornare all’elenco e riaprirle.</p>
        <div className="crash-actions">
          <button
            type="button"
            className="big-button primary"
            onClick={() => void Promise.resolve(this.props.onReset()).then(() => this.setState({ failed: false }))}
          >
            <span className="big-button-label">Torna alle mappe</span>
          </button>
          <button type="button" className="big-button" onClick={() => window.location.reload()}>
            <span className="big-button-label">Riavvia l’app</span>
          </button>
        </div>
      </main>
    );
  }
}
