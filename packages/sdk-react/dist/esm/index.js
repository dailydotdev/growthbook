export { GrowthBook } from '@growthbook/growthbook';
import * as React from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const GrowthBookContext = /*#__PURE__*/React.createContext({});
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
  } = React.useContext(GrowthBookContext);
  return growthbook;
}
const GrowthBookProvider = ({
  children,
  growthbook
}) => {
  // Tell growthbook how to re-render our app (for dev mode integration)
  // eslint-disable-next-line
  const [_, setRenderCount] = React.useState(0);
  React.useEffect(() => {
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
  return /*#__PURE__*/React.createElement(GrowthBookContext.Provider, {
    value: {
      growthbook
    }
  }, children);
};

export { GrowthBookContext, GrowthBookProvider, useFeatureIsOn, useFeatureValue, useGrowthBook };
//# sourceMappingURL=index.js.map
