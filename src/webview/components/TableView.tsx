import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import * as jsYaml from 'js-yaml';
import { EditableKeyCell } from './EditableKeyCell';
import { EditableCell } from './EditableCell';

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

// コンポーネント定義を削除（外部からインポートされたものを使用）

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
            background-color: var(--panel-background);
            border-radius: 6px;
            padding: 16px;
            box-shadow: 0 2px 10px var(--shadow-color);
            color: var(--text-color);
            position: relative;
          }
          
          .yaml-table {
            border-collapse: collapse;
            width: 100%;
            margin: 0;
            border: 1px solid var(--border-color);
            background-color: var(--panel-background);
          }`}
      </style>
      <style>
        {`
          .yaml-table th, .yaml-table td {
            border: 1px solid var(--border-color);
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          .yaml-table th {
            background-color: var(--background-color);
            color: var(--text-color);
            font-weight: bold;
          }
          .key-cell {
            width: 200px;
            font-weight: bold;
            background-color: var(--format-background);
            border-right: 2px solid var(--border-color);
            color: var(--format-text);
            cursor: pointer;
          }
          .key-cell:hover {
            background-color: var(--button-hover);
            color: var(--button-text);
          }
          .key-text {
            padding: 2px 4px;
            border-radius: 2px;
            transition: background-color 0.2s;
          }
          .key-text:hover {
            background-color: var(--button-hover);
            color: var(--button-text);
          }
          .value-cell {
            background-color: var(--panel-background);
          }
          .value-cell:hover {
            background-color: var(--background-color);
          }
          .nested-table-container {
            padding: 0;
          }
          .nested-table-container .yaml-table {
            margin: 0;
            width: 100%;
            border-width: 1px;
          }
          /* ダークモード対応レベル別スタイル */
          [data-theme='light'] .level-0 .key-cell {
            background-color: #f3f3f5;
            color: #555555;
          }
          [data-theme='light'] .level-1 .key-cell {
            background-color: #f5f5f7;
            color: #555555;
          }
          [data-theme='light'] .level-2 .key-cell {
            background-color: #f7f7f9;
            color: #555555;
          }
          [data-theme='light'] .level-3 .key-cell {
            background-color: #f9f9fb;
            color: #555555;
          }
          [data-theme='light'] .level-4 .key-cell {
            background-color: #fbfbfd;
            color: #555555;
          }
          [data-theme='dark'] .level-0 .key-cell {
            background-color: #2d3439;
            color: #ffffff;
          }
          [data-theme='dark'] .level-1 .key-cell {
            background-color: #33393e;
            color: #ffffff;
          }
          [data-theme='dark'] .level-2 .key-cell {
            background-color: #393f44;
            color: #ffffff;
          }
          [data-theme='dark'] .level-3 .key-cell {
            background-color: #3f454a;
            color: #ffffff;
          }
          [data-theme='dark'] .level-4 .key-cell {
            background-color: #454b50;
            color: #ffffff;
          }
          [data-theme='light'] .level-0 {
            border-left: 5px solid #8a9aa3;
          }
          [data-theme='light'] .level-1 {
            border-left: 5px solid #96a5ad;
          }
          [data-theme='light'] .level-2 {
            border-left: 5px solid #a2b0b7;
          }
          [data-theme='light'] .level-3 {
            border-left: 5px solid #aebbc1;
          }
          [data-theme='light'] .level-4 {
            border-left: 5px solid #bac6cc;
          }
          [data-theme='dark'] .level-0 {
            border-left: 5px solid #4a5a64;
          }
          [data-theme='dark'] .level-1 {
            border-left: 5px solid #56666f;
          }
          [data-theme='dark'] .level-2 {
            border-left: 5px solid #62727a;
          }
          [data-theme='dark'] .level-3 {
            border-left: 5px solid #6e7e85;
          }
          [data-theme='dark'] .level-4 {
            border-left: 5px solid #7a8a90;
          }
          .undefined-value {
            color: #888888;
            font-style: italic;
          }
          [data-theme='light'] .string-value {
            color: #5e7985;
            font-weight: normal;
          }
          [data-theme='light'] .number-value {
            color: #4e9170;
            font-weight: normal;
          }
          [data-theme='light'] .boolean-value {
            color: #69767e;
            font-weight: normal;
          }
          [data-theme='dark'] .string-value {
            color: #a6bbc5;
            font-weight: normal;
          }
          [data-theme='dark'] .number-value {
            color: #89d185;
            font-weight: normal;
          }
          [data-theme='dark'] .boolean-value {
            color: #8fa0a8;
            font-weight: bold;
          }
          .array-items {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .array-item {
            padding: 4px 6px;
            background-color: var(--panel-background);
            border-radius: 3px;
          }
          .array-item:not(:last-child) {
            border-bottom: 1px dashed var(--border-color);
            margin-bottom: 4px;
          }
          .table-view-empty {
            padding: 20px;
            text-align: center;
            color: var(--text-color);
            font-style: italic;
            background-color: var(--background-color);
            border-radius: 4px;
            border: 1px solid var(--border-color);
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
            color: var(--button-background);
            position: absolute;
            left: 0;
            font-weight: bold;
          }
          hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 8px 0;
          }
          .editable-hint {
            font-size: 12px;
            color: var(--text-color);
            margin-top: 10px;
            font-style: italic;
            text-align: right;
          }
          .save-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            background-color: var(--status-background);
            color: var(--status-text);
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 2px 8px var(--shadow-color);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }
          .error-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            background-color: var(--error-background);
            color: var(--error-text);
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 2px 8px var(--shadow-color);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          /* 値のタイプごとの色とスタイルを強化 */
          span.string-value:hover, span.number-value:hover, span.boolean-value:hover, span.undefined-value:hover {
            background-color: var(--button-hover);
            opacity: 0.9;
          }
          
          /* 編集可能なフィールドを示す視覚的手がかり */
          span.string-value, span.number-value, span.boolean-value, span.undefined-value {
            border-bottom: 1px dotted var(--border-color);
          }
          
          [data-theme='light'] {
            --panel-background: #ffffff;
            --background-color: #fafafa;
            --text-color: #555555;
            --border-color: #e5e5e5;
            --format-background: #f7f7f9;
            --format-text: #5e7985;
            --button-background: #8aa0aa;
            --button-text: #ffffff;
            --button-hover: #778e99;
            --shadow-color: rgba(0, 0, 0, 0.06);
            --status-background: #f0f0f2;
            --status-text: #5e7985;
            --error-background: #feeef0;
            --error-text: #c56c6c;
          }
          
          [data-theme='dark'] {
            --panel-background: #2d2d2d;
            --background-color: #1e1e1e;
            --text-color: #e8e8e8;
            --border-color: #555555;
            --format-background: #2d3439;
            --format-text: #a6bbc5;
            --button-background: #4a5a64;
            --button-text: #ffffff;
            --button-hover: #5a6a74;
            --shadow-color: rgba(0, 0, 0, 0.4);
            --status-background: #2d3439;
            --status-text: #ffffff;
            --error-background: #5a1d1d;
            --error-text: #f48771;
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