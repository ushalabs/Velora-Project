"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MotionSvg = void 0;
var RNSvg = _interopRequireWildcard(require("react-native-svg"));
var _createMotionComponent = require("./createMotionComponent");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
let MotionSvg = exports.MotionSvg = void 0;
(function (_MotionSvg) {
  const Svg = _MotionSvg.Svg = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Svg);
  const Polygon = _MotionSvg.Polygon = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Polygon);
  const Rect = _MotionSvg.Rect = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Rect);
  const Circle = _MotionSvg.Circle = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Circle);
  const Ellipse = _MotionSvg.Ellipse = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Ellipse);
  const Line = _MotionSvg.Line = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Line);
  const Polyline = _MotionSvg.Polyline = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Polyline);
  const Path = _MotionSvg.Path = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Path);
  const Text = _MotionSvg.Text = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.Text);
  const TSpan = _MotionSvg.TSpan = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.TSpan);
  const TextPath = _MotionSvg.TextPath = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.TextPath);
  const G = _MotionSvg.G = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.G);
  const ClipPath = _MotionSvg.ClipPath = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.ClipPath);
  const LinearGradient = _MotionSvg.LinearGradient = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.LinearGradient);
  const RadialGradient = _MotionSvg.RadialGradient = (0, _createMotionComponent.createMotionAnimatedComponent)(RNSvg.RadialGradient);
})(MotionSvg || (exports.MotionSvg = MotionSvg = {}));
//# sourceMappingURL=svg.js.map