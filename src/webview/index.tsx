import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { YamlPreview } from './components/YamlPreview';
import { ThemeProvider, ThemeMode } from './utils/themeContext';
import './utils/themeStyles.css';

// グローバルオブジェクトのポリフィル - より堅牢な実装
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = { 
    env: {}, 
    browser: true,
    // 最小限のNode.js processポリフィル
    nextTick: (cb: Function, ...args: any[]) => {
      setTimeout(() => cb(...args), 0);
    }
  };
}

// デバッグログ
console.log('Webview script loaded');

// グローバルに定義されている初期データを取得
declare global {
  interface Window {
    initialData: {
      yamlContent: string;
      vscodeTheme?: ThemeMode;
    };
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

// 拡張機能への準備完了メッセージ送信関数
function notifyReady(vscode: any) {
  setTimeout(() => {
    try {
      console.log('Sending ready message to extension');
      vscode.postMessage({ command: 'ready' });
    } catch (e) {
      console.error('Failed to send ready message:', e);
    }
  }, 500);
}

// DOMContentLoadedイベントでの初期化を確保
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, initializing app');
  initializeApp();
});

// すでにDOMがロードされている場合に備えて
if (document.readyState === 'loading') {
  console.log('Document is still loading, waiting for DOMContentLoaded');
} else {
  console.log('Document already loaded, initializing immediately');
  initializeApp();
}

// アプリケーション初期化関数
function initializeApp() {
  // エラーハンドリングを強化
  try {
    // デバッグログ - 初期データの確認
    console.log('Initial data:', typeof window.initialData !== 'undefined' ? 'Available' : 'Not available');
    console.log('VS Code API:', typeof window.acquireVsCodeApi === 'function' ? 'Available' : 'Not available');

    // 必要なオブジェクトがない場合は早期リターン
    if (typeof window.initialData === 'undefined') {
      console.error('initialData is not defined');
      document.getElementById('root')!.innerHTML = '<div class="error-message">初期データがロードできませんでした</div>';
      return;
    }

    if (typeof window.acquireVsCodeApi !== 'function') {
      console.error('acquireVsCodeApi is not available');
      document.getElementById('root')!.innerHTML = '<div class="error-message">VSCode APIにアクセスできません</div>';
      return;
    }

    try {
      // VSCode APIへのアクセス
      const vscode = window.acquireVsCodeApi();
      console.log('VS Code API acquired');

      // VSCodeから初期テーマを取得
      const initialTheme = window.initialData.vscodeTheme || 'light';
      console.log('Initial theme:', initialTheme);

      // rootエレメントの存在確認
      const rootElement = document.getElementById('root');
      if (!rootElement) {
        console.error('Root element not found');
        return;
      }

      console.log('Root element found, rendering React component');
      
      // Reactコンポーネントのレンダリング
      ReactDOM.render(
        <React.StrictMode>
          <ThemeProvider initialTheme={initialTheme}>
          <YamlPreview
            initialContent={window.initialData.yamlContent}
            vscodeApi={vscode}
          />
          </ThemeProvider>
        </React.StrictMode>,
        rootElement
      );
      console.log('React component rendered');

      // VSCodeに準備完了を通知
      notifyReady(vscode);

      // VSCodeからのメッセージハンドリング
      window.addEventListener('message', event => {
        const message = event.data;
        console.log('Received message in webview:', message);
        
        // VSCodeのテーマ変更メッセージを処理
        if (message.command === 'themeChanged') {
          console.log('Theme changed:', message.theme);
          // テーマ変更イベントを発火
          const themeEvent = new CustomEvent('vscode-theme-changed', {
            detail: { theme: message.theme }
          });
          window.dispatchEvent(themeEvent);
        }
        
        // コンテンツの更新メッセージを受け取った場合
        if (message.command === 'updateContent') {
          console.log('Updating YAML content via custom event');
          // Reactコンポーネントのstate更新はコンポーネント内で行う
          // カスタムイベントを発火して通知
          const customEvent = new CustomEvent('yaml-content-update', {
            detail: { content: message.content }
          });
          window.dispatchEvent(customEvent);
        }
      });
    } catch (error) {
      console.error('Error initializing webview:', error);
      document.getElementById('root')!.innerHTML = `<div class="error-message">初期化エラー: ${error}</div>`;
    }
  } catch (outerError) {
    console.error('Critical error during initialization:', outerError);
    try {
      document.getElementById('root')!.innerHTML = `
        <div class="error-message">
          <h3>重大なエラーが発生しました</h3>
          <p>${outerError}</p>
          <p>詳細はコンソールログを確認してください</p>
        </div>
      `;
    } catch (e) {
      // 最終手段として、bodyに直接エラーを書き込む
      document.body.innerHTML = `<div style="color:red; padding: 20px;">Critical error: ${outerError}</div>`;
    }
  }
} 