/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import type {
  Experiment,
  Result,
  JSONValue,
  FeatureDefinition,
  WidenPrimitives,
} from "@growthbook/growthbook";
import { GrowthBook } from "@growthbook/growthbook";

export type GrowthBookContextValue = {
  growthbook?: GrowthBook;
};
export interface WithRunExperimentProps {
  runExperiment: <T>(exp: Experiment<T>) => Result<T>;
}
export type GrowthBookSSRData = {
  attributes: Record<string, any>;
  features: Record<string, FeatureDefinition>;
};

export const GrowthBookContext = React.createContext<GrowthBookContextValue>(
  {}
);

export function useFeatureIsOn<
  AppFeatures extends Record<string, any> = Record<string, any>
>(id: string & keyof AppFeatures): boolean {
  const growthbook = useGrowthBook<AppFeatures>();
  return growthbook ? growthbook.isOn(id) : false;
}

export function useFeatureValue<T extends JSONValue = any>(
  id: string,
  fallback: T
): WidenPrimitives<T> {
  const growthbook = useGrowthBook();
  return growthbook
    ? growthbook.getFeatureValue(id, fallback)
    : (fallback as WidenPrimitives<T>);
}

export function useGrowthBook<
  AppFeatures extends Record<string, any> = Record<string, any>
>(): GrowthBook<AppFeatures> | undefined {
  const { growthbook } = React.useContext(GrowthBookContext);
  return growthbook as GrowthBook<AppFeatures> | undefined;
}

export const GrowthBookProvider: React.FC<
  React.PropsWithChildren<{
    growthbook?: GrowthBook;
  }>
> = ({ children, growthbook }) => {
  // Tell growthbook how to re-render our app (for dev mode integration)
  // eslint-disable-next-line
  const [_, setRenderCount] = React.useState(0);
  React.useEffect(() => {
    if (!growthbook || !growthbook.setRenderer) return;

    growthbook.setRenderer(() => {
      setRenderCount((v) => v + 1);
    });
    return () => {
      growthbook.setRenderer(() => {
        // do nothing
      });
    };
  }, [growthbook]);

  return (
    <GrowthBookContext.Provider
      value={{
        growthbook,
      }}
    >
      {children}
    </GrowthBookContext.Provider>
  );
};
