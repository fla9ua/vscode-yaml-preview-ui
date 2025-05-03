/**
 * YAML形式の自動検出ユーティリティ
 */

// サポートされるYAML形式の種類
export enum YamlFormat {
  Generic = 'generic',
  Kubernetes = 'kubernetes',
  DockerCompose = 'docker-compose',
  OpenAPI = 'openapi',
  CloudFormation = 'cloudformation',
  GitHubActions = 'github-actions',
}

/**
 * YAMLコンテンツの形式を検出するクラス
 */
export class YamlDetector {
  /**
   * YAMLコンテンツから形式を検出
   * @param content YAMLコンテンツ
   * @returns 検出された形式
   */
  static detectFormat(content: any): YamlFormat {
    if (!content || typeof content !== 'object') {
      return YamlFormat.Generic;
    }

    // Kubernetes リソースの検出
    if (content.apiVersion && content.kind) {
      return YamlFormat.Kubernetes;
    }

    // Docker Compose の検出
    if (content.version && (content.services || content.networks || content.volumes)) {
      return YamlFormat.DockerCompose;
    }

    // OpenAPI/Swagger の検出
    if (content.openapi || content.swagger) {
      return YamlFormat.OpenAPI;
    }

    // AWS CloudFormation の検出
    if (content.AWSTemplateFormatVersion || content.Resources) {
      return YamlFormat.CloudFormation;
    }

    // GitHub Actions の検出
    if (content.name && content.on && content.jobs) {
      return YamlFormat.GitHubActions;
    }

    // どのパターンにも一致しない場合はジェネリック
    return YamlFormat.Generic;
  }

  /**
   * 形式にあったアイコンを返す
   * @param format YAML形式
   * @returns アイコン文字列
   */
  static getFormatIcon(format: YamlFormat): string {
    switch (format) {
      case YamlFormat.Kubernetes:
        return ''; // Kubernetesアイコン
      case YamlFormat.DockerCompose:
        return ''; // Dockerアイコン
      case YamlFormat.OpenAPI:
        return ''; // APIアイコン
      case YamlFormat.CloudFormation:
        return ''; // Cloudアイコン
      case YamlFormat.GitHubActions:
        return ''; // Gear/Actionsアイコン
      default:
        return ''; // Generic documentアイコン
    }
  }

  /**
   * 形式の表示名を返す
   * @param format YAML形式
   * @returns 表示名
   */
  static getFormatDisplayName(format: YamlFormat): string {
    switch (format) {
      case YamlFormat.Kubernetes:
        return 'Kubernetes';
      case YamlFormat.DockerCompose:
        return 'Docker Compose';
      case YamlFormat.OpenAPI:
        return 'OpenAPI/Swagger';
      case YamlFormat.CloudFormation:
        return 'AWS CloudFormation';
      case YamlFormat.GitHubActions:
        return 'GitHub Actions';
      default:
        return 'Generic YAML';
    }
  }
} 