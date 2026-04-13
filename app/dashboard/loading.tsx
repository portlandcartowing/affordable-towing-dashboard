import {
  SkeletonHeader,
  SkeletonKpiGrid,
  SkeletonTable,
} from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="flex-1 p-4 md:p-8 space-y-10">
        <section>
          <div className="h-4 w-20 bg-slate-200/70 rounded-md animate-pulse mb-4" />
          <SkeletonKpiGrid count={6} />
        </section>
        <section>
          <div className="h-4 w-24 bg-slate-200/70 rounded-md animate-pulse mb-4" />
          <SkeletonKpiGrid count={3} />
        </section>
        <SkeletonTable rows={5} />
      </main>
    </>
  );
}
