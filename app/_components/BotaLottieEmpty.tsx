"use client";

import Lottie from "lottie-react";
import botaSymbol from "@/public/assets/animations/bota-symbol.json";

interface BotaLottieEmptyProps {
  size?: number;
}

export default function BotaLottieEmpty({ size = 80 }: BotaLottieEmptyProps) {
  return (
    <Lottie
      animationData={botaSymbol}
      loop
      autoplay
      style={{ width: size, height: size, margin: "0 auto" }}
    />
  );
}
