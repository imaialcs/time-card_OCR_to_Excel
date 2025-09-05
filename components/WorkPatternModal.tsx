import React, { useState, useEffect } from 'react';
import { WorkPattern } from '../types';

interface WorkPatternModalProps {
  patterns: WorkPattern[];
  onSave: (patterns: WorkPattern[]) => void;
  onClose: () => void;
}

const WorkPatternModal: React.FC<WorkPatternModalProps> = ({ patterns, onSave, onClose }) => {
  const [localPatterns, setLocalPatterns] = useState<WorkPattern[]>([]);
  const [editingPattern, setEditingPattern] = useState<WorkPattern | null>(null);

  useEffect(() => {
    setLocalPatterns(JSON.parse(JSON.stringify(patterns))); // Deep copy
  }, [patterns]);

  const handleAddNew = () => {
    setEditingPattern({
      id: crypto.randomUUID(),
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      breakTimeHours: 1.0,
    });
  };

  const handleEdit = (pattern: WorkPattern) => {
    setEditingPattern(JSON.parse(JSON.stringify(pattern))); // Deep copy
  };

  const handleDelete = (id: string) => {
    setLocalPatterns(localPatterns.filter(p => p.id !== id));
  };

  const handleSaveEditing = () => {
    if (!editingPattern) return;

    const existingIndex = localPatterns.findIndex(p => p.id === editingPattern.id);
    if (existingIndex > -1) {
      const updated = [...localPatterns];
      updated[existingIndex] = editingPattern;
      setLocalPatterns(updated);
    } else {
      setLocalPatterns([...localPatterns, editingPattern]);
    }
    setEditingPattern(null);
  };

  const handleFinalSave = () => {
    onSave(localPatterns);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4">勤務パターンの設定</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pattern List */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">登録済みパターン</h3>
              <button onClick={handleAddNew} className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">新規追加</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {localPatterns.map(p => (
                <div key={p.id} className="p-2 border-b flex justify-between items-center">
                  <span>{p.name} ({p.startTime}-{p.endTime})</span>
                  <div className="space-x-2">
                    <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline text-sm">編集</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-sm">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editing Form */}
          <div>
            {editingPattern ? (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-4">{localPatterns.some(p => p.id === editingPattern.id) ? 'パターンの編集' : '新規パターン作成'}</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">パターン名</label>
                    <input type="text" id="name" value={editingPattern.name} onChange={e => setEditingPattern({...editingPattern, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" placeholder="例: 正社員" />
                  </div>
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">勤務開始時刻</label>
                    <input type="time" id="startTime" value={editingPattern.startTime} onChange={e => setEditingPattern({...editingPattern, startTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">勤務終了時刻</label>
                    <input type="time" id="endTime" value={editingPattern.endTime} onChange={e => setEditingPattern({...editingPattern, endTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="breakTime" className="block text-sm font-medium text-gray-700">休憩時間 (時間)</label>
                    <input type="number" step="0.25" id="breakTime" value={editingPattern.breakTimeHours} onChange={e => setEditingPattern({...editingPattern, breakTimeHours: parseFloat(e.target.value) || 0})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEditingPattern(null)} className="px-4 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300">キャンセル</button>
                  <button onClick={handleSaveEditing} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">この内容を保存</button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 p-8 border rounded-lg bg-gray-50 h-full flex items-center justify-center">
                <p>左のリストからパターンを選択して編集するか、「新規追加」してください。</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button onClick={() => { handleFinalSave(); onClose(); }} className="px-6 py-2 bg-gray-300 rounded-md hover:bg-gray-400">閉じる</button>
          <button onClick={handleFinalSave} className="px-6 py-2 bg-blue-700 text-white font-semibold rounded-md hover:bg-blue-800">すべての変更を保存</button>
        </div>
      </div>
    </div>
  );
};

export default WorkPatternModal;
