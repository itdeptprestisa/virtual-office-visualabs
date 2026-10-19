// Penangkap error untuk bagian yang dimuat lazy (mode 3D): gagal unduh (mis. file lama hilang setelah deploy ulang)
// tidak boleh membuat seluruh halaman putih.
import { Component, type ReactNode } from "react";

interface Props {
  onError: (e: unknown) => void;
  fallback: ReactNode;
  children: ReactNode;
}

export class LazyBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
