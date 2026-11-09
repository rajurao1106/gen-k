export default function PageLoader() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-screen place-items-center bg-[#071a2a] text-[#f9f3eb]"
    >
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-[#f2c36b]/25 border-t-[#f2c36b] motion-reduce:animate-none"
        />
        <p className="text-sm font-medium">Loading Gen-K...</p>
      </div>
    </main>
  );
}
