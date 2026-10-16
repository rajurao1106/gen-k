import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071a2a] px-6 text-center text-white">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="max-w-lg text-slate-200">
        This Gen-K page does not exist. Return home to explore our astrology
        tools.
      </p>
      <Link className="text-amber-300 underline" href="/">
        Go to Gen-K home
      </Link>
    </main>
  );
}
