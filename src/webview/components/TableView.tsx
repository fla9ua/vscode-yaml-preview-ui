import * as React from 'react';
import { useState, ReactNode } from 'react';

interface TableViewProps {
  data: any;
}

interface NestedTableProps {
  data: any;
  level: number;
}

export const TableView: React.FC<TableViewProps> = ({ data }) => {
  // データが無効な場合の表示
  if (data === null || data === undefined) {
    return <div className="table-view-empty">No valid data to display</div>;
  }

  return (
    <div className="table-view">
      <style>
        {`
          .table-view {
            font-family: var(--vscode-editor-font-family);
            overflow-x: auto;
            background-color: #ffffff;
            border-radius: 6px;
            padding: 16px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            color: #333;
          }
          .yaml-table {
            border-collapse: collapse;
            width: 100%;
            margin: 0;
            border: 1px solid #ddd;
            background-color: #f8f8f8;
          }
          .yaml-table th, .yaml-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          .yaml-table th {
            background-color: #e0e0e0;
            color: #333;
            font-weight: bold;
          }
          .key-cell {
            width: 200px;
            font-weight: bold;
            background-color: #ececec;
            border-right: 2px solid #ccc;
            color: #333;
          }
          .description-cell {
            background-color: #ececec;
            border-right: 2px solid #ccc;
            color: #666;
            font-style: italic;
            width: 200px;
          }
          .value-cell {
            background-color: #ffffff;
          }
          .nested-table-container {
            padding: 0;
          }
          .nested-table-container .yaml-table {
            margin: 0;
            width: 100%;
            border-width: 1px;
          }
          .level-0 .key-cell {
            background-color: #e6f0ff;
          }
          .level-1 .key-cell {
            background-color: #e6f5ff;
          }
          .level-2 .key-cell {
            background-color: #e6faff;
          }
          .level-3 .key-cell {
            background-color: #e6fff5;
          }
          .level-4 .key-cell {
            background-color: #e6ffea;
          }
          .level-0 {
            border-left: 5px solid #0078d7;
          }
          .level-1 {
            border-left: 5px solid #2b88d8;
          }
          .level-2 {
            border-left: 5px solid #5ea3e4;
          }
          .level-3 {
            border-left: 5px solid #83baeb;
          }
          .level-4 {
            border-left: 5px solid #a7d1f1;
          }
          .undefined-value {
            color: #999;
            font-style: italic;
          }
          .string-value {
            color: #0451a5;
          }
          .number-value {
            color: #098658;
          }
          .boolean-value {
            color: #0000ff;
            font-weight: bold;
          }
          .array-items {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .array-item {
            padding: 4px 6px;
            background-color: #fff;
            border-radius: 3px;
          }
          .array-item:not(:last-child) {
            border-bottom: 1px dashed #ccc;
            margin-bottom: 4px;
          }
          .table-view-empty {
            padding: 20px;
            text-align: center;
            color: #666;
            font-style: italic;
            background-color: #f8f8f8;
            border-radius: 4px;
            border: 1px solid #ddd;
          }
          .list-container {
            margin: 0;
            padding-left: 16px;
            list-style-type: none;
          }
          .bullet-list {
            margin: 4px 0;
            padding-left: 0;
            list-style-type: none;
          }
          .bullet-item {
            position: relative;
            padding: 4px 0 4px 18px;
            margin-bottom: 2px;
          }
          .bullet-item::before {
            content: "• ";
            color: #0078d7;
            position: absolute;
            left: 0;
            font-weight: bold;
          }
          hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 8px 0;
          }
        `}
      </style>
      <NestedTable data={data} level={0} />
    </div>
  );
};

// ネストされたテーブルを表示するコンポーネント
const NestedTable: React.FC<NestedTableProps> = ({ data, level }) => {
  // シンプルな値の表示
  const renderSimpleValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="undefined-value">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="boolean-value">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="number-value">{value}</span>;
    }

    if (typeof value === 'string') {
      // 文字列の場合、ダブルクォーテーションなしで表示
      // 長い文字列は省略表示
      if (value.length > 100) {
        return <span className="string-value">{value.substring(0, 100)}...</span>;
      }
      return <span className="string-value">{value}</span>;
    }

    return String(value);
  };

  // 配列アイテムの表示
  const renderArrayItems = (items: any[]): React.ReactNode => {
    // すべての項目が文字列のときはバレットリストで表示
    if (items.length > 0 && items.every(item => typeof item === 'string')) {
      return (
        <ul className="bullet-list">
          {items.map((item, index) => (
            <li key={index} className="bullet-item">{renderSimpleValue(item)}</li>
          ))}
        </ul>
      );
    }
    
    // 配列内の要素がオブジェクトのときは、専用の処理
    if (items.length > 0 && items.every(item => typeof item === 'object' && item !== null)) {
      return (
        <div className="array-items">
          {items.map((item, index) => (
            <div key={index} className="array-item">
              <NestedTable data={item} level={level + 1} />
            </div>
          ))}
        </div>
      );
    }

    // 混合タイプの配列
    return (
      <div className="array-items">
        {items.map((item, index) => (
          <div key={index} className="array-item">
            {typeof item === 'object' && item !== null ? (
              <NestedTable data={item} level={level + 1} />
            ) : (
              renderSimpleValue(item)
            )}
          </div>
        ))}
      </div>
    );
  };

  // 同じキーを持つデータを結合して整理
  const organizeData = (data: any): Map<string, any[]> => {
    const result = new Map<string, any[]>();
    
    if (Array.isArray(data)) {
      // 配列の場合は特別処理
      result.set('(array)', [data]);
      return result;
    }
    
    if (typeof data !== 'object' || data === null) {
      // プリミティブ値の場合
      result.set('(value)', [data]);
      return result;
    }
    
    // オブジェクトの場合、キーごとにグループ化
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (!result.has(key)) {
          result.set(key, []);
        }
        result.get(key)!.push(value);
      }
    }
    
    return result;
  };
  
  // データが無効な場合
  if (data === null || data === undefined) {
    return <span className="undefined-value">undefined</span>;
  }
  
  // データの整理
  const organizedData = organizeData(data);
  
  // 配列の場合の特別処理
  if (organizedData.has('(array)') && Array.isArray(data)) {
    return <>{renderArrayItems(data)}</>;
  }
  
  // プリミティブ値の場合
  if (organizedData.has('(value)')) {
    return <>{renderSimpleValue(data)}</>;
  }

  // 特定のキーパターンに対するフォーマット
  const hasDescriptionKey = (key: string): boolean => {
    return key === 'description';
  };
  
  // 特定のキーに対する列の幅調整
  const getKeyColumnClass = (key: string): string => {
    if (hasDescriptionKey(key)) {
      return "description-cell";
    }
    return "key-cell";
  };
  
  // 特定の配列表示パターン（supported_formatsなど）を検出
  const isSpecialFormatArray = (key: string, value: any): boolean => {
    return key === 'supported_formats' && Array.isArray(value) && value.length > 0;
  };
  
  // テーブルの表示
  return (
    <table className="yaml-table">
      <tbody className={`level-${level}`}>
        {Array.from(organizedData.entries()).map(([key, values]) => (
          <tr key={key}>
            <td className={getKeyColumnClass(key)}>
              {key}
            </td>
            <td className="value-cell">
              {values.map((value, index) => (
                <div key={index}>
                  {isSpecialFormatArray(key, value) ? (
                    <ul className="bullet-list">
                      {Array.isArray(value) && value.map((item, itemIndex) => (
                        <li key={itemIndex} className="bullet-item">{renderSimpleValue(item)}</li>
                      ))}
                    </ul>
                  ) : typeof value === 'object' && value !== null ? (
                    <div className="nested-table-container">
                      <NestedTable data={value} level={level + 1} />
                    </div>
                  ) : (
                    renderSimpleValue(value)
                  )}
                  {index < values.length - 1 && <hr />}
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}; 