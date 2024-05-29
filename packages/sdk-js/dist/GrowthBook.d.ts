import type { Context, Experiment, FeatureResult, Result, SubscriptionFunction, FeatureDefinition, Attributes, WidenPrimitives, ApiHost, ClientKey } from "./types/growthbook";
export declare class GrowthBook<AppFeatures extends Record<string, any> = Record<string, any>> {
    private context;
    debug: boolean;
    ready: boolean;
    private _ctx;
    private _renderer;
    private _trackedExperiments;
    private _trackedFeatures;
    private _subscriptions;
    private _assigned;
    private _forcedFeatureValues;
    private _attributeOverrides;
    private _activeAutoExperiments;
    constructor(context?: Context);
    getApiInfo(): [ApiHost, ClientKey];
    private _render;
    setFeatures(features: Record<string, FeatureDefinition>): void;
    setAttributes(attributes: Attributes): void;
    setAttributeOverrides(overrides: Attributes): void;
    setForcedVariations(vars: Record<string, number>): void;
    setForcedFeatures(map: Map<string, any>): void;
    setURL(url: string): void;
    getAttributes(): {
        [x: string]: any;
    };
    getFeatures(): Record<string, FeatureDefinition<any>>;
    getExperiments(): import("./types/growthbook").AutoExperiment[];
    subscribe(cb: SubscriptionFunction): () => void;
    getAllResults(): Map<string, {
        experiment: Experiment<any>;
        result: Result<any>;
    }>;
    destroy(): void;
    setRenderer(renderer: () => void): void;
    forceVariation(key: string, variation: number): void;
    run<T>(experiment: Experiment<T>): Result<T>;
    private _fireSubscriptions;
    private _trackFeatureUsage;
    private _getFeatureResult;
    isOn<K extends string & keyof AppFeatures = string>(key: K): boolean;
    isOff<K extends string & keyof AppFeatures = string>(key: K): boolean;
    getFeatureValue<V extends AppFeatures[K], K extends string & keyof AppFeatures = string>(key: K, defaultValue: V): WidenPrimitives<V>;
    /**
     * @deprecated Use {@link evalFeature}
     * @param id
     */
    feature<V extends AppFeatures[K], K extends string & keyof AppFeatures = string>(id: K): FeatureResult<V | null>;
    evalFeature<V extends AppFeatures[K], K extends string & keyof AppFeatures = string>(id: K): FeatureResult<V | null>;
    private _isIncludedInRollout;
    private _conditionPasses;
    private _isFilteredOut;
    private _run;
    log(msg: string, ctx: Record<string, unknown>): void;
    private _track;
    private _mergeOverrides;
    private _getHashAttribute;
    private _getResult;
    private _getContextUrl;
    private _urlIsValid;
    private _hasGroupOverlap;
}
//# sourceMappingURL=GrowthBook.d.ts.map