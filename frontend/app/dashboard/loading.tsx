// frontend/app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-[#1e1e2e] rounded-xl p-5 bg-[#12121a] animate-pulse">
          <div className="h-4 bg-[#1e1e2e] rounded w-48 mb-3" />
          <div className="h-3 bg-[#1e1e2e] rounded w-72 mb-2" />
          <div className="h-3 bg-[#1e1e2e] rounded w-32" />
        </div>
      ))}
    </div>
  );
}
