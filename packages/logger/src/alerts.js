/**
 * Alert rules and notification system
 */

/**
 * @typedef {Object} AlertRule
 * @property {string} name
 * @property {string} condition - Condition expression
 * @property {number} duration - Duration in ms
 * @property {'warning' | 'critical'} severity
 * @property {string} message
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} rule
 * @property {'warning' | 'critical'} severity
 * @property {string} message
 * @property {number} triggeredAt
 * @property {boolean} active
 * @property {Record<string, any>} context
 */

class AlertManager {
  constructor() {
    this.rules = new Map();
    this.alerts = new Map();
    this.history = [];
    this.maxHistory = 1000;
    this.handlers = [];
  }

  /**
   * Register an alert rule
   */
  registerRule(rule) {
    this.rules.set(rule.name, {
      ...rule,
      state: {
        triggered: false,
        triggeredAt: null,
        lastChecked: null
      }
    });
  }

  /**
   * Register alert handler
   */
  onAlert(handler) {
    this.handlers.push(handler);
  }

  /**
   * Evaluate all rules with current metrics
   */
  evaluate(metrics) {
    const now = Date.now();

    for (const [name, rule] of this.rules) {
      const shouldTrigger = this._evaluateCondition(rule.condition, metrics);

      if (shouldTrigger) {
        if (!rule.state.triggered) {
          rule.state.triggered = true;
          rule.state.triggeredAt = now;
        } else if (now - rule.state.triggeredAt >= rule.duration) {
          // Fire alert if condition persists beyond duration
          this._fireAlert(rule, metrics);
        }
      } else {
        // Resolve if was triggered
        if (rule.state.triggered) {
          this._resolveAlert(name);
        }
        rule.state.triggered = false;
        rule.state.triggeredAt = null;
      }

      rule.state.lastChecked = now;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(a => a.active);
  }

  /**
   * Get alert history
   */
  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  _evaluateCondition(condition, metrics) {
    try {
      // Simple condition evaluation
      // Format: "metric_name operator value"
      // Example: "error_rate > 0.05"
      const match = condition.match(/^(\S+)\s*([><=]+)\s*(\S+)$/);
      if (!match) return false;

      const [, metricPath, operator, thresholdStr] = match;
      const threshold = parseFloat(thresholdStr);
      const value = this._getMetricValue(metrics, metricPath);

      if (value === null) return false;

      switch (operator) {
        case '>': return value > threshold;
        case '>=': return value >= threshold;
        case '<': return value < threshold;
        case '<=': return value <= threshold;
        case '==': return value === threshold;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  _getMetricValue(metrics, path) {
    const parts = path.split('.');
    let current = metrics;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'number' ? current : null;
  }

  _fireAlert(rule, context) {
    const alertId = `${rule.name}-${Date.now()}`;
    const alert = {
      id: alertId,
      rule: rule.name,
      severity: rule.severity,
      message: rule.message,
      triggeredAt: Date.now(),
      active: true,
      context
    };

    this.alerts.set(alertId, alert);
    this.history.push({ ...alert });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Notify handlers
    for (const handler of this.handlers) {
      try {
        handler(alert);
      } catch (error) {
        console.error('Alert handler failed:', error);
      }
    }
  }

  _resolveAlert(ruleName) {
    for (const [id, alert] of this.alerts) {
      if (alert.rule === ruleName && alert.active) {
        alert.active = false;
        alert.resolvedAt = Date.now();

        // Notify handlers of resolution
        for (const handler of this.handlers) {
          try {
            handler({ ...alert, resolved: true });
          } catch (error) {
            console.error('Alert handler failed:', error);
          }
        }
      }
    }
  }
}

// Global alert manager
const globalAlertManager = new AlertManager();

export const alertManager = {
  registerRule: (rule) => globalAlertManager.registerRule(rule),
  onAlert: (handler) => globalAlertManager.onAlert(handler),
  evaluate: (metrics) => globalAlertManager.evaluate(metrics),
  getActiveAlerts: () => globalAlertManager.getActiveAlerts(),
  getHistory: (limit) => globalAlertManager.getHistory(limit)
};

/**
 * Standard alert rules for DGOS
 */
export const standardAlertRules = [
  {
    name: 'high_error_rate',
    condition: 'error_rate > 0.05',
    duration: 5 * 60 * 1000, // 5 minutes
    severity: 'critical',
    message: 'Error rate exceeds 5% for 5 minutes'
  },
  {
    name: 'slow_response_time',
    condition: 'response_time_p95 > 1000',
    duration: 10 * 60 * 1000, // 10 minutes
    severity: 'warning',
    message: 'P95 response time exceeds 1000ms for 10 minutes'
  },
  {
    name: 'database_connection_pool_high',
    condition: 'db_pool_usage > 0.9',
    duration: 2 * 60 * 1000, // 2 minutes
    severity: 'warning',
    message: 'Database connection pool usage exceeds 90% for 2 minutes'
  },
  {
    name: 'high_memory_usage',
    condition: 'memory_usage_mb > 1024',
    duration: 5 * 60 * 1000, // 5 minutes
    severity: 'warning',
    message: 'Memory usage exceeds 1GB for 5 minutes'
  }
];

/**
 * Log-based alert handler
 */
export function createLogAlertHandler(logger) {
  return function(alert) {
    if (alert.resolved) {
      logger.info('Alert resolved', {
        alertId: alert.id,
        rule: alert.rule,
        duration: alert.resolvedAt - alert.triggeredAt
      });
    } else {
      const logMethod = alert.severity === 'critical' ? 'error' : 'warn';
      logger[logMethod]('Alert triggered', {
        alertId: alert.id,
        rule: alert.rule,
        severity: alert.severity,
        message: alert.message
      });
    }
  };
}

/**
 * Webhook alert handler
 */
export function createWebhookAlertHandler(webhookUrl) {
  return async function(alert) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send alert webhook:', error);
    }
  };
}
