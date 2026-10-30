// Shown instantly in the content area while a page's server data loads, so the
// sidebar and header stay put and a click never looks frozen.
function Block({ className }: { className: string }) {
  return <div className={`bg-border/60 rounded-lg animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl px-4 py-3.5">
            <Block className="h-3 w-20" />
            <Block className="h-6 w-24 mt-2.5" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3.5">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-6">
            <Block className="h-4 w-32" />
            <Block className="h-3 w-24 mt-2" />
            <Block className="h-56 w-full mt-5" />
          </div>
        ))}
      </div>
    </>
  );
}
