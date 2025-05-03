# ローカル開発環境セットアップ

## 必要条件
- Node.js (LTS版推奨、v16以上)
- npm または yarn
- Git
- Visual Studio Code

## 開発環境セットアップ手順

### 1. 必要なグローバルパッケージのインストール

```bash
# Yeoman（スキャフォールディングツール）とVSCode拡張機能ジェネレータのインストール
npm install -g yo generator-code vsce
```

### 2. VSCode拡張機能プロジェクトの初期化

```bash
# プロジェクトルートで以下を実行
yo code
```

プロンプトでは以下のように回答します：
- 拡張機能の種類: TypeScript拡張機能
- 拡張機能の名前: yaml-preview-ui
- 説明: VSCode extension for YAML visualization and editing
- その他の項目は適宜設定

### 3. React環境のセットアップ

```bash
# Reactとその関連パッケージをインストール
npm install --save react react-dom
npm install --save-dev @types/react @types/react-dom
```

### 4. YAML解析のためのパッケージ

```bash
# js-yamlのインストール
npm install --save js-yaml
npm install --save-dev @types/js-yaml
```

### 5. Webpackの設定（Reactを使用するため）

```bash
npm install --save-dev webpack webpack-cli ts-loader css-loader style-loader
```

### 6. 開発サーバーの起動

```bash
# 開発モードで拡張機能を実行
npm run watch
```

その後、F5キーでVSCodeの新しいウィンドウが起動し、デバッグモードで拡張機能を実行できます。

## プロジェクト構造
プロジェクトは`docs/directory-structure.md`に記載された構造に従って構築します。 