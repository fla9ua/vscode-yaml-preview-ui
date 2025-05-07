import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import * as jsYaml from 'js-yaml';
import { TableView } from './TableView';
import { YamlDetector, YamlFormat } from '../../utils/yaml-detector';
import { ThemeProvider } from '../utils/themeContext';

// Property type definition
interface YamlPreviewProps {
  initialContent: string;
  vscodeApi: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
}

// Export format definition
type ExportFormat = 'json' | 'xml' | 'pdf' | 'csv' | 'markdown' | 'html' | 'png';

// Component wrapped with theme
const YamlPreviewInner: React.FC<YamlPreviewProps> = ({ initialContent, vscodeApi }) => {
  // YAML content state
  const [yamlContent, setYamlContent] = useState<string>(initialContent);
  // Parsed JSON data
  const [jsonData, setJsonData] = useState<any>(null);
  // Error message
  const [error, setError] = useState<string | null>(null);
  // Detected YAML format
  const [yamlFormat, setYamlFormat] = useState<YamlFormat>(YamlFormat.Generic);
  // Communication status tracking
  const [communicationStatus, setCommunicationStatus] = useState<string | null>(null);
  // Ref to hold last processed YAML content
  const lastContentRef = useRef<string>(initialContent);
  // Export menu display state
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Convert YAML to JSON
  const parseYaml = (content: string) => {
    try {
      console.log('Parsing YAML content...');
      // Make sure this code runs in browser environment
      let data = null;
      try {
        data = jsYaml.load(content);
      } catch (loadErr) {
        console.error('JS-YAML load error:', loadErr);
        throw loadErr;
      }
      
      setJsonData(data);
      // Detect YAML format
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

  // Process initial content
  useEffect(() => {
    console.log('Processing initial content...');
    parseYaml(initialContent);
    lastContentRef.current = initialContent;
  }, [initialContent]);

  // Set up VSCode API message handling
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
        // Process save complete notification
        console.log('YamlPreview: Save complete notification received:', message.success);
        if (message.success) {
          setCommunicationStatus('Saved successfully');
          setTimeout(() => setCommunicationStatus(null), 2000);
        } else {
          setCommunicationStatus(`Error: ${message.error || 'Failed to save'}`);
          setTimeout(() => setCommunicationStatus(null), 5000);
        }
      } else if (message.command === 'exportComplete') {
        // Process export complete notification
        console.log('YamlPreview: Export complete notification received:', message.success);
        if (message.success) {
          setCommunicationStatus(`Exported ${message.format?.toUpperCase() || 'file'} successfully`);
          setTimeout(() => setCommunicationStatus(null), 2000);
        } else {
          setCommunicationStatus(`Error: ${message.error || 'Export failed'}`);
          setTimeout(() => setCommunicationStatus(null), 5000);
        }
      } else if (message.command === 'prepareForScreenshot') {
        // Process screenshot preparation
        console.log('YamlPreview: Preparing for screenshot');
        // Close export menu if open
        setShowExportMenu(false);
        // Hide notification messages
        setCommunicationStatus(null);
        // Prepare other UI elements as needed (e.g., expand all nodes)
      } else if (message.command === 'captureHtmlSnapshot') {
        // Capture and send HTML snapshot
        console.log('YamlPreview: Capturing HTML snapshot');
        
        // Hide export menu
        setShowExportMenu(false);
        // Hide notification messages
        setCommunicationStatus(null);
        
        // Wait a moment to capture snapshot (to allow UI updates to complete)
        setTimeout(() => {
          try {
            // Get table element only
            const tableElement = document.querySelector('.content-view table');
            if (!tableElement) {
              // If table not found, use entire content view as fallback
              const contentElement = document.querySelector('.content-view');
              if (!contentElement) {
                throw new Error('Content element not found');
              }
              
              // Get style information
              const styles = Array.from(document.styleSheets)
                .filter(sheet => {
                  try {
                    // CSSStyleSheet.cssRules access may be restricted by CORS policy
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
              
              // Get HTML content (excluding edit-related UI elements)
              const html = contentElement.innerHTML;
              
              // Send snapshot information to VSCode
              vscodeApi.postMessage({
                command: 'htmlSnapshot',
                html: html,
                styles: styles
              });
            } else {
              // If table element found, use it only
              // Get style information
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
              
              // Get table HTML
              const html = tableElement.outerHTML;
              
              // Send snapshot information to VSCode
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
        }, 200); // Set 200ms delay
      }
    };

    // Check for VS Code Webview API initialization
    if (window.addEventListener) {
      // Listen for messages from VS Code Webview API
      window.addEventListener('message', handleVSCodeMessage);

      // Send initialization complete message
      console.log('YamlPreview: Sending ready message to VSCode');
      vscodeApi.postMessage({ command: 'ready' });
    } else {
      console.error('Window event listener is not available');
    }

    // Handle content updates from VSCode (custom event)
    const handleContentUpdate = (event: CustomEvent) => {
      const detail = event.detail;
      console.log('YamlPreview: Received content update event:', detail);
      
      if (detail.command === 'updateYaml' && detail.content) {
        // Send updated YAML back to VS Code
        vscodeApi.postMessage({
          command: 'updateYaml',
          content: detail.content
        });
        setCommunicationStatus('Saving...');
      }
    };

    // Add custom event listener
    window.addEventListener('yaml-editor-update', handleContentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('message', handleVSCodeMessage);
      window.removeEventListener('yaml-editor-update', handleContentUpdate as EventListener);
    };
  }, [vscodeApi]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showExportMenu]);

  // Export in specified format
  const exportAs = (format: ExportFormat) => {
    console.log(`YamlPreview: Exporting as ${format}`);
    
    if (!jsonData) {
      console.error('Cannot export: No valid data');
      setCommunicationStatus('Error: No valid data to export');
      setTimeout(() => setCommunicationStatus(null), 3000);
      return;
    }
    
    // Send export message to VS Code extension
    vscodeApi.postMessage({
      command: 'exportAs',
      format: format,
      content: jsonData,
      yamlContent: yamlContent
    });
    
    setCommunicationStatus(`Exporting as ${format.toUpperCase()}...`);
    setShowExportMenu(false); // Close menu
  };

  // Toggle export menu
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
          .editing-guide {
            background-color: var(--info-background);
            color: var(--info-text);
            padding: 8px 12px;
            border-radius: 4px;
            margin: 10px 0 15px;
            font-size: 12px;
            display: flex;
            align-items: center;
          }
          .editing-guide .info-icon {
            margin-right: 8px;
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
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: var(--vscode-editor-font-family);
            display: flex;
            align-items: center;
            outline: none;
            box-shadow: 0 1px 3px var(--shadow-color);
            transition: all 0.2s ease;
            min-width: 90px;
            justify-content: center;
            margin-top: 5px;
            margin-bottom: 10px;
          }
          .export-button svg {
            margin-right: 5px;
            width: 14px;
            height: 14px;
          }
          .export-button:hover {
            background-color: var(--button-hover);
            transform: scale(1.05);
          }
          .export-button:active {
            transform: translateY(1px) scale(1);
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
            min-width: 150px;
          }
          .export-menu-item {
            padding: 8px 16px;
            cursor: pointer;
            font-size: 13px;
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
          .action-buttons {
            position: relative;
            display: flex;
            justify-content: flex-start;
            margin: 10px 0 15px;
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
            --info-background: #f0f0f2;
            --info-text: #5e7985;
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
            --info-background: #2d3439;
            --info-text: #a6bbc5;
          }
        `}
      </style>
      
      {error && (
        <div className="error-message">
          <p>YAML parsing error:</p>
          <pre>{error}</pre>
        </div>
      )}
      
      {communicationStatus && (
        <div className={`communication-status ${communicationStatus.includes('Error') ? 'error' : 'success'}`}>
          {communicationStatus}
        </div>
      )}

      {/* Editing guide */}
      <div className="editing-guide">
        <span className="info-icon">ℹ️</span> Double-click on any key or value to edit
      </div>

      {/* YAML format information display */}
      {!error && jsonData && (
        <div className="yaml-format-info">
          <span className="yaml-format-icon">📄</span>
          <span className="yaml-format-name">
            {yamlFormat === YamlFormat.Generic ? 'Generic YAML' : yamlFormat}
          </span>
        </div>
      )}
      
      {/* Export button and menu */}
      <div className="action-buttons">
        <button 
          className="export-button" 
          onClick={toggleExportMenu}
          title="Export"
        >
          Export ▾
        </button>
        
        {showExportMenu && (
          <div className="export-menu">
            <div className="export-menu-item" onClick={() => exportAs('json')}>
              Save as JSON
            </div>
            <div className="export-menu-item" onClick={() => exportAs('markdown')}>
              Save as Markdown
            </div>
            <div className="export-menu-item" onClick={() => exportAs('xml')}>
              Save as XML
            </div>
            <div className="export-menu-item" onClick={() => exportAs('html')}>
              Save as HTML
            </div>
            <div className="export-menu-item" onClick={() => exportAs('png')}>
              Save as PNG
            </div>
          </div>
        )}
      </div>
      
      {/* JSON display or table display */}
      {!error && jsonData && (
        <div className="content-view">
          <TableView data={jsonData} vscodeApi={vscodeApi} yamlContent={yamlContent} />
        </div>
      )}
    </div>
  );
};

// Main component (wrapped with ThemeProvider)
export const YamlPreview: React.FC<YamlPreviewProps> = (props) => {
  return <YamlPreviewInner {...props} />;
}; 