import { useEffect, useRef } from "react";

// Gerak antarmuka (revisi putaran 2). Prinsip: konten selalu terlihat tanpa JS;
// kelas awal .rv dipasang dari sini tepat sebelum pengamatan dimulai.
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pasang reveal-saat-scroll pada semua elemen [data-reveal] di dalam root. Sekali tampil, tidak diulang. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (reduced() || !("IntersectionObserver" in window)) return; // konten tetap terlihat
    els.forEach((el) => el.classList.add("rv"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement;
          el.style.transitionDelay = `${Math.min(Number(el.dataset.revealDelay ?? 0), 240)}ms`;
          el.classList.add("rv-in");
          io.unobserve(el);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Hitung naik angka statistik saat masuk layar. Nilai akhir selalu persis sama dengan data. */
export function useCountUp<T extends HTMLElement>(target: number, decimals = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const render = (v: number) => { el.textContent = v.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
    if (reduced() || !("IntersectionObserver" in window)) { render(target); return; }
    render(0);
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(); const dur = 900;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        render(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick); else render(target);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, decimals]);
  return ref;
}
