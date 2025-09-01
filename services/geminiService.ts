import { GoogleGenAI, Type } from "@google/genai";
import { TimeCardData } from '../types';

<<<<<<< HEAD
// The type definition for `window.electronAPI` is now in `electron.d.ts`
// which is automatically included by the TypeScript compiler.

const getApiKey = async (): Promise<string> => {
    let apiKey: string | null | undefined = null;
    // Check if running in Electron by looking for the preload script's API
    if (window.electronAPI && typeof window.electronAPI.getApiKey === 'function') {
        apiKey = await window.electronAPI.getApiKey();
    } else {
        // Fallback for web preview environment, which should have process.env.API_KEY
        console.warn("Electron API not found. Using API_KEY from web preview environment.");
        apiKey = process.env.API_KEY;
    }

    if (!apiKey) {
        const errorMessage = window.electronAPI
            ? "APIキーがElectronのメインプロセスで設定されていません。'API_KEY'環境変数が設定されているか確認してください。"
            : "APIキーが見つかりません。Webプレビュー環境で'API_KEY'環境変数が設定されているか確認してください。";
        throw new Error(errorMessage);
    }
    return apiKey;
};

export const processTimeCardFile = async (
  file: { base64: string; mimeType: string }
): Promise<TimeCardData[]> => {
  const apiKey = await getApiKey();

  const ai = new GoogleGenAI({ apiKey });
=======
export const processTimeCardFile = async (
  file: { base64: string; mimeType: string }
): Promise<TimeCardData[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
>>>>>>> 7b386db226a4259bb4a04124e710d90651f0b88d

  const filePart = {
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  };
  
<<<<<<< HEAD
  const textPart = {
    text: `あなたはタイムカードの画像からテキストを抽出するOCRエンジンです。
=======
  const systemInstruction = `あなたはタイムカードの画像からテキストを抽出するOCRエンジンです。
>>>>>>> 7b386db226a4259bb4a04124e710d90651f0b88d
以下のルールに厳密に従って、画像内のすべてのタイムカードからデータを抽出し、指定されたJSON形式で出力してください。

# 全体ルール
- 画像に複数のタイムカードがある場合、それぞれをJSON配列内の個別のオブジェクトとしてください。
- JSONスキーマに100%準拠した、有効なJSON配列のみを出力してください。
- 説明、挨拶、マークダウン(\`\`\`json ... \`\`\`)は絶対に含めないでください。

# 各タイムカードの処理ルール
1.  **title**:
    - \`yearMonth\`: タイムカードの年月（例: 「2025年 8月」）を文字列で抽出します。
    - \`name\`: 氏名を文字列で抽出します。
    - 見つからない場合は空文字列 \`""\` にしてください。
2.  **headers**:
    - 勤怠データの列ヘッダー（例: 「日」「出勤」「退勤」）を文字列の配列として抽出します。
3.  **data**:
    - 各データ行を、文字列の配列に変換します。
    - **見たままを転記**: 文字、数字、記号を一切変更せずにそのまま転記します。
    - **空白のセル**: 空白のセルは空文字列 \`""\` にします。
    - **行の列数を統一**: 各データ行の要素数は、必ず \`headers\` 配列の要素数と一致させてください。足りない場合は \`""\` で埋めてください。
    - **空白行**: 何も書かれていない行も、\`headers\` と同じ数の \`""\` を持つ配列として含めてください。
<<<<<<< HEAD
    - \`data\` は、必ず **文字列の配列の配列 (\`string[][]\`)** となるようにしてください。\`null\` や他の型を含めないでください。`
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [filePart, textPart] },
    config: {
=======
    - \`data\` は、必ず **文字列の配列の配列 (\`string[][]\`)** となるようにしてください。\`null\` や他の型を含めないでください。`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [filePart] },
    config: {
      systemInstruction,
>>>>>>> 7b386db226a4259bb4a04124e710d90651f0b88d
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.OBJECT,
              properties: {
                yearMonth: { type: Type.STRING, description: "タイムカードの年月 (例: 2025年8月)。" },
                name: { type: Type.STRING, description: "タイムカードの氏名 (例: 田中 直子)" },
              },
              required: ["yearMonth", "name"],
            },
            headers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "タイムカードの列ヘッダー (例: ['日付', '出勤', '退勤', '備考'])",
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              description: "タイムカードの勤怠データ。各行は文字列の配列。",
            },
          },
          required: ["title", "headers", "data"],
        },
      },
    },
  });

<<<<<<< HEAD
  if (!response.text) {
    throw new Error("APIからの応答にテキストデータが含まれていませんでした。ファイルを確認してもう一度お試しください。");
  }

  let jsonString = response.text.trim();
  // モデルが稀にマークダウンを付与する場合があるため、除去します。
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.substring(7, jsonString.length - 3).trim();
  } else if (jsonString.startsWith("```")) {
    jsonString = jsonString.substring(3, jsonString.length - 3).trim();
  }

  try {
    const parsedData = JSON.parse(jsonString);
=======
  const jsonString = response.text.trim();
  try {
    const parsedData = JSON.parse(jsonString);
    // Basic validation to ensure the parsed data is an array.
>>>>>>> 7b386db226a4259bb4a04124e710d90651f0b88d
    if (Array.isArray(parsedData)) {
        return parsedData as TimeCardData[];
    } else {
        throw new Error("Parsed JSON is not an array as expected.");
    }
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    console.error("Received response string:", jsonString);
    throw new Error("The API returned a response that could not be parsed as valid JSON.");
  }
};