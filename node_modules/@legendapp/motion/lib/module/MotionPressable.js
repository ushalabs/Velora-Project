function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React, { createContext, useCallback, useState } from 'react';
import { Platform, Pressable } from 'react-native';
export const ContextPressable = /*#__PURE__*/createContext({
  pressed: false,
  hovered: false
});
export function MotionPressable(props) {
  // @ts-ignore Web props cause errors
  const {
    onPressIn,
    onPressOut,
    onMouseEnter,
    onMouseLeave,
    children,
    ...rest
  } = props;
  const [state, setState] = useState({
    pressed: false,
    hovered: false
  });
  const update = useCallback((pressed, hovered) => {
    setState(cur => ({
      pressed: pressed ?? cur.pressed,
      hovered: hovered ?? cur.hovered
    }));
  }, []);
  return /*#__PURE__*/React.createElement(Pressable, _extends({
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
    onMouseEnter: Platform.OS === 'web' ? e => {
      update(undefined, true);
      onMouseEnter === null || onMouseEnter === void 0 || onMouseEnter(e);
    } : undefined
    // @ts-ignore
    ,
    onMouseLeave: Platform.OS === 'web' ? e => {
      update(undefined, false);
      onMouseLeave === null || onMouseLeave === void 0 || onMouseLeave(e);
    } : undefined
  }, rest), pressableState => {
    const renderedChildren = typeof children === 'function' ? children(pressableState) : children;
    return /*#__PURE__*/React.createElement(ContextPressable.Provider, {
      value: state
    }, renderedChildren);
  });
}
//# sourceMappingURL=MotionPressable.js.map