import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="h-12 bg-gray-200 rounded w-64 mb-4 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-96 animate-pulse" />
        </div>

        <div className="mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-64 mb-3 animate-pulse" />
            <div className="h-6 bg-gray-200 rounded w-full max-w-md animate-pulse" />
          </div>
        </div>

        <div className="mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full mb-3 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-12 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
            <div className="h-96 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        <div className="mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl overflow-hidden">
                  <div className="h-48 bg-gray-200 animate-pulse" />
                  <div className="p-6">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
