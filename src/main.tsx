import { Link as RadixLink } from "@radix-ui/themes";
import { Link } from "react-router";

export function Main() {
  return (
    <>
      <h1>Hello Dear Singer!</h1>
      <RadixLink asChild>
        <Link to={"/about"}>About</Link>
      </RadixLink>
    </>
  );
}
