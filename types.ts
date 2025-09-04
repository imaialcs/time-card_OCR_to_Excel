export interface ProcessedTable {
  type: 'table';
  title: {
    yearMonth: string;
    name: string;
  };
  headers: string[];
  data: string[][];
  nameCorrected?: boolean;
}

export interface ProcessedText {
  type: 'transcription';
  fileName: string;
  content: string;
}

export type ProcessedData = ProcessedTable | ProcessedText;

export interface FilePreview {
  file: File;
  type: 'image' | 'pdf';
  url: string | null;
  name: string;
  isLoading: boolean;
}
