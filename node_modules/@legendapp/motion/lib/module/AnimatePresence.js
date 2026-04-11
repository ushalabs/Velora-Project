import { arrayRemove, isString } from '@legendapp/tools';
import { useForceRender, usePrevious } from '@legendapp/tools/react';
import React, { Children, cloneElement, isValidElement, useRef } from 'react';
function exitableByKey(children) {
  const map = new Map();
  Children.forEach(children, child => {
    if (/*#__PURE__*/isValidElement(child)) {
      var _motionChild$props;
      const motionChild = child;
      if (motionChild.key && (_motionChild$props = motionChild.props) !== null && _motionChild$props !== void 0 && _motionChild$props.exit && isString(motionChild.key)) {
        map.set(motionChild.key, motionChild);
      }
    }
  });
  return map;
}
export function AnimatePresence({
  children
}) {
  const fr = useForceRender();
  const childArr = Children.toArray(children);
  const childrenPrevious = usePrevious(childArr);

  // Map children and previous children to { key: child }
  const childrenByKey = exitableByKey(childArr);
  const childrenByKeyPrevious = usePrevious(childrenByKey);

  // Add newly exited elements to the exiting map
  const exiting = useRef(new Map());
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
  return /*#__PURE__*/React.createElement(React.Fragment, null, childrenToRender.map(child => {
    if (/*#__PURE__*/isValidElement(child)) {
      const motionChild = child;
      const {
        exit: motionExit
      } = motionChild.props;
      if (motionExit) {
        const key = motionChild.key;
        const animKeys = Object.keys(motionExit);
        // Remove the child when all exit animations end
        return key && exiting.current.get(key) && animKeys ? /*#__PURE__*/cloneElement(motionChild, {
          animate: motionExit,
          onAnimationComplete: animKey => {
            if (exiting.current.has(key)) {
              arrayRemove(animKeys, animKey);
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