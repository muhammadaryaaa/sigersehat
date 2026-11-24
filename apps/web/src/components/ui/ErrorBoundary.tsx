import { Component, type ReactNode } from "react";
// Error handling frontend: kegagalan render tidak mengosongkan layar; tidak menampilkan detail teknis/PHI.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Halaman tidak dapat ditampilkan</h1>
        <p className="mt-2">Silakan muat ulang halaman. Bila berlanjut, coba lagi beberapa saat lagi.</p>
        <button className="mt-4 min-h-12 rounded-btn bg-brand-800 px-5 font-semibold text-white" onClick={() => location.reload()}>Muat Ulang</button>
      </main>);
    return this.props.children;
  }
}
