import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import modules for export functionality
// Note: These modules work in Node.js environment but not in Webview
import * as convert from 'xml-js';
import { stringify } from 'csv-stringify/sync';
import MarkdownIt from 'markdown-it';
import * as PDFDocument from 'pdfkit';
import * as puppeteer from 'puppeteer';

// Variable to hold reference to the Webview panel
let currentPanel: vscode.WebviewPanel | undefined = undefined;
// Reference to the currently open editor
let currentEditor: vscode.TextEditor | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  // Log when extension is activated
  console.log('YAML Preview UI is now active');

  // Register command: Show YAML Preview
  let disposable = vscode.commands.registerCommand('yaml-preview-ui.showPreview', () => {
    // Add debug log
    console.log('YAML Preview command triggered');
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      console.log('No active editor found');
      return;
    }

    // Only target YAML files
    if (editor.document.languageId !== 'yaml' && !editor.document.fileName.endsWith('.yml')) {
      vscode.window.showErrorMessage('Active editor does not contain YAML content');
      console.log('Active editor does not contain YAML content: ' + editor.document.languageId);
      return;
    }

    // Save current editor
    currentEditor = editor;
    
    const yamlContent = editor.document.getText();
    console.log('YAML content length: ' + yamlContent.length);
    
    // Reuse existing panel if available, otherwise create a new one
    if (currentPanel) {
      console.log('Reusing existing panel');
      currentPanel.reveal(vscode.ViewColumn.Beside);
      updateWebview(currentPanel, yamlContent);
    } else {
      // Create a new Webview panel
      console.log('Creating new panel');
      try {
        currentPanel = vscode.window.createWebviewPanel(
          'yamlPreview',
          'YAML Preview',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true, // Retain context
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, 'out')),
              vscode.Uri.file(context.extensionPath)
            ]
          }
        );
        
        console.log('Panel created successfully');

        // Set Webview content
        setupWebview(currentPanel, context, yamlContent);

        // Handle panel close event
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

  // Update preview when editor content changes
  vscode.workspace.onDidChangeTextDocument(event => {
    if (currentPanel && currentEditor && event.document === currentEditor.document) {
      console.log('Document changed, updating preview');
      updateWebview(currentPanel, event.document.getText());
    }
  });

  // Handle editor switching
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && (editor.document.languageId === 'yaml' || editor.document.fileName.endsWith('.yml'))) {
      console.log('Editor changed to YAML file');
      currentEditor = editor;
      if (currentPanel) {
        updateWebview(currentPanel, editor.document.getText());
      }
    }
  });

  context.subscriptions.push(disposable);
}

