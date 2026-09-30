import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="kicker">404</p>
      <h1 className="display mt-3 text-[2rem] text-highlight">Nothing at this address.</h1>
      <p className="mt-3 text-[14.5px] text-mist">If you followed a coin link, it may not be indexed yet. Give it a few seconds.</p>
      <Link href="/" className="btn mt-6">
        Back to the board
      </Link>
    </div>
  );
}
