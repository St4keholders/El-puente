"use client";

import React, { useEffect, useRef, useState } from "react";

export type GlassVariant =
  | "bar"
  | "panel"
  | "sheet"
  | "pill"
  | "button"
  | "menu"
  | "card";

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  children: React.ReactNode;
  as?: React.ElementType;
  interactive?: boolean;
  withRefraction?: boolean;
  className?: string;
}

export const Glass: React.FC<GlassProps> = ({
  variant = "panel",
  children,
  as: Component = "div",
  interactive = false,
  withRefraction = true,
  className = "",
  style,
  ...props
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [isChromium, setIsChromium] = useState(false);

  useEffect(() => {
    // Detect Chromium safely per spec: navigator.userAgentData?.brands
    const uaData = (navigator as any).userAgentData;
    const isChromeLike = uaData?.brands
      ? uaData.brands.some((b: any) =>
          ["Chromium", "Google Chrome", "Microsoft Edge", "Brave", "Arc"].includes(b.brand)
        )
      : /Chrome|Chromium|Edg/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent);

    setIsChromium(!!isChromeLike);

    if (withRefraction && isChromeLike && typeof window !== "undefined") {
      const id = "glass-filter-" + Math.random().toString(36).substring(2, 9);
      setFilterId(id);
    }
  }, [withRefraction]);

  // Pointer hover glow on desktop
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!ref.current || e.pointerType === "touch") return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
  };

  const variantStyles: Record<GlassVariant, string> = {
    bar: "rounded-2xl px-5 py-3",
    panel: "rounded-3xl p-6",
    sheet: "rounded-t-3xl p-6",
    pill: "rounded-full px-4 py-2",
    button: "rounded-xl px-4 py-2.5 transition-transform active:scale-[0.97] cursor-pointer",
    menu: "rounded-2xl p-2",
    card: "rounded-2xl p-4",
  };

  return (
    <Component
      ref={ref}
      onPointerMove={interactive ? handlePointerMove : undefined}
      className={`glass-container relative overflow-hidden backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] ${variantStyles[variant]} ${className}`}
      style={{
        backgroundColor: "var(--glass-tint)",
        boxShadow: "var(--glass-shadow)",
        border: "1px solid var(--glass-edge)",
        transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
        ...style,
      }}
      {...props}
    >
      {/* Specular rim light */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: "inset 0 1px 0 var(--glass-highlight)",
          background:
            "linear-gradient(180deg, var(--glass-rim-top) 0%, transparent 40%, var(--glass-rim-bottom) 100%)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
        aria-hidden="true"
      />

      {/* Subtle cursor follower glow */}
      {interactive && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
          style={{
            background:
              "radial-gradient(160px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.12), transparent 80%)",
          }}
          aria-hidden="true"
        />
      )}

      {children}
    </Component>
  );
};
