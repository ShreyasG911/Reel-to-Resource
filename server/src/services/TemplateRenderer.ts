export interface TemplateVariables {
  resourceUrl?: string;
  title?: string;
  reelId?: string;
  senderId?: string;
  [key: string]: string | undefined;
}

export class TemplateRenderer {
  private static readonly VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

  /**
   * Replaces placeholders like {{resourceUrl}} with provided variable values.
   */
  public static render(template: string, variables: TemplateVariables): string {
    if (!template || typeof template !== 'string') {
      return '';
    }

    return template.replace(this.VARIABLE_REGEX, (match, variableName) => {
      const val = variables[variableName];
      if (val !== undefined && val !== null) {
        return String(val);
      }
      // If variable is missing, return empty string or keep clean
      return '';
    }).trim();
  }
}

