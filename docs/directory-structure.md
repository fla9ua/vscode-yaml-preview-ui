# ディレクトリ構造

プロジェクトは以下のディレクトリ構造で構築されます：

```
yaml-preview-ui/
├── .vscode/             # VSCode設定ファイル
├── docs/                # ドキュメント
├── src/                 # 拡張機能のソースコード
│   ├── extension.ts     # 拡張機能のエントリーポイント
│   ├── webview/         # Webviewのソースコード
│   │   ├── components/  # Reactコンポーネント
│   │   ├── utils/       # ユーティリティ関数
│   │   └── index.tsx    # Webviewのエントリーポイント
│   └── utils/           # 拡張機能全体のユーティリティ関数
├── media/               # アイコンなどの静的リソース
├── .gitignore
├── package.json         # プロジェクト設定
├── tsconfig.json        # TypeScript設定
├── webpack.config.js    # Webpack設定
└── README.md            # プロジェクト説明
```

## 主要コンポーネント

### 拡張機能側（Extension Host）
- `src/extension.ts`: 拡張機能のメインファイル
- `src/utils/`: YAMLパースやVSCode APIとの連携を行うユーティリティ

### Webview側（Webview Host）
- `src/webview/index.tsx`: Webviewのエントリーポイント
- `src/webview/components/`: UI構築用のReactコンポーネント
- `src/webview/utils/`: Webview側のユーティリティ関数 