import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import * as jsYaml from 'js-yaml';
import { TableView } from './TableView';
import { YamlDetector, YamlFormat } from '../../utils/yaml-detector';
import { ThemeProvider } from '../utils/themeContext';

// プロパティの型定義
interface YamlPreviewProps {
  initialContent: string;
  vscodeApi: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
}

// エクスポート形式の定義
type ExportFormat = 'json' | 'xml' | 'pdf' | 'csv' | 'markdown' | 'html' | 'png';

// テーマをラップするコンポーネント
const YamlPreviewInner: React.FC<YamlPreviewProps> = ({ initialContent, vscodeApi }) => {
  // YAMLコンテンツのステート
  const [yamlContent, setYamlContent] = useState<string>(initialContent);
  // パース済みのJSONデータ
  const [jsonData, setJsonData] = useState<any>(null);
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);
  // 検出されたYAML形式
  const [yamlFormat, setYamlFormat] = useState<YamlFormat>(YamlFormat.Generic);
  // 通信ステータスの追跡
  const [communicationStatus, setCommunicationStatus] = useState<string | null>(null);
  // 最後に処理されたYAMLコンテンツを保持するref
  const lastContentRef = useRef<string>(initialContent);
  // エクスポートメニューの表示状態
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

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
      } else if (message.command === 'exportComplete') {
        // エクスポート完了通知の処理
        console.log('YamlPreview: Export complete notification received:', message.success);
        if (message.success) {
          setCommunicationStatus(`${message.format?.toUpperCase() || 'ファイル'}をエクスポートしました`);
          setTimeout(() => setCommunicationStatus(null), 2000);
        } else {
          setCommunicationStatus(`エラー: ${message.error || 'エクスポートに失敗しました'}`);
          setTimeout(() => setCommunicationStatus(null), 5000);
        }
      } else if (message.command === 'prepareForScreenshot') {
        // スクリーンショット撮影準備の処理
        console.log('YamlPreview: Preparing for screenshot');
        // エクスポートメニューが開いていれば閉じる
        setShowExportMenu(false);
        // 通知メッセージを非表示にする
        setCommunicationStatus(null);
        // 必要に応じて他のUI要素の準備（すべてのノードを展開するなど）
      } else if (message.command === 'captureHtmlSnapshot') {
        // HTMLスナップショットの取得と送信
        console.log('YamlPreview: Capturing HTML snapshot');
        
        // エクスポートメニューを非表示にする
        setShowExportMenu(false);
        // 通知メッセージを非表示にする
        setCommunicationStatus(null);
        
        // 少し待ってからスナップショットを取得（UIの更新を待つため）
        setTimeout(() => {
          try {
            // テーブル要素のみを取得
            const tableElement = document.querySelector('.content-view table');
            if (!tableElement) {
              // テーブルが見つからない場合は代替としてコンテンツビュー全体を使用
              const contentElement = document.querySelector('.content-view');
              if (!contentElement) {
                throw new Error('Content element not found');
              }
              
              // スタイル情報を取得
              const styles = Array.from(document.styleSheets)
                .filter(sheet => {
                  try {
                    // CSSStyleSheet.cssRulesの取得はCORSポリシーによって制限される可能性がある
                    return sheet.cssRules !== null;
                  } catch (e) {
                    return false;
                  }
                })
                .map(sheet => {
                  return Array.from(sheet.cssRules)
                    .map(rule => rule.cssText)
                    .join('\n');
                })
                .join('\n');
              
              // HTML内容を取得（編集関連のUI要素を除外）
              const html = contentElement.innerHTML;
              
              // VSCodeにスナップショット情報を送信
              vscodeApi.postMessage({
                command: 'htmlSnapshot',
                html: html,
                styles: styles
              });
            } else {
              // テーブル要素が見つかった場合、それだけを使用
              // スタイル情報を取得
              const styles = Array.from(document.styleSheets)
                .filter(sheet => {
                  try {
                    return sheet.cssRules !== null;
                  } catch (e) {
                    return false;
                  }
                })
                .map(sheet => {
                  return Array.from(sheet.cssRules)
                    .map(rule => rule.cssText)
                    .join('\n');
                })
                .join('\n');
              
              // テーブルのHTMLを取得
              const html = tableElement.outerHTML;
              
              // VSCodeにスナップショット情報を送信
              vscodeApi.postMessage({
                command: 'htmlSnapshot',
                html: html,
                styles: styles,
                tableOnly: true
              });
            }
            
            console.log('YamlPreview: HTML snapshot sent to VSCode');
          } catch (err) {
            console.error('Error capturing HTML snapshot:', err);
            vscodeApi.postMessage({
              command: 'htmlSnapshotError',
              error: String(err)
            });
          }
        }, 200); // 200msの遅延を設定
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

  // エクスポートメニュー以外のクリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.export-menu') && !target.closest('.export-button')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 指定形式でエクスポートする関数
  const exportAs = (format: ExportFormat) => {
    if (!jsonData) {
      setCommunicationStatus('エラー: エクスポートするデータがありません');
      setTimeout(() => setCommunicationStatus(null), 3000);
      return;
    }

    try {
      // VS Code拡張機能にエクスポートのメッセージを送信
      vscodeApi.postMessage({
        command: 'exportAs',
        format: format,
        content: JSON.stringify(jsonData, null, 2),
        yamlContent: yamlContent
      });
      console.log(`Export as ${format} message sent`);
      setShowExportMenu(false); // メニューを閉じる
    } catch (err) {
      console.error('Failed to send export request:', err);
      setCommunicationStatus(`エラー: エクスポートリクエストの送信に失敗しました`);
      setTimeout(() => setCommunicationStatus(null), 3000);
    }
  };

  // エクスポートメニューのトグル
  const toggleExportMenu = () => {
    setShowExportMenu(!showExportMenu);
  };

  return (
    <div className="yaml-preview-container">
      <style>
        {`
          .yaml-preview-container {
            background-color: var(--background-color);
            color: var(--text-color);
            padding: 20px;
            font-family: var(--vscode-editor-font-family);
            border-radius: 8px;
            box-shadow: 0 1px 5px var(--shadow-color);
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
          }
          .error-message {
            background-color: var(--error-background);
            color: var(--error-text);
            padding: 10px 15px;
            border-radius: 4px;
            margin: 10px 0;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
          }
          .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 0;
            background-color: transparent;
            border-radius: 0;
          }
          .yaml-format-badge {
            background-color: var(--format-background);
            color: var(--format-text);
            padding: 4px 8px;
            font-size: 12px;
            border-radius: 4px;
            display: inline-block;
            font-weight: 500;
          }
          .export-button {
            background-color: var(--button-background);
            color: var(--button-text);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--vscode-editor-font-family);
            display: flex;
            align-items: center;
            outline: none;
            box-shadow: 0 1px 3px var(--shadow-color);
            transition: background-color 0.2s;
          }
          .export-button svg {
            margin-right: 5px;
            width: 14px;
            height: 14px;
          }
          .export-button:hover {
            background-color: var(--button-hover);
          }
          .export-button:active {
            transform: translateY(1px);
            box-shadow: 0 0 1px var(--shadow-color);
          }
          .export-menu {
            position: absolute;
            top: 45px;
            left: 10px;
            background-color: var(--panel-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 5px 0;
            z-index: 100;
            box-shadow: 0 2px 10px var(--shadow-color);
            min-width: 120px;
          }
          .export-menu-item {
            padding: 6px 15px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            display: flex;
            align-items: center;
            transition: background-color 0.1s;
          }
          .export-menu-item:hover {
            background-color: var(--format-background);
            color: var(--format-text);
          }
          .export-menu-item svg {
            margin-right: 8px;
            width: 14px;
            height: 14px;
          }
          .status-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 12px;
            background-color: var(--status-background);
            color: var(--status-text);
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            transition: opacity 0.3s;
            box-shadow: 0 2px 10px var(--shadow-color);
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
      
      {error && (
        <div className="error-message">
          <p>YAMLパースエラー:</p>
          <pre>{error}</pre>
        </div>
      )}
      
      {communicationStatus && (
        <div className={`communication-status ${communicationStatus.includes('エラー') ? 'error' : 'success'}`}>
          {communicationStatus}
        </div>
      )}

      {/* YAMLフォーマット情報表示 */}
      {!error && jsonData && (
        <div className="yaml-format-info">
          <span className="yaml-format-icon">📄</span>
          <span className="yaml-format-name">
            {yamlFormat === YamlFormat.Generic ? 'Generic YAML' : yamlFormat}
          </span>
        </div>
      )}
      
      {/* エクスポートボタンとメニュー */}
      <div className="action-buttons">
        <button 
          className="export-button" 
          onClick={toggleExportMenu}
          title="エクスポート"
        >
          エクスポート ▾
        </button>
        
        {showExportMenu && (
          <div className="export-menu">
            <div className="export-option" onClick={() => exportAs('json')}>
              JSONとして保存
            </div>
            <div className="export-option" onClick={() => exportAs('markdown')}>
              Markdownとして保存
            </div>
            <div className="export-option" onClick={() => exportAs('xml')}>
              XMLとして保存
            </div>
            <div className="export-option" onClick={() => exportAs('html')}>
              HTMLとして保存
            </div>
            <div className="export-option" onClick={() => exportAs('png')}>
              PNGとして保存
            </div>
          </div>
        )}
      </div>
      
      {/* JSON表示またはテーブル表示 */}
      {!error && jsonData && (
        <div className="content-view">
          <TableView data={jsonData} vscodeApi={vscodeApi} yamlContent={yamlContent} />
        </div>
      )}
    </div>
  );
};

// メインコンポーネント（ThemeProviderでラップ）
export const YamlPreview: React.FC<YamlPreviewProps> = (props) => {
  return <YamlPreviewInner {...props} />;
}; 