# YAML Preview UI

A Visual Studio Code extension that provides visualization and editing capabilities for YAML files.

## Features

- Hierarchical, interactive UI display for YAML files
- Edit mode toggleable with double-click
- Preview display from context menu
- Export to various formats (JSON, Markdown, HTML, XML, PNG)

## Usage

### Opening the Preview

1. Open a YAML file (`.yaml` or `.yml` extension)
2. Use one of the following methods to display the preview:
   - Select "Show YAML Preview" from the command palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Right-click in the editor and select "Show YAML Preview" from the context menu

### Navigation and Interaction

- Click on triangle icons next to objects or arrays to expand/collapse
- Use the search box to filter content by key or value
- The breadcrumb navigation at the top shows your current position in the hierarchy

### Editing Mode

- Click the "Edit YAML" button to switch to editing mode
- Double-click on any value to edit it directly
- After editing, click "Show Preview" to apply and view your changes

### Exporting

1. Click the "Export" button in the preview toolbar
2. Select your desired export format:
   - JSON: Structured data format
   - Markdown: For documentation
   - HTML: For web display
   - XML: For data interchange
   - PNG: For image representation