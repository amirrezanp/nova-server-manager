"use client";

import { IconContext } from "@/lib/icons";

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "duotone", mirrored: false }}>
      {children}
    </IconContext.Provider>
  );
}
