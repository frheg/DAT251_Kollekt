import { useEffect } from "react";

export function Confetti({ trigger }: { trigger: boolean }) {
  useEffect(() => {
    if (!trigger) return;
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.7 },
        zIndex: 9999,
      });
    });
  }, [trigger]);
  return null;
}
