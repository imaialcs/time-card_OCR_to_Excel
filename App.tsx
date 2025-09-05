import React, { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { processDocumentPages } from './services/geminiService';
import { ProcessedData, ProcessedTable, ProcessedText, FilePreview, OcrRegion, WorkPattern } from './types';
import { parseTime } from './services/utils';
import { UploadIcon, DownloadIcon, ProcessingIcon, FileIcon, CloseIcon, MailIcon, UsersIcon, TableCellsIcon, SparklesIcon, ChevronDownIcon, DocumentTextIcon } from './components/icons';
const UpdateNotification = lazy(() => import('./components/UpdateNotification'));
const WorkPatternModal = lazy(() => import('./components/WorkPatternModal'));
const DataTable = lazy(() => import('./components/DataTable'));

import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

interface Profile {
  name: string;
  rosterFile: { name: string; data: string } | null; // data as base64 string
  rosterSettings: { sheetName: string; column: string; };
  excelTemplateFile: { name: string; data: string } | null; // data as base64 string
  outputMode: 'new' | 'template';
  templateSettings: { dataStartCell: string; };
}

// Helper functions for ArrayBuffer <-> Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

if (pdfjsLib.version) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
}

const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

const MultiFileUploader: React.FC<{ 
  onFilesUpload: (files: FileList) => void;
  previews: FilePreview[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  onPreviewClick: (preview: FilePreview) => void;
}> = ({ onFilesUpload, previews, onRemoveFile, onClearAll, onPreviewClick }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesUpload(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onFilesUpload(event.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        className="relative flex flex-col justify-center items-center w-full min-h-[16rem] p-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-400 focus:outline-none"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {previews.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-center pointer-events-none">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <UploadIcon className="h-10 w-10 text-slate-500" />
            </div>
            <p className="font-semibold text-gray-700">
              ファイルをここにドラッグ＆ドロップ
            </p>
            <p className="text-sm text-gray-500">
              または <span className="text-blue-600 font-medium">クリックしてファイルを選択</span>
            </p>
            <p className="text-xs text-gray-500 pt-2">
              (複数ファイルの画像またはPDFに対応)
            </p>
          </div>
        ) : (
          <div className="w-full h-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {previews.map((p, index) => (
                <div key={index} className="relative aspect-square border rounded-md overflow-hidden bg-gray-100 group">
                   <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                    className="absolute top-1 left-1 z-10 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${p.name}`}
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                  {p.isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                        <ProcessingIcon className="w-8 h-8 mx-auto text-gray-500 animate-spin" />
                        <p className="mt-1 text-xs font-medium text-gray-700">生成中...</p>
                    </div>
                  ) : p.url ? (
                    <img
                      src={p.url}
                      alt={p.name}
                      className={`w-full h-full object-contain ${p.type === 'image' ? 'cursor-pointer' : ''}`}
                      onClick={(e) => {
                        if (p.type === 'image') {
                            e.preventDefault();
                            e.stopPropagation();
                            onPreviewClick(p);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                        <FileIcon className="w-8 h-8 mx-auto text-gray-500" />
                        <p className="mt-1 text-xs font-medium text-gray-700 break-all text-center">{p.name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearAll();
              }}
              className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              すべてクリア
            </button>
          </div>
        )}
        <input id="file-upload" name="file-upload" type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
      </label>
    </div>
  );
};

const TranscriptionView: React.FC<{
  fileName: string;
  content: string;
  onContentChange: (fileName: string, value: string) => void;
}> = ({ fileName, content, onContentChange }) => {
  return (
    <textarea
      value={content}
      onChange={(e) => onContentChange(fileName, e.target.value)}
      className="w-full h-60 p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 bg-gray-50 font-mono text-sm"
      aria-label="Transcription Content"
    />
  );
};


// --- String Similarity Function (Levenshtein Distance) ---
const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const findBestMatch = (name: string, roster: string[]): string | null => {
    if (!roster || roster.length === 0 || !name) return null;

    let bestMatch: string | null = null;
    let minDistance = Infinity;
    const similarityThreshold = 0.7; // 70% similarity required

    const normalizedName = name.replace(/\s+/g, '');

    for (const rosterName of roster) {
        const normalizedRosterName = rosterName.replace(/\s+/g, '');
        const distance = levenshteinDistance(normalizedName, normalizedRosterName);
        const similarity = 1 - distance / Math.max(normalizedName.length, normalizedRosterName.length);

        if (similarity > similarityThreshold && distance < minDistance) {
            minDistance = distance;
            bestMatch = rosterName;
        }
    }
    return bestMatch;
};

const columnToIndex = (col: string): number => {
    let index = 0;
    const upperCol = col.toUpperCase();
    for (let i = 0; i < upperCol.length; i++) {
        index = index * 26 + upperCol.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1;
};

const findMatchingSheetName = (fullName: string, sheetNames: string[]): string | null => {
    if (!fullName || sheetNames.length === 0) {
        return null;
    }

    const trimmedFullName = fullName.trim();
    const nameParts = trimmedFullName.split(/[　 ]+/ ).filter(p => p);

    if (nameParts.length === 0) {
        return null;
    }

    const normalizedSheetNames = sheetNames.map(s => s.trim());

    let foundIndex = normalizedSheetNames.findIndex(sheet => sheet === trimmedFullName);
    if (foundIndex > -1) return sheetNames[foundIndex];

    const firstNamePart = nameParts[0];
    foundIndex = normalizedSheetNames.findIndex(sheet => sheet === firstNamePart);
    if (foundIndex > -1) return sheetNames[foundIndex];
    
    if (nameParts.length > 1) {
        const lastNamePart = nameParts[nameParts.length - 1];
        foundIndex = normalizedSheetNames.findIndex(sheet => sheet === lastNamePart);
        if (foundIndex > -1) return sheetNames[foundIndex];
    }

    return null;
};

const withRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
};

const RegionSelectionModal: React.FC<{
  preview: FilePreview;
  onClose: () => void;
  onUpdateRegions: (regions: OcrRegion[]) => void;
  onReprocess: (preview: FilePreview) => void;
}> = ({ preview, onClose }) => {
  // Placeholder component
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">Region Selection for {preview.name}</h2>
        <p>Region selection functionality is not yet implemented in this view.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">Close</button>
      </div>
    </div>
  );
};


const App = () => {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancelledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [modalPreview, setModalPreview] = useState<FilePreview | null>(null);
  const [hasScrolledToResults, setHasScrolledToResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const [updateStatus, setUpdateStatus] = useState<{ message: string; ready?: boolean; transient?: boolean } | null>(null);
  const updateTimeoutRef = useRef<number | null>(null);

  // Profile States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState('');

  // Settings States
  const [roster, setRoster] = useState<string[]>([]);
  const [rosterFile, setRosterFile] = useState<{ name: string } | null>(null);
  const [rosterData, setRosterData] = useState<ArrayBuffer | null>(null);
  const [rosterSettings, setRosterSettings] = useState({ sheetName: '', column: 'A' });
  const [excelTemplateFile, setExcelTemplateFile] = useState<{ name: string } | null>(null);
  const [excelTemplateData, setExcelTemplateData] = useState<ArrayBuffer | null>(null);
  const [outputMode, setOutputMode] = useState<'new' | 'template'>('new');
  const [templateSettings, setTemplateSettings] = useState({ dataStartCell: 'A1' });

  // ROI Drawing States
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<OcrRegion['rect'] | null>(null);
  const [regionTypePopup, setRegionTypePopup] = useState<{ visible: boolean; x: number; y: number; onSelect: (type: OcrRegion['type']) => void; } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Merging and Work Pattern States
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [workPatterns, setWorkPatterns] = useState<WorkPattern[]>([]);
  const [isWorkPatternModalOpen, setIsWorkPatternModalOpen] = useState(false);

  // Load profiles from localStorage on initial render
  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem('ocr-profiles');
      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      }
    } catch (error) {
      console.error("Failed to load profiles from localStorage", error);
      setError("プロファイルの読み込みに失敗しました。");
    }
  }, []);

  // Save profiles to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ocr-profiles', JSON.stringify(profiles));
    } catch (error) {
      console.error("Failed to save profiles to localStorage", error);
      setError("プロファイルの保存に失敗しました。");
    }
  }, [profiles]);

  // Load work patterns from localStorage on initial render
  useEffect(() => {
    try {
      const savedPatterns = localStorage.getItem('ocr-work-patterns');
      if (savedPatterns) {
        setWorkPatterns(JSON.parse(savedPatterns));
      }
    } catch (error) {
      console.error("Failed to load work patterns from localStorage", error);
      setError("勤務パターンの読み込みに失敗しました。");
    }
  }, []);

  // Save work patterns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ocr-work-patterns', JSON.stringify(workPatterns));
    } catch (error) {
      console.error("Failed to save work patterns to localStorage", error);
      setError("勤務パターンの保存に失敗しました。");
    }
  }, [workPatterns]);

  useEffect(() => {
    return () => {
      previews.forEach(p => {
        if (p.url && p.type === 'image' && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [previews]);

  useEffect(() => {
    if (processedData.length > 0 && !loading && !hasScrolledToResults) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasScrolledToResults(true);
    }
  }, [processedData, loading, hasScrolledToResults]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onUpdateStatus) {
      const removeListener = window.electronAPI.onUpdateStatus((status) => {
        console.log('Update status received:', status);
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        setUpdateStatus(status);
        if (status.transient) {
          updateTimeoutRef.current = window.setTimeout(() => {
            setUpdateStatus(null);
            updateTimeoutRef.current = null;
          }, 5000);
        }
      });
      return () => {
        removeListener();
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onOpenSettings) {
      const removeListener = window.electronAPI.onOpenSettings((_event, type) => {
        if (type === 'work-pattern') {
          setIsWorkPatternModalOpen(true);
        }
      });
      return () => removeListener();
    }
  }, []);


  const generatePdfThumbnail = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const desiredWidth = 200;
    const viewport = page.getViewport({ scale: 1 });
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not get canvas context');
    }
    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/png');
  };

  const handleFilesUpload = useCallback(async (files: FileList) => {
    const newFiles = Array.from(files);
    const newPreviews: FilePreview[] = newFiles.map(file => {
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';
      return { file, type, url: type === 'image' ? URL.createObjectURL(file) : null, name: file.name, isLoading: type === 'pdf' };
    });
    setPreviews(prev => [...prev, ...newPreviews]);

    newPreviews.forEach(async (p) => {
        if (p.type === 'pdf') {
            try {
                const thumbnailUrl = await generatePdfThumbnail(p.file);
                setPreviews(current => current.map(item => item.file === p.file ? { ...item, url: thumbnailUrl, isLoading: false } : item));
            } catch (err) {
                console.error("Failed to generate PDF thumbnail for", p.name, err);
                setPreviews(current => current.map(item => item.file === p.file ? { ...item, isLoading: false } : item));
            }
        }
    });
  }, []);

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    setPreviews(prev => {
      const fileToRemove = prev[indexToRemove];
      if (fileToRemove?.url && fileToRemove.type === 'image' && fileToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    previews.forEach(p => {
        if (p.url && p.type === 'image' && p.url.startsWith('blob:')) {
            URL.revokeObjectURL(p.url);
        }
    });
    setPreviews([]);
    setProcessedData([]);
    setError(null);
    setHasScrolledToResults(false);
  }, [previews]);

  const handlePreviewClick = useCallback((preview: FilePreview) => {
    if (preview.type === 'image' && preview.url) {
        setModalPreview(preview);
    }
  }, []);

  const handleRosterSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRosterSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleRosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const data = await readFileAsArrayBuffer(file);
        setRosterFile({ name: file.name });
        setRosterData(data);

        const workbook = XLSX.read(data, { type: 'buffer' });
        const sheetName = rosterSettings.sheetName.trim() || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            setError(`名簿ファイルにシート名「${sheetName}」が見つかりませんでした。`);
            setRoster([]);
            return;
        }

        const json: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const colIndex = rosterSettings.column ? columnToIndex(rosterSettings.column) : 0;
        
        if (colIndex < 0) {
            setError('列の指定が無効です。A, B, C...のように指定してください。');
            setRoster([]);
            return;
        }

        const names = json
            .map((row: unknown[]) => row[colIndex])
            .filter((name: unknown): name is string => typeof name === 'string' && name.trim() !== '');
        
        setRoster(names);
        setError(null);
    } catch (err) {
        setError('名簿ファイルの読み込みに失敗しました。');
        console.error(err);
        setRoster([]);
    }
  };


  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const data = await readFileAsArrayBuffer(file);
        setExcelTemplateFile({ name: file.name });
        setExcelTemplateData(data);
    } catch (err) {
        setError('Excelテンプレートの読み込みに失敗しました。');
        console.error(err);
    }
  };

  const handleTemplateSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setTemplateSettings(prev => ({ ...prev, [name]: value.trim() }));
  };

  const handleProfileSave = () => {
    if (!newProfileName) {
      setError("プロファイル名を入力してください。");
      return;
    }

    const newProfile: Profile = {
      name: newProfileName,
      rosterFile: rosterFile && rosterData ? { name: rosterFile.name, data: arrayBufferToBase64(rosterData) } : null,
      rosterSettings,
      excelTemplateFile: excelTemplateFile && excelTemplateData ? { name: excelTemplateFile.name, data: arrayBufferToBase64(excelTemplateData) } : null,
      outputMode,
      templateSettings,
    };

    setProfiles(prevProfiles => {
      const existingIndex = prevProfiles.findIndex(p => p.name === newProfileName);
      if (existingIndex > -1) {
        const updatedProfiles = [...prevProfiles];
        updatedProfiles[existingIndex] = newProfile;
        return updatedProfiles;
      } else {
        return [...prevProfiles, newProfile];
      }
    });

    setNewProfileName('');
    setSelectedProfile(newProfileName);
    setError(null);
  };

  const handleProfileSelect = (profileName: string) => {
    setSelectedProfile(profileName);
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) return;

    if (profile.rosterFile && profile.rosterFile.data) {
      const buffer = base64ToArrayBuffer(profile.rosterFile.data);
      setRosterFile({ name: profile.rosterFile.name });
      setRosterData(buffer);
      // Re-process roster from loaded data
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = profile.rosterSettings.sheetName.trim() || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const colIndex = columnToIndex(profile.rosterSettings.column);
        const names = json.map((row: any[]) => row[colIndex]).filter((name): name is string => typeof name === 'string' && name.trim() !== '');
        setRoster(names);
      } catch (e) {
        console.error("Error processing roster from profile", e);
        setError("プロファイルから名簿の処理中にエラーが発生しました。");
      }
    } else {
      setRosterFile(null);
      setRosterData(null);
      setRoster([]);
    }

    if (profile.excelTemplateFile && profile.excelTemplateFile.data) {
      const buffer = base64ToArrayBuffer(profile.excelTemplateFile.data);
      setExcelTemplateFile({ name: profile.excelTemplateFile.name });
      setExcelTemplateData(buffer);
    } else {
      setExcelTemplateFile(null);
      setExcelTemplateData(null);
    }

    setRosterSettings(profile.rosterSettings);
    setOutputMode(profile.outputMode);
    setTemplateSettings(profile.templateSettings);
  };

  const handleUpdateRegions = (file: File, regions: OcrRegion[]) => {
    setPreviews(currentPreviews => {
      return currentPreviews.map(p => {
        if (p.file === file) {
          return { ...p, ocrRegions: regions };
        }
        return p;
      });
    });
  };


  const handlePatternChange = (cardId: string, rowIndex: number, patternId: string) => {
    setProcessedData(prevData =>
      prevData.map(item => {
        if (item.type === 'table' && item.id === cardId) {
          const updatedData = [...item.data];
          updatedData[rowIndex] = { ...updatedData[rowIndex], selectedPatternId: patternId };
          return { ...item, data: updatedData };
        }
        return item;
      })
    );
  };

  const handleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleMergeSelected = () => {
    if (selectedCardIds.length < 2) return;
    const newGroupId = crypto.randomUUID();
    setProcessedData(prev =>
      prev.map(item => {
        if (item.type === 'table' && selectedCardIds.includes(item.id)) {
          return { ...item, groupId: newGroupId, isMerged: true };
        }
        return item;
      })
    );
    setSelectedCardIds([]);
  };

  const handleUnmergeGroup = (groupId: string) => {
    setProcessedData(prev =>
      prev.map(item => {
        if (item.type === 'table' && item.groupId === groupId) {
          return { ...item, groupId: item.id, isMerged: false };
        }
        return item;
      })
    );
  };

  const handleExportCsv = async (format: 'decimal' | 'hh:mm' = 'decimal') => {
    if (!window.electronAPI) {
      setError("CSVエクスポート機能はデスクトップアプリ版でのみ利用可能です。");
      return;
    }

    const tableData = processedData.filter(d => d.type === 'table') as ProcessedTable[];
    if (tableData.length === 0) {
      alert("エクスポート対象のテーブルデータがありません。");
      return;
    }

    const header = ['従業員名', '日付', '総労働時間', '時間外労働時間', '深夜労働時間', '遅刻フラグ', '早退フラグ'];
    const rows: string[][] = [];

    tableData.forEach(card => {
      const employeeName = card.title.name;
      const findHeaderIndex = (name: string) => card.headers.findIndex(h => h.includes(name));
      const dateIndex = findHeaderIndex('日');
      const inTimeIndex = findHeaderIndex('出勤');
      const outTimeIndex = findHeaderIndex('退勤');

      card.data.forEach(day => {
        const pattern = workPatterns.find(p => p.id === day.selectedPatternId);
        if (!pattern) return; // Skip if no pattern selected

        const inTime = parseTime(day.rowData[inTimeIndex]);
        const outTime = parseTime(day.rowData[outTimeIndex]);

        if (inTime === null || outTime === null || outTime <= inTime) return; // Skip invalid rows

        const actualWorkHours = outTime - inTime - pattern.breakTimeHours;
        const scheduledWorkHours = parseTime(pattern.endTime)! - parseTime(pattern.startTime)! - pattern.breakTimeHours;
        const overtime = Math.max(0, actualWorkHours - scheduledWorkHours);
        const lateNightHours = Math.max(0, Math.min(outTime, 29) - Math.max(inTime, 22));
        const isLate = inTime > parseTime(pattern.startTime)!;
        const isEarlyLeave = outTime < parseTime(pattern.endTime)!;

        const formatHours = (hours: number) => {
            if (format === 'hh:mm') {
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            return hours.toFixed(2);
        };

        rows.push([
          employeeName,
          day.rowData[dateIndex] || '',
          formatHours(actualWorkHours),
          formatHours(overtime),
          formatHours(lateNightHours),
          isLate ? '1' : '0',
          isEarlyLeave ? '1' : '0'
        ]);
      });
    });

    const csvContent = [header.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    
    try {
        await window.electronAPI.saveFile({ defaultPath: `月締め_${new Date().toISOString().split('T')[0]}.csv` }, new TextEncoder().encode(csvContent));
    } catch(e: any) {
        setError(`CSVエクスポート中にエラーが発生しました: ${e.message}`);
    }
  };

  const handleExportSettings = async () => {
    if (!window.electronAPI) {
      setError("この機能はデスクトップアプリ版でのみ利用可能です。");
      return;
    }
    try {
      const result = await window.electronAPI.exportSettings(JSON.stringify(profiles, null, 2));
      if (result.error) {
        setError(`エクスポートに失敗しました: ${result.error}`);
      }
    } catch (err: any) {
      setError(`エクスポート中にエラーが発生しました: ${err.message}`);
    }
  };

  const handleImportSettings = async () => {
    if (!window.electronAPI) {
      setError("この機能はデスクトップアプリ版でのみ利用可能です。");
      return;
    }
    try {
      const result = await window.electronAPI.importSettings();
      if (result.success && result.data) {
        const importedProfiles = JSON.parse(result.data) as Profile[];
        // Simple merge: overwrite existing profiles, add new ones.
        const updatedProfiles = [...profiles];
        importedProfiles.forEach(p => {
          const existingIndex = updatedProfiles.findIndex(up => up.name === p.name);
          if (existingIndex > -1) {
            updatedProfiles[existingIndex] = p;
          } else {
            updatedProfiles.push(p);
          }
        });
        setProfiles(updatedProfiles);
        alert(`${importedProfiles.length}件のプロファイルをインポートしました。`);
      } else if (result.error) {
        setError(`インポートに失敗しました: ${result.error}`);
      }
    } catch (err: any) {
      setError(`インポート中にエラーが発生しました: ${err.message}`);
    }
  };

  const handleProcess = async (singlePreview?: FilePreview) => {
    const previewsToProcess = singlePreview ? [singlePreview] : previews;
    if (previewsToProcess.length === 0) return;

    setLoading(true);
    setError(null);
    if (!singlePreview) {
      setProcessedData([]);
    }
    setHasScrolledToResults(false);
    setIsCancelling(false);
    isCancelledRef.current = false;

    let allExtractedData: ProcessedData[] = [];

    try {
      for (const p of previewsToProcess) {
        if (isCancelledRef.current) {
          break;
        }

        const file = p.file;
        let pagesToProcess: { base64: string; mimeType: string; name: string }[] = [];

        if (p.type === 'pdf') {
          // PDF processing logic remains unchanged for now, as ROI is on images.
          // This part could be extended to allow ROI on PDF pages.
          const arrayBuffer = await readFileAsArrayBuffer(file);
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdf.numPages;

          for (let i = 1; i <= numPages; i++) {
            if (isCancelledRef.current) {
              break;
            }
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (!context) {
              throw new Error('Could not get canvas context for PDF page rendering');
            }

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
            pagesToProcess.push({ base64, mimeType: 'image/jpeg', name: `${file.name}_page_${i}` });
          }
        } else {
          const { base64, mimeType } = await readFileAsBase64(file);
          pagesToProcess.push({ base64, mimeType, name: file.name });
        }

        if (isCancelledRef.current) {
          break;
        }

        if (pagesToProcess.length > 0) {
          const result = await withRetry(() => processDocumentPages(pagesToProcess, p.ocrRegions));
          if (singlePreview) {
            // If reprocessing a single file, remove its old data first
            setProcessedData(prev => prev.filter(item => {
              if (item.type === 'transcription') return item.fileName !== singlePreview.name;
              if (item.type === 'table') {
                const existingPreview = previews.find(pr => pr.name === item.title.name); // This is a simplification
                return existingPreview?.file !== singlePreview.file;
              }
              return true;
            }));
            allExtractedData.push(...result);
          } else {
            allExtractedData.push(...result);
          }
        }
      }

      if (isCancelledRef.current) {
        setError("処理がユーザーによって中止されました。");
        if (!singlePreview) setProcessedData([]);
        return;
      }

      const sanitizedAndValidatedData = allExtractedData.map(item => {
          if (item.type === 'table') {
            const card = item as any; // Treat as any to handle incoming string[][]
            if (!card || typeof card !== 'object' || !card.headers || !card.data) return null;
            const sanitizedHeaders = Array.isArray(card.headers) ? card.headers.map((h: any) => String(h ?? "")) : [];
            const headerCount = sanitizedHeaders.length;
            const sanitizedData = (Array.isArray(card.data) ? card.data.map((row: any) => {
                if (!Array.isArray(row)) return null;
                let sanitizedRow = row.map((cell: any) => String(cell ?? ""));
                if (sanitizedRow.length < headerCount) {
                  sanitizedRow = [...sanitizedRow, ...Array(headerCount - sanitizedRow.length).fill("")];
                } else if (sanitizedRow.length > headerCount) {
                  sanitizedRow = sanitizedRow.slice(0, headerCount);
                }
                // Create the new data structure here
                return { rowData: sanitizedRow, selectedPatternId: '' }; 
              }).filter((row: any): row is { rowData: string[]; selectedPatternId?: string; } => row !== null) : []);

            const id = crypto.randomUUID();
            const sanitizedCard: ProcessedTable = { 
              id: id,
              groupId: id, // Initially, each card is its own group
              isMerged: false,
              type: 'table',
              title: { yearMonth: String(card.title?.yearMonth ?? ""), name: String(card.title?.name ?? "") },
              headers: sanitizedHeaders, 
              data: sanitizedData
            };
            
            if (roster.length > 0) {
                const bestMatch = findBestMatch(sanitizedCard.title.name, roster);
                if (bestMatch && bestMatch !== sanitizedCard.title.name) {
                    sanitizedCard.title.name = bestMatch;
                    sanitizedCard.nameCorrected = true;
                }
            }
            return sanitizedCard;
          } else if (item.type === 'transcription') {
            return item as ProcessedText;
          }
          return null;
        }).filter((card): card is ProcessedData => card !== null);

      if (allExtractedData.length > 0 && sanitizedAndValidatedData.length === 0) {
        throw new Error("AIは応答しましたが、期待されるデータ形式と一致しませんでした。ファイルが対応形式であることを確認してください。");
      }

      const finalData = singlePreview ? [...processedData.filter(pd => pd.type === 'transcription'), ...sanitizedAndValidatedData] : sanitizedAndValidatedData;

      // Auto-grouping logic
      const tableData = finalData.filter(d => d.type === 'table') as ProcessedTable[];
      const transcriptionData = finalData.filter(d => d.type === 'transcription');
      const mergeGroups = new Map<string, string[]>();

      tableData.forEach(card => {
        const key = `${card.title.name.replace(/\s+/g, '')}-${card.title.yearMonth.replace(/\s+/g, '')}`;
        if (!mergeGroups.has(key)) {
          mergeGroups.set(key, []);
        }
        mergeGroups.get(key)!.push(card.id);
      });

      mergeGroups.forEach(ids => {
        if (ids.length > 1) {
          const groupId = crypto.randomUUID();
          ids.forEach(id => {
            const card = tableData.find(c => c.id === id);
            if (card) {
              card.groupId = groupId;
              card.isMerged = true;
            }
          });
        }
      });

      setProcessedData([...tableData, ...transcriptionData]);

    } catch (e: any) {
        if (!isCancelledRef.current) {
            console.error(e);
            const message = e.message || JSON.stringify(e);
            if (message.includes('503') || message.toLowerCase().includes('overloaded') || message.toLowerCase().includes('unavailable')) {
                setError("AIモデルが現在大変混み合っています。ご迷惑をおかけしますが、しばらく時間をおいてから再度お試しください。");
            } else {
                setError(`処理中に予期せぬエラーが発生しました:\n${message}`);
            }
        }
    } finally {
      setLoading(false);
      setIsCancelling(false);
    }
  };

  const handleDataChange = (cardId: string, rowIndex: number, cellIndex: number, value: string) => {
    setProcessedData(prevData =>
      prevData.map(item => {
        if (item.type === 'table' && item.id === cardId) {
          const updatedData = [...item.data];
          const newRowData = [...updatedData[rowIndex].rowData];
          newRowData[cellIndex] = value;
          updatedData[rowIndex] = { ...updatedData[rowIndex], rowData: newRowData };
          return { ...item, data: updatedData };
        }
        return item;
      })
    );
  };
  
  const handleContentChange = (fileName: string, value: string) => {
    setProcessedData(prevData =>
      prevData.map(item => {
        if (item.type === 'transcription' && item.fileName === fileName) {
          return { ...item, content: value };
        }
        return item;
      })
    );
  };

  const handleTitleChange = (cardId: string, field: 'yearMonth' | 'name', value: string) => {
    setProcessedData(prevData =>
      prevData.map(item => {
        if (item.type === 'table' && item.id === cardId) {
          const updatedTitle = { ...item.title, [field]: value };
          const updatedItem = { ...item, title: updatedTitle };
          if (field === 'name') {
            updatedItem.nameCorrected = false;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleDownloadTranscription = async (fileName: string) => {
    if (!window.electronAPI) {
        setError("ファイル保存機能が利用できません。アプリケーションを再起動してください。");
        return;
    }
    const card = processedData.find(item => item.type === 'transcription' && item.fileName === fileName) as ProcessedText | undefined;
    if (!card) return;

    try {
        const fileData = new TextEncoder().encode(card.content);
        const defaultPath = `${fileName.split('.').slice(0, -1).join('.')}.txt`;
        await window.electronAPI.saveFile({ defaultPath }, fileData);
        setError(null);
    } catch (err: any) {
        setError(`ファイルの保存中にエラーが発生しました: ${err.message}`);
        console.error(err);
    }
  };
  
  const handleDownloadSingle = async (cardId: string) => {
    if (!window.electronAPI) {
        setError("ファイル保存機能が利用できません。アプリケーションを再起動してください。");
        return;
    }

    const card = processedData.find(item => item.type === 'table' && item.id === cardId) as ProcessedTable | undefined;
    if (!card) return;

    try {
        const fileNameBase = `${card.title.name.replace(/\s+/g, '')}_${card.title.yearMonth.replace(/\s+/g, '')}`.replace(/[\\/:*?"<>|]/g, '_') || 'Document';
        const dataToExport = card.data.map(d => d.rowData);

        let fileData: Uint8Array;
        let fileName: string;

        if (outputMode === 'template') {
            if (!excelTemplateData || !templateSettings.dataStartCell) {
                setError('テンプレートファイルとデータ開始セルを指定してください。');
                return;
            }
            const templateWb = XLSX.read(excelTemplateData, { type: 'buffer' });
            const targetSheetName = findMatchingSheetName(card.title.name, templateWb.SheetNames);
            
            if (!targetSheetName) {
                setError(`テンプレートファイルに、氏名「${card.title.name}」に一致するシート（フルネーム/姓/名）が見つかりませんでした。`);
                return;
            }

            const newWb = XLSX.utils.book_new();
            templateWb.SheetNames.forEach((sheetName: string) => {
                const originalSheet = templateWb.Sheets[sheetName];
                const newSheet = JSON.parse(JSON.stringify(originalSheet));
                if (sheetName === targetSheetName) {
                    XLSX.utils.sheet_add_aoa(newSheet, dataToExport, { origin: templateSettings.dataStartCell });
                }
                XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);
            });

            fileData = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
            fileName = `${fileNameBase}_template_filled.xlsx`;
        } else {
            const wb = XLSX.utils.book_new();
            const sheetName = `${card.title.yearMonth} ${card.title.name}`.replace(/[\\/:*?"<>|]/g, '').substring(0, 31);
            const ws_data = [['期間', card.title.yearMonth], ['件名', card.title.name], [], card.headers, ...dataToExport];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            fileName = `${fileNameBase}.xlsx`;
        }
        await window.electronAPI.saveFile({ defaultPath: fileName }, fileData);
        setError(null);

    } catch (err: any) {
        setError(`ファイルの保存中にエラーが発生しました: ${err.message}`);
        console.error(err);
    }
  };

  const handleDownloadAll = async () => {
    if (!window.electronAPI) {
        setError("ファイル保存機能が利用できません。アプリケーションを再起動してください。");
        return;
    }

    const tableData = processedData.filter(d => d.type === 'table') as ProcessedTable[];
    if (tableData.length === 0) return;

    try {
        let fileData: Uint8Array;
        let fileName: string;

        if (outputMode === 'template') {
            if (!excelTemplateData || !excelTemplateFile || !templateSettings.dataStartCell) {
                setError('テンプレートファイルとデータ開始セルを指定してください。');
                return;
            }
            const templateWb = XLSX.read(excelTemplateData, { type: 'buffer' });
            const newWb = XLSX.utils.book_new();
            const unmatchedNames: string[] = [];

            const dataBySheet = new Map<string, string[][]>();
            
            const groupedData = new Map<string, ProcessedTable[]>();
            tableData.forEach(card => {
                if (!groupedData.has(card.groupId)) {
                    groupedData.set(card.groupId, []);
                }
                groupedData.get(card.groupId)!.push(card);
            });

            groupedData.forEach(group => {
                const firstCard = group[0];
                const combinedData = group.flatMap(g => g.data.map(d => d.rowData));
                const targetSheetName = findMatchingSheetName(firstCard.title.name, templateWb.SheetNames);
                if (targetSheetName) {
                    if (!dataBySheet.has(targetSheetName)) {
                        dataBySheet.set(targetSheetName, []);
                    }
                    dataBySheet.get(targetSheetName)!.push(...combinedData);
                } else {
                    unmatchedNames.push(firstCard.title.name);
                }
            });

            templateWb.SheetNames.forEach((sheetName: string) => {
                const originalSheet = templateWb.Sheets[sheetName];
                const newSheet = JSON.parse(JSON.stringify(originalSheet));
                if (dataBySheet.has(sheetName)) {
                    const dataToWrite = dataBySheet.get(sheetName)!;
                    XLSX.utils.sheet_add_aoa(newSheet, dataToWrite, { origin: templateSettings.dataStartCell });
                }
                XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);
            });

            fileData = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
            fileName = `${excelTemplateFile.name.replace(/\.(xlsx|xls)$/, '')}_filled.xlsx`;
            
            if (unmatchedNames.length > 0) {
                setError(`転記が完了しましたが、一部の氏名のシートが見つかりませんでした。
未転記: ${unmatchedNames.join(', ')}`);
            } else {
                setError(null);
            }
        } else {
            const wb = XLSX.utils.book_new();
            const groupedData = new Map<string, ProcessedTable[]>();
            tableData.forEach(card => {
                if (!groupedData.has(card.groupId)) {
                    groupedData.set(card.groupId, []);
                }
                groupedData.get(card.groupId)!.push(card);
            });

            groupedData.forEach(group => {
                const firstCard = group[0];
                const combinedData = group.flatMap(g => g.data.map(d => d.rowData));
                const sheetName = `${firstCard.title.yearMonth} ${firstCard.title.name}`.replace(/[\\/:*?"<>|]/g, '').substring(0, 31);
                const ws_data = [['期間', firstCard.title.yearMonth], ['件名', firstCard.title.name], [], firstCard.headers, ...combinedData];
                const ws = XLSX.utils.aoa_to_sheet(ws_data);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            fileName = 'Documents_All.xlsx';
        }

        await window.electronAPI.saveFile({ defaultPath: fileName }, fileData);

    } catch (err: any) {
        setError(`一括保存中にエラーが発生しました: ${err.message}`);
        console.error(err);
    }
  };

  const groupedTableData = useMemo(() => {
    const tableData = processedData.filter(d => d.type === 'table') as ProcessedTable[];
    const groups = new Map<string, ProcessedTable[]>();
    tableData.forEach(card => {
      const groupId = card.groupId || card.id;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(card);
    });
    return Array.from(groups.values());
  }, [processedData]);


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">ALCS文書OCR</h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            画像(PNG, JPG)やPDFをアップロードすると、AIが内容を読み取りデータ化します。<br />
            認識結果は画面上で修正でき、Excelファイルとしてダウンロード可能です。<br />
            <span className="font-semibold text-orange-600">※PDFは画像に変換して処理しますが、ファイルサイズが大きいと時間がかかるため、画像ファイルの利用をお勧めします。</span>
          </p>
        </header>

        <main className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">1. ファイルをアップロード</h2>
              <MultiFileUploader onFilesUpload={handleFilesUpload} previews={previews} onRemoveFile={handleRemoveFile} onClearAll={handleClearAll} onPreviewClick={handlePreviewClick} />
            </div>

            <div className='space-y-4'>
              <div className="group rounded-lg bg-gray-50 p-4">
                <h3 className="font-semibold text-gray-700 mb-3">プロファイル設定</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label htmlFor="profile-select" className="block text-sm font-medium text-gray-700">保存した設定を読み込む</label>
                    <select 
                      id="profile-select"
                      value={selectedProfile}
                      onChange={(e) => handleProfileSelect(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">プロファイルを選択...</option>
                      {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-grow">
                      <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">現在の設定を保存</label>
                      <input 
                        type="text" 
                        id="profile-name"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="新しいプロファイル名"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <button 
                      onClick={handleProfileSave}
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
                <details className="group rounded-lg bg-gray-50 p-4 transition-all duration-300 open:ring-1 open:ring-gray-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-gray-700">
                        <div className="flex items-center gap-3">
                            <UsersIcon className="h-6 w-6 text-gray-500" />
                            <span>氏名読み取り精度向上 (オプション)</span>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 border-t pt-4 space-y-3">
                        <p className="text-sm text-gray-600">氏名が記載されたExcelファイル（名簿）をアップロードすると、OCRが読み取った氏名を自動で補正します。名簿のシート名と氏名が記載されている列を指定してください。</p>
                        <div className="flex items-center gap-4">
                            <input type="file" id="roster-upload" className="hidden" accept=".xlsx, .xls" onChange={handleRosterUpload} />
                            <label htmlFor="roster-upload" className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">名簿ファイルを選択</label>
                            {rosterFile && <span className="text-sm text-gray-700">{rosterFile.name} ({roster.length}名)</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div><label htmlFor="rosterSheetName" className="block text-sm font-medium leading-6 text-gray-900">シート名 (空欄で最初のシート)</label><input type="text" name="sheetName" id="rosterSheetName" value={rosterSettings.sheetName} onChange={handleRosterSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: 社員一覧" /></div>
                             <div><label htmlFor="rosterColumn" className="block text-sm font-medium leading-6 text-gray-900">氏名が記載されている列</label><input type="text" name="column" id="rosterColumn" value={rosterSettings.column} onChange={handleRosterSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: B" /></div>
                        </div>
                    </div>
                </details>

                <details className="group rounded-lg bg-gray-50 p-4 transition-all duration-300 open:ring-1 open:ring-gray-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-gray-700">
                        <div className="flex items-center gap-3">
                            <TableCellsIcon className="h-6 w-6 text-gray-500" />
                            <span>Excel出力設定</span>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 space-y-4 border-t pt-4">
                        <fieldset>
                            <legend className="text-sm font-medium text-gray-900">出力方法を選択してください (表形式データのみ)</legend>
                            <div className="mt-2 flex gap-8">
                                <div className="flex items-center gap-x-3"><input id="output-new" name="output-mode" type="radio" value="new" checked={outputMode === 'new'} onChange={() => setOutputMode('new')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600" /><label htmlFor="output-new" className="block text-sm font-medium leading-6 text-gray-900">新規Excelファイルを作成</label></div>
                                <div className="flex items-center gap-x-3"><input id="output-template" name="output-mode" type="radio" value="template" checked={outputMode === 'template'} onChange={() => setOutputMode('template')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600" /><label htmlFor="output-template" className="block text-sm font-medium leading-6 text-gray-900">既存のExcelファイルに転記</label></div>
                            </div>
                        </fieldset>

                        {outputMode === 'template' && (
                            <div className="space-y-4 rounded-md border bg-white p-4">
                                <p className="text-sm text-gray-600">テンプレートモードでは、OCRで読み取った氏名と一致する名前のシートに、勤怠データ（ヘッダーを除く）のみを転記します。データの書き込みを開始するセルを指定してください。</p>
                                <div>
                                    <label htmlFor="template-upload" className="block text-sm font-medium text-gray-700 mb-1">テンプレートExcelファイル</label>
                                    <div className="flex items-center gap-4">
                                        <input type="file" id="template-upload" className="hidden" accept=".xlsx, .xls" onChange={handleTemplateUpload} />
                                        <label htmlFor="template-upload" className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">ファイルを選択</label>
                                        {excelTemplateFile && <span className="text-sm text-gray-700">{excelTemplateFile.name}</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                     <div><label htmlFor="dataStartCell" className="block text-sm font-medium leading-6 text-gray-900">データ書き込み開始セル</label><input type="text" name="dataStartCell" id="dataStartCell" value={templateSettings.dataStartCell} onChange={handleTemplateSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: C5" /></div>
                                </div>
                            </div>
                        )}
                    </div>
                </details>
            </div>

          </div>
          
          <div className="text-center">
            {loading ? (
              <div className="inline-flex items-center gap-4">
                <div className="inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-400">
                  <ProcessingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  処理中...
                </div>
                <button
                  onClick={() => {
                    isCancelledRef.current = true;
                    setIsCancelling(true);
                  }}
                  disabled={isCancelling}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                >
                  {isCancelling ? '中止中...' : '処理を中止'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleProcess()}
                disabled={previews.length === 0}
                className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                2. 処理を開始
              </button>
            )}
          </div>
          
          {error && (
            <div className="p-4 bg-red-100 text-red-700 border border-red-400 rounded-md">
              <h3 className="font-bold">エラーが発生しました</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          )}

          {processedData.length > 0 && (
            <div ref={resultsRef} className="p-6 bg-white rounded-lg shadow-md">
              <Suspense fallback={<div>Loading...</div>}> 
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-700">3. 結果の確認と修正</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={handleMergeSelected} disabled={selectedCardIds.length < 2} className="px-4 py-2 border rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">選択したカードを結合</button>
                    <button onClick={handleDownloadAll} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">すべてExcel形式でダウンロード</button>
                    <button onClick={() => handleExportCsv()} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700">月締め処理 (CSVエクスポート)</button>
                  </div>
                </div>
                <div className="space-y-8">
                  {groupedTableData.map((group: ProcessedTable[]) => (
                    <div key={group[0].groupId} className="border-2 border-dashed p-4 rounded-lg space-y-4 relative">
                      {group.length > 1 && (
                        <button onClick={() => handleUnmergeGroup(group[0].groupId)} className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">結合を解除</button>
                      )}
                      {group.map((item: ProcessedTable) => (
                        <div key={item.id}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedCardIds.includes(item.id)} onChange={() => handleCardSelection(item.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow mr-4 min-w-[200px]">
                                <input type="text" value={item.title.yearMonth} onChange={(e) => handleTitleChange(item.id, 'yearMonth', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full sm:w-auto" />
                                <span className="text-gray-500">-</span>
                                <div className="flex items-center gap-1.5 flex-grow">
                                    {item.nameCorrected && <SparklesIcon className="h-5 w-5 text-blue-500 flex-shrink-0" title="名簿により自動修正" />}
                                    <input type="text" value={item.title.name} onChange={(e) => handleTitleChange(item.id, 'name', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full" />
                                </div>
                            </div>
                            <button onClick={() => handleDownloadSingle(item.id)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0">この帳票をダウンロード</button>
                          </div>
                          <Suspense fallback={<div>Loading Table...</div>}>
                            <DataTable card={item} workPatterns={workPatterns} onDataChange={handleDataChange} onPatternChange={handlePatternChange} />
                          </Suspense>
                        </div>
                      ))}
                    </div>
                  ))}
                  {processedData.filter((d): d is ProcessedText => d.type === 'transcription').map((item, index) => (
                     <div key={index} className="border-t pt-6 first:border-t-0 first:pt-0">
                       <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                           <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow mr-4 min-w-[200px]">
                               <DocumentTextIcon className="h-6 w-6 text-gray-600" />
                               <span>{item.fileName}</span>
                           </div>
                           <button onClick={() => handleDownloadTranscription(item.fileName)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0">テキストファイルで保存</button>
                       </div>
                       <TranscriptionView fileName={item.fileName} content={item.content} onContentChange={handleContentChange} />
                     </div>
                  ))}
                </div>
              </Suspense>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 py-6 border-t border-gray-200 space-y-4">
          <div className="flex justify-center items-center gap-6">
            <button onClick={handleImportSettings} className="text-sm text-gray-600 hover:text-blue-800 hover:underline">設定をインポート</button>
            <button onClick={handleExportSettings} className="text-sm text-gray-600 hover:text-blue-800 hover:underline">設定をエクスポート</button>
          </div>
          <a href="mailto:imai_f@alcs.co.jp?subject=ALCS%E6%96%87%E6%9B%B8OCR%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6" className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-800 hover:underline">
            <MailIcon className="h-5 w-5" />
            <span>フィードバックや不具合報告はこちら</span>
          </a>
        </footer>
      </div>

      {modalPreview && (
        <RegionSelectionModal 
          preview={modalPreview}
          onClose={() => setModalPreview(null)}
          onUpdateRegions={(regions: OcrRegion[]) => handleUpdateRegions(modalPreview.file, regions)}
          onReprocess={handleProcess}
        />
      )}

      {isWorkPatternModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
            <WorkPatternModal 
              patterns={workPatterns}
              onSave={(updatedPatterns) => {
                setWorkPatterns(updatedPatterns);
                setIsWorkPatternModalOpen(false);
              }}
              onClose={() => setIsWorkPatternModalOpen(false)}
            />
        </Suspense>
      )}

      {updateStatus && (
        <React.Suspense fallback={null}>
          <UpdateNotification
            message={updateStatus.message}
            isReady={updateStatus.ready}
            onRestart={() => window.electronAPI?.restartApp()}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default App;
