"use client";

import lottie from "lottie-web";
import { useEffect, useRef } from "react";

interface BotaLoaderProps {
  /** Visual size of the spinner in px. Defaults to 48. */
  size?: number;
  /** Additional class name for the outer wrapper. */
  className?: string;
  /** Inline style overrides for the outer wrapper. */
  style?: React.CSSProperties;
}

/**
 * BOTA branded Lottie loading animation.
 * Drop-in replacement for Ant Design <Spin> indicator.
 *
 * The animation canvas is 1920×1080. We render Lottie into a large
 * internal container (RENDER_SIZE × RENDER_SIZE) with "slice" aspect
 * ratio so the centred BOTA symbol fills the box, then CSS-scale the
 * whole thing down to the desired `size` so it stays sharp.
 */

// Size at which lottie renders internally — large enough that the
// BOTA symbol is visible; the outer wrapper clips & scales it down.
const RENDER_SIZE = 240;

export function BotaLoader({ size = 48, className, style }: BotaLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "/bota-loader.json",
      rendererSettings: {
        // "slice" fills RENDER_SIZE × RENDER_SIZE by height and clips
        // the excess horizontal canvas — keeps the centred symbol visible.
        preserveAspectRatio: "xMidYMid slice",
      },
    });

    return () => anim.destroy();
  }, []);

  const scale = size / RENDER_SIZE;

  return (
    // Outer clip-box presented to the layout
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Inner rendering canvas — larger for fidelity, scaled down via CSS */}
      <div
        ref={containerRef}
        style={{
          width: RENDER_SIZE,
          height: RENDER_SIZE,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </span>
  );
}

