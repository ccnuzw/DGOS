// DGOS Accessibility Testing Utilities
// Tools for testing WCAG compliance and accessibility

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  element?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
}

export class AccessibilityChecker {
  private issues: AccessibilityIssue[] = [];

  /**
   * Check color contrast ratio
   */
  checkColorContrast(
    foreground: string,
    background: string,
    fontSize: number,
    wcagLevel: 'AA' | 'AAA' = 'AA'
  ): AccessibilityIssue | null {
    const contrast = this.calculateContrast(foreground, background);
    const isLargeText = fontSize >= 18 || fontSize >= 14; // 14pt bold or 18pt regular

    const requiredRatio = wcagLevel === 'AAA'
      ? (isLargeText ? 4.5 : 7)
      : (isLargeText ? 3 : 4.5);

    if (contrast < requiredRatio) {
      const issue: AccessibilityIssue = {
        type: 'error',
        rule: 'color-contrast',
        message: `Contrast ratio ${contrast.toFixed(2)}:1 is below required ${requiredRatio}:1`,
        wcagLevel,
      };
      this.issues.push(issue);
      return issue;
    }

    return null;
  }

  /**
   * Calculate relative luminance of a color
   */
  private getLuminance(hex: string): number {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Apply gamma correction
    const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrast(color1: string, color2: string): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if element has proper ARIA labels
   */
  checkAriaLabels(element: {
    role?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    ariaDescribedBy?: string;
  }): AccessibilityIssue | null {
    if (!element.role) {
      return null; // No role, no ARIA requirements
    }

    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'slider'];

    if (interactiveRoles.includes(element.role)) {
      if (!element.ariaLabel && !element.ariaLabelledBy) {
        const issue: AccessibilityIssue = {
          type: 'error',
          rule: 'aria-label',
          message: `Interactive element with role="${element.role}" must have aria-label or aria-labelledby`,
          element: element.role,
          wcagLevel: 'A',
        };
        this.issues.push(issue);
        return issue;
      }
    }

    return null;
  }

  /**
   * Check keyboard navigation support
   */
  checkKeyboardNavigation(element: {
    role?: string;
    tabIndex?: number;
    onClick?: Function;
    onKeyDown?: Function;
  }): AccessibilityIssue | null {
    const interactiveRoles = ['button', 'link'];

    if (element.role && interactiveRoles.includes(element.role)) {
      if (element.onClick && !element.onKeyDown) {
        const issue: AccessibilityIssue = {
          type: 'error',
          rule: 'keyboard-navigation',
          message: `Interactive element with role="${element.role}" must handle keyboard events`,
          element: element.role,
          wcagLevel: 'A',
        };
        this.issues.push(issue);
        return issue;
      }

      if (element.tabIndex !== undefined && element.tabIndex < 0 && element.role !== 'link') {
        const issue: AccessibilityIssue = {
          type: 'warning',
          rule: 'keyboard-navigation',
          message: `Interactive element should be keyboard accessible (tabIndex >= 0)`,
          element: element.role,
          wcagLevel: 'A',
        };
        this.issues.push(issue);
        return issue;
      }
    }

    return null;
  }

  /**
   * Check if images have alt text
   */
  checkImageAlt(image: {
    alt?: string;
    role?: string;
    ariaLabel?: string;
  }): AccessibilityIssue | null {
    if (!image.alt && !image.ariaLabel && image.role !== 'presentation') {
      const issue: AccessibilityIssue = {
        type: 'error',
        rule: 'image-alt',
        message: 'Images must have alt text or aria-label',
        element: 'img',
        wcagLevel: 'A',
      };
      this.issues.push(issue);
      return issue;
    }

    return null;
  }

  /**
   * Check form input labels
   */
  checkFormLabel(input: {
    id?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    type?: string;
  }): AccessibilityIssue | null {
    if (input.type === 'hidden') {
      return null;
    }

    if (!input.ariaLabel && !input.ariaLabelledBy && !input.id) {
      const issue: AccessibilityIssue = {
        type: 'error',
        rule: 'form-label',
        message: 'Form inputs must have associated labels',
        element: 'input',
        wcagLevel: 'A',
      };
      this.issues.push(issue);
      return issue;
    }

    return null;
  }

  /**
   * Check heading hierarchy
   */
  checkHeadingHierarchy(headings: Array<{ level: number; text: string }>): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];

      if (curr.level > prev.level + 1) {
        const issue: AccessibilityIssue = {
          type: 'warning',
          rule: 'heading-hierarchy',
          message: `Heading level skipped from h${prev.level} to h${curr.level}`,
          wcagLevel: 'AA',
        };
        this.issues.push(issue);
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Get all recorded issues
   */
  getIssues(): AccessibilityIssue[] {
    return this.issues;
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(type: 'error' | 'warning' | 'info'): AccessibilityIssue[] {
    return this.issues.filter(issue => issue.type === type);
  }

  /**
   * Check if there are any accessibility errors
   */
  hasErrors(): boolean {
    return this.issues.some(issue => issue.type === 'error');
  }

  /**
   * Generate accessibility report
   */
  report(): string {
    const lines: string[] = ['Accessibility Report', '='.repeat(50)];

    const errors = this.getIssuesBySeverity('error');
    const warnings = this.getIssuesBySeverity('warning');
    const infos = this.getIssuesBySeverity('info');

    lines.push(`\nSummary: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);

    if (errors.length > 0) {
      lines.push('\nErrors:');
      errors.forEach((issue, i) => {
        lines.push(`  ${i + 1}. [${issue.rule}] ${issue.message}`);
        if (issue.element) lines.push(`     Element: ${issue.element}`);
        if (issue.wcagLevel) lines.push(`     WCAG Level: ${issue.wcagLevel}`);
      });
    }

    if (warnings.length > 0) {
      lines.push('\nWarnings:');
      warnings.forEach((issue, i) => {
        lines.push(`  ${i + 1}. [${issue.rule}] ${issue.message}`);
        if (issue.element) lines.push(`     Element: ${issue.element}`);
        if (issue.wcagLevel) lines.push(`     WCAG Level: ${issue.wcagLevel}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Reset all issues
   */
  reset(): void {
    this.issues = [];
  }
}

/**
 * Create a simple accessibility checker instance
 */
export function createA11yChecker(): AccessibilityChecker {
  return new AccessibilityChecker();
}
