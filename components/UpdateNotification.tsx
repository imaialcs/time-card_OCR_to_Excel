import React from 'react';
import { DownloadIcon, SparklesIcon } from './icons';

interface UpdateNotificationProps {
  message: string;
  isReady?: boolean;
  onRestart: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ message, isReady, onRestart }) => {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-lg bg-white p-4 text-gray-800 shadow-2xl ring-1 ring-black ring-opacity-5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          {isReady ? (
            <SparklesIcon className="h-6 w-6 text-blue-500" title="Update Ready" />
          ) : (
            <DownloadIcon className="h-6 w-6 text-gray-500" title="Update Status" />
          )}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-semibold">{isReady ? 'アップデートの準備ができました' : 'アップデート情報'}</p>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
          {isReady && (
            <div className="mt-4">
              <button
                onClick={onRestart}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                再起動して更新
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};