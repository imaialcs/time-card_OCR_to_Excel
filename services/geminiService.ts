import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedData } from '../types';

// Helper function to get API key from the main process in a secure way.
const getApiKey = async (): Promise<string> => {
  if (window.electronAPI?.getApiKey) {
    const apiKey = await window.electronAPI.getApiKey();
    if (apiKey) {
      return apiKey;
    }
  }
  throw new Error("APIキーが見つかりません。'API_KEY'環境変数が設定されているか確認してください。");
};

export const processDocumentPages = async (
  pages: { base64: string; mimeType: string, name: string }[]
): Promise<ProcessedData[]> => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const allProcessedData: ProcessedData[] = [];

  for (const page of pages) {
    const filePart = {
      inlineData: {
        data: page.base64,
        mimeType: page.mimeType,
      },
    };

    const prompt = `あなたは高度なOCRエンジンです。画像やPDFからテキストを抽出し、その内容に応じて最適な形式で出力します。

# 全体ルール
- **最重要**: 何があっても、指定されたJSONスキーマに100%準拠した有効なJSON配列のみを出力してください。
- 文書が読み取れない、または内容が空の場合でも、必ず空の配列 '[]' を返してください。エラーメッセージや説明は絶対にJSONに含めないでください。
- まず、文書の種類を「テーブル形式」か「文字起こし形式」か判断してください。
  - **テーブル形式**: タイムカード、通帳、請求書など、行と列で構成される構造化された帳票。
  - **文字起こし形式**: 手紙、メモ、記事など、特定の構造を持たない一般的な文章。
- 画像に複数の文書がある場合、それぞれをJSON配列内の個別のオブジェクトとしてください。
- 説明、挨拶、マークダウン('json'など)は絶対に含めないでください。

# 1. テーブル形式の場合の処理ルール
- 'type': 必ず '"table"' という文字列を設定します。
- 'title':
    - 'yearMonth': 文書全体の年月（例: 「2025年 8月」）を抽出します。なければ空文字列 '""'。
    - 'name': 氏名や件名など、文書の主題を抽出します。なければ空文字列 '""'。
- 'headers':
    - データの列ヘッダー（例: 「日」「出勤」「退勤」）を文字列の配列として抽出します。
- 'data':
    - 各データ行を、文字列の配列に変換します。
    - **見たままを転記**: 文字、数字、記号を一切変更せずにそのまま転記します。特に、9:05や8:00のような時間や、1.00のような数字は、欠落させずに必ず文字列として含めてください。
    - **空白のセル**: 空白のセルは空文字列 '""' にします。
    - **行の列数を統一**: 各データ行の要素数は、必ず 'headers' 配列の要素数と一致させてください。足りない場合は '""' で埋めてください。
    - 'data' は、必ず **文字列の配列の配列 ('string[][]')** となるようにしてください。

# 2. 文字起こし形式の場合の処理ルール
- 'type': 必ず '"transcription"' という文字列を設定します。
- 'fileName': この文書のファイル名です。常に '${page.name}' を設定してください。
- 'content':
    - 文書内のすべてのテキストを、改行も含めて一つの文字列として書き起こします。
    - 見たままを忠実に再現してください。`;

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [filePart, textPart] },
    });

    if (!response.text) {
      throw new Error("APIからの応答にテキストデータが含まれていませんでした。ファイルを確認してもう一度お試しください。");
    }

    let jsonString = response.text.trim();
    
    // Find the start and end of the JSON content
    const arrayStart = jsonString.indexOf('[');
    const arrayEnd = jsonString.lastIndexOf(']');
    
    if (arrayStart !== -1 && arrayEnd !== -1) {
      jsonString = jsonString.substring(arrayStart, arrayEnd + 1);
    } else {
      // Fallback for single object response, though the schema expects an array
      const objectStart = jsonString.indexOf('{');
      const objectEnd = jsonString.lastIndexOf('}');
      if (objectStart !== -1 && objectEnd !== -1) {
          jsonString = jsonString.substring(objectStart, objectEnd + 1);
      }
    }

    try {
      const parsedData = JSON.parse(jsonString);
      if (Array.isArray(parsedData)) {
          // Basic validation to ensure the data looks like ProcessedData[]
          const isValid = parsedData.every(item =>
              (item.type === 'table' && 'headers' in item && 'data' in item) ||
              (item.type === 'transcription' && 'content' in item)
          );
          if (isValid) {
              allProcessedData.push(...parsedData as ProcessedData[]);
          } else {
            console.warn("API returned data that did not fully match ProcessedData[] structure for a page:", parsedData);
          }
      } else {
        console.warn("API returned a non-array response for a page:", parsedData);
      }
    } catch (e) {
      console.error("Failed to parse JSON response for a page:", e);
      console.error("Received response string for page:", jsonString);
      // Continue to next page even if one page fails to parse
    }
  }
  return allProcessedData;
};
