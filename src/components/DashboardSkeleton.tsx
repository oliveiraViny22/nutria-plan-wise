import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="space-y-3 sm:space-y-4">
        {/* Calorie & Macros Row */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {/* Calorie Card Skeleton */}
          <div className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-32 w-32 sm:h-40 sm:w-40 rounded-full" />
            <Skeleton className="h-4 w-24 mt-3" />
          </div>

          {/* Macros Card Skeleton */}
          <div className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Goals Projection + Hydration Tip Skeleton - Compact Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 card-elevated rounded-xl p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="card-elevated rounded-xl p-3 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Skeleton - Compact */}
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Meals Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-elevated rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
