import { SkeletonHeader, SkeletonKpiGrid } from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4 h-20 animate-pulse" />
        <SkeletonKpiGrid count={3} />
      </main>
    </>
  );
}
