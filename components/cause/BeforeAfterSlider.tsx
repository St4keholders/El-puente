"use client";

import React, { useState, useRef, useCallback } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt = "Antes",
  afterAlt = "Después",
  className = "",
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      className={`relative overflow-hidden select-none cursor-ew-resize rounded-3xl ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* After image (base full) */}
      <img
        src={afterUrl}
        alt={afterAlt}
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
      />

      {/* Before image (clipped overlay) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img
          src={beforeUrl}
          alt={beforeAlt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Slider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl pointer-events-none transition-transform"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-black shadow-xl flex items-center justify-center font-bold text-xs">
          ↔
        </div>
      </div>

      {/* Badges */}
      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider pointer-events-none uppercase">
        {beforeAlt}
      </span>
      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-emerald-600/80 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider pointer-events-none uppercase">
        {afterAlt}
      </span>
    </div>
  );
}
