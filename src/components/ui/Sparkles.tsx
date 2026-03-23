import { useEffect, useRef } from "react";

export function Sparkles({ count = 18, color = "#f472b6", size = 2, style = {} }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sparkles = Array.from(el.children) as HTMLDivElement[];
    sparkles.forEach((sparkle, i) => {
      const delay = Math.random() * 2;
      sparkle.animate([
        { opacity: 0, transform: `scale(0.7) translateY(0px)` },
        { opacity: 1, transform: `scale(1.1) translateY(-8px)` },
        { opacity: 0, transform: `scale(0.7) translateY(0px)` },
      ], {
        duration: 1800 + Math.random() * 1200,
        delay: delay * 1000,
        iterations: Infinity,
        easing: "ease-in-out",
      });
    });
  }, [count]);
  return (
    <div ref={ref} style={{ pointerEvents: "none", position: "absolute", inset: 0, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            opacity: 0.7,
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </div>
  );
}
