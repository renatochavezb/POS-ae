"use client";

import Image from "next/image";

type StudioLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: 32,
  md: 56,
  lg: 160,
};

export default function StudioLogo({
  size = "md",
  showWordmark = false,
  className = "",
}: StudioLogoProps) {
  const px = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <Image
        src="/branding/studio-ae-logo.png"
        alt="aé STUDIO"
        width={px}
        height={px}
        className="shrink-0 rounded-sm object-contain"
        priority={size === "lg"}
      />
      {showWordmark && (
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-primary leading-tight tracking-tight">
            studio aé
          </p>
        </div>
      )}
    </div>
  );
}
