'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var growthbook = require('@growthbook/growthbook');
var React = require('react');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var React__namespace = /*#__PURE__*/_interopNamespace(React);

/* eslint-disable @typescript-eslint/no-explicit-any */
const GrowthBookContext = /*#__PURE__*/React__namespace.createContext({});

// function run<T>(exp: Experiment<T>, growthbook?: GrowthBook): Result<T> {
//   if (!growthbook) {
//     return {
//       featureId: null,
//       value: exp.variations[0],
//       variationId: 0,
//       inExperiment: false,
//       hashUsed: false,
//       hashAttribute: exp.hashAttribute || "id",
//       hashValue: "",
//       key: "",
//     };
//   }
//   return growthbook.run(exp);
// }
// function feature<T extends JSONValue = any>(
//   id: string,
//   growthbook?: GrowthBook
// ): FeatureResult<T | null> {
//   if (!growthbook) {
//     return {
//       value: null,
//       on: false,
//       off: true,
//       source: "unknownFeature",
//       ruleId: "",
//     };
//   }
//   return growthbook.evalFeature<T>(id);
// }

// Get features from API and targeting attributes during SSR
// export async function getGrowthBookSSRData(
//   context: Context
// ): Promise<GrowthBookSSRData> {
//   // Server-side GrowthBook instance
//   const gb = new GrowthBook({
//     ...context,
//   });

//   // Load feature flags from network if needed
//   if (context.clientKey) {
//     await gb.loadFeatures();
//   }

//   const data: GrowthBookSSRData = {
//     attributes: gb.getAttributes(),
//     features: gb.getFeatures(),
//   };
//   gb.destroy();

//   return data;
// }

// Populate the GrowthBook instance in context from the SSR props
// export function useGrowthBookSSR(data: GrowthBookSSRData) {
//   const gb = useGrowthBook();

//   // Only do this once to avoid infinite loops
//   const isFirst = React.useRef(true);
//   if (gb && isFirst.current) {
//     gb.setFeatures(data.features);
//     gb.setAttributes(data.attributes);
//     isFirst.current = false;
//   }
// }

// export function useExperiment<T>(exp: Experiment<T>): Result<T> {
//   const { growthbook } = React.useContext(GrowthBookContext);
//   return run(exp, growthbook);
// }

// export function useFeature<T extends JSONValue = any>(
//   id: string
// ): FeatureResult<T | null> {
//   const growthbook = useGrowthBook();
//   return feature(id, growthbook);
// }

function useFeatureIsOn(id) {
  const growthbook = useGrowthBook();
  return growthbook ? growthbook.isOn(id) : false;
}
function useFeatureValue(id, fallback) {
  const growthbook = useGrowthBook();
  return growthbook ? growthbook.getFeatureValue(id, fallback) : fallback;
}
function useGrowthBook() {
  const {
    growthbook
  } = React__namespace.useContext(GrowthBookContext);
  return growthbook;
}

// export function FeaturesReady({
//   children,
//   timeout,
//   fallback,
// }: {
//   children: React.ReactNode;
//   timeout?: number;
//   fallback?: React.ReactNode;
// }) {
//   const gb = useGrowthBook();
//   const [hitTimeout, setHitTimeout] = React.useState(false);
//   const ready = gb ? gb.ready : false;
//   React.useEffect(() => {
//     if (timeout && !ready) {
//       const timer = setTimeout(() => {
//         gb &&
//           gb.log("FeaturesReady timed out waiting for features to load", {
//             timeout,
//           });
//         setHitTimeout(true);
//       }, timeout);
//       return () => clearTimeout(timer);
//     }
//   }, [timeout, ready, gb]);

//   return <>{ready || hitTimeout ? children : fallback || null}</>;
// }

// export function IfFeatureEnabled({
//   children,
//   feature,
// }: {
//   children: React.ReactNode;
//   feature: string;
// }) {
//   return useFeature(feature).on ? <>{children}</> : null;
// }

// export function FeatureString(props: { default: string; feature: string }) {
//   const value = useFeature(props.feature).value;

//   if (value !== null) {
//     return <>{value}</>;
//   }

//   return <>{props.default}</>;
// }

// export const withRunExperiment = <P extends WithRunExperimentProps>(
//   Component: React.ComponentType<P>
// ): React.ComponentType<Omit<P, keyof WithRunExperimentProps>> => {
//   // eslint-disable-next-line
//   const withRunExperimentWrapper = (props: any): JSX.Element => (
//     <GrowthBookContext.Consumer>
//       {({ growthbook }): JSX.Element => {
//         return (
//           <Component
//             {...(props as P)}
//             runExperiment={(exp) => run(exp, growthbook)}
//           />
//         );
//       }}
//     </GrowthBookContext.Consumer>
//   );
//   return withRunExperimentWrapper;
// };
// withRunExperiment.displayName = "WithRunExperiment";

const GrowthBookProvider = ({
  children,
  growthbook
}) => {
  // Tell growthbook how to re-render our app (for dev mode integration)
  // eslint-disable-next-line
  const [_, setRenderCount] = React__namespace.useState(0);
  React__namespace.useEffect(() => {
    if (!growthbook || !growthbook.setRenderer) return;
    growthbook.setRenderer(() => {
      setRenderCount(v => v + 1);
    });
    return () => {
      growthbook.setRenderer(() => {
        // do nothing
      });
    };
  }, [growthbook]);
  return /*#__PURE__*/React__namespace.createElement(GrowthBookContext.Provider, {
    value: {
      growthbook
    }
  }, children);
};

Object.defineProperty(exports, 'GrowthBook', {
  enumerable: true,
  get: function () { return growthbook.GrowthBook; }
});
exports.GrowthBookContext = GrowthBookContext;
exports.GrowthBookProvider = GrowthBookProvider;
exports.useFeatureIsOn = useFeatureIsOn;
exports.useFeatureValue = useFeatureValue;
exports.useGrowthBook = useGrowthBook;
//# sourceMappingURL=index.js.map
