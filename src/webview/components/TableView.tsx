import * as React from 'react';
import { useState, ReactNode, useRef, useEffect } from 'react';
import * as jsYaml from 'js-yaml';

interface TableViewProps {
  data: any;
  vscodeApi: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
  yamlContent: string;
}

interface NestedTableProps {
  data: any;
  level: number;
  path?: string[];
  onEditValue: (path: string[], newValue: any) => void;
  onEditKey: (path: string[], oldKey: string, newKey: string) => void;
}

interface EditableCellProps {
  value: any;
  path: string[];
  onSave: (path: string[], newValue: any) => void;
}

interface EditableKeyCellProps {
  keyName: string;
  path: string[];
  onSave: (path: string[], oldKey: string, newKey: string) => void;
}

// 編集可能なキーセルコンポーネント
const EditableKeyCell: React.FC<EditableKeyCellProps> = ({ keyName, path, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(keyName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== keyName && editValue.trim() !== '') {
      onSave(path, keyName, editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(keyName);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="key-cell-input"
        style={{
          width: '90%',
          boxSizing: 'border-box',
          padding: '8px',
          border: '1px solid #2196f3',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'bold',
          backgroundColor: '#e6f7ff'
        }}
      />
    );
  }

  return (
    <div className="key-text" onDoubleClick={handleDoubleClick}>
      {keyName}
    </div>
  );
};

// 編集可能なセルコンポーネント
const EditableCell: React.FC<EditableCellProps> = ({ value, path, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value !== null && value !== undefined ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    let finalValue: any = editValue;
    
    // 値の型を推測して変換
    if (editValue === 'true') {
      finalValue = true;
    } else if (editValue === 'false') {
      finalValue = false;
    } else if (!isNaN(Number(editValue)) && editValue !== '') {
      finalValue = Number(editValue);
    } else if (editValue === '') {
      finalValue = null;
    }
    
    onSave(path, finalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value !== null && value !== undefined ? String(value) : '');
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px',
          border: '1px solid #2196f3',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit'
        }}
      />
    );
  }

  if (typeof value === 'boolean') {
    return <span className="boolean-value" onDoubleClick={handleDoubleClick}>{value.toString()}</span>;
  }

  if (typeof value === 'number') {
    return <span className="number-value" onDoubleClick={handleDoubleClick}>{value}</span>;
  }

  if (typeof value === 'string') {
    if (value.length > 100) {
      return <span className="string-value" onDoubleClick={handleDoubleClick}>{value.substring(0, 100)}...</span>;
    }
    return <span className="string-value" onDoubleClick={handleDoubleClick}>{value}</span>;
  }

  if (value === null || value === undefined) {
    return <span className="undefined-value" onDoubleClick={handleDoubleClick}>undefined</span>;
  }

  return <span onDoubleClick={handleDoubleClick}>{String(value)}</span>;
};

