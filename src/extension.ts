import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Webviewパネルの参照を保持する変数
let currentPanel: vscode.WebviewPanel | undefined = undefined;
// 現在開いているエディタの参照
let currentEditor: vscode.TextEditor | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  // 拡張機能が有効化されたときのログ出力
  console.log('YAML Preview UI is now active');

  // コマンド登録: YAMLプレビューを表示
  let disposable = vscode.commands.registerCommand('yaml-preview-ui.showPreview', () => {
    // デバッグログを追加
    console.log('YAML Preview command triggered');
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      console.log('No active editor found');
      return;
    }

    // YAMLファイル以外は対象外
    if (editor.document.languageId !== 'yaml') {
      vscode.window.showErrorMessage('Active editor does not contain YAML content');
      console.log('Active editor does not contain YAML content: ' + editor.document.languageId);
      return;
    }

    // 現在のエディタを保存
    currentEditor = editor;
    
    const yamlContent = editor.document.getText();
    console.log('YAML content length: ' + yamlContent.length);
    
    // 既存のパネルがあれば再利用、なければ新規作成
    if (currentPanel) {
      console.log('Reusing existing panel');
      currentPanel.reveal(vscode.ViewColumn.Beside);
      updateWebview(currentPanel, yamlContent);
    } else {
      // 新しいWebviewパネルを作成
      console.log('Creating new panel');
      try {
        currentPanel = vscode.window.createWebviewPanel(
          'yamlPreview',
          'YAML Preview',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true, // コンテキストを保持
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, 'out')),
              vscode.Uri.file(context.extensionPath)
            ]
          }
        );
        
        console.log('Panel created successfully');

        // Webviewのコンテンツを設定
        setupWebview(currentPanel, context, yamlContent);

        // パネルが閉じられたときの処理
        currentPanel.onDidDispose(
          () => {
            console.log('Panel disposed');
            currentPanel = undefined;
          },
          null,
          context.subscriptions
        );
      } catch (error) {
        console.error('Error creating panel:', error);
        vscode.window.showErrorMessage('Failed to create YAML Preview panel: ' + error);
      }
    }
  });

  // エディタ内容が変更されたときにプレビューを更新
  vscode.workspace.onDidChangeTextDocument(event => {
    if (currentPanel && currentEditor && event.document === currentEditor.document) {
      console.log('Document changed, updating preview');
      updateWebview(currentPanel, event.document.getText());
    }
  });

  // エディタが切り替わったときの処理
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && editor.document.languageId === 'yaml') {
      console.log('Editor changed to YAML file');
      currentEditor = editor;
      if (currentPanel) {
        updateWebview(currentPanel, editor.document.getText());
      }
    }
  });

  context.subscriptions.push(disposable);
}

// Webviewの初期設定
function setupWebview(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, yamlContent: string) {
  // webview.jsへのパスを取得
  try {
    const scriptPath = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview.js'))
    );
    console.log('Script path:', scriptPath.toString());

    // HTMLを生成
    panel.webview.html = getWebviewContent(scriptPath, yamlContent);
    console.log('Webview HTML has been set');

    // カスタムイベントリスナーを含むスクリプトを追加
    const customEventCode = `
      <script>
        // カスタムイベントリスナーを設定
        window.addEventListener('yaml-editor-update', function(event) {
          const detail = event.detail;
          console.log('Custom event received:', detail.command);
          if (detail.command === 'updateYaml' && window.acquireVsCodeApi) {
            try {
              const vscode = window.acquireVsCodeApi();
              vscode.postMessage(detail);
              console.log('Forwarded message via acquireVsCodeApi');
            } catch (e) {
              console.error('Failed to forward message:', e);
            }
          }
        });
        console.log('Custom event listener installed');
      </script>
    `;

    // スクリプトを挿入したHTMLに更新
    let htmlContent = panel.webview.html;
    htmlContent = htmlContent.replace('</body>', `${customEventCode}</body>`);
    panel.webview.html = htmlContent;

    // Webviewからのメッセージを処理するイベントハンドラを登録
    panel.webview.onDidReceiveMessage(
      message => {
        handleWebviewMessage(panel, message);
      },
      undefined,
      context.subscriptions
    );
  } catch (error) {
    console.error('Error setting up webview:', error);
    vscode.window.showErrorMessage('Failed to setup YAML Preview: ' + error);
  }
}

// Webviewの内容を更新
function updateWebview(panel: vscode.WebviewPanel, yamlContent: string) {
  console.log('Posting message to update webview content');
  panel.webview.postMessage({ command: 'updateContent', content: yamlContent });
}

// Webviewへのメッセージ送信を確認するヘルパー関数
function sendMessageToWebview(panel: vscode.WebviewPanel, message: any) {
  console.log('Sending message to webview:', message.command);
  panel.webview.postMessage(message);
  // メッセージが届いたかチェックするためのログ
  console.log('Message posted to webview');
}

