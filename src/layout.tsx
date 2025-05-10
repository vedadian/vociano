import type { PropsWithChildren } from "react";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="fixed left-0 top-0 w-full h-full flex flex-col justify-center items-center">
      {children}
    </div>
  );
}
