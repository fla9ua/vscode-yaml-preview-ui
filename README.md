# YAML Preview UI

VSCode拡張機能「YAML Preview UI」は、YAMLファイルのビジュアルプレビューと編集機能を提供します。

## 機能

- YAMLファイルを階層的な対話型UIで表示
- ダブルクリックでの編集モード切替
- コンテキストメニューからのプレビュー表示
- 様々なフォーマット（JSON, Markdown, HTML, XML, PNG）へのエクスポート

## インストール方法

### 開発版のインストール

1. リポジトリのクローン:
   ```
   git clone https://github.com/your-username/yaml-preview-ui.git
   cd yaml-preview-ui
   ```

2. 依存パッケージのインストール:
   ```
   npm install
   ```

3. 拡張機能のビルド:
   ```
   npm run compile
   ```

4. VSCodeでのデバッグ:
   - F5キーを押して新しいVSCodeウィンドウでデバッグ実行

## 使用方法

1. YAMLファイル(.yaml, .yml)を開く
2. 以下のいずれかの方法でプレビューを表示:
   - コマンドパレットから「Show YAML Preview」を選択
   - エディタのコンテキストメニューから「Show YAML Preview」を選択
   
3. プレビュー画面での操作:
   - オブジェクトや配列の横の三角アイコンをクリックして展開/折りたたみ
   - 「Edit YAML」ボタンをクリックして編集モードに切替
   - 編集後は「Show Preview」ボタンをクリックして変更を確認

## 開発者向け情報

### プロジェクト構造

```
yaml-preview-ui/
├── src/                 # ソースコード
│   ├── extension.ts     # 拡張機能のエントリーポイント
│   ├── webview/         # Webviewのソースコード
│   │   ├── components/  # Reactコンポーネント
│   │   ├── utils/       # ユーティリティ関数
│   │   └── index.tsx    # Webviewのエントリーポイント
│   └── utils/           # 拡張機能全体のユーティリティ
└── ...
```

### 開発用コマンド

- `npm run compile`: TypeScriptのコンパイル
- `npm run watch`: ファイル変更を監視して自動コンパイル
- `npm run lint`: コードのリント
- `npm run test`: テストの実行
- `npm run package`: 拡張機能のパッケージング

## トラブルシューティング

### WebView関連の問題

#### "process is not defined" エラー

このエラーはNode.jsのプロセスオブジェクトがブラウザ環境で利用できないときに発生します。

**解決策**:
1. 以下のパッケージがインストールされていることを確認:
   ```
   npm install process buffer --save-dev
   ```

2. `webpack.config.js`のWebviewConfig部分で以下の設定が正しく行われていることを確認:
   ```javascript
   resolve: {
     extensions: ['.ts', '.tsx', '.js', '.jsx'],
     fallback: {
       path: false,
       fs: false,
       process: require.resolve('process/browser'),
       buffer: false
     }
   },
   plugins: [
     new webpack.ProvidePlugin({
       process: 'process/browser'
     }),
     new webpack.DefinePlugin({
       'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG),
       'process.env': '{}'
     })
   ],
   ```

3. 変更後は必ず再ビルドを行う:
   ```
   npm run compile
   ``` 