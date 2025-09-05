export interface ProcessedTable {
  id: string; // Unique ID for each card
  groupId: string; // ID for merging
  isMerged: boolean;
  type: 'table';
  title: {
    yearMonth: string;
    name: string;
  };
  headers: string[];
  data: { rowData: string[]; selectedPatternId?: string; }[];
  nameCorrected?: boolean;
}

export interface ProcessedText {
  type: 'transcription';
  fileName: string;
  content: string;
}

export interface WorkPattern {
  id: string; 
  name: string; 
  startTime: string; 
  endTime: string; 
  breakTimeHours: number; 
}

export type ProcessedData = ProcessedTable | ProcessedText;

export interface FilePreview {
  file: File;
  type: 'image' | 'pdf';
  url: string | null;
  name: string;
  isLoading: boolean;
  ocrRegions?: OcrRegion[];
}

export interface OcrRegion {
  id: number;
  type: 'name' | 'yearMonth' | 'data';
  rect: { x: number; y: number; width: number; height: number; }; // 0-1の相対座標
}