// Initialize Webview
function setupWebview(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, yamlContent: string) {
  // Get path to webview.js
  try {
    const scriptPath = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview.js'))
    );
    console.log('Script path:', scriptPath.toString());

    // Generate HTML
    panel.webview.html = getWebviewContent(scriptPath, yamlContent);
    console.log('Webview HTML has been set');

    // Add script with custom event listeners
    const customEventCode = `
      <script>
        // Set up custom event listeners
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

    // Update HTML with inserted script
    let htmlContent = panel.webview.html;
    htmlContent = htmlContent.replace('</body>', `${customEventCode}</body>`);
    panel.webview.html = htmlContent;

    // Register event handler to process messages from Webview
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

// Update Webview content
function updateWebview(panel: vscode.WebviewPanel, yamlContent: string) {
  console.log('Posting message to update webview content');
  panel.webview.postMessage({ command: 'updateContent', content: yamlContent });
}

// Helper function to confirm message sending to Webview
function sendMessageToWebview(panel: vscode.WebviewPanel, message: any) {
  console.log('Sending message to webview:', message.command);
  panel.webview.postMessage(message);
  // Log to check if message was delivered
  console.log('Message posted to webview');
}

// Function to get current workspace directory
function getWorkspaceDirectory(): string | undefined {
  // Check if there's at least one workspace folder
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Get path of the first workspace folder
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  // If no workspace folder, use directory of the file being edited
  if (vscode.window.activeTextEditor) {
    const activeFile = vscode.window.activeTextEditor.document.uri;
    return path.dirname(activeFile.fsPath);
  }
  // Return undefined if neither can be obtained
  return undefined;
}

// Function to generate filename with current date and time
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

// Event handler to process messages from Webview
async function handleWebviewMessage(panel: vscode.WebviewPanel, message: any) {
  console.log('Received message from webview:', message.command);
  switch (message.command) {
    case 'ready':
      // Webview ready notification only
      console.log('Webview ready notification received');
      break;
    
    case 'updateYaml':
      // Get currently open editor (check current active editor and currentEditor)
      const editor = vscode.window.activeTextEditor || currentEditor;
      
      if (!editor || !message.content) {
        console.error('No active editor or content for YAML update');
        // If editor cannot be found, show error to user
        vscode.window.showErrorMessage('Failed to update YAML: Editor not found. Please do not close the editor while editing YAML.');
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: 'Failed to update YAML: Editor not found'
        });
        return;
      }
      
      // Check if editor is not a YAML file
      if (editor.document.languageId !== 'yaml' && !editor.document.fileName.endsWith('.yml')) {
        console.error('Active editor is not a YAML file');
        vscode.window.showErrorMessage('Failed to update YAML: Active editor is not a YAML file.');
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: 'Failed to update YAML: Active editor is not a YAML file'
        });
        return;
      }
      
      try {
        console.log('Updating YAML in editor...');
        
        // Update entire file
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          editor.document.lineAt(editor.document.lineCount - 1).range.end
        );
        
        // Perform edit
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
          console.log('Replacing content in editor...');
          editBuilder.replace(fullRange, message.content);
        }).then((success: boolean) => {
          if (success) {
            console.log('Edit successful, saving file...');
            // Explicitly save changes
            try {
              // Set timeout to ensure changes are reflected before saving
              setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.files.save')
                  .then(() => {
                    console.log('YAML content saved successfully');
                    // Notify save success
                    sendMessageToWebview(panel, { 
                      command: 'saveComplete', 
                      success: true 
                    });
                  }, (err) => {
                    // Error handling
                    console.error('Error saving file:', err);
                    vscode.window.showErrorMessage('Failed to save YAML changes. Please try again.');
                    sendMessageToWebview(panel, { 
                      command: 'saveComplete', 
                      success: false,
                      error: 'Save failed'
                    });
                  });
              }, 100); // Wait 100ms
            } catch (err) {
              console.error('Exception during save operation:', err);
              vscode.window.showErrorMessage('Failed to save YAML changes: ' + String(err));
              sendMessageToWebview(panel, { 
                command: 'saveComplete', 
                success: false,
                error: String(err)
              });
            }
          } else {
            console.error('Failed to update YAML content');
            vscode.window.showErrorMessage('Failed to update YAML content. Please try again.');
            sendMessageToWebview(panel, { 
              command: 'saveComplete', 
              success: false,
              error: 'Edit failed'
            });
          }
        }, (err: any) => {
          // Error handling for edit operation
          console.error('Exception during edit operation:', err);
          vscode.window.showErrorMessage('Failed to update YAML: ' + String(err));
          sendMessageToWebview(panel, { 
            command: 'saveComplete', 
            success: false,
            error: 'Edit operation failed: ' + String(err)
          });
        });
      } catch (err) {
        console.error('Exception processing updateYaml message:', err);
        vscode.window.showErrorMessage('Failed to update YAML: ' + String(err));
        sendMessageToWebview(panel, { 
          command: 'saveComplete', 
          success: false,
          error: 'YAML processing error: ' + String(err)
        });
      }
      break;
    case 'exportAs':
      // Export to various formats
      if (!message.content) {
        console.error('No content for export');
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: 'No data to export',
          format: message.format
        });
        return;
      }

      try {
        // Branch processing based on export format
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
            return; // PDF output is separate processing, so exit here
          case 'png':
            await exportAsPng(panel, jsonData, message.yamlContent);
            return; // PNG output is separate processing, so exit here
          default:
            throw new Error(`Unsupported export format: ${message.format}`);
        }

        // Generate default filename with date and time
        const defaultFilename = generateExportFilename(fileExtension);
        
        // Get current workspace directory
        const workspaceDir = getWorkspaceDirectory();
        
        // Set default URI
        let defaultUri: vscode.Uri | undefined = undefined;
        if (workspaceDir) {
          defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
        } else {
          // If workspace cannot be obtained, use user's home directory
          defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
        }

        // Show save dialog
        const options: vscode.SaveDialogOptions = {
          defaultUri: defaultUri,
          filters: {
            [`${format.toUpperCase()} Files`]: [fileExtension]
          },
          title: `Export as ${format.toUpperCase()}`,
          saveLabel: `Export as ${format.toUpperCase()}`
        };

        vscode.window.showSaveDialog(options).then(fileUri => {
          if (fileUri) {
            // Save file
            fs.writeFile(fileUri.fsPath, exportContent, err => {
              if (err) {
                console.error(`Error saving ${format} file:`, err);
                vscode.window.showErrorMessage(`Failed to save ${format.toUpperCase()} file: ${err.message}`);
                sendMessageToWebview(panel, {
                  command: 'exportComplete',
                  success: false,
                  error: `Failed to save: ${err.message}`,
                  format: format
                });
              } else {
                console.log(`${format} file saved successfully`);
                vscode.window.showInformationMessage(`${format.toUpperCase()} file exported successfully: ${fileUri.fsPath}`);
                sendMessageToWebview(panel, {
                  command: 'exportComplete',
                  success: true,
                  filePath: fileUri.fsPath,
                  format: format
                });
              }
            });
          } else {
            // User cancelled save
            console.log(`${format} export cancelled by user`);
            sendMessageToWebview(panel, {
              command: 'exportComplete',
              success: false,
              error: 'Export cancelled by user',
              format: format
            });
          }
        });
      } catch (err) {
        console.error(`Exception during ${message.format} export:`, err);
        vscode.window.showErrorMessage(`Failed to export ${message.format}: ${String(err)}`);
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: `Export error: ${String(err)}`,
          format: message.format
        });
      }
      break;
    case 'error':
      // Webview error notification
      console.error('Error in webview:', message.message);
      vscode.window.showErrorMessage('YAML Preview error: ' + message.message);
      break;
  }
}

// Convert JSON to XML
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
    throw new Error('Failed to convert to XML: ' + String(err));
  }
}

// Convert JSON to CSV
function convertToCsv(jsonData: any): string {
  try {
    // Convert array data to CSV
    if (Array.isArray(jsonData)) {
      return stringify(jsonData, { header: true });
    }
    
    // Convert object data to array for CSV
    if (typeof jsonData === 'object' && jsonData !== null) {
      // Process object data as 1-row array
      return stringify([jsonData], { header: true });
    }
    
    throw new Error('Only array or object data can be converted to CSV');
  } catch (err) {
    console.error('Error converting to CSV:', err);
    throw new Error('Failed to convert to CSV: ' + String(err));
  }
}

// Convert JSON to Markdown
function convertToMarkdown(jsonData: any): string {
  try {
    let markdown = '# YAML Data Export\n\n';
    
    // Format JSON and add
    markdown += '```json\n';
    markdown += JSON.stringify(jsonData, null, 2);
    markdown += '\n```\n\n';
    
    // Add data structure as table format (simplified implementation)
    if (typeof jsonData === 'object' && jsonData !== null) {
      markdown += '## Data Structure\n\n';
      
      if (Array.isArray(jsonData)) {
        markdown += '### Array Items\n\n';
        
        // If array, show first 10 items as sample
        const sample = jsonData.slice(0, 10);
        if (sample.length > 0 && typeof sample[0] === 'object') {
          // If object array, show properties in table
          const keys = Object.keys(sample[0]);
          markdown += '| ' + keys.join(' | ') + ' |\n';
          markdown += '| ' + keys.map(() => '---').join(' | ') + ' |\n';
          
          sample.forEach(item => {
            markdown += '| ' + keys.map(key => String(item[key] || '')).join(' | ') + ' |\n';
          });
        } else {
          // If primitive array, show simple list
          sample.forEach(item => {
            markdown += `- ${String(item)}\n`;
          });
        }
        
        if (jsonData.length > 10) {
          markdown += '\n*... and more items*\n';
        }
      } else {
        markdown += '### Object Properties\n\n';
        
        // If object, show key and value in table
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
    throw new Error('Failed to convert to Markdown: ' + String(err));
  }
}

// Convert JSON to HTML
function convertToHtml(jsonData: any): string {
  try {
    // Custom HTML generation
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
    throw new Error('Failed to convert to HTML: ' + String(err));
  }
}

// Render object as HTML table recursively
function renderObjectAsHtmlTable(data: any, level: number = 0): string {
  if (data === null || data === undefined) {
    return '<span class="null-value">null</span>';
  }

  // If primitive value, simply text display
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return escapeHtml(data);
    }
    return String(data);
  }

  // If array, show ordered list
  if (Array.isArray(data)) {
    let html = '<div class="array-container">';
    
    // Check array content (complex structure or not)
    const hasComplexItems = data.some(item => typeof item === 'object' && item !== null);
    
    if (hasComplexItems) {
      // If complex structure, show table format
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
      // Simple value array, show list format
      html += '<ol class="simple-array">';
      data.forEach(item => {
        html += `<li class="array-item">${typeof item === 'string' ? escapeHtml(item) : String(item)}</li>`;
      });
      html += '</ol>';
    }
    
    html += '</div>';
    return html;
  }

  // If object, show table format
  let html = `<table class="object-table${level > 0 ? ' nested-table' : ''}">`;
  
  // Show key and value as table row
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

