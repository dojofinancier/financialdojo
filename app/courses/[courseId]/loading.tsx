export default function CourseDetailLoading() {
  return (
    <div className="container mx-auto p-6 animate-in fade-in duration-200">
      <div className="space-y-6">
        {/* Hero section skeleton */}
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/2 animate-pulse"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
