import { Link as RadixLink } from "@radix-ui/themes";
import { Fragment, type PropsWithChildren } from "react";
import { Link, useLocation } from "react-router";

export function Layout({ children }: PropsWithChildren) {
  const location = useLocation();
  return (
    <div className="fixed left-0 top-0 w-full h-full flex flex-col justify-start items-center">
      <div className="flex flex-row items-center gap-2 p-6">
        {["Home", ...location.pathname.split("/").filter((e) => e)].map(
          (n, i, l) => (
            <Fragment key={`${n}-${i}`}>
              <RadixLink asChild>
                <Link to={i === 0 ? "/" : `/${n}`}>{n}</Link>
              </RadixLink>
              {i < l.length - 1 && "»"}
            </Fragment>
          )
        )}
      </div>
      <div className="flex-1 w-full min-h-0">{children}</div>
    </div>
  );
}