// HTML special characters escaping function
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Export JSON to PDF
async function exportAsPdf(panel: vscode.WebviewPanel, jsonData: any, _yamlContent: string) {
  try {
    // Generate default filename with date and time
    const defaultFilename = generateExportFilename('pdf');
    
    // Get current workspace directory
    const workspaceDir = getWorkspaceDirectory();
    
    // Set default URI
    let defaultUri: vscode.Uri | undefined = undefined;
    if (workspaceDir) {
      defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
    } else {
      // If workspace cannot be obtained, use user's home directory
      defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
    }
    
    // Show save dialog
    const options: vscode.SaveDialogOptions = {
      defaultUri: defaultUri,
      filters: {
        'PDF Files': ['pdf']
      },
      title: 'Export as PDF',
      saveLabel: 'Export as PDF'
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    
    if (!fileUri) {
      console.log('PDF export cancelled by user');
      sendMessageToWebview(panel, {
        command: 'exportComplete',
        success: false,
        error: 'Export cancelled by user',
        format: 'pdf'
      });
      return;
    }

    // Generate HTML and save to temporary file
    const htmlContent = convertToHtml(jsonData);
    const tempHtmlPath = path.join(os.tmpdir(), `yaml-preview-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // Use Puppeteer to convert to PDF
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
    
    // Delete temporary file
    try { fs.unlinkSync(tempHtmlPath); } catch (e) { console.error('Failed to delete temp file:', e); }

    console.log('PDF file saved successfully');
    vscode.window.showInformationMessage(`PDF file exported successfully: ${fileUri.fsPath}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: true,
      filePath: fileUri.fsPath,
      format: 'pdf'
    });
  } catch (err) {
    console.error('Error exporting to PDF:', err);
    vscode.window.showErrorMessage(`Failed to export PDF: ${String(err)}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: false,
      error: `Export error: ${String(err)}`,
      format: 'pdf'
    });
  }
}

// Export JSON to PNG
async function exportAsPng(panel: vscode.WebviewPanel, _jsonData: any, _yamlContent: string) {
  try {
    // Generate default filename with date and time
    const defaultFilename = generateExportFilename('png');
    
    // Get current workspace directory
    const workspaceDir = getWorkspaceDirectory();
    
    // Set default URI
    let defaultUri: vscode.Uri | undefined = undefined;
    if (workspaceDir) {
      defaultUri = vscode.Uri.file(path.join(workspaceDir, defaultFilename));
    } else {
      // If workspace cannot be obtained, use user's home directory
      defaultUri = vscode.Uri.file(path.join(os.homedir(), defaultFilename));
    }
    
    // Show save dialog
    const options: vscode.SaveDialogOptions = {
      defaultUri: defaultUri,
      filters: {
        'PNG Files': ['png']
      },
      title: 'Export as PNG',
      saveLabel: 'Export as PNG'
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    
    if (!fileUri) {
      console.log('PNG export cancelled by user');
      sendMessageToWebview(panel, {
        command: 'exportComplete',
        success: false,
        error: 'Export cancelled by user',
        format: 'png'
      });
      return;
    }

    // WebView HTML content
    // Cannot directly get HTML from WebView, so use messaging
    return new Promise<void>((resolve, reject) => {
      let htmlSnapshotTimeout: NodeJS.Timeout | null = null;
      
      // Handler for screenshot capture
      const captureHandler = async (message: any) => {
        if (message.command === 'htmlSnapshot') {
          // Clear timeout
          if (htmlSnapshotTimeout) {
            clearTimeout(htmlSnapshotTimeout);
            htmlSnapshotTimeout = null;
          }
          
          // Remove message handler
          panel.webview.onDidReceiveMessage(() => {}, undefined, []);
          
          try {
            // Get HTML snapshot
            const htmlContent = message.html;
            
            // Create styled HTML
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
    /* Additional styles for table */
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
            
            // Save to temporary file
            const tempHtmlPath = path.join(os.tmpdir(), `yaml-preview-${Date.now()}.html`);
            fs.writeFileSync(tempHtmlPath, styledHtml);
            
            // Use Puppeteer for screenshot
            const browser = await puppeteer.launch({ 
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            
            // Set page size
            await page.setViewport({ 
              width: 1200, 
              height: 800, 
              deviceScaleFactor: 2 
            });
            
            await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
            
            // Take screenshot
            await page.screenshot({ 
              path: fileUri.fsPath, 
              fullPage: true,
              omitBackground: false
            });
            
            await browser.close();
            
            // Delete temporary file
            try { fs.unlinkSync(tempHtmlPath); } catch (e) { console.error('Failed to delete temp file:', e); }
            
            console.log('PNG file saved successfully');
            vscode.window.showInformationMessage(`PNG file exported successfully: ${fileUri.fsPath}`);
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
              error: `Export error: ${String(err)}`,
              format: 'png'
            });
            
            reject(err);
          }
        }
      };
      
      // Register event handler to process messages from Webview
      panel.webview.onDidReceiveMessage(captureHandler);
      
      // Notify Webview for screenshot preparation
      panel.webview.postMessage({ command: 'captureHtmlSnapshot' });
      
      // Set 10-second timeout
      htmlSnapshotTimeout = setTimeout(() => {
        console.error('Timeout waiting for HTML snapshot from WebView');
        sendMessageToWebview(panel, {
          command: 'exportComplete',
          success: false,
          error: 'Timeout waiting for HTML snapshot from WebView',
          format: 'png'
        });
        
        reject(new Error('Timeout waiting for HTML snapshot'));
      }, 10000);
    });
  } catch (err) {
    console.error('Error exporting to PNG:', err);
    vscode.window.showErrorMessage(`Failed to export PNG: ${String(err)}`);
    sendMessageToWebview(panel, {
      command: 'exportComplete',
      success: false,
      error: `Export error: ${String(err)}`,
      format: 'png'
    });
  }
}

// Generate HTML to display in Webview
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
      // Add error handling
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

      // Initial data setup
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

// This method is called when the extension is deactivated
export function deactivate() {} 