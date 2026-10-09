import * as React from "react";
import { createRoot } from "react-dom/client";
import TigerTearReveal from "./tiger-tear-reveal";

const ANIMATION_DURATION = 4800;
const FINAL_PAUSE = 650;

function Intro() {
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    let animationFrame = 0;
    let hideTimeout = 0;
    let startedAt: number | null = null;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 900
      : ANIMATION_DURATION;

    const animate = (now: number) => {
      startedAt ??= now;
      const nextProgress = Math.min(1, (now - startedAt) / duration);
      setProgress(nextProgress);
      if (nextProgress === 1) {
        hideTimeout = window.setTimeout(() => setVisible(false), FINAL_PAUSE);
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(hideTimeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="intro-overlay">
      <TigerTearReveal
        word="NISD"
        tagline="DASHBOARD DO TRELLO"
        progress={progress}
        height="100svh"
        scrollDistance="0px"
        hint={false}
        className="intro-stage"
      />
      <button
        className="intro-skip"
        type="button"
        onClick={() => setVisible(false)}
      >
        Pular introdução
      </button>
    </div>
  );
}

const root = document.getElementById("intro-root");
if (root) createRoot(root).render(<Intro />);
