"use client";

import Image from "next/image";

type StudioLogoProps = {
  size?: "sm" | "md" | "lg" | "xl" | "login" | "loginCompact";
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: 32,
  md: 56,
  lg: 160,
  xl: 400,
  login: 400,
  loginCompact: 192,
};

const MARK_SRC = "/branding/studio-ae-mark.png";

export default function StudioLogo({
  size = "md",
  showWordmark = false,
  className = "",
}: StudioLogoProps) {
  const px = sizeMap[size];
  const isLoginHero = size === "login";
  const isLoginCompact = size === "loginCompact";

  if (isLoginCompact) {
    return (
      <Image
        src={MARK_SRC}
        alt="aé STUDIO"
        width={460}
        height={478}
        className={`mx-auto h-auto w-32 sm:w-40 md:w-48 drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)] ${className}`}
        priority
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <Image
        src="/branding/studio-ae-logo.png"
        alt="aé STUDIO"
        width={px}
        height={px}
        className={`shrink-0 rounded-sm object-contain ${
          isLoginHero
            ? "w-[min(68vw,280px)] h-[min(68vw,280px)] sm:w-[min(360px,42vw)] sm:h-[min(360px,42vw)] md:w-[400px] md:h-[400px]"
            : ""
        }`}
        style={isLoginHero ? undefined : { width: px, height: px }}
        priority={size === "lg" || size === "login"}
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
