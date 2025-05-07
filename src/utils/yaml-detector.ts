/**
 * YAML format auto-detection utility
 */

// Supported YAML format types
export enum YamlFormat {
  Generic = 'generic',
  Kubernetes = 'kubernetes',
  DockerCompose = 'docker-compose',
  OpenAPI = 'openapi',
  CloudFormation = 'cloudformation',
  GitHubActions = 'github-actions',
}

/**
 * Class for detecting YAML content format
 */
export class YamlDetector {
  /**
   * Detect format from YAML content
   * @param content YAML content
   * @returns Detected format
   */
  static detectFormat(content: any): YamlFormat {
    if (!content || typeof content !== 'object') {
      return YamlFormat.Generic;
    }

    // Kubernetes resource detection
    if (content.apiVersion && content.kind) {
      return YamlFormat.Kubernetes;
    }

    // Docker Compose detection
    if (content.version && (content.services || content.networks || content.volumes)) {
      return YamlFormat.DockerCompose;
    }

    // OpenAPI/Swagger detection
    if (content.openapi || content.swagger) {
      return YamlFormat.OpenAPI;
    }

    // AWS CloudFormation detection
    if (content.AWSTemplateFormatVersion || content.Resources) {
      return YamlFormat.CloudFormation;
    }

    // GitHub Actions detection
    if (content.name && content.on && content.jobs) {
      return YamlFormat.GitHubActions;
    }

    // If no patterns match, return generic
    return YamlFormat.Generic;
  }

  /**
   * Return icon corresponding to the format
   * @param format YAML format
   * @returns Icon string
   */
  static getFormatIcon(format: YamlFormat): string {
    switch (format) {
      case YamlFormat.Kubernetes:
        return ''; // Kubernetes icon
      case YamlFormat.DockerCompose:
        return ''; // Docker icon
      case YamlFormat.OpenAPI:
        return ''; // API icon
      case YamlFormat.CloudFormation:
        return ''; // Cloud icon
      case YamlFormat.GitHubActions:
        return ''; // Gear/Actions icon
      default:
        return ''; // Generic document icon
    }
  }

  /**
   * Return display name for the format
   * @param format YAML format
   * @returns Display name
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