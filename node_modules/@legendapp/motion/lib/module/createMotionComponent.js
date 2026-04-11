function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { isArray, isNumber, isString } from '@legendapp/tools';
import React, { forwardRef, useContext, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { config } from './configureMotion';
import { DefaultTransitionTime } from './Constants';
import { ContextPressable } from './MotionPressable';
import { useTransformOrigin } from './useTransformOrigin';
const TransformKeys = {
  x: 'translateX',
  y: 'translateY',
  scale: 'scale',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  skewX: 'skewX',
  skewY: 'skewY',
  perspective: 'perspective',
  rotate: 'rotate',
  rotateX: 'rotateX',
  rotateY: 'rotateY',
  rotateZ: 'rotateZ',
  matrix: 'matrix'
};
const OtherNativeKeys = {
  opacity: 'opacity'
};
const DefaultValues = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  skewX: '0deg',
  skewY: '0deg',
  perspective: 0,
  rotate: '0deg',
  rotateX: '0deg',
  rotateY: '0deg',
  rotateZ: '0deg',
  matrix: [],
  opacity: 1
};
const DefaultTransition = {
  type: 'tween',
  duration: DefaultTransitionTime
};
const Eases = {
  linear: Easing.linear,
  easeIn: Easing.ease,
  easeInOut: Easing.inOut(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  circIn: Easing.circle,
  circInOut: Easing.inOut(Easing.circle),
  circOut: Easing.out(Easing.circle),
  backIn: Easing.back(2),
  backInOut: Easing.inOut(Easing.back(2)),
  backOut: Easing.out(Easing.back(2))
};
function addKeysToSet(...objs) {
  const set = new Set();
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    if (obj) {
      const keys = Object.keys(obj);
      for (let u = 0; u < keys.length; u++) {
        set.add(keys[u]);
      }
    }
  }
  return set;
}
export function createMotionComponent(Component) {
  const MotionComponent = /*#__PURE__*/forwardRef(function MotionComponent({
    animate,
    animateProps,
    initial,
    initialProps,
    exit,
    transition,
    transformOrigin,
    style: styleProp,
    onLayout: onLayoutProp,
    whileTap,
    whileHover,
    onAnimationComplete,
    ...rest
  }, ref) {
    const refAnims = useRef({});

    // Generate the arrays of keys and values for transitioning. These are used as deps of useMemo
    // so that it will update whenever a key or value changes.
    const animateRecord = animate;
    const animatePropsRecord = animateProps;
    const initialRecord = initial;
    const initialPropsRecord = initialProps;
    const whileTapRecord = whileTap;
    const whileHoverRecord = whileHover;
    const exitRecord = exit;
    const animKeysSet = addKeysToSet(initialRecord || {}, animateRecord || {}, animatePropsRecord || {}, whileTapRecord || {}, whileHoverRecord || {}, exitRecord || {});
    const values = Object.assign({}, animateRecord ?? {});
    if (animatePropsRecord) {
      addKeysToSet(animKeysSet, animatePropsRecord);
      Object.assign(values, animatePropsRecord);
    }
    if (whileTap || whileHover) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const {
        pressed,
        hovered
      } = useContext(ContextPressable);
      if (whileHoverRecord) {
        addKeysToSet(animKeysSet, whileHoverRecord);
        if (hovered) {
          Object.assign(values, whileHoverRecord);
        }
      }
      if (whileTapRecord) {
        addKeysToSet(animKeysSet, whileTapRecord);
        if (pressed) {
          Object.assign(values, whileTapRecord);
        }
      }
    }
    if (exitRecord) {
      addKeysToSet(animKeysSet, exitRecord);
    }
    const animKeys = [...animKeysSet];
    const animValues = animKeys.map(key => values[key]);
    const update = () => {
      const anims = refAnims.current;
      const useNativeDriver = !animatePropsRecord && animKeys.every(key => !!OtherNativeKeys[key] || !!TransformKeys[key]);
      for (let i = 0; i < animKeys.length; i++) {
        const key = animKeys[i];
        const isProp = (animatePropsRecord === null || animatePropsRecord === void 0 ? void 0 : animatePropsRecord[key]) !== undefined;
        let value = values[key];
        const valueInitial = (isProp ? initialPropsRecord === null || initialPropsRecord === void 0 ? void 0 : initialPropsRecord[key] : initialRecord === null || initialRecord === void 0 ? void 0 : initialRecord[key]) ?? value ?? DefaultValues[key];
        if (value === undefined) {
          value = valueInitial ?? DefaultValues[key];
        }
        if (!anims[key] || anims[key].value !== value) {
          const isStr = isString(valueInitial);
          const isArr = isArray(valueInitial);

          // If this is the first run or it's a new key, create the Animated.Value
          if (!anims[key]) {
            const startValue = isStr || isArr ? 1 : valueInitial;
            const animValue = new Animated.Value(startValue);
            anims[key] = {
              value: valueInitial,
              animValue,
              valueInterp: isStr ? 1 : undefined
            };
          }
          let toValue;
          // If string or array it needs to interpolate, so toggle back and forth between 0 and 1,
          // interpolating from current value to target value
          if (isStr || isArr) {
            const fromInterp = anims[key].valueInterp;
            const from = anims[key].value;
            anims[key].interpolation = anims[key].animValue.interpolate({
              inputRange: [0, 1],
              outputRange: fromInterp === 1 ? [value, from] : [from, value]
            });
            anims[key].valueInterp = toValue = 1 - fromInterp;
            anims[key].value = value;
          } else {
            anims[key].value = toValue = value;
          }

          // Get the transition for this key, the 'default' key, the root transition, or default transition if no transition prop
          const transitionForKey = (transition === null || transition === void 0 ? void 0 : transition[key]) || (transition === null || transition === void 0 ? void 0 : transition.default) || transition || DefaultTransition;
          if (config.timing === 's' && transitionForKey !== DefaultTransition && isNumber(transitionForKey.duration)) {
            transitionForKey.duration *= 1000;
          }
          if (isString(transitionForKey.easing)) {
            transitionForKey.easing = Eases[transitionForKey.easing];
          }
          if (isString(transitionForKey.ease)) {
            transitionForKey.ease = Eases[transitionForKey.ease];
          }
          const animOptions = Object.assign({
            toValue,
            useNativeDriver
          }, transitionForKey);

          // This typeof check is to make it work when rendered server-side like in Next.js
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
              const callback = onAnimationComplete ? () => onAnimationComplete(key) : undefined;
              const {
                loop,
                type
              } = transitionForKey;
              let animation;

              // Spring or timing based on the transition prop
              if (type === 'spring') {
                animation = Animated.spring(anims[key].animValue, animOptions);
              } else {
                animation = Animated.timing(anims[key].animValue, animOptions);
              }

              // Loop based on the transition prop
              if (loop !== undefined) {
                animation = Animated.loop(animation, {
                  iterations: loop
                });
              }
              animation.start(callback);
            });
          }
        }
      }
    };
    useMemo(update, animValues); // eslint-disable-line react-hooks/exhaustive-deps

    // Apply the animations to the style object
    const style = {};
    const animProps = {};
    const transforms = [];
    Object.entries(refAnims.current).forEach(([key, value]) => {
      if ((animatePropsRecord === null || animatePropsRecord === void 0 ? void 0 : animatePropsRecord[key]) !== undefined) {
        animProps[key] = value.interpolation || value.animValue;
      } else if (TransformKeys[key]) {
        transforms.push({
          key,
          value
        });
      } else {
        style[key] = value.interpolation || value.animValue;
      }
    });

    // Map the transforms into an Animated transforms array
    if (transforms.length) {
      style.transform = transforms.map(({
        key,
        value
      }) => ({
        [TransformKeys[key]]: value.interpolation || value.animValue
      }));
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const onLayout = transformOrigin ? useTransformOrigin(transformOrigin, style.transform, onLayoutProp) : onLayoutProp;

    // @ts-ignore
    return /*#__PURE__*/React.createElement(Component, _extends({
      style: [styleProp, style],
      onLayout: onLayout
    }, rest, animProps, {
      ref: ref
    }));
  });
  return MotionComponent;
}
export function createMotionAnimatedComponent(component) {
  return createMotionComponent(Animated.createAnimatedComponent(component));
}
//# sourceMappingURL=createMotionComponent.js.map