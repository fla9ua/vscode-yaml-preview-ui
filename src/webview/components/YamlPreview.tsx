import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import * as jsYaml from 'js-yaml';
import { JsonView } from './JsonView';
import { TableView } from './TableView';
import { YamlDetector, YamlFormat } from '../../utils/yaml-detector';

// プロパティの型定義
interface YamlPreviewProps {
  initialContent: string;
  vscodeApi: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
}

// 表示モードの型定義
type DisplayMode = 'table' | 'json'; // テーブルを先に定義して優先度を示す

export const YamlPreview: React.FC<YamlPreviewProps> = ({ initialContent, vscodeApi }) => {
  // YAMLコンテンツのステート
  const [yamlContent, setYamlContent] = useState<string>(initialContent);
  // パース済みのJSONデータ
  const [jsonData, setJsonData] = useState<any>(null);
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);
  // 表示タイプ (table or json) - デフォルトをテーブルに変更
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  // 検出されたYAML形式
  const [yamlFormat, setYamlFormat] = useState<YamlFormat>(YamlFormat.Generic);
  // 通信ステータスの追跡
  const [communicationStatus, setCommunicationStatus] = useState<string | null>(null);
  // 最後に処理されたYAMLコンテンツを保持するref
  const lastContentRef = useRef<string>(initialContent);

  // YAMLからJSONへの変換処理
  const parseYaml = (content: string) => {
    try {
      console.log('Parsing YAML content...');
      // ここでのコードはブラウザ環境で動作することを確認
      let data = null;
      try {
        data = jsYaml.load(content);
      } catch (loadErr) {
        console.error('JS-YAML load error:', loadErr);
        throw loadErr;
      }
      
      setJsonData(data);
      // YAML形式を検出
      if (data && typeof data === 'object') {
        const format = YamlDetector.detectFormat(data);
        setYamlFormat(format);
      }
      setError(null);
      return data;
    } catch (err) {
      console.error('YAML parsing error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error parsing YAML');
      }
      return null;
    }
  };

  // 初期コンテンツの処理
  useEffect(() => {
    console.log('Processing initial content...');
    parseYaml(initialContent);
    lastContentRef.current = initialContent;
  }, [initialContent]);

  // VSCode APIのメッセージ設定
  useEffect(() => {
    const handleVSCodeMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('YamlPreview: Received message from vscode:', message);
      
      if (message.command === 'updateContent') {
        if (message.content && message.content !== lastContentRef.current) {
          console.log('YamlPreview: Updating content from VSCode message');
          setYamlContent(message.content);
          parseYaml(message.content);
          lastContentRef.current = message.content;
        }
      } else if (message.command === 'saveComplete') {
        // 保存完了通知の処理
        console.log('YamlPreview: Save complete notification received:', message.success);
        if (message.success) {
          setCommunicationStatus('保存しました');
          setTimeout(() => setCommunicationStatus(null), 2000);
        } else {
          setCommunicationStatus(`エラー: ${message.error || '保存に失敗しました'}`);
          setTimeout(() => setCommunicationStatus(null), 5000);
        }
      }
    };
    
    // VS Code Webview APIの初期化を確認
    console.log('YamlPreview: Initializing VSCode message listener, vscodeApi available:', !!vscodeApi);
    
    // VS Code Webview APIのメッセージイベントをリッスン
    window.addEventListener('message', handleVSCodeMessage);
    
    // 初期化完了メッセージを送信
    try {
      vscodeApi.postMessage({ command: 'ready' });
      console.log('YamlPreview: Ready message sent to vscode');
    } catch (err) {
      console.error('YamlPreview: Failed to send ready message:', err);
    }
    
    return () => {
      window.removeEventListener('message', handleVSCodeMessage);
    };
  }, [vscodeApi]);

  // VSCodeからのコンテンツ更新メッセージを受け取る (カスタムイベント用)
  useEffect(() => {
    const handleContentUpdate = (event: CustomEvent) => {
      const newContent = event.detail.content;
      console.log('Received custom event for content update');
      if (newContent && newContent !== lastContentRef.current) {
        setYamlContent(newContent);
        parseYaml(newContent);
        lastContentRef.current = newContent;
      }
    };

    // カスタムイベントリスナーを追加
    window.addEventListener('yaml-content-update', handleContentUpdate as EventListener);

    // クリーンアップ関数
    return () => {
      window.removeEventListener('yaml-content-update', handleContentUpdate as EventListener);
    };
  }, []);

  // 表示モード（テーブル/JSON）の切り替え
  const toggleDisplayMode = () => {
    setDisplayMode(displayMode === 'table' ? 'json' : 'table');
  };

  return (
    <div className="yaml-preview-container">
      <style>
        {`
          .yaml-preview-container {
            background-color: #f5f5f5;
            color: #333;
            padding: 20px;
            font-family: var(--vscode-editor-font-family);
            border-radius: 8px;
            box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
          }
          .error-message {
            background-color: #fff4f4;
            color: #d32f2f;
            padding: 12px;
            margin-bottom: 18px;
            border-radius: 4px;
            border-left: 4px solid #f44336;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .error-message h3 {
            margin-top: 0;
            color: #d32f2f;
            font-size: 16px;
          }
          .error-message pre {
            background-color: #ffebee;
            padding: 10px;
            overflow-x: auto;
            color: #b71c1c;
            border-radius: 3px;
            border: 1px solid #ffcdd2;
            font-family: monospace;
          }
          .format-indicator {
            margin-bottom: 12px;
            padding: 6px 10px;
            background-color: #e3f2fd;
            display: inline-block;
            border-radius: 4px;
            border-left: 3px solid #2196f3;
            color: #0d47a1;
            font-weight: 500;
          }
          .mode-controls {
            margin-bottom: 18px;
            display: flex;
            gap: 10px;
          }
          .mode-controls button {
            background-color: #2196f3;
            color: white;
            border: none;
            padding: 8px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          .mode-controls button:hover {
            background-color: #1976d2;
          }
          .yaml-preview {
            margin-top: 12px;
            padding: 0;
            overflow: visible;
          }
          .specialized-preview {
            margin-top: 24px;
            padding: 16px;
            background-color: #e8f5e9;
            border-left: 4px solid #4caf50;
            border-radius: 4px;
            color: #2e7d32;
          }
          .specialized-preview h3 {
            margin-top: 0;
            color: #2e7d32;
            font-size: 16px;
          }
          .status-message {
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
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      {/* エラー表示 */}
      {error && (
        <div className="error-message">
          <h3>YAML Parse Error:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {/* 検出されたYAML形式の表示 */}
      {!error && yamlFormat !== YamlFormat.Generic && (
        <div className="format-indicator">
          <span title={YamlDetector.getFormatDisplayName(yamlFormat)}>
            {YamlDetector.getFormatDisplayName(yamlFormat)}
          </span>
        </div>
      )}

      {/* モード切替ボタン */}
      <div className="mode-controls">
        <button onClick={toggleDisplayMode}>
          {displayMode === 'table' ? 'Show as JSON' : 'Show as Table'}
        </button>
      </div>

      {/* プレビューモード */}
      <div className="yaml-preview">
        {displayMode === 'table' ? (
          <TableView data={jsonData} vscodeApi={vscodeApi} yamlContent={yamlContent} />
        ) : (
          <JsonView data={jsonData} />
        )}
      </div>

      {/* 特定形式のプレビュー（将来の拡張用） */}
      {yamlFormat !== YamlFormat.Generic && (
        <div className="specialized-preview">
          <h3>Specialized View</h3>
          <p>この形式に特化したビューは現在開発中です。</p>
        </div>
      )}
      
      {/* 通信ステータスの表示 */}
      {communicationStatus && (
        <div className="status-message">
          {communicationStatus}
        </div>
      )}
    </div>
  );
}; 