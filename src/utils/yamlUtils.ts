import * as jsYaml from 'js-yaml';

/**
 * YAMLからJSONオブジェクトへの変換を行うユーティリティクラス
 */
export class YamlUtils {
  /**
   * YAMLテキストをJSONオブジェクトに変換する
   * @param yamlText YAML形式のテキスト
   * @returns 変換されたJSONオブジェクト
   */
  static parseYaml(yamlText: string): any {
    try {
      return jsYaml.load(yamlText);
    } catch (error) {
      console.error('Failed to parse YAML:', error);
      throw error;
    }
  }

  /**
   * JSONオブジェクトをYAMLテキストに変換する
   * @param jsonObj JSONオブジェクト
   * @returns YAML形式のテキスト
   */
  static stringifyYaml(jsonObj: any): string {
    try {
      return jsYaml.dump(jsonObj, {
        lineWidth: -1, // 行の折り返しなし
        noRefs: true,  // 循環参照の処理
        sortKeys: false, // キーの順序を保持
        schema: jsYaml.DEFAULT_SCHEMA
      });
    } catch (error) {
      console.error('Failed to stringify YAML:', error);
      throw error;
    }
  }

  /**
   * YAMLテキストの検証を行う
   * @param yamlText YAML形式のテキスト
   * @returns エラーがあればそのメッセージ、なければnull
   */
  static validateYaml(yamlText: string): string | null {
    try {
      jsYaml.load(yamlText);
      return null;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return 'Unknown YAML error';
    }
  }
} 