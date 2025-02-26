import * as React from "react";
import type { Experiment, Result, JSONValue, FeatureDefinition, WidenPrimitives } from "@growthbook/growthbook";
import { GrowthBook } from "@growthbook/growthbook";
export declare type GrowthBookContextValue = {
    growthbook?: GrowthBook;
};
export interface WithRunExperimentProps {
    runExperiment: <T>(exp: Experiment<T>) => Result<T>;
}
export declare type GrowthBookSSRData = {
    attributes: Record<string, any>;
    features: Record<string, FeatureDefinition>;
};
export declare const GrowthBookContext: React.Context<GrowthBookContextValue>;
export declare function useFeatureIsOn<AppFeatures extends Record<string, any> = Record<string, any>>(id: string & keyof AppFeatures): boolean;
export declare function useFeatureValue<T extends JSONValue = any>(id: string, fallback: T): WidenPrimitives<T>;
export declare function useGrowthBook<AppFeatures extends Record<string, any> = Record<string, any>>(): GrowthBook<AppFeatures> | undefined;
export declare const GrowthBookProvider: React.FC<React.PropsWithChildren<{
    growthbook?: GrowthBook;
}>>;
//# sourceMappingURL=GrowthBookReact.d.ts.map