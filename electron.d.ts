
// This file provides type definitions for the Electron APIs exposed via preload.js.
// It is used for TypeScript type checking in the renderer process.

declare global {
  interface Window {
    electronAPI: {
      getApiKey: () => Promise<string | null>;
      /**
       * Listens for update status messages from the main process.
       * @param callback The function to execute when a message is received.
       * The callback receives a status object with a message and an optional 'ready' flag.
       * @returns A function to remove the listener.
       */
      onUpdateStatus: (
        callback: (status: { message: string; ready?: boolean }) => void
      ) => () => void;
      /**
       * Tells the main process to quit the application and install the update.
       */
      restartApp: () => void;
    };
  }
}

// The export {} is necessary to make this file a module, which allows augmenting the global scope.
export {};