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
