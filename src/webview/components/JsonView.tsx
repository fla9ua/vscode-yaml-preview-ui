import * as React from 'react';
import { useState, useEffect } from 'react';

interface JsonViewProps {
  data: any;
}

export const JsonView: React.FC<JsonViewProps> = ({ data }) => {
  // すべてのパスを初期状態で展開するための関数
  const getAllPaths = (obj: any, currentPath = 'root'): string[] => {
    if (obj === null || obj === undefined) {
      return [];
    }

    let paths: string[] = [currentPath];

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          paths = [...paths, ...getAllPaths(item, `${currentPath}[${index}]`)];
        }
      });
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          paths = [...paths, ...getAllPaths(obj[key], `${currentPath}.${key}`)];
        }
      });
    }

    return paths;
  };

  // 特定のノードが開かれているかどうかを追跡
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 初期表示時にすべてのノードを展開
  useEffect(() => {
    if (data) {
      const allPaths = getAllPaths(data);
      setExpandedNodes(new Set(allPaths));
    }
  }, [data]);

  // データが無効な場合の表示
  if (data === null || data === undefined) {
    return <div className="json-view-empty">No valid data to display</div>;
  }

  // ノードの展開/折りたたみを切り替える
  const toggleNode = (path: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(path)) {
      newExpandedNodes.delete(path);
    } else {
      newExpandedNodes.add(path);
    }
    setExpandedNodes(newExpandedNodes);
  };

  // 値の型に基づいたフォーマット表示
  const renderValue = (value: any, path: string) => {
    // 値がnullの場合
    if (value === null) {
      return <span className="json-null">null</span>;
    }

    // 値がundefinedの場合
    if (value === undefined) {
      return <span className="json-undefined">undefined</span>;
    }

    // 値が配列の場合
    if (Array.isArray(value)) {
      return renderArray(value, path);
    }

    // 値がオブジェクトの場合
    if (typeof value === 'object') {
      return renderObject(value, path);
    }

    // 値が文字列の場合
    if (typeof value === 'string') {
      return <span className="json-string">"{value}"</span>;
    }

    // 値が数値の場合
    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>;
    }

    // 値が真偽値の場合
    if (typeof value === 'boolean') {
      return <span className="json-boolean">{value.toString()}</span>;
    }

    // その他の型の場合
    return <span>{String(value)}</span>;
  };

  // オブジェクトのレンダリング
  const renderObject = (obj: any, path: string) => {
    const isExpanded = expandedNodes.has(path);
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return <span className="json-object-empty">{'{}'}</span>;
    }

    return (
      <div className="json-object">
        <span 
          className={`json-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
          onClick={() => toggleNode(path)}
        >
          {isExpanded ? '▼' : '▶'} {'{'}
        </span>
        {isExpanded && (
          <div className="json-object-body">
            {keys.map((key, index) => (
              <div key={index} className="json-property">
                <span className="json-property-name">"{key}":</span>{' '}
                {renderValue(obj[key], `${path}.${key}`)}
                {index < keys.length - 1 && <span>,</span>}
              </div>
            ))}
          </div>
        )}
        <span>{isExpanded ? '}' : '... }'}</span>
      </div>
    );
  };

  // 配列のレンダリング
  const renderArray = (arr: any[], path: string) => {
    const isExpanded = expandedNodes.has(path);

    if (arr.length === 0) {
      return <span className="json-array-empty">[]</span>;
    }

    return (
      <div className="json-array">
        <span 
          className={`json-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
          onClick={() => toggleNode(path)}
        >
          {isExpanded ? '▼' : '▶'} [
        </span>
        {isExpanded && (
          <div className="json-array-body">
            {arr.map((item, index) => (
              <div key={index} className="json-array-item">
                {renderValue(item, `${path}[${index}]`)}
                {index < arr.length - 1 && <span>,</span>}
              </div>
            ))}
          </div>
        )}
        <span>{isExpanded ? ']' : '... ]'}</span>
      </div>
    );
  };

  // ルートのレンダリング
  return (
    <div className="json-view">
      <style>
        {`
          .json-view {
            font-family: monospace;
            font-size: 14px;
            line-height: 1.5;
            padding: 16px;
            background-color: #ffffff;
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            color: #333;
            overflow-x: auto;
          }
          .json-property {
            margin-left: 24px;
            padding: 3px 0;
          }
          .json-array-item {
            margin-left: 24px;
            padding: 3px 0;
          }
          .json-property-name {
            color: #0451a5;
            font-weight: 500;
          }
          .json-string {
            color: #a31515;
          }
          .json-number {
            color: #098658;
          }
          .json-boolean {
            color: #0000ff;
            font-weight: bold;
          }
          .json-null, .json-undefined {
            color: #999;
            font-style: italic;
          }
          .json-toggle {
            cursor: pointer;
            user-select: none;
            color: #333;
            font-weight: bold;
          }
          .json-toggle:hover {
            text-decoration: underline;
            color: #2196f3;
          }
          .json-view-empty {
            padding: 20px;
            text-align: center;
            color: #666;
            font-style: italic;
            background-color: #f8f8f8;
            border-radius: 4px;
            border: 1px solid #ddd;
          }
          .json-object-empty, .json-array-empty {
            color: #666;
            font-style: italic;
          }
          .json-object, .json-array {
            margin: 2px 0;
          }
          .json-object-body, .json-array-body {
            margin-top: 4px;
            margin-bottom: 4px;
          }
        `}
      </style>
      {renderValue(data, 'root')}
    </div>
  );
}; 