export function BuildInfoFooter() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  const timeRaw = process.env.NEXT_PUBLIC_BUILD_TIME;
  let time = "";
  if (timeRaw) {
    const d = new Date(timeRaw);
    if (!isNaN(d.getTime())) {
      time = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
    }
  }
  return (
    <footer className="mt-auto px-4 py-2 text-center text-xs text-zinc-600 border-t border-zinc-900">
      Build <span className="font-mono text-zinc-500">{sha}</span>
      {time && <span className="text-zinc-700"> · {time}</span>}
    </footer>
  );
}
