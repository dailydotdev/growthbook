function hashFnv32a(str) {
  let hval = 0x811c9dc5;
  const l = str.length;
  for (let i = 0; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}
function hash(seed, value, version) {
  // New unbiased hashing algorithm
  if (version === 2) {
    return hashFnv32a(hashFnv32a(seed + value) + "") % 10000 / 10000;
  }
  // Original biased hashing algorithm (keep for backwards compatibility)
  if (version === 1) {
    return hashFnv32a(value + seed) % 1000 / 1000;
  }

  // Unknown hash version
  return null;
}
function getEqualWeights(n) {
  if (n <= 0) return [];
  return new Array(n).fill(1 / n);
}
function inRange(n, range) {
  return n >= range[0] && n < range[1];
}
function inNamespace(hashValue, namespace) {
  const n = hash("__" + namespace[0], hashValue, 1);
  if (n === null) return false;
  return n >= namespace[1] && n < namespace[2];
}
function chooseVariation(n, ranges) {
  for (let i = 0; i < ranges.length; i++) {
    if (inRange(n, ranges[i])) {
      return i;
    }
  }
  return -1;
}
function getUrlRegExp(regexString) {
  try {
    const escaped = regexString.replace(/([^\\])\//g, "$1\\/");
    return new RegExp(escaped);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}
function isURLTargeted(url, targets) {
  if (!targets.length) return false;
  let hasIncludeRules = false;
  let isIncluded = false;
  for (let i = 0; i < targets.length; i++) {
    const match = _evalURLTarget(url, targets[i].type, targets[i].pattern);
    if (targets[i].include === false) {
      if (match) return false;
    } else {
      hasIncludeRules = true;
      if (match) isIncluded = true;
    }
  }
  return isIncluded || !hasIncludeRules;
}
function _evalSimpleUrlPart(actual, pattern, isPath) {
  try {
    // Escape special regex characters and change wildcard `_____` to `.*`
    let escaped = pattern.replace(/[*.+?^${}()|[\]\\]/g, "\\$&").replace(/_____/g, ".*");
    if (isPath) {
      // When matching pathname, make leading/trailing slashes optional
      escaped = "\\/?" + escaped.replace(/(^\/|\/$)/g, "") + "\\/?";
    }
    const regex = new RegExp("^" + escaped + "$", "i");
    return regex.test(actual);
  } catch (e) {
    return false;
  }
}
function _evalSimpleUrlTarget(actual, pattern) {
  try {
    // If a protocol is missing, but a host is specified, add `https://` to the front
    // Use "_____" as the wildcard since `*` is not a valid hostname in some browsers
    const expected = new URL(pattern.replace(/^([^:/?]*)\./i, "https://$1.").replace(/\*/g, "_____"), "https://_____");

    // Compare each part of the URL separately
    const comps = [[actual.host, expected.host, false], [actual.pathname, expected.pathname, true]];
    // We only want to compare hashes if it's explicitly being targeted
    if (expected.hash) {
      comps.push([actual.hash, expected.hash, false]);
    }
    expected.searchParams.forEach((v, k) => {
      comps.push([actual.searchParams.get(k) || "", v, false]);
    });

    // If any comparisons fail, the whole thing fails
    return !comps.some(data => !_evalSimpleUrlPart(data[0], data[1], data[2]));
  } catch (e) {
    return false;
  }
}
function _evalURLTarget(url, type, pattern) {
  try {
    const parsed = new URL(url, "https://_");
    if (type === "regex") {
      const regex = getUrlRegExp(pattern);
      if (!regex) return false;
      return regex.test(parsed.href) || regex.test(parsed.href.substring(parsed.origin.length));
    } else if (type === "simple") {
      return _evalSimpleUrlTarget(parsed, pattern);
    }
    return false;
  } catch (e) {
    return false;
  }
}
function getBucketRanges(numVariations, coverage, weights) {
  coverage = coverage === undefined ? 1 : coverage;

  // Make sure coverage is within bounds
  if (coverage < 0) {
    coverage = 0;
  } else if (coverage > 1) {
    coverage = 1;
  }

  // Default to equal weights if missing or invalid
  const equal = getEqualWeights(numVariations);
  weights = weights || equal;
  if (weights.length !== numVariations) {
    weights = equal;
  }

  // If weights don't add up to 1 (or close to it), default to equal weights
  const totalWeight = weights.reduce((w, sum) => sum + w, 0);
  if (totalWeight < 0.99 || totalWeight > 1.01) {
    weights = equal;
  }

  // Covert weights to ranges
  let cumulative = 0;
  return weights.map(w => {
    const start = cumulative;
    cumulative += w;
    return [start, start + coverage * w];
  });
}
function getQueryStringOverride(id, url, numVariations) {
  if (!url) {
    return null;
  }
  const search = url.split("?")[1];
  if (!search) {
    return null;
  }
  const match = search.replace(/#.*/, "") // Get rid of anchor
  .split("&") // Split into key/value pairs
  .map(kv => kv.split("=", 2)).filter(_ref => {
    let [k] = _ref;
    return k === id;
  }) // Look for key that matches the experiment id
  .map(_ref2 => {
    let [, v] = _ref2;
    return parseInt(v);
  }); // Parse the value into an integer

  if (match.length > 0 && match[0] >= 0 && match[0] < numVariations) return match[0];
  return null;
}
function isIncluded(include) {
  try {
    return include();
  } catch (e) {
    console.error(e);
    return false;
  }
}
function paddedVersionString(input) {
  // Remove build info and leading `v` if any
  // Split version into parts (both core version numbers and pre-release tags)
  // "v1.2.3-rc.1+build123" -> ["1","2","3","rc","1"]
  const parts = input.replace(/(^v|\+.*$)/g, "").split(/[-.]/);

  // If it's SemVer without a pre-release, add `~` to the end
  // ["1","0","0"] -> ["1","0","0","~"]
  // "~" is the largest ASCII character, so this will make "1.0.0" greater than "1.0.0-beta" for example
  if (parts.length === 3) {
    parts.push("~");
  }

  // Left pad each numeric part with spaces so string comparisons will work ("9">"10", but " 9"<"10")
  // Then, join back together into a single string
  return parts.map(v => v.match(/^[0-9]+$/) ? v.padStart(5, " ") : v).join("-");
}

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
      return paddedVersionString(actual) === paddedVersionString(expected);
    case "$vne":
      return paddedVersionString(actual) !== paddedVersionString(expected);
    case "$vgt":
      return paddedVersionString(actual) > paddedVersionString(expected);
    case "$vgte":
      return paddedVersionString(actual) >= paddedVersionString(expected);
    case "$vlt":
      return paddedVersionString(actual) < paddedVersionString(expected);
    case "$vlte":
      return paddedVersionString(actual) <= paddedVersionString(expected);
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

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
class GrowthBook {
  // context is technically private, but some tools depend on it so we can't mangle the name
  // _ctx below is a clone of this property that we use internally

  // Properties and methods that start with "_" are mangled by Terser (saves ~150 bytes)

  // eslint-disable-next-line

  constructor(context) {
    context = context || {};
    // These properties are all initialized in the constructor instead of above
    // This saves ~80 bytes in the final output
    this._ctx = this.context = context;
    this._renderer = null;
    this._trackedExperiments = new Set();
    this._trackedFeatures = {};
    this.debug = false;
    this._subscriptions = new Set();
    this.ready = false;
    this._assigned = new Map();
    this._forcedFeatureValues = new Map();
    this._attributeOverrides = {};
    this._activeAutoExperiments = new Map();
    if (context.features) {
      this.ready = true;
    }
    if (isBrowser && context.enableDevMode) {
      window._growthbook = this;
      document.dispatchEvent(new Event("gbloaded"));
    }
    if (context.experiments) {
      this.ready = true;
    }
  }
  _render() {
    if (this._renderer) {
      this._renderer();
    }
  }
  setFeatures(features) {
    this._ctx.features = features;
    this.ready = true;
    this._render();
  }
  setAttributes(attributes) {
    this._ctx.attributes = attributes;
    this._render();
  }
  setAttributeOverrides(overrides) {
    this._attributeOverrides = overrides;
    this._render();
  }
  setForcedVariations(vars) {
    this._ctx.forcedVariations = vars || {};
    this._render();
  }
  // eslint-disable-next-line
  setForcedFeatures(map) {
    this._forcedFeatureValues = map;
    this._render();
  }
  setURL(url) {
    this._ctx.url = url;
  }
  getAttributes() {
    return {
      ...this._ctx.attributes,
      ...this._attributeOverrides
    };
  }
  getFeatures() {
    return this._ctx.features || {};
  }
  getExperiments() {
    return this._ctx.experiments || [];
  }
  subscribe(cb) {
    this._subscriptions.add(cb);
    return () => {
      this._subscriptions.delete(cb);
    };
  }
  getAllResults() {
    return new Map(this._assigned);
  }
  destroy() {
    // Release references to save memory
    this._subscriptions.clear();
    this._assigned.clear();
    this._trackedExperiments.clear();
    this._trackedFeatures = {};
    if (isBrowser && window._growthbook === this) {
      delete window._growthbook;
    }

    // Undo any active auto experiments
    this._activeAutoExperiments.forEach(exp => {
      exp.undo();
    });
    this._activeAutoExperiments.clear();
  }
  setRenderer(renderer) {
    this._renderer = renderer;
  }
  forceVariation(key, variation) {
    this._ctx.forcedVariations = this._ctx.forcedVariations || {};
    this._ctx.forcedVariations[key] = variation;
    this._render();
  }
  run(experiment) {
    const result = this._run(experiment, null);
    this._fireSubscriptions(experiment, result);
    return result;
  }
  _fireSubscriptions(experiment, result) {
    const key = experiment.key;

    // If assigned variation has changed, fire subscriptions
    const prev = this._assigned.get(key);
    // TODO: what if the experiment definition has changed?
    if (!prev || prev.result.inExperiment !== result.inExperiment || prev.result.variationId !== result.variationId) {
      this._assigned.set(key, {
        experiment,
        result
      });
      this._subscriptions.forEach(cb => {
        try {
          cb(experiment, result);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }
  _trackFeatureUsage(key, res) {
    // Don't track feature usage that was forced via an override
    if (res.source === "override") return;

    // Only track a feature once, unless the assigned value changed
    const stringifiedValue = JSON.stringify(res.value);
    if (this._trackedFeatures[key] === stringifiedValue) return;
    this._trackedFeatures[key] = stringifiedValue;

    // Fire user-supplied callback
    if (this._ctx.onFeatureUsage) {
      try {
        this._ctx.onFeatureUsage(key, res);
      } catch (e) {
        // Ignore feature usage callback errors
      }
    }

    // In browser environments, queue up feature usage to be tracked in batches
    if (!isBrowser || !window.fetch) return;
  }
  _getFeatureResult(key, value, source, ruleId, experiment, result) {
    const ret = {
      value,
      on: !!value,
      off: !value,
      source,
      ruleId: ruleId || ""
    };
    if (experiment) ret.experiment = experiment;
    if (result) ret.experimentResult = result;

    // Track the usage of this feature in real-time
    this._trackFeatureUsage(key, ret);
    return ret;
  }
  isOn(key) {
    return this.evalFeature(key).on;
  }
  isOff(key) {
    return this.evalFeature(key).off;
  }
  getFeatureValue(key, defaultValue) {
    const value = this.evalFeature(key).value;
    return value === null ? defaultValue : value;
  }

  /**
   * @deprecated Use {@link evalFeature}
   * @param id
   */
  // eslint-disable-next-line
  feature(id) {
    return this.evalFeature(id);
  }
  evalFeature(id) {
    // Global override
    if (this._forcedFeatureValues.has(id)) {
      return this._getFeatureResult(id, this._forcedFeatureValues.get(id), "override");
    }

    // Unknown feature id
    if (!this._ctx.features || !this._ctx.features[id]) {
      return this._getFeatureResult(id, null, "unknownFeature");
    }

    // Get the feature
    const feature = this._ctx.features[id];

    // Loop through the rules
    if (feature.rules) {
      for (const rule of feature.rules) {
        // If it's a conditional rule, skip if the condition doesn't pass
        if (rule.condition && !this._conditionPasses(rule.condition)) {
          continue;
        }
        // If there are filters for who is included (e.g. namespaces)
        if (rule.filters && this._isFilteredOut(rule.filters)) {
          continue;
        }

        // Feature value is being forced
        if ("force" in rule) {
          // If this is a percentage rollout, skip if not included
          if (!this._isIncludedInRollout(rule.seed || id, rule.hashAttribute, rule.range, rule.coverage, rule.hashVersion)) {
            continue;
          }

          // If this was a remotely evaluated experiment, fire the tracking callbacks
          if (rule.tracks) {
            rule.tracks.forEach(t => {
              this._track(t.experiment, t.result);
            });
          }
          return this._getFeatureResult(id, rule.force, "force", rule.id);
        }
        if (!rule.variations) {
          continue;
        }
        // For experiment rules, run an experiment
        const exp = {
          variations: rule.variations,
          key: rule.key || id
        };
        if ("coverage" in rule) exp.coverage = rule.coverage;
        if (rule.weights) exp.weights = rule.weights;
        if (rule.hashAttribute) exp.hashAttribute = rule.hashAttribute;
        if (rule.namespace) exp.namespace = rule.namespace;
        if (rule.meta) exp.meta = rule.meta;
        if (rule.ranges) exp.ranges = rule.ranges;
        if (rule.name) exp.name = rule.name;
        if (rule.phase) exp.phase = rule.phase;
        if (rule.seed) exp.seed = rule.seed;
        if (rule.hashVersion) exp.hashVersion = rule.hashVersion;
        if (rule.filters) exp.filters = rule.filters;

        // Only return a value if the user is part of the experiment
        const res = this._run(exp, id);
        this._fireSubscriptions(exp, res);
        if (res.inExperiment && !res.passthrough) {
          return this._getFeatureResult(id, res.value, "experiment", rule.id, exp, res);
        }
      }
    }

    // Fall back to using the default value
    return this._getFeatureResult(id, feature.defaultValue === undefined ? null : feature.defaultValue, "defaultValue");
  }
  _isIncludedInRollout(seed, hashAttribute, range, coverage, hashVersion) {
    if (!range && coverage === undefined) return true;
    const {
      hashValue
    } = this._getHashAttribute(hashAttribute);
    if (!hashValue) {
      return false;
    }
    const n = hash(seed, hashValue, hashVersion || 1);
    if (n === null) return false;
    return range ? inRange(n, range) : coverage !== undefined ? n <= coverage : true;
  }
  _conditionPasses(condition) {
    return evalCondition(this.getAttributes(), condition);
  }
  _isFilteredOut(filters) {
    return filters.some(filter => {
      const {
        hashValue
      } = this._getHashAttribute(filter.attribute);
      if (!hashValue) return true;
      const n = hash(filter.seed, hashValue, filter.hashVersion || 2);
      if (n === null) return true;
      return !filter.ranges.some(r => inRange(n, r));
    });
  }
  _run(experiment, featureId) {
    const key = experiment.key;
    const numVariations = experiment.variations.length;

    // 1. If experiment has less than 2 variations, return immediately
    if (numVariations < 2) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 2. If the context is disabled, return immediately
    if (this._ctx.enabled === false) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 2.5. Merge in experiment overrides from the context
    experiment = this._mergeOverrides(experiment);

    // 3. If a variation is forced from a querystring, return the forced variation
    const qsOverride = getQueryStringOverride(key, this._getContextUrl(), numVariations);
    if (qsOverride !== null) {
      return this._getResult(experiment, qsOverride, false, featureId);
    }

    // 4. If a variation is forced in the context, return the forced variation
    if (this._ctx.forcedVariations && key in this._ctx.forcedVariations) {
      const variation = this._ctx.forcedVariations[key];
      return this._getResult(experiment, variation, false, featureId);
    }

    // 5. Exclude if a draft experiment or not active
    if (experiment.status === "draft" || experiment.active === false) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 6. Get the hash attribute and return if empty
    const {
      hashValue
    } = this._getHashAttribute(experiment.hashAttribute);
    if (!hashValue) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 7. Exclude if user is filtered out (used to be called "namespace")
    if (experiment.filters) {
      if (this._isFilteredOut(experiment.filters)) {
        return this._getResult(experiment, -1, false, featureId);
      }
    } else if (experiment.namespace && !inNamespace(hashValue, experiment.namespace)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 7.5. Exclude if experiment.include returns false or throws
    if (experiment.include && !isIncluded(experiment.include)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8. Exclude if condition is false
    if (experiment.condition && !this._conditionPasses(experiment.condition)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.1. Exclude if user is not in a required group
    if (experiment.groups && !this._hasGroupOverlap(experiment.groups)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.2. Old style URL targeting
    if (experiment.url && !this._urlIsValid(experiment.url)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.3. New, more powerful URL targeting
    if (experiment.urlPatterns && !isURLTargeted(this._getContextUrl(), experiment.urlPatterns)) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 9. Get bucket ranges and choose variation
    const n = hash(experiment.seed || key, hashValue, experiment.hashVersion || 1);
    if (n === null) {
      return this._getResult(experiment, -1, false, featureId);
    }
    const ranges = experiment.ranges || getBucketRanges(numVariations, experiment.coverage === undefined ? 1 : experiment.coverage, experiment.weights);
    const assigned = chooseVariation(n, ranges);

    // 10. Return if not in experiment
    if (assigned < 0) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 11. Experiment has a forced variation
    if ("force" in experiment) {
      return this._getResult(experiment, experiment.force === undefined ? -1 : experiment.force, false, featureId);
    }

    // 12. Exclude if in QA mode
    if (this._ctx.qaMode) {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 12.5. Exclude if experiment is stopped
    if (experiment.status === "stopped") {
      return this._getResult(experiment, -1, false, featureId);
    }

    // 13. Build the result object
    const result = this._getResult(experiment, assigned, true, featureId, n);

    // 14. Fire the tracking callback
    this._track(experiment, result);
    return result;
  }
  log(msg, ctx) {
    if (!this.debug) return;
    if (this._ctx.log) this._ctx.log(msg, ctx);else console.log(msg, ctx);
  }
  _track(experiment, result) {
    if (!this._ctx.trackingCallback) return;
    const key = experiment.key;

    // Make sure a tracking callback is only fired once per unique experiment
    const k = result.hashAttribute + result.hashValue + key + result.variationId;
    if (this._trackedExperiments.has(k)) return;
    this._trackedExperiments.add(k);
    try {
      this._ctx.trackingCallback(experiment, result);
    } catch (e) {
      console.error(e);
    }
  }
  _mergeOverrides(experiment) {
    const key = experiment.key;
    const o = this._ctx.overrides;
    if (o && o[key]) {
      experiment = Object.assign({}, experiment, o[key]);
      if (typeof experiment.url === "string") {
        experiment.url = getUrlRegExp(
        // eslint-disable-next-line
        experiment.url);
      }
    }
    return experiment;
  }
  _getHashAttribute(attr) {
    const hashAttribute = attr || "id";
    let hashValue = "";
    if (this._attributeOverrides[hashAttribute]) {
      hashValue = this._attributeOverrides[hashAttribute];
    } else if (this._ctx.attributes) {
      hashValue = this._ctx.attributes[hashAttribute] || "";
    } else if (this._ctx.user) {
      hashValue = this._ctx.user[hashAttribute] || "";
    }
    return {
      hashAttribute,
      hashValue
    };
  }
  _getResult(experiment, variationIndex, hashUsed, featureId, bucket) {
    let inExperiment = true;
    // If assigned variation is not valid, use the baseline and mark the user as not in the experiment
    if (variationIndex < 0 || variationIndex >= experiment.variations.length) {
      variationIndex = 0;
      inExperiment = false;
    }
    const {
      hashAttribute,
      hashValue
    } = this._getHashAttribute(experiment.hashAttribute);
    const meta = experiment.meta ? experiment.meta[variationIndex] : {};
    const res = {
      key: meta.key || "" + variationIndex,
      featureId,
      inExperiment,
      hashUsed,
      variationId: variationIndex,
      value: experiment.variations[variationIndex],
      hashAttribute,
      hashValue
    };
    if (meta.name) res.name = meta.name;
    if (bucket !== undefined) res.bucket = bucket;
    if (meta.passthrough) res.passthrough = meta.passthrough;
    return res;
  }
  _getContextUrl() {
    return this._ctx.url || (isBrowser ? window.location.href : "");
  }
  _urlIsValid(urlRegex) {
    const url = this._getContextUrl();
    if (!url) return false;
    const pathOnly = url.replace(/^https?:\/\//, "").replace(/^[^/]*\//, "/");
    if (urlRegex.test(url)) return true;
    if (urlRegex.test(pathOnly)) return true;
    return false;
  }
  _hasGroupOverlap(expGroups) {
    const groups = this._ctx.groups || {};
    for (let i = 0; i < expGroups.length; i++) {
      if (groups[expGroups[i]]) return true;
    }
    return false;
  }
}

export { GrowthBook, isURLTargeted };
//# sourceMappingURL=esm.js.map
