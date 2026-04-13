import { SkeletonHeader, SkeletonTable } from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-slate-200/70 rounded-md animate-pulse" />
          <div className="h-9 w-28 bg-slate-200/70 rounded-lg animate-pulse" />
        </div>
        <SkeletonTable rows={8} />
      </main>
    </>
  );
}
