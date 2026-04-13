import {
  SkeletonHeader,
  SkeletonKpiGrid,
  SkeletonTable,
} from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <SkeletonKpiGrid count={4} />
        <SkeletonTable rows={6} />
      </main>
    </>
  );
}
