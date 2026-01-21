export default function CourseLoading() {
  return (
    <div className="container mx-auto p-6 animate-in fade-in duration-200">
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 animate-pulse"></div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar skeleton */}
          <div className="lg:col-span-1 space-y-3">
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Main content skeleton */}
          <div className="lg:col-span-3 space-y-4">
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