// Webviewからのメッセージを処理するイベントハンドラ
function handleWebviewMessage(panel: vscode.WebviewPanel, message: any) {
  console.log('Received message from webview:', message.command);
  switch (message.command) {
    case 'updateYaml':
      // 現在開いているエディタを取得 (現在のアクティブなエディタとcurrentEditorを確認)
      const editor = vscode.window.activeTextEditor || currentEditor;
      
      if (!editor || !message.content) {
        console.error('No active editor or content for YAML update');
        // エディタが見つからない場合はユーザーにエラーを表示
        vscode.window.showErrorMessage('YAML編集の反映に失敗しました: エディタが見つかりません。YAML編集中にエディタを閉じないでください。');
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: '編集の反映に失敗しました: エディタが見つかりません'
        });
        return;
      }
      
      // YAMLファイル以外のエディタになっていないか確認
      if (editor.document.languageId !== 'yaml') {
        console.error('Active editor is not a YAML file');
        vscode.window.showErrorMessage('YAML編集の反映に失敗しました: アクティブなエディタがYAMLファイルではありません。');
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: '編集の反映に失敗しました: YAMLファイルではありません'
        });
        return;
      }
      
      try {
        console.log('Updating YAML in editor...');
        
        // ファイル全体を更新
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          editor.document.lineAt(editor.document.lineCount - 1).range.end
        );
        
        // 編集を行う
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
          console.log('Replacing content in editor...');
          editBuilder.replace(fullRange, message.content);
        }).then((success: boolean) => {
          if (success) {
            console.log('Edit successful, saving file...');
            // 変更を明示的に保存
            try {
              // 編集が確実に反映されてから保存するために、タイムアウトを設定
              setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.files.save')
                  .then(() => {
                    console.log('YAML content saved successfully');
                    // 保存成功を通知
                    sendMessageToWebview(panel, { 
                      command: 'saveComplete', 
                      success: true 
                    });
                  }, (err) => {
                    // エラーハンドリング
                    console.error('Error saving file:', err);
                    vscode.window.showErrorMessage('YAML変更の保存に失敗しました。もう一度試してください。');
                    sendMessageToWebview(panel, { 
                      command: 'saveComplete', 
                      success: false,
                      error: 'Save failed'
                    });
                  });
              }, 100); // 100ms待機
            } catch (err) {
              console.error('Exception during save operation:', err);
              vscode.window.showErrorMessage('YAML変更の保存中にエラーが発生しました: ' + String(err));
              sendMessageToWebview(panel, { 
                command: 'saveComplete', 
                success: false,
                error: String(err)
              });
            }
          } else {
            console.error('Failed to update YAML content');
            vscode.window.showErrorMessage('YAML内容の更新に失敗しました。もう一度試してください。');
            sendMessageToWebview(panel, { 
              command: 'saveComplete', 
              success: false,
              error: 'Edit failed'
            });
          }
        }, (err: any) => {
          // edit操作のエラーハンドリング
          console.error('Exception during edit operation:', err);
          vscode.window.showErrorMessage('YAML編集中にエラーが発生しました: ' + String(err));
          sendMessageToWebview(panel, { 
            command: 'saveComplete', 
            success: false,
            error: 'Edit operation failed: ' + String(err)
          });
        });
      } catch (err) {
        console.error('Exception processing updateYaml message:', err);
        vscode.window.showErrorMessage('YAML処理中にエラーが発生しました: ' + String(err));
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: 'YAML processing error: ' + String(err)
        });
      }
      break;
    case 'ready':
      // Webviewの準備完了通知
      console.log('Webview is ready');
      break;
    case 'error':
      // Webviewからのエラー通知
      console.error('Error in webview:', message.message);
      vscode.window.showErrorMessage('YAML Preview error: ' + message.message);
      break;
  }
}

// Webviewに表示するHTMLを生成
function getWebviewContent(scriptUri: vscode.Uri, yamlContent: string) {
  console.log('Generating webview HTML');
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'unsafe-inline' 'unsafe-eval' vscode-resource:; style-src 'unsafe-inline' vscode-resource:;">
    <title>YAML Preview</title>
    <style>
      body {
        padding: 0;
        margin: 0;
        font-family: var(--vscode-editor-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
      }
      .yaml-preview-container {
        padding: 16px;
      }
      .error-message {
        padding: 10px;
        margin-bottom: 10px;
        background-color: var(--vscode-inputValidation-errorBackground);
        border: 1px solid var(--vscode-inputValidation-errorBorder);
        color: var(--vscode-inputValidation-errorForeground);
      }
      .mode-toggle {
        margin-bottom: 16px;
      }
      button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        cursor: pointer;
      }
      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      textarea {
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 8px;
      }
      .yaml-format-info {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
        padding: 6px 10px;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 4px;
        max-width: fit-content;
      }
      .yaml-format-icon {
        margin-right: 8px;
        font-size: 16px;
      }
      .yaml-format-name {
        font-weight: 500;
      }
      .specialized-preview {
        margin-top: 20px;
        padding: 10px;
        border: 1px solid var(--vscode-editor-lineHighlightBorder);
        border-radius: 4px;
      }
    </style>
</head>
<body>
    <div id="root">Loading YAML Preview...</div>
    <script>
      // エラーハンドリングを追加
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('Error in webview:', message, 'at', source, lineno, colno, error);
        if (window.acquireVsCodeApi) {
          try {
            const vscode = window.acquireVsCodeApi();
            vscode.postMessage({
              command: 'error',
              message: message
            });
          } catch (e) {
            console.error('Failed to report error to extension:', e);
          }
        }
        return false;
      };

      // 初期データの設定
      try {
        window.initialData = ${JSON.stringify({ yamlContent })};
        console.log('Webview initialized with data length:', ${yamlContent.length});
      } catch (e) {
        console.error('Failed to initialize data:', e);
      }
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
}

// このメソッドは拡張機能が非アクティブになったときに呼ばれる
export function deactivate() {} 