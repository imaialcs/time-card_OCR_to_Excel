// This file provides type definitions for the Electron APIs exposed via preload.js.
// It is used for TypeScript type checking in the renderer process.

// By defining the Window interface directly, we augment the global scope.
// This file is treated as a global script because it lacks top-level imports/exports.
interface Window {
  electronAPI: {
    /**
     * Asynchronously retrieves the Gemini API key from the main process.
     * @returns A promise that resolves with the API key string.
     */
    getApiKey: () => Promise<string>;

    /**
     * Listens for update status messages from the main process.
     * @param callback The function to execute when a message is received.
     * The callback receives a status object with a message and an optional 'ready' flag.
     * @returns A function to remove the listener.
     */
    onUpdateStatus: (
      callback: (status: { message: string; ready?: boolean; transient?: boolean }) => void
    ) => () => void;
    /**
     * Tells the main process to quit the application and install the update.
     */
    restartApp: () => void;

    /**
     * Opens a save dialog and writes the provided data to the selected file.
     * @param options The options for the save dialog, including the default file path.
     * @param data The file content as a Uint8Array.
     * @returns A promise that resolves when the file is saved.
     */
    saveFile: (options: { defaultPath: string }, data: Uint8Array) => Promise<void>;

    /**
     * Opens a save dialog to export profile settings to a JSON file.
     * @param settingsJson The profile settings serialized as a JSON string.
     * @returns A promise that resolves with the result of the operation.
     */
    exportSettings: (settingsJson: string) => Promise<{ success: boolean; path?: string; error?: string }>;

    /**
     * Opens a file dialog to import profile settings from a JSON file.
     * @returns A promise that resolves with the imported settings data or an error.
     */
    importSettings: () => Promise<{ success: boolean; data?: string; error?: string; canceled?: boolean }>;

    /**
     * Listens for a request from the main process to open a settings dialog.
     * @param callback The function to execute when the event is received.
     * @returns A function to remove the listener.
     */
    onOpenSettings: (callback: (event: any, type: string) => void) => () => void;
  };
}