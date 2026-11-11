import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F0E8] px-6 text-center text-[#171717]">
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
