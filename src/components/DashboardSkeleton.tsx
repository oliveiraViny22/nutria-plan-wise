import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Quick Actions Bar Skeleton */}
      <div className="sticky top-[65px] z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-3 glass border-b border-border/30">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* Metabolic Metrics Skeleton - Collapsible style */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-elevated rounded-xl p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-24 mb-1.5" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Cards Skeleton - Calorie & Macros */}
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
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
            <Skeleton className="h-5 w-28" />
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

      {/* Daily Log CTA Skeleton */}
      <div className="card-elevated rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Gamification Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Adherence Streak */}
        <div className="card-elevated rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center justify-center gap-1 py-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="card-elevated rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex items-end justify-between gap-2 h-24 px-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${Math.random() * 60 + 30}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 px-2">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, i) => (
              <Skeleton key={i} className="h-3 w-4" />
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>

      {/* Meals Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-elevated rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="text-center py-6 space-y-3">
        <Skeleton className="h-4 w-36 mx-auto" />
        <Skeleton className="h-3 w-72 mx-auto" />
      </div>
    </div>
  );
}
