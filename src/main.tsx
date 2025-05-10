import { Link } from "react-router";

export function Main() {
  return (
    <>
      <h1>Hello Dear Singer!</h1>
      <Link to={"/about"}>About</Link>
    </>
  );
}
