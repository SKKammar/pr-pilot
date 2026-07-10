"use client";
import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(undefined);

  useEffect(() => {
    if (value === 0) return;
    const start = Date.now();
    const duration = 1000;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  return <span>{display}</span>;
}
