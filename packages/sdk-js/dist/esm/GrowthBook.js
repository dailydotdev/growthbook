import { getUrlRegExp, isIncluded, getBucketRanges, hash, chooseVariation, getQueryStringOverride, inNamespace, inRange, isURLTargeted } from "./util";
import { evalCondition } from "./mongrule";
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
export class GrowthBook {
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
  getApiInfo() {
    return [(this._ctx.apiHost || "https://cdn.growthbook.io").replace(/\/*$/, ""), this._ctx.clientKey || ""];
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
      process.env.NODE_ENV !== "production" && this.log("Global override", {
        id,
        value: this._forcedFeatureValues.get(id)
      });
      return this._getFeatureResult(id, this._forcedFeatureValues.get(id), "override");
    }

    // Unknown feature id
    if (!this._ctx.features || !this._ctx.features[id]) {
      process.env.NODE_ENV !== "production" && this.log("Unknown feature", {
        id
      });
      return this._getFeatureResult(id, null, "unknownFeature");
    }

    // Get the feature
    const feature = this._ctx.features[id];

    // Loop through the rules
    if (feature.rules) {
      for (const rule of feature.rules) {
        // If it's a conditional rule, skip if the condition doesn't pass
        if (rule.condition && !this._conditionPasses(rule.condition)) {
          process.env.NODE_ENV !== "production" && this.log("Skip rule because of condition", {
            id,
            rule
          });
          continue;
        }
        // If there are filters for who is included (e.g. namespaces)
        if (rule.filters && this._isFilteredOut(rule.filters)) {
          process.env.NODE_ENV !== "production" && this.log("Skip rule because of filters", {
            id,
            rule
          });
          continue;
        }

        // Feature value is being forced
        if ("force" in rule) {
          // If this is a percentage rollout, skip if not included
          if (!this._isIncludedInRollout(rule.seed || id, rule.hashAttribute, rule.range, rule.coverage, rule.hashVersion)) {
            process.env.NODE_ENV !== "production" && this.log("Skip rule because user not included in rollout", {
              id,
              rule
            });
            continue;
          }
          process.env.NODE_ENV !== "production" && this.log("Force value from rule", {
            id,
            rule
          });

          // If this was a remotely evaluated experiment, fire the tracking callbacks
          if (rule.tracks) {
            rule.tracks.forEach(t => {
              this._track(t.experiment, t.result);
            });
          }
          return this._getFeatureResult(id, rule.force, "force", rule.id);
        }
        if (!rule.variations) {
          process.env.NODE_ENV !== "production" && this.log("Skip invalid rule", {
            id,
            rule
          });
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
    process.env.NODE_ENV !== "production" && this.log("Use default value", {
      id,
      value: feature.defaultValue
    });

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
      process.env.NODE_ENV !== "production" && this.log("Invalid experiment", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 2. If the context is disabled, return immediately
    if (this._ctx.enabled === false) {
      process.env.NODE_ENV !== "production" && this.log("Context disabled", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 2.5. Merge in experiment overrides from the context
    experiment = this._mergeOverrides(experiment);

    // 3. If a variation is forced from a querystring, return the forced variation
    const qsOverride = getQueryStringOverride(key, this._getContextUrl(), numVariations);
    if (qsOverride !== null) {
      process.env.NODE_ENV !== "production" && this.log("Force via querystring", {
        id: key,
        variation: qsOverride
      });
      return this._getResult(experiment, qsOverride, false, featureId);
    }

    // 4. If a variation is forced in the context, return the forced variation
    if (this._ctx.forcedVariations && key in this._ctx.forcedVariations) {
      const variation = this._ctx.forcedVariations[key];
      process.env.NODE_ENV !== "production" && this.log("Force via dev tools", {
        id: key,
        variation
      });
      return this._getResult(experiment, variation, false, featureId);
    }

    // 5. Exclude if a draft experiment or not active
    if (experiment.status === "draft" || experiment.active === false) {
      process.env.NODE_ENV !== "production" && this.log("Skip because inactive", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 6. Get the hash attribute and return if empty
    const {
      hashValue
    } = this._getHashAttribute(experiment.hashAttribute);
    if (!hashValue) {
      process.env.NODE_ENV !== "production" && this.log("Skip because missing hashAttribute", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 7. Exclude if user is filtered out (used to be called "namespace")
    if (experiment.filters) {
      if (this._isFilteredOut(experiment.filters)) {
        process.env.NODE_ENV !== "production" && this.log("Skip because of filters", {
          id: key
        });
        return this._getResult(experiment, -1, false, featureId);
      }
    } else if (experiment.namespace && !inNamespace(hashValue, experiment.namespace)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of namespace", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 7.5. Exclude if experiment.include returns false or throws
    if (experiment.include && !isIncluded(experiment.include)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of include function", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8. Exclude if condition is false
    if (experiment.condition && !this._conditionPasses(experiment.condition)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of condition", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.1. Exclude if user is not in a required group
    if (experiment.groups && !this._hasGroupOverlap(experiment.groups)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of groups", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.2. Old style URL targeting
    if (experiment.url && !this._urlIsValid(experiment.url)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of url", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 8.3. New, more powerful URL targeting
    if (experiment.urlPatterns && !isURLTargeted(this._getContextUrl(), experiment.urlPatterns)) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of url targeting", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 9. Get bucket ranges and choose variation
    const n = hash(experiment.seed || key, hashValue, experiment.hashVersion || 1);
    if (n === null) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of invalid hash version", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }
    const ranges = experiment.ranges || getBucketRanges(numVariations, experiment.coverage === undefined ? 1 : experiment.coverage, experiment.weights);
    const assigned = chooseVariation(n, ranges);

    // 10. Return if not in experiment
    if (assigned < 0) {
      process.env.NODE_ENV !== "production" && this.log("Skip because of coverage", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 11. Experiment has a forced variation
    if ("force" in experiment) {
      process.env.NODE_ENV !== "production" && this.log("Force variation", {
        id: key,
        variation: experiment.force
      });
      return this._getResult(experiment, experiment.force === undefined ? -1 : experiment.force, false, featureId);
    }

    // 12. Exclude if in QA mode
    if (this._ctx.qaMode) {
      process.env.NODE_ENV !== "production" && this.log("Skip because QA mode", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 12.5. Exclude if experiment is stopped
    if (experiment.status === "stopped") {
      process.env.NODE_ENV !== "production" && this.log("Skip because stopped", {
        id: key
      });
      return this._getResult(experiment, -1, false, featureId);
    }

    // 13. Build the result object
    const result = this._getResult(experiment, assigned, true, featureId, n);

    // 14. Fire the tracking callback
    this._track(experiment, result);

    // 15. Return the result
    process.env.NODE_ENV !== "production" && this.log("In experiment", {
      id: key,
      variation: result.variationId
    });
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
//# sourceMappingURL=GrowthBook.js.map