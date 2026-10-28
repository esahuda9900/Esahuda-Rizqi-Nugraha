import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="center-state" role="alert"><p className="eyebrow">SDLG WARRANTY</p><h1>Halaman belum bisa ditampilkan.</h1><p>Muat ulang workspace untuk mencoba lagi.</p><a className="btn-link" href={import.meta.env.BASE_URL}>Buka ulang workspace</a></main>;
    return this.props.children;
  }
}
