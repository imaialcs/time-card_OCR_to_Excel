
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { processTimeCardFile } from './services/geminiService';
import { TimeCardData } from './types';
import { UploadIcon, DownloadIcon, ProcessingIcon, FileIcon, CloseIcon } from './components/icons';

// TypeScript declaration for the libraries loaded from CDN
declare var XLSX: any;
declare var pdfjsLib: any;

interface FilePreview {
  file: File;
  type: 'image' | 'pdf';
  url: string | null; // URL for images, null for PDFs
  name: string;
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
      event.target.value = ''; // Reset input to allow re-selecting the same files
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
        className="relative flex flex-col justify-center items-center w-full min-h-[16rem] p-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {previews.length === 0 ? (
          <div className="flex items-center space-x-2 text-center">
            <UploadIcon className="w-6 h-6 text-gray-600" />
            <span className="font-medium text-gray-600">
              タイムカード画像またはPDFをここにドラッグ＆ドロップするか、
              <span className="text-blue-600 underline">クリックして選択</span>
              <p className="text-sm text-gray-500">(複数ファイル選択可)</p>
            </span>
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
                  {p.type === 'image' && p.url ? (
                    <img
                      src={p.url}
                      alt={p.name}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPreviewClick(p);
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

const TimeCardTable: React.FC<{
  cardIndex: number;
  headers: string[];
  data: string[][];
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
}> = ({ cardIndex, headers, data, onDataChange }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="px-4 py-2 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data || []).map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {(row || []).map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={cell || ''}
                    onChange={(e) => onDataChange(cardIndex, rowIndex, cellIndex, e.target.value)}
                    className="w-full px-1 py-0.5 border border-transparent focus:outline-none focus:border-blue-500 rounded-sm bg-transparent text-gray-900"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const App = () => {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [timeCardData, setTimeCardData] = useState<TimeCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalPreview, setModalPreview] = useState<FilePreview | null>(null);
  const [hasScrolledToResults, setHasScrolledToResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup object URLs when component unmounts or previews change
    return () => {
      previews.forEach(p => {
        if (p.url) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [previews]);

  // Scroll to results when data is available, but only once per processing.
  useEffect(() => {
    if (timeCardData.length > 0 && !loading && !hasScrolledToResults) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasScrolledToResults(true);
    }
  }, [timeCardData, loading, hasScrolledToResults]);

  // Handle Esc key to close modal
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


  const handleFilesUpload = useCallback((files: FileList) => {
    const newPreviews: FilePreview[] = Array.from(files).map(file => {
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';
      return {
        file,
        type,
        url: type === 'image' ? URL.createObjectURL(file) : null,
        name: file.name
      };
    });
    setPreviews(prev => [...prev, ...newPreviews]);
  }, []);

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    setPreviews(prev => {
      const fileToRemove = prev[indexToRemove];
      if (fileToRemove?.url) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    previews.forEach(p => {
        if (p.url) {
            URL.revokeObjectURL(p.url);
        }
    });
    setPreviews([]);
    setTimeCardData([]);
    setError(null);
    setHasScrolledToResults(false);
  }, [previews]);

  const handlePreviewClick = useCallback((preview: FilePreview) => {
    if (preview.type === 'image' && preview.url) {
        setModalPreview(preview);
    }
  }, []);

  const handleProcess = async () => {
    if (previews.length === 0) return;
    setLoading(true);
    setError(null);
    setTimeCardData([]);
    setHasScrolledToResults(false);
    
    let allExtractedData: TimeCardData[] = [];

    try {
      for (const p of previews) {
        const file = p.file;
        const { base64, mimeType } = await readFileAsBase64(file);
        const result = await processTimeCardFile({ base64, mimeType });
        allExtractedData.push(...result);
      }

      // Sanitize and validate the data from the API to prevent rendering errors.
      const sanitizedAndValidatedData = allExtractedData
        .map(card => {
          if (!card || typeof card !== 'object' || !card.headers || !card.data) {
            console.warn('Skipping malformed card object in API response:', card);
            return null;
          }
          
          const sanitizedHeaders = Array.isArray(card.headers) ? card.headers.map(h => String(h ?? "")) : [];
          const headerCount = sanitizedHeaders.length;

          const sanitizedData = Array.isArray(card.data) ? card.data
            .map(row => {
              if (!Array.isArray(row)) return null; 
              
              let sanitizedRow = row.map(cell => String(cell ?? ""));

              // Adjust row length to match header count
              if (sanitizedRow.length < headerCount) {
                sanitizedRow = [...sanitizedRow, ...Array(headerCount - sanitizedRow.length).fill("")];
              } else if (sanitizedRow.length > headerCount) {
                sanitizedRow = sanitizedRow.slice(0, headerCount);
              }
              return sanitizedRow;
            })
            .filter((row): row is string[] => row !== null)
          : [];

          const sanitizedCard: TimeCardData = {
            title: {
              yearMonth: String(card.title?.yearMonth ?? ""),
              name: String(card.title?.name ?? ""),
            },
            headers: sanitizedHeaders,
            data: sanitizedData,
          };
          return sanitizedCard;
        })
        .filter((card): card is TimeCardData => card !== null);

      if (allExtractedData.length > 0 && sanitizedAndValidatedData.length === 0) {
        throw new Error("AIは応答しましたが、期待されるデータ形式と一致しませんでした。ファイルがタイムカード形式であることを確認してください。");
      }

      // Merge data for the same person and month using the sanitized data
      const mergedData = new Map<string, TimeCardData>();
      sanitizedAndValidatedData.forEach(card => {
        const key = `${card.title.name.replace(/\s+/g, '')}-${card.title.yearMonth.replace(/\s+/g, '')}`;
        if (mergedData.has(key)) {
          const existingCard = mergedData.get(key)!;
          existingCard.data.push(...card.data);
          // Sort by the value in the first column, assuming it's the date
          existingCard.data.sort((a, b) => {
              const dateA = parseInt(a[0]?.trim(), 10) || 0;
              const dateB = parseInt(b[0]?.trim(), 10) || 0;
              return dateA - dateB;
          });
        } else {
          mergedData.set(key, JSON.parse(JSON.stringify(card))); // Deep copy
        }
      });
      setTimeCardData(Array.from(mergedData.values()));

    } catch (e: any) {
      console.error(e);
      setError(`処理中にエラーが発生しました:\n${e.message || JSON.stringify(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => {
    setTimeCardData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      if(newData[cardIndex] && newData[cardIndex].data[rowIndex]) {
        newData[cardIndex].data[rowIndex][cellIndex] = value;
      }
      return newData;
    });
  };

  const handleTitleChange = (cardIndex: number, field: 'yearMonth' | 'name', value: string) => {
    setTimeCardData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      if (newData[cardIndex] && newData[cardIndex].title) {
        newData[cardIndex].title[field] = value;
      }
      return newData;
    });
  };
  
  const handleDownloadSingleCard = (card: TimeCardData) => {
    const wb = XLSX.utils.book_new();
    const sheetName = `${card.title.yearMonth} ${card.title.name}`.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
    const ws_data = [
      ['年月', card.title.yearMonth],
      ['氏名', card.title.name],
      [], // Empty row
      card.headers,
      ...card.data
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const name = card.title.name.replace(/\s+/g, '').replace(/[\\/*?:"<>|]/g, '_');
    const yearMonth = card.title.yearMonth.replace(/\s+/g, '').replace(/[\\/*?:"<>|]/g, '_');
    const fileName = (name && yearMonth) ? `${name}_${yearMonth}.xlsx` : 'TimeCard.xlsx';
    
    XLSX.writeFile(wb, fileName);
  };

  const handleDownloadAll = () => {
    if (timeCardData.length === 0) return;

    const wb = XLSX.utils.book_new();
    timeCardData.forEach(card => {
      const sheetName = `${card.title.yearMonth} ${card.title.name}`.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
      const ws_data = [
        ['年月', card.title.yearMonth],
        ['氏名', card.title.name],
        [], // Empty row for spacing
        card.headers,
        ...card.data
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, 'TimeCards.xlsx');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">タイムカード OCR to Excel</h1>
          <p className="mt-2 text-gray-600">
            タイムカードの画像やPDFをアップロードするとAIが内容をテキスト化します。<br/>
            読み取りは完ぺきではないため、この画面上で直接、数字や文字を修正してください。<br/>
            修正後、Excelファイルとしてダウンロードできます。
          </p>
        </header>

        <main className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">1. ファイルをアップロード</h2>
            <MultiFileUploader 
              onFilesUpload={handleFilesUpload} 
              previews={previews} 
              onRemoveFile={handleRemoveFile}
              onClearAll={handleClearAll}
              onPreviewClick={handlePreviewClick}
            />
          </div>
          
          <div className="text-center">
            <button
              onClick={handleProcess}
              disabled={loading || previews.length === 0}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <ProcessingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  処理中...
                </>
              ) : '2. 処理を開始'}
            </button>
          </div>
          
          {error && (
            <div className="p-4 bg-red-100 text-red-700 border border-red-400 rounded-md">
              <h3 className="font-bold">エラーが発生しました</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          )}

          {timeCardData.length > 0 && (
            <div ref={resultsRef} className="p-6 bg-white rounded-lg shadow-md">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-700">3. 結果の確認と修正</h2>
                <button
                  onClick={handleDownloadAll}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <DownloadIcon className="-ml-1 mr-2 h-5 w-5" />
                  すべてExcel形式でダウンロード
                </button>
              </div>
              <div className="space-y-8">
                {timeCardData.map((card, index) => (
                  <div key={index} className="border-t pt-6 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                        <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow mr-4 min-w-[200px]">
                            <input
                                type="text"
                                value={card.title.yearMonth}
                                onChange={(e) => handleTitleChange(index, 'yearMonth', e.target.value)}
                                className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full sm:w-auto"
                                aria-label="Edit Year and Month"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="text"
                                value={card.title.name}
                                onChange={(e) => handleTitleChange(index, 'name', e.target.value)}
                                className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full sm:w-auto flex-grow"
                                aria-label="Edit Name"
                            />
                        </div>
                        <button
                            onClick={() => handleDownloadSingleCard(card)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0"
                            aria-label={`${card.title.name}のタイムカードをダウンロード`}
                        >
                            <DownloadIcon className="-ml-0.5 mr-2 h-4 w-4" />
                            このカードをダウンロード
                        </button>
                    </div>
                    <TimeCardTable cardIndex={index} headers={card.headers} data={card.data} onDataChange={handleDataChange} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Powered by Google Gemini API</p>
        </footer>
      </div>

      {modalPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
          onClick={() => setModalPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-preview-title"
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <h2 id="image-preview-title" className="sr-only">Image Preview: {modalPreview.name}</h2>
            <img src={modalPreview.url!} alt={modalPreview.name} className="max-w-[90vw] max-h-[90vh] object-contain" />
            <button
              onClick={() => setModalPreview(null)}
              className="absolute -top-2 -right-2 sm:top-2 sm:right-2 bg-white text-black rounded-full p-1 shadow-lg"
              aria-label="Close image preview"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