export const TableView: React.FC<TableViewProps> = ({ data, vscodeApi, yamlContent }) => {
  // データが無効な場合の表示
  if (data === null || data === undefined) {
    return <div className="table-view-empty">No valid data to display</div>;
  }
  
  // 保存状態の管理
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // VSCodeからのメッセージを処理
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('TableView received message:', message);
      
      if (message.command === 'saveComplete') {
        console.log('Save completion status:', message.success);
        setIsSaving(false);
        
        if (!message.success) {
          setSaveError(message.error || 'Failed to save changes');
          setTimeout(() => setSaveError(null), 5000); // 5秒後にエラーメッセージを消す
        }
      }
    };
    
    // イベントリスナーを追加
    window.addEventListener('message', handleMessage);
    
    // クリーンアップ関数
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 保存状態が長時間続く場合のタイムアウト
  useEffect(() => {
    let timeoutId: number | null = null;
    
    if (isSaving) {
      console.log('Setting save timeout');
      // 保存中の状態が8秒以上続いたら自動的にリセット
      timeoutId = window.setTimeout(() => {
        console.log('Save timeout - resetting state');
        setIsSaving(false);
        setSaveError('保存の応答がタイムアウトしました。変更が反映されているか確認してください。');
        setTimeout(() => setSaveError(null), 5000);
      }, 8000);
    }
    
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isSaving]);

  // キーを変更する関数
  const updateYamlKey = (path: string[], oldKey: string, newKey: string) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // YAMLをJavaScriptオブジェクトに変換
      const yamlObj = jsYaml.load(yamlContent) as Record<string, any>;
      
      // 最上位レベルのキーを変更する場合の特別処理
      if (path.length === 0) {
        if (!(oldKey in yamlObj)) {
          setIsSaving(false);
          return; // キーが存在しない場合は何もしない
        }
        
        // 元のオブジェクトの順序を維持するための新しいオブジェクトを作成
        const newObj: any = {};
        
        // 元のオブジェクトのキーを順番に処理し、変更するキーの場合は新しいキーで追加
        Object.keys(yamlObj).forEach(key => {
          if (key === oldKey) {
            newObj[newKey] = yamlObj[key];
          } else {
            newObj[key] = yamlObj[key];
          }
        });
        
        // 更新されたオブジェクトをYAMLに変換
        const updatedYaml = jsYaml.dump(newObj, { 
          lineWidth: -1, 
          noRefs: true, 
          sortKeys: false 
        });
        
        console.log(`Sending top-level key update from ${oldKey} to ${newKey}`);
        
        // VSCodeに更新を通知
        try {
          // 1. VSCode API を使用
          vscodeApi.postMessage({
            command: 'updateYaml',
            content: updatedYaml
          });
          console.log('updateYaml message sent for top-level key update via vscodeApi');
          
          // 2. カスタムイベントも発行
          const customEvent = new CustomEvent('yaml-editor-update', {
            detail: {
              command: 'updateYaml',
              content: updatedYaml
            }
          });
          window.dispatchEvent(customEvent);
          console.log('Custom event dispatched for top-level key update');
        } catch (err) {
          console.error('Error sending update:', err);
          setIsSaving(false);
          setSaveError('Error sending update: ' + String(err));
        }
        
        return;
      }
      
      // ネストされたオブジェクトの場合
      let parent: any = yamlObj;
      let current = parent;
      
      // 親オブジェクトまでたどる
      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] === undefined) {
          setIsSaving(false);
          return; // パスが存在しない場合は何もしない
        }
        current = current[path[i]];
      }
      
      // 最後の親オブジェクト内のターゲットオブジェクト
      const parentKey = path[path.length - 1];
      const targetObj = current[parentKey];
      
      // ターゲットがオブジェクトでない場合や、oldKeyが存在しない場合は処理終了
      if (typeof targetObj !== 'object' || targetObj === null || !(oldKey in targetObj)) {
        setIsSaving(false);
        return;
      }
      
      // キーの順序を維持するための新しいオブジェクトを作成
      const newObj: any = {};
      
      // 元のオブジェクトのキーを順番に処理し、変更するキーの場合は新しいキーで追加
      Object.keys(targetObj).forEach(key => {
        if (key === oldKey) {
          newObj[newKey] = targetObj[key];
        } else {
          newObj[key] = targetObj[key];
        }
      });
      
      // 親オブジェクト内のターゲットを更新
      current[parentKey] = newObj;
      
      // 更新されたオブジェクトをYAMLに変換
      const updatedYaml = jsYaml.dump(yamlObj, { 
        lineWidth: -1, 
        noRefs: true, 
        sortKeys: false 
      });
      
      console.log(`Sending key update from ${oldKey} to ${newKey} at path: ${path.join('.')}`);
      
      // VSCodeに更新を通知
      try {
        // 1. VSCode API を使用
        vscodeApi.postMessage({
          command: 'updateYaml',
          content: updatedYaml
        });
        console.log('updateYaml message sent for key update via vscodeApi');
        
        // 2. カスタムイベントも発行
        const customEvent = new CustomEvent('yaml-editor-update', {
          detail: {
            command: 'updateYaml',
            content: updatedYaml
          }
        });
        window.dispatchEvent(customEvent);
        console.log('Custom event dispatched for key update');
      } catch (err) {
        console.error('Error sending update:', err);
        setIsSaving(false);
        setSaveError('Error sending update: ' + String(err));
      }
      
    } catch (err) {
      console.error('Failed to update YAML key:', err);
      setIsSaving(false);
      setSaveError('Failed to update key: ' + String(err));
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  // YAMLオブジェクトの特定のパスの値を更新する関数
  const updateYamlValue = (path: string[], newValue: any) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // YAMLをJavaScriptオブジェクトに変換
      const yamlObj = jsYaml.load(yamlContent) as Record<string, any>;
      
      // オブジェクトのネストされたパスを更新
      let current: any = yamlObj;
      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] === undefined) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }
      
      // 最後のプロパティを更新
      const lastKey = path[path.length - 1];
      if (lastKey !== undefined) {
        current[lastKey] = newValue;
      }
      
      // 更新されたオブジェクトをYAMLに変換
      const updatedYaml = jsYaml.dump(yamlObj, { 
        lineWidth: -1, // 行の折り返しなし
        noRefs: true, // 循環参照の処理
        sortKeys: false // キーの順序を保持
      });
      
      console.log(`Sending value update at path: ${path.join('.')}`);
      
      // 更新の前に既存のエラーをクリア
      setSaveError(null);
      
      // VSCodeに更新を通知 - 両方の方法で通信を試みる
      try {
        // 1. VSCode API を使用
        vscodeApi.postMessage({
          command: 'updateYaml',
          content: updatedYaml
        });
        console.log('updateYaml message sent for value update via vscodeApi');
        
        // 2. カスタムイベントも発行（代替手段）
        const customEvent = new CustomEvent('yaml-editor-update', {
          detail: {
            command: 'updateYaml',
            content: updatedYaml
          }
        });
        window.dispatchEvent(customEvent);
        console.log('Custom event dispatched for value update');
      } catch (err) {
        console.error('Error sending update:', err);
        setIsSaving(false);
        setSaveError('Error sending update: ' + String(err));
      }
      
    } catch (err) {
      console.error('Failed to update YAML:', err);
      setIsSaving(false);
      setSaveError('Failed to update value: ' + String(err));
      setTimeout(() => setSaveError(null), 5000);
    }
  };

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
            position: relative;
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
            cursor: pointer;
          }
          .key-cell:hover {
            background-color: #e3f2fd;
          }
          .key-text {
            padding: 2px 4px;
            border-radius: 2px;
            transition: background-color 0.2s;
          }
          .key-text:hover {
            background-color: #d0e8ff;
          }
          .value-cell {
            background-color: #ffffff;
            cursor: text;
          }
          .value-cell:hover {
            background-color: #f5f5f5;
          }
          .value-cell:active {
            background-color: #e3f2fd;
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
          .editable-hint {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
            font-style: italic;
            text-align: right;
          }
          .save-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            background-color: rgba(0, 120, 215, 0.9);
            color: white;
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }
          .error-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            background-color: rgba(215, 40, 40, 0.9);
            color: white;
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <NestedTable 
        data={data} 
        level={0} 
        onEditValue={updateYamlValue} 
        onEditKey={updateYamlKey}
      />
      <div className="editable-hint">キーと値はダブルクリックで編集できます</div>
      
      {/* 保存中インジケータ */}
      {isSaving && (
        <div className="save-indicator">
          保存中...
        </div>
      )}
      
      {/* エラーインジケータ */}
      {saveError && (
        <div className="error-indicator">
          エラー: {saveError}
        </div>
      )}
    </div>
  );
};

