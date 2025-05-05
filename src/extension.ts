import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// エクスポート用のモジュールをインポート
// 注意: これらのモジュールはNode.js環境で動作しますが、Webviewでは動作しません
import * as convert from 'xml-js';
import { stringify } from 'csv-stringify/sync';
import MarkdownIt from 'markdown-it';
import * as PDFDocument from 'pdfkit';
import * as puppeteer from 'puppeteer';

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

// 現在のワークスペースディレクトリを取得する関数
function getWorkspaceDirectory(): string | undefined {
  // ワークスペースフォルダが1つ以上あるかチェック
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // 最初のワークスペースフォルダのパスを取得
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  // ワークスペースフォルダがない場合は編集中のファイルのディレクトリを使用
  if (vscode.window.activeTextEditor) {
    const activeFile = vscode.window.activeTextEditor.document.uri;
    return path.dirname(activeFile.fsPath);
  }
  // どちらも取得できない場合はundefined
  return undefined;
}

// 現在の日時を使ったファイル名を生成する関数
function generateExportFilename(extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}_export.${extension}`;
}

// Webviewからのメッセージを処理するイベントハンドラ
async function handleWebviewMessage(panel: vscode.WebviewPanel, message: any) {
  console.log('Received message from webview:', message.command);
  switch (message.command) {
    case 'ready':
      // webviewが準備完了の通知のみ
      console.log('Webview ready notification received');
      break;
    
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
    case 'exportAs':
      // 各種形式にエクスポート
      if (!message.content) {
        console.error('No content for export');
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: 'エクスポートするデータがありません',
          format: message.format
        });
        return;
      }

      try {
        // エクスポート形式によって処理を分岐
        let exportContent: string | Buffer;
        let fileExtension: string;
        const format = message.format as string;
        const jsonData = JSON.parse(message.content);

        switch (format) {
          case 'json':
            exportContent = message.content;
            fileExtension = 'json';
            break;
          case 'xml':
            exportContent = convertToXml(jsonData);
            fileExtension = 'xml';
            break;
          case 'csv':
            exportContent = convertToCsv(jsonData);
            fileExtension = 'csv';
            break;
          case 'markdown':
            exportContent = convertToMarkdown(jsonData);
            fileExtension = 'md';
            break;
          case 'html':
            exportContent = convertToHtml(jsonData);
            fileExtension = 'html';
            break;
          case 'pdf':
            await exportAsPdf(panel, jsonData, message.yamlContent);
            return; // PDF出力は別処理のため、ここで終了
          case 'png':
            await exportAsPng(panel, jsonData, message.yamlContent);
            return; // PNG出力は別処理のため、ここで終了
          default:
            throw new Error(`Unsupported export format: ${message.format}`);
        }

        // 日付を含むデフォルトファイル名を生成
        const defaultFilename = generateExportFilename(fileExtension);
        
        // 現在のワークスペースディレクトリを取得
        const workspaceDir = getWorkspaceDirectory();
        
        // デフォルトURIを設定
        let defaultUri: vscode.Uri | undefined = undefined;
        if (workspaceDir) {
          defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
        } else {
          // ワークスペースが取得できない場合はユーザーのホームディレクトリを使用
          defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
        }

        // ファイル保存ダイアログを表示
        const options: vscode.SaveDialogOptions = {
          defaultUri: defaultUri,
          filters: {
            [`${format.toUpperCase()} Files`]: [fileExtension]
          },
          title: `Export as ${format.toUpperCase()}`,
          saveLabel: `${format.toUpperCase()}としてエクスポート`
        };

        vscode.window.showSaveDialog(options).then(fileUri => {
          if (fileUri) {
            // ファイルに保存
            fs.writeFile(fileUri.fsPath, exportContent, err => {
              if (err) {
                console.error(`Error saving ${format} file:`, err);
                vscode.window.showErrorMessage(`${format.toUpperCase()}ファイルの保存に失敗しました: ${err.message}`);
                sendMessageToWebview(panel, {
                  command: 'exportComplete',
                  success: false,
                  error: `保存に失敗しました: ${err.message}`,
                  format: format
                });
              } else {
                console.log(`${format} file saved successfully`);
                vscode.window.showInformationMessage(`${format.toUpperCase()}ファイルをエクスポートしました: ${fileUri.fsPath}`);
                sendMessageToWebview(panel, {
                  command: 'exportComplete',
                  success: true,
                  filePath: fileUri.fsPath,
                  format: format
                });
              }
            });
          } else {
            // ユーザーが保存をキャンセルした場合
            console.log(`${format} export cancelled by user`);
            sendMessageToWebview(panel, {
              command: 'exportComplete',
              success: false,
              error: 'エクスポートがキャンセルされました',
              format: format
            });
          }
        });
      } catch (err) {
        console.error(`Exception during ${message.format} export:`, err);
        vscode.window.showErrorMessage(`${message.format}エクスポート中にエラーが発生しました: ${String(err)}`);
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: `エクスポートエラー: ${String(err)}`,
          format: message.format
        });
      }
      break;
    case 'error':
      // Webviewからのエラー通知
      console.error('Error in webview:', message.message);
      vscode.window.showErrorMessage('YAML Preview error: ' + message.message);
      break;
  }
}

// JSONをXMLに変換
function convertToXml(jsonData: any): string {
  try {
    const options = {
      compact: true,
      ignoreComment: true,
      spaces: 2
    };
    return convert.js2xml({ root: jsonData }, options);
  } catch (err) {
    console.error('Error converting to XML:', err);
    throw new Error('XMLへの変換に失敗しました: ' + String(err));
  }
}

// JSONをCSVに変換
function convertToCsv(jsonData: any): string {
  try {
    // 配列データをCSVに変換
    if (Array.isArray(jsonData)) {
      return stringify(jsonData, { header: true });
    }
    
    // オブジェクトデータを配列に変換してCSVに
    if (typeof jsonData === 'object' && jsonData !== null) {
      // オブジェクトデータを1行の配列として処理
      return stringify([jsonData], { header: true });
    }
    
    throw new Error('CSVに変換できるのは配列またはオブジェクトのみです');
  } catch (err) {
    console.error('Error converting to CSV:', err);
    throw new Error('CSVへの変換に失敗しました: ' + String(err));
  }
}

// JSONをMarkdownに変換
function convertToMarkdown(jsonData: any): string {
  try {
    let markdown = '# YAML Data Export\n\n';
    
    // JSONを整形して追加
    markdown += '```json\n';
    markdown += JSON.stringify(jsonData, null, 2);
    markdown += '\n```\n\n';
    
    // データの構造を表形式で追加（簡易的に実装）
    if (typeof jsonData === 'object' && jsonData !== null) {
      markdown += '## Data Structure\n\n';
      
      if (Array.isArray(jsonData)) {
        markdown += '### Array Items\n\n';
        
        // 配列の場合、先頭10件をサンプルとして表示
        const sample = jsonData.slice(0, 10);
        if (sample.length > 0 && typeof sample[0] === 'object') {
          // オブジェクト配列の場合はプロパティをテーブルで表示
          const keys = Object.keys(sample[0]);
          markdown += '| ' + keys.join(' | ') + ' |\n';
          markdown += '| ' + keys.map(() => '---').join(' | ') + ' |\n';
          
          sample.forEach(item => {
            markdown += '| ' + keys.map(key => String(item[key] || '')).join(' | ') + ' |\n';
          });
        } else {
          // プリミティブ配列の場合は単純リスト
          sample.forEach(item => {
            markdown += `- ${String(item)}\n`;
          });
        }
        
        if (jsonData.length > 10) {
          markdown += '\n*... and more items*\n';
        }
      } else {
        markdown += '### Object Properties\n\n';
        
        // オブジェクトの場合、キーと値をテーブルで表示
        markdown += '| Key | Value |\n';
        markdown += '| --- | ----- |\n';
        
        Object.entries(jsonData).forEach(([key, value]) => {
          let valueStr: string;
          
          if (typeof value === 'object' && value !== null) {
            valueStr = Array.isArray(value) 
              ? `Array(${(value as any[]).length})` 
              : `Object(${Object.keys(value).length} properties)`;
          } else {
            valueStr = String(value);
          }
          
          markdown += `| ${key} | ${valueStr} |\n`;
        });
      }
    }
    
    return markdown;
  } catch (err) {
    console.error('Error converting to Markdown:', err);
    throw new Error('Markdownへの変換に失敗しました: ' + String(err));
  }
}

// JSONをHTMLに変換
function convertToHtml(jsonData: any): string {
  try {
    // カスタムHTML生成
    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YAML Data Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: white;
    }
    .yaml-data {
      margin-bottom: 20px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .key-cell {
      background-color: #f9f9f9;
      font-weight: 500;
    }
    .nested-table {
      margin-left: 20px;
      margin-top: 5px;
      margin-bottom: 5px;
    }
    .array-item {
      margin: 5px 0;
      padding: 5px;
      border-bottom: 1px solid #eee;
    }
    .container-type {
      color: #666;
      font-size: 12px;
      margin-left: 5px;
    }
    .null-value {
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="yaml-data">
    ${renderObjectAsHtmlTable(jsonData)}
  </div>
</body>
</html>`;

    return html;
  } catch (err) {
    console.error('Error converting to HTML:', err);
    throw new Error('HTMLへの変換に失敗しました: ' + String(err));
  }
}

// オブジェクトをHTMLテーブルとして再帰的にレンダリング
function renderObjectAsHtmlTable(data: any, level: number = 0): string {
  if (data === null || data === undefined) {
    return '<span class="null-value">null</span>';
  }

  // プリミティブ値の場合は単純にテキスト表示
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return escapeHtml(data);
    }
    return String(data);
  }

  // 配列の場合は順序付きリストとして表示
  if (Array.isArray(data)) {
    let html = '<div class="array-container">';
    
    // 配列の内容をチェック（複雑な構造かどうか）
    const hasComplexItems = data.some(item => typeof item === 'object' && item !== null);
    
    if (hasComplexItems) {
      // 複雑な構造の場合はテーブル形式で表示
      html += '<table class="array-table">';
      html += '<thead><tr><th>Index</th><th>Value</th></tr></thead>';
      html += '<tbody>';
      
      data.forEach((item, index) => {
        html += `<tr>
          <td class="key-cell">${index}</td>
          <td>${renderObjectAsHtmlTable(item, level + 1)}</td>
        </tr>`;
      });
      
      html += '</tbody></table>';
    } else {
      // 単純な値の配列の場合はリスト形式で表示
      html += '<ol class="simple-array">';
      data.forEach(item => {
        html += `<li class="array-item">${typeof item === 'string' ? escapeHtml(item) : String(item)}</li>`;
      });
      html += '</ol>';
    }
    
    html += '</div>';
    return html;
  }

  // オブジェクトの場合はテーブル形式で表示
  let html = `<table class="object-table${level > 0 ? ' nested-table' : ''}">`;
  
  // 各キーと値をテーブル行として表示
  Object.entries(data).forEach(([key, value]) => {
    const isObject = typeof value === 'object' && value !== null;
    const isArray = Array.isArray(value);
    
    html += '<tr>';
    html += `<td class="key-cell">${escapeHtml(key)}${isObject ? 
      `<span class="container-type">${isArray ? `[${(value as any[]).length}]` : '{...}'}</span>` : ''}</td>`;
    html += `<td>${renderObjectAsHtmlTable(value, level + 1)}</td>`;
    html += '</tr>';
  });
  
  html += '</table>';
  return html;
}

// HTML特殊文字をエスケープする関数
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// JSONをPDFにエクスポート
async function exportAsPdf(panel: vscode.WebviewPanel, jsonData: any, _yamlContent: string) {
  try {
    // 日付を含むデフォルトファイル名を生成
    const defaultFilename = generateExportFilename('pdf');
    
    // 現在のワークスペースディレクトリを取得
    const workspaceDir = getWorkspaceDirectory();
    
    // デフォルトURIを設定
    let defaultUri: vscode.Uri | undefined = undefined;
    if (workspaceDir) {
      defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
    } else {
      // ワークスペースが取得できない場合はユーザーのホームディレクトリを使用
      defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
    }
    
    // ファイル保存ダイアログを表示
    const options: vscode.SaveDialogOptions = {
      defaultUri: defaultUri,
      filters: {
        'PDF Files': ['pdf']
      },
      title: 'Export as PDF',
      saveLabel: 'PDFとしてエクスポート'
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    
    if (!fileUri) {
      console.log('PDF export cancelled by user');
      sendMessageToWebview(panel, {
        command: 'exportComplete',
        success: false,
        error: 'エクスポートがキャンセルされました',
        format: 'pdf'
      });
      return;
    }

    // HTMLを生成して一時ファイルに保存
    const htmlContent = convertToHtml(jsonData);
    const tempHtmlPath = path.join(os.tmpdir(), `yaml-preview-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // Puppeteerを使用してPDFに変換
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: fileUri.fsPath,
      format: 'A4',
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    await browser.close();
    
    // 一時ファイルの削除
    try { fs.unlinkSync(tempHtmlPath); } catch (e) { console.error('Failed to delete temp file:', e); }

    console.log('PDF file saved successfully');
    vscode.window.showInformationMessage(`PDFファイルをエクスポートしました: ${fileUri.fsPath}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: true,
      filePath: fileUri.fsPath,
      format: 'pdf'
    });
  } catch (err) {
    console.error('Error exporting to PDF:', err);
    vscode.window.showErrorMessage(`PDFエクスポート中にエラーが発生しました: ${String(err)}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: false,
      error: `エクスポートエラー: ${String(err)}`,
      format: 'pdf'
    });
  }
}

// JSONをPNGにエクスポート
async function exportAsPng(panel: vscode.WebviewPanel, _jsonData: any, _yamlContent: string) {
  try {
    // 日付を含むデフォルトファイル名を生成
    const defaultFilename = generateExportFilename('png');
    
    // 現在のワークスペースディレクトリを取得
    const workspaceDir = getWorkspaceDirectory();
    
    // デフォルトURIを設定
    let defaultUri: vscode.Uri | undefined = undefined;
    if (workspaceDir) {
      defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
    } else {
      // ワークスペースが取得できない場合はユーザーのホームディレクトリを使用
      defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
    }
    
    // ファイル保存ダイアログを表示
    const options: vscode.SaveDialogOptions = {
      defaultUri: defaultUri,
      filters: {
        'PNG Files': ['png']
      },
      title: 'Export as PNG',
      saveLabel: 'PNGとしてエクスポート'
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    
    if (!fileUri) {
      console.log('PNG export cancelled by user');
      sendMessageToWebview(panel, {
        command: 'exportComplete',
        success: false,
        error: 'エクスポートがキャンセルされました',
        format: 'png'
      });
      return;
    }

    // WebViewのHTMLコンテンツを取得
    // 直接WebViewからHTMLを取得できないため、メッセージングを使用
    return new Promise<void>((resolve, reject) => {
      let htmlSnapshotTimeout: NodeJS.Timeout | null = null;
      
      // スクリーンショットキャプチャのためのハンドラ
      const captureHandler = async (message: any) => {
        if (message.command === 'htmlSnapshot') {
          // タイムアウトをクリア
          if (htmlSnapshotTimeout) {
            clearTimeout(htmlSnapshotTimeout);
            htmlSnapshotTimeout = null;
          }
          
          // メッセージハンドラを削除
          panel.webview.onDidReceiveMessage(() => {}, undefined, []);
          
          try {
            // HTMLスナップショットを取得
            const htmlContent = message.html;
            
            // スタイルを適用したHTMLを作成
            const styledHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YAML Data Export</title>
  <style>
    ${message.styles}
    body {
      background-color: white;
      padding: 20px;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    /* テーブル用の追加スタイル */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .key-cell {
      background-color: #f9f9f9;
      font-weight: 500;
    }
  </style>
</head>
<body>
  ${message.tableOnly ? 
    `<div class="table-container">${htmlContent}</div>` : 
    `<h1>YAML Data Export</h1><div class="yaml-data">${htmlContent}</div>`
  }
</body>
</html>`;
            
            // 一時ファイルに保存
            const tempHtmlPath = path.join(os.tmpdir(), `yaml-preview-${Date.now()}.html`);
            fs.writeFileSync(tempHtmlPath, styledHtml);
            
            // Puppeteerでスクリーンショット
            const browser = await puppeteer.launch({ 
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            
            // ページサイズの設定
            await page.setViewport({ 
              width: 1200, 
              height: 800, 
              deviceScaleFactor: 2 
            });
            
            await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
            
            // スクリーンショットの撮影
            await page.screenshot({ 
              path: fileUri.fsPath, 
              fullPage: true,
              omitBackground: false
            });
            
            await browser.close();
            
            // 一時ファイルの削除
            try { fs.unlinkSync(tempHtmlPath); } catch (e) { console.error('Failed to delete temp file:', e); }
            
            console.log('PNG file saved successfully');
            vscode.window.showInformationMessage(`PNGファイルをエクスポートしました: ${fileUri.fsPath}`);
            sendMessageToWebview(panel, {
              command: 'exportComplete',
              success: true,
              filePath: fileUri.fsPath,
              format: 'png'
            });
            
            resolve();
          } catch (err) {
            console.error('Error during PNG screenshot capture:', err);
            sendMessageToWebview(panel, {
              command: 'exportComplete',
              success: false,
              error: `エクスポートエラー: ${String(err)}`,
              format: 'png'
            });
            
            reject(err);
          }
        }
      };
      
      // WebViewからのメッセージを処理するイベントハンドラを登録
      panel.webview.onDidReceiveMessage(captureHandler);
      
      // Webviewにスクリーンショット準備を通知
      panel.webview.postMessage({ command: 'captureHtmlSnapshot' });
      
      // 10秒タイムアウトを設定
      htmlSnapshotTimeout = setTimeout(() => {
        console.error('Timeout waiting for HTML snapshot from WebView');
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: 'WebViewからのHTMLスナップショット取得がタイムアウトしました',
          format: 'png'
        });
        
        reject(new Error('Timeout waiting for HTML snapshot'));
      }, 10000);
    });
  } catch (err) {
    console.error('Error exporting to PNG:', err);
    vscode.window.showErrorMessage(`PNGエクスポート中にエラーが発生しました: ${String(err)}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: false,
      error: `エクスポートエラー: ${String(err)}`,
      format: 'png'
    });
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