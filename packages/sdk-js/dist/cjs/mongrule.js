"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.evalCondition = evalCondition;
var _util = require("./util");
/* eslint-disable @typescript-eslint/no-explicit-any */

const _regexCache = {};

// The top-level condition evaluation function
function evalCondition(obj, condition) {
  // Recursive condition
  if ("$or" in condition) {
    return evalOr(obj, condition["$or"]);
  }
  if ("$nor" in condition) {
    return !evalOr(obj, condition["$nor"]);
  }
  if ("$and" in condition) {
    return evalAnd(obj, condition["$and"]);
  }
  if ("$not" in condition) {
    return !evalCondition(obj, condition["$not"]);
  }

  // Condition is an object, keys are object paths, values are the condition for that path
  for (const [k, v] of Object.entries(condition)) {
    if (!evalConditionValue(v, getPath(obj, k))) return false;
  }
  return true;
}

// Return value at dot-separated path of an object
function getPath(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current && typeof current === "object" && parts[i] in current) {
      current = current[parts[i]];
    } else {
      return null;
    }
  }
  return current;
}

// Transform a regex string into a real RegExp object
function getRegex(regex) {
  if (!_regexCache[regex]) {
    _regexCache[regex] = new RegExp(regex.replace(/([^\\])\//g, "$1\\/"));
  }
  return _regexCache[regex];
}

// Evaluate a single value against a condition
function evalConditionValue(condition, value) {
  // Simple equality comparisons
  if (typeof condition === "string") {
    return value + "" === condition;
  }
  if (typeof condition === "number") {
    return value * 1 === condition;
  }
  if (typeof condition === "boolean") {
    return !!value === condition;
  }
  if (condition === null) {
    return value === null;
  }
  if (Array.isArray(condition) || !isOperatorObject(condition)) {
    return JSON.stringify(value) === JSON.stringify(condition);
  }

  // This is a special operator condition and we should evaluate each one separately
  for (const op in condition) {
    if (!evalOperatorCondition(op, value, condition[op])) {
      return false;
    }
  }
  return true;
}

// If the object has only keys that start with '$'
function isOperatorObject(obj) {
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.filter(k => k[0] === "$").length === keys.length;
}

// Return the data type of a value
function getType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (["string", "number", "boolean", "object", "undefined"].includes(t)) {
    return t;
  }
  return "unknown";
}

// At least one element of actual must match the expected condition/value
function elemMatch(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const check = isOperatorObject(expected) ? v => evalConditionValue(expected, v) : v => evalCondition(v, expected);
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] && check(actual[i])) {
      return true;
    }
  }
  return false;
}
function isIn(actual, expected) {
  // Do an intersection is attribute is an array
  if (Array.isArray(actual)) {
    return actual.some(el => expected.includes(el));
  }
  return expected.includes(actual);
}

// Evaluate a single operator condition
function evalOperatorCondition(operator, actual, expected) {
  switch (operator) {
    case "$veq":
      return (0, _util.paddedVersionString)(actual) === (0, _util.paddedVersionString)(expected);
    case "$vne":
      return (0, _util.paddedVersionString)(actual) !== (0, _util.paddedVersionString)(expected);
    case "$vgt":
      return (0, _util.paddedVersionString)(actual) > (0, _util.paddedVersionString)(expected);
    case "$vgte":
      return (0, _util.paddedVersionString)(actual) >= (0, _util.paddedVersionString)(expected);
    case "$vlt":
      return (0, _util.paddedVersionString)(actual) < (0, _util.paddedVersionString)(expected);
    case "$vlte":
      return (0, _util.paddedVersionString)(actual) <= (0, _util.paddedVersionString)(expected);
    case "$eq":
      return actual === expected;
    case "$ne":
      return actual !== expected;
    case "$lt":
      return actual < expected;
    case "$lte":
      return actual <= expected;
    case "$gt":
      return actual > expected;
    case "$gte":
      return actual >= expected;
    case "$exists":
      return expected ? actual !== null : actual === null;
    case "$in":
      if (!Array.isArray(expected)) return false;
      return isIn(actual, expected);
    case "$nin":
      if (!Array.isArray(expected)) return false;
      return !isIn(actual, expected);
    case "$not":
      return !evalConditionValue(expected, actual);
    case "$size":
      if (!Array.isArray(actual)) return false;
      return evalConditionValue(expected, actual.length);
    case "$elemMatch":
      return elemMatch(actual, expected);
    case "$all":
      if (!Array.isArray(actual)) return false;
      for (let i = 0; i < expected.length; i++) {
        let passed = false;
        for (let j = 0; j < actual.length; j++) {
          if (evalConditionValue(expected[i], actual[j])) {
            passed = true;
            break;
          }
        }
        if (!passed) return false;
      }
      return true;
    case "$regex":
      try {
        return getRegex(expected).test(actual);
      } catch (e) {
        return false;
      }
    case "$type":
      return getType(actual) === expected;
    default:
      console.error("Unknown operator: " + operator);
      return false;
  }
}

// Recursive $or rule
function evalOr(obj, conditions) {
  if (!conditions.length) return true;
  for (let i = 0; i < conditions.length; i++) {
    if (evalCondition(obj, conditions[i])) {
      return true;
    }
  }
  return false;
}

// Recursive $and rule
function evalAnd(obj, conditions) {
  for (let i = 0; i < conditions.length; i++) {
    if (!evalCondition(obj, conditions[i])) {
      return false;
    }
  }
  return true;
}
//# sourceMappingURL=mongrule.js.map