"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnimatePresence = AnimatePresence;
var _tools = require("@legendapp/tools");
var _react = require("@legendapp/tools/react");
var _react2 = _interopRequireWildcard(require("react"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function exitableByKey(children) {
  const map = new Map();
  _react2.Children.forEach(children, child => {
    if (/*#__PURE__*/(0, _react2.isValidElement)(child)) {
      var _motionChild$props;
      const motionChild = child;
      if (motionChild.key && (_motionChild$props = motionChild.props) !== null && _motionChild$props !== void 0 && _motionChild$props.exit && (0, _tools.isString)(motionChild.key)) {
        map.set(motionChild.key, motionChild);
      }
    }
  });
  return map;
}
function AnimatePresence({
  children
}) {
  const fr = (0, _react.useForceRender)();
  const childArr = _react2.Children.toArray(children);
  const childrenPrevious = (0, _react.usePrevious)(childArr);

  // Map children and previous children to { key: child }
  const childrenByKey = exitableByKey(childArr);
  const childrenByKeyPrevious = (0, _react.usePrevious)(childrenByKey);

  // Add newly exited elements to the exiting map
  const exiting = (0, _react2.useRef)(new Map());
  if (childrenByKeyPrevious) {
    childrenByKeyPrevious.forEach((prevChild, key) => {
      if (!childrenByKey.get(key)) {
        exiting.current.set(key, prevChild);
      }
    });
  }

  // Render exiting elements into the position they were previously
  let childrenToRender = [...childArr];
  exiting.current.forEach((child, key) => {
    if (childrenByKey.get(key)) {
      exiting.current.delete(key);
    } else {
      const index = childrenPrevious.indexOf(child);
      childrenToRender.splice(index, 0, child);
    }
  });
  return /*#__PURE__*/_react2.default.createElement(_react2.default.Fragment, null, childrenToRender.map(child => {
    if (/*#__PURE__*/(0, _react2.isValidElement)(child)) {
      const motionChild = child;
      const {
        exit: motionExit
      } = motionChild.props;
      if (motionExit) {
        const key = motionChild.key;
        const animKeys = Object.keys(motionExit);
        // Remove the child when all exit animations end
        return key && exiting.current.get(key) && animKeys ? /*#__PURE__*/(0, _react2.cloneElement)(motionChild, {
          animate: motionExit,
          onAnimationComplete: animKey => {
            if (exiting.current.has(key)) {
              (0, _tools.arrayRemove)(animKeys, animKey);
              if (animKeys.length === 0) {
                exiting.current.delete(key);
                fr();
              }
            }
          }
        }) : motionChild;
      }
    }
    return child;
  }));
}
//# sourceMappingURL=AnimatePresence.js.map