// This file is used to provide ambient type declarations for modules
// that are imported via CDN in index.html (importmap) and have no
// corresponding type definitions installed in node_modules.
// This silences TypeScript errors during the build process (tsc).

declare module 'xlsx';
declare module 'pdfjs-dist';
