import React, { useMemo } from 'react';
import { ProcessedTable, WorkPattern } from '../types';
import { parseTime } from '../services/utils';

const CalculatedRow: React.FC<{
  rowData: { rowData: string[]; selectedPatternId?: string; };
  headers: string[];
  workPatterns: WorkPattern[];
  onPatternChange: (rowIndex: number, patternId: string) => void;
  onDataChange: (rowIndex: number, cellIndex: number, value: string) => void;
  rowIndex: number;
}> = ({ rowData, headers, workPatterns, onPatternChange, onDataChange, rowIndex }) => {

  const findHeaderIndex = (name: string) => headers.findIndex(h => h.includes(name));

  const { calculated, error } = useMemo(() => {
    const outTimeIndex = findHeaderIndex('退勤');
    const inTimeIndex = findHeaderIndex('出勤');

    const inTimeStr = rowData.rowData[inTimeIndex];
    const outTimeStr = rowData.rowData[outTimeIndex];

    if (!inTimeStr || !outTimeStr) {
      return { calculated: {}, error: '打刻漏れ' };
    }

    const inTime = parseTime(inTimeStr);
    const outTime = parseTime(outTimeStr);

    if (inTime === null || outTime === null) {
      return { calculated: {}, error: '時刻形式不正' };
    }

    if (outTime <= inTime) {
      return { calculated: {}, error: '時刻逆転' };
    }

    const pattern = workPatterns.find(p => p.id === rowData.selectedPatternId);
    if (!pattern) {
      return { calculated: {}, error: 'パターン未選択' };
    }

    const actualWorkHours = outTime - inTime - pattern.breakTimeHours;
    if (actualWorkHours > 12) {
        return { calculated: { actualWorkHours: actualWorkHours.toFixed(2) }, error: '長時間労働' };
    }

    const scheduledWorkHours = parseTime(pattern.endTime)! - parseTime(pattern.startTime)! - pattern.breakTimeHours;
    const overtime = Math.max(0, actualWorkHours - scheduledWorkHours);
    
    const lateNightStart = 22;
    const lateNightEnd = 29; // 24 + 5
    const lateNightHours = Math.max(0, Math.min(outTime, lateNightEnd) - Math.max(inTime, lateNightStart));

    const isLate = inTime > parseTime(pattern.startTime)!;
    const isEarlyLeave = outTime < parseTime(pattern.endTime)!;

    return {
      calculated: {
        actualWorkHours: actualWorkHours.toFixed(2),
        overtime: overtime.toFixed(2),
        lateNightHours: lateNightHours.toFixed(2),
        status: `${isLate ? '遅刻' : ''}${isEarlyLeave ? (isLate ? '/' : '') + '早退' : ''}`,
      },
      error: null,
    };
  }, [rowData, headers, workPatterns]);

  const errorClass = error ? 'bg-red-100' : '';

  return (
    <tr className={`border-b ${errorClass}`}>
      {rowData.rowData.map((cell, cellIndex) => (
        <td key={cellIndex} className="px-4 py-2 whitespace-nowrap">
          <input
            type="text"
            value={cell || ''}
            onChange={(e) => onDataChange(rowIndex, cellIndex, e.target.value)}
            className={`w-full px-1 py-0.5 border border-transparent focus:outline-none focus:border-blue-500 rounded-sm bg-transparent`}
          />
        </td>
      ))}
      <td className="px-4 py-2 whitespace-nowrap">
        <select value={rowData.selectedPatternId || ''} onChange={(e) => onPatternChange(rowIndex, e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
            <option value="">選択...</option>
            {workPatterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{calculated.actualWorkHours || '-'}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{calculated.overtime || '-'}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{calculated.lateNightHours || '-'}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500 font-medium">{calculated.status || error || '-'}</td>
    </tr>
  );
};

const DataTable: React.FC<{
  card: ProcessedTable;
  workPatterns: WorkPattern[];
  onDataChange: (cardId: string, rowIndex: number, cellIndex: number, value: string) => void;
  onPatternChange: (cardId: string, rowIndex: number, patternId: string) => void;
}> = ({ card, workPatterns, onDataChange, onPatternChange }) => {
  
  const tableHeaders = [...card.headers, '勤務パターン', '実労働時間', '時間外', '深夜', '状態'];

  return (
    <div className="overflow-x-auto">
      <table className="bg-white">
        <thead className="bg-gray-100">
          <tr>
            {tableHeaders.map((header, index) => (
              <th key={index} className="px-4 py-2 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(card.data || []).map((row, rowIndex) => (
            <CalculatedRow 
              key={rowIndex}
              rowIndex={rowIndex}
              rowData={row}
              headers={card.headers}
              workPatterns={workPatterns}
              onDataChange={(rIndex, cIndex, val) => onDataChange(card.id, rIndex, cIndex, val)}
              onPatternChange={(rIndex, pId) => onPatternChange(card.id, rIndex, pId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
