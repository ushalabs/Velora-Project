"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ContextPressable = void 0;
exports.MotionPressable = MotionPressable;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ContextPressable = exports.ContextPressable = /*#__PURE__*/(0, _react.createContext)({
  pressed: false,
  hovered: false
});
function MotionPressable(props) {
  // @ts-ignore Web props cause errors
  const {
    onPressIn,
    onPressOut,
    onMouseEnter,
    onMouseLeave,
    children,
    ...rest
  } = props;
  const [state, setState] = (0, _react.useState)({
    pressed: false,
    hovered: false
  });
  const update = (0, _react.useCallback)((pressed, hovered) => {
    setState(cur => ({
      pressed: pressed ?? cur.pressed,
      hovered: hovered ?? cur.hovered
    }));
  }, []);
  return /*#__PURE__*/_react.default.createElement(_reactNative.Pressable, _extends({
    onPressIn: e => {
      update(true, undefined);
      onPressIn === null || onPressIn === void 0 || onPressIn(e);
    },
    onPressOut: e => {
      update(false, undefined);
      onPressOut === null || onPressOut === void 0 || onPressOut(e);
    }
    // @ts-ignore
    ,
    onMouseEnter: _reactNative.Platform.OS === 'web' ? e => {
      update(undefined, true);
      onMouseEnter === null || onMouseEnter === void 0 || onMouseEnter(e);
    } : undefined
    // @ts-ignore
    ,
    onMouseLeave: _reactNative.Platform.OS === 'web' ? e => {
      update(undefined, false);
      onMouseLeave === null || onMouseLeave === void 0 || onMouseLeave(e);
    } : undefined
  }, rest), pressableState => {
    const renderedChildren = typeof children === 'function' ? children(pressableState) : children;
    return /*#__PURE__*/_react.default.createElement(ContextPressable.Provider, {
      value: state
    }, renderedChildren);
  });
}
//# sourceMappingURL=MotionPressable.js.map