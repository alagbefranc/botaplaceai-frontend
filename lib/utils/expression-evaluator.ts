/**
 * Safe expression evaluator for agent variables
 * 
 * Supports dynamic expressions like:
 * - {{user.name}} - Simple variable access
 * - {{user.name || 'Guest'}} - Fallback values
 * - {{system.date}} - System variables
 * - {{customer_name}} - Custom static variables
 * 
 * Security: Uses a sandboxed evaluation approach, no eval() or Function()
 */

export interface ExpressionContext {
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
  system?: Record<string, unknown>;
  variables?: Record<string, string>;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  variables?: string[];
}

// Regex to match {{expression}} patterns
const EXPRESSION_PATTERN = /\{\{([^}]+)\}\}/g;

// Allowed operators and tokens
const ALLOWED_OPERATORS = ['||', '&&', '?', ':', '!', '==', '!=', '===', '!=='];
const VARIABLE_PATH_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
const STRING_LITERAL_PATTERN = /^(['"]).*\1$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const BOOLEAN_PATTERN = /^(true|false)$/;

/**
 * Safely get a nested property from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj || !path) return undefined;
  
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Resolve a variable path to its value from context
 */
function resolveVariable(path: string, context: ExpressionContext): unknown {
  const [namespace, ...rest] = path.split('.');
  const propertyPath = rest.join('.');
  
  switch (namespace) {
    case 'user':
      return propertyPath ? getNestedValue(context.user, propertyPath) : context.user;
    case 'session':
      return propertyPath ? getNestedValue(context.session, propertyPath) : context.session;
    case 'system':
      return propertyPath ? getNestedValue(context.system, propertyPath) : context.system;
    default:
      // Check if it's a custom variable
      if (context.variables && path in context.variables) {
        return context.variables[path];
      }
      // Try to resolve from all namespaces
      if (context.variables && namespace in context.variables) {
        return context.variables[namespace];
      }
      return undefined;
  }
}

/**
 * Parse a string literal, removing quotes
 */
function parseStringLiteral(literal: string): string {
  if (literal.startsWith("'") || literal.startsWith('"')) {
    return literal.slice(1, -1);
  }
  return literal;
}

/**
 * Evaluate a simple expression (no complex operators)
 * Supports: variable paths, string literals, numbers, booleans, || operator
 */
function evaluateSimpleExpression(expression: string, context: ExpressionContext): unknown {
  const trimmed = expression.trim();
  
  // Handle || (or) operator for fallbacks
  if (trimmed.includes('||')) {
    const parts = trimmed.split('||').map(p => p.trim());
    for (const part of parts) {
      const value = evaluateSimpleExpression(part, context);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return '';
  }
  
  // Handle && (and) operator
  if (trimmed.includes('&&')) {
    const parts = trimmed.split('&&').map(p => p.trim());
    const results: unknown[] = [];
    for (const part of parts) {
      const value = evaluateSimpleExpression(part, context);
      if (!value) return false;
      results.push(value);
    }
    return results[results.length - 1];
  }
  
  // Handle ternary operator: condition ? trueValue : falseValue
  const ternaryMatch = trimmed.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
  if (ternaryMatch) {
    const [, condition, trueValue, falseValue] = ternaryMatch;
    const conditionResult = evaluateSimpleExpression(condition, context);
    return conditionResult
      ? evaluateSimpleExpression(trueValue, context)
      : evaluateSimpleExpression(falseValue, context);
  }
  
  // String literal
  if (STRING_LITERAL_PATTERN.test(trimmed)) {
    return parseStringLiteral(trimmed);
  }
  
  // Number
  if (NUMBER_PATTERN.test(trimmed)) {
    return parseFloat(trimmed);
  }
  
  // Boolean
  if (BOOLEAN_PATTERN.test(trimmed)) {
    return trimmed === 'true';
  }
  
  // Null/undefined literals
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;
  
  // Variable path
  if (VARIABLE_PATH_PATTERN.test(trimmed)) {
    return resolveVariable(trimmed, context);
  }
  
  // Unknown expression type
  return undefined;
}

/**
 * Evaluate a template string with {{expression}} patterns
 */
export function evaluateExpression(
  template: string,
  context: ExpressionContext
): string {
  if (!template) return '';
  
  return template.replace(EXPRESSION_PATTERN, (_match, expression) => {
    const result = evaluateSimpleExpression(expression, context);
    
    if (result === undefined || result === null) {
      return '';
    }
    
    if (typeof result === 'object') {
      return JSON.stringify(result);
    }
    
    return String(result);
  });
}

/**
 * Validate an expression for syntax errors
 */
export function validateExpression(expression: string): ValidationResult {
  if (!expression) {
    return { valid: true, variables: [] };
  }
  
  const variables: string[] = [];
  const matches = expression.matchAll(EXPRESSION_PATTERN);
  
  for (const match of matches) {
    const innerExpression = match[1].trim();
    
    // Extract variable references
    const varMatches = innerExpression.match(/[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*/g);
    if (varMatches) {
      for (const varMatch of varMatches) {
        // Skip if it's a boolean literal
        if (varMatch === 'true' || varMatch === 'false' || varMatch === 'null' || varMatch === 'undefined') {
          continue;
        }
        variables.push(varMatch);
      }
    }
    
    // Check for balanced quotes
    const singleQuotes = (innerExpression.match(/'/g) || []).length;
    const doubleQuotes = (innerExpression.match(/"/g) || []).length;
    
    if (singleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unbalanced single quotes in expression' };
    }
    if (doubleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unbalanced double quotes in expression' };
    }
    
    // Check for balanced ternary
    const questionMarks = (innerExpression.match(/\?/g) || []).length;
    const colons = (innerExpression.match(/:/g) || []).length;
    
    if (questionMarks !== colons) {
      return { valid: false, error: 'Unbalanced ternary operator (? :)' };
    }
  }
  
  // Check for unclosed brackets
  const openBrackets = (expression.match(/\{\{/g) || []).length;
  const closeBrackets = (expression.match(/\}\}/g) || []).length;
  
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: 'Unbalanced expression brackets {{ }}' };
  }
  
  return { valid: true, variables: [...new Set(variables)] };
}

/**
 * Extract all variable references from a template
 */
export function extractVariables(template: string): string[] {
  const result = validateExpression(template);
  return result.variables || [];
}

/**
 * Build system context with current date/time and agent info
 */
export function buildSystemContext(agentName?: string, conversationId?: string, channel?: string): Record<string, unknown> {
  const now = new Date();
  
  return {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    datetime: now.toISOString(),
    timestamp: now.getTime(),
    agent_name: agentName || 'Agent',
    conversation_id: conversationId || '',
    channel: channel || 'web_chat',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
  };
}

/**
 * Create a full expression context from user data and agent settings
 */
export function createExpressionContext(
  userData?: Record<string, unknown>,
  sessionData?: Record<string, unknown>,
  customVariables?: Record<string, string>,
  agentName?: string,
  conversationId?: string,
  channel?: string
): ExpressionContext {
  return {
    user: userData || {},
    session: sessionData || {},
    system: buildSystemContext(agentName, conversationId, channel),
    variables: customVariables || {},
  };
}

/**
 * Process a system prompt template, replacing all variable expressions
 */
export function processPromptTemplate(
  template: string,
  context: ExpressionContext
): string {
  return evaluateExpression(template, context);
}