// ネストされたテーブルを表示するコンポーネント
const NestedTable: React.FC<NestedTableProps> = ({ data, level, path = [], onEditValue, onEditKey }) => {
  // シンプルな値の表示
  const renderSimpleValue = (value: any, currentPath: string[]): React.ReactNode => {
    return <EditableCell value={value} path={currentPath} onSave={onEditValue} />;
  };

  // 配列アイテムの表示
  const renderArrayItems = (items: any[], currentPath: string[]): React.ReactNode => {
    // すべての項目が文字列のときはバレットリストで表示
    if (items.length > 0 && items.every(item => typeof item === 'string')) {
      return (
        <ul className="bullet-list">
          {items.map((item, index) => (
            <li key={index} className="bullet-item">
              {renderSimpleValue(item, [...currentPath, index.toString()])}
            </li>
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
              <NestedTable 
                data={item} 
                level={level + 1} 
                path={[...currentPath, index.toString()]} 
                onEditValue={onEditValue}
                onEditKey={onEditKey} 
              />
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
              <NestedTable 
                data={item} 
                level={level + 1} 
                path={[...currentPath, index.toString()]} 
                onEditValue={onEditValue}
                onEditKey={onEditKey}
              />
            ) : (
              renderSimpleValue(item, [...currentPath, index.toString()])
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
    return <>{renderArrayItems(data, path)}</>;
  }
  
  // プリミティブ値の場合
  if (organizedData.has('(value)')) {
    return <>{renderSimpleValue(data, path)}</>;
  }
  
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
            <td className="key-cell">
              {key !== '(array)' && key !== '(value)' ? (
                <EditableKeyCell 
                  keyName={key} 
                  path={path} 
                  onSave={onEditKey} 
                />
              ) : (
                key
              )}
            </td>
            <td className="value-cell">
              {values.map((value, index) => (
                <div key={index}>
                  {isSpecialFormatArray(key, value) ? (
                    <ul className="bullet-list">
                      {Array.isArray(value) && value.map((item, itemIndex) => (
                        <li key={itemIndex} className="bullet-item">
                          {renderSimpleValue(item, [...path, key, itemIndex.toString()])}
                        </li>
                      ))}
                    </ul>
                  ) : typeof value === 'object' && value !== null ? (
                    <div className="nested-table-container">
                      <NestedTable 
                        data={value} 
                        level={level + 1} 
                        path={[...path, key]} 
                        onEditValue={onEditValue}
                        onEditKey={onEditKey}
                      />
                    </div>
                  ) : (
                    renderSimpleValue(value, [...path, key])
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