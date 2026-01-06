export default function TurfDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Gallery Skeleton */}
      <div className="aspect-video bg-gray-900 animate-pulse" />

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Title and Rating Skeleton */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="h-8 bg-gray-800 rounded-lg w-64 mb-3 animate-pulse" />
            <div className="h-4 bg-gray-800 rounded w-48 animate-pulse" />
          </div>
          <div className="h-10 bg-gray-800 rounded-lg w-24 animate-pulse" />
        </div>

        {/* Info Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse"
            >
              <div className="h-4 bg-gray-800 rounded w-16 mb-2" />
              <div className="h-6 bg-gray-800 rounded w-24" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-800 rounded w-5/6 animate-pulse" />
                <div className="h-4 bg-gray-800 rounded w-4/6 animate-pulse" />
              </div>
            </div>

            {/* Play Areas */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-28 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-800 rounded-lg animate-pulse"
                  >
                    <div className="h-5 bg-gray-700 rounded w-24 mb-2" />
                    <div className="h-4 bg-gray-700 rounded w-16" />
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-24 mb-4 animate-pulse" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-8 bg-gray-800 rounded-full w-20 animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Slot Grid Skeleton */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse" />
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-800 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6">
            {/* Map Placeholder */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="aspect-video bg-gray-800 animate-pulse" />
              <div className="p-4">
                <div className="h-4 bg-gray-800 rounded w-full mb-2 animate-pulse" />
                <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
              </div>
            </div>

            {/* Contact */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-24 mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Skeleton */}
        <div className="mt-8">
          <div className="h-6 bg-gray-800 rounded w-24 mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div>
                    <div className="h-4 bg-gray-800 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-full" />
                  <div className="h-4 bg-gray-800 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Footer Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 p-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <div className="h-3 bg-gray-800 rounded w-16 mb-1 animate-pulse" />
            <div className="h-6 bg-gray-800 rounded w-24 animate-pulse" />
          </div>
          <div className="h-12 bg-gray-800 rounded-lg w-32 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
