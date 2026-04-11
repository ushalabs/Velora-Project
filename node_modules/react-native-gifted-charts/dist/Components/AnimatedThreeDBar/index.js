var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { View, StyleSheet, LayoutAnimation, Platform, UIManager, Text, } from 'react-native';
import Svg, { Defs, Rect } from 'react-native-svg';
import { styles } from './styles';
import LinearGradient from "../common/LinearGradient";
import { useAnimatedThreeDBar, } from 'gifted-charts-core';
if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental &&
        UIManager.setLayoutAnimationEnabledExperimental(true);
}
var TriangleCorner = function (props) {
    return (_jsx(View, { style: [
            triangleStyles.triangleCorner,
            props.style,
            {
                borderRightWidth: props.width / 2,
                borderTopWidth: props.width / 2,
                borderTopColor: props.color,
            },
        ] }));
};
var triangleStyles = StyleSheet.create({
    triangleCorner: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderRightColor: 'transparent',
        transform: [{ rotate: '90deg' }],
    },
});
var AnimatedThreeDBar = function (props) {
    var _a;
    var heightCopy = props.height;
    var _b = __read(useState(props.isAnimated ? (Platform.OS === 'ios' ? 0 : 20) : heightCopy), 2), height = _b[0], setHeight = _b[1];
    var isAnimated = props.isAnimated, animationDuration = props.animationDuration, item = props.item, index = props.index, barWidth = props.barWidth, sideWidth = props.sideWidth, barStyle = props.barStyle, barBackgroundPattern = props.barBackgroundPattern, barInnerComponent = props.barInnerComponent, patternId = props.patternId, intactTopLabel = props.intactTopLabel, showValuesAsTopLabel = props.showValuesAsTopLabel, topLabelContainerStyle = props.topLabelContainerStyle, topLabelTextStyle = props.topLabelTextStyle;
    var _c = useAnimatedThreeDBar(props), showGradient = _c.showGradient, gradientColor = _c.gradientColor, frontColor = _c.frontColor, sideColor = _c.sideColor, topColor = _c.topColor, opacity = _c.opacity, initialRender = _c.initialRender, setInitialRender = _c.setInitialRender;
    useEffect(function () {
        if (isAnimated) {
            if (initialRender) {
                setTimeout(function () {
                    layoutAppear();
                }, 20);
            }
            else {
                elevate();
            }
        }
    }, [props.height]);
    var elevate = function () {
        LayoutAnimation.configureNext({
            duration: animationDuration,
            update: { type: 'linear', property: 'scaleY' },
        });
        setHeight(props.height);
    };
    var layoutAppear = function () {
        LayoutAnimation.configureNext({
            duration: Platform.OS == 'ios' ? animationDuration : 20,
            create: { type: 'linear', property: 'scaleY' },
            // update: { type: 'linear' }
        });
        setInitialRender(false);
        setTimeout(function () { return elevate(); }, Platform.OS == 'ios' ? 10 : 100);
    };
    return (_jsx(View, { style: styles.container, children: !initialRender && (_jsxs(View, { style: [
                styles.row,
                { opacity: opacity, position: 'absolute', bottom: 0 },
                props.side === 'right' && { transform: [{ rotateY: '180deg' }] },
            ], children: [props.height ? (_jsxs(_Fragment, { children: [_jsx(View, { style: { position: 'absolute', top: sideWidth / -2 }, children: _jsx(TriangleCorner, { color: topColor, width: sideWidth, style: { transform: [{ rotate: '90deg' }], opacity: opacity } }) }), _jsx(View, { style: { position: 'absolute', top: sideWidth / -2 }, children: _jsx(View, { style: {
                                    width: barWidth,
                                    height: barWidth,
                                    // left: width / 2,
                                    backgroundColor: topColor,
                                    opacity: opacity,
                                } }) }), _jsx(View, { style: {
                                position: 'absolute',
                                top: sideWidth / -2,
                                left: barWidth - 1,
                            }, children: _jsx(TriangleCorner, { color: topColor, width: sideWidth, style: { transform: [{ rotate: '-90deg' }], opacity: opacity } }) })] })) : null, _jsxs(View, { style: { marginTop: sideWidth / -2 - 1 }, children: [_jsx(TriangleCorner, { color: height ? sideColor : 'transparent', width: sideWidth, style: { transform: [{ rotate: '-90deg' }], opacity: opacity } }), _jsx(View, { style: {
                                width: sideWidth / 2 + 1,
                                height: height - sideWidth / 2, //animatedSideHeight
                                backgroundColor: sideColor,
                                opacity: opacity,
                            } }), _jsx(TriangleCorner, { color: height ? sideColor : 'transparent', width: sideWidth + 1, style: { transform: [{ rotate: '90deg' }], opacity: opacity } })] }), _jsxs(View, { style: [
                        {
                            width: barWidth,
                            height: height, //animatedHeight
                            backgroundColor: frontColor,
                            borderLeftWidth: StyleSheet.hairlineWidth,
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderColor: 'white',
                            opacity: opacity,
                        },
                        item.barStyle || barStyle,
                    ], children: [showGradient && (_jsx(LinearGradient, { style: { position: 'absolute', width: '100%', height: '100%' }, start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, colors: [gradientColor, frontColor] })), barBackgroundPattern && (_jsxs(Svg, { children: [_jsx(Defs, { children: barBackgroundPattern() }), _jsx(Rect, { stroke: "none", x: "1", y: "1", width: barWidth || 30, height: height, fill: "url(#".concat(patternId, ")") })] })), barInnerComponent ? (_jsx(View, { style: { height: '100%', width: '100%' }, children: barInnerComponent(item, index) })) : null] }), (item.topLabelComponent || showValuesAsTopLabel) && (_jsx(View, { style: [
                        {
                            position: 'absolute',
                            top: barWidth * -2,
                            height: (barWidth * 3) / 2,
                            width: (barWidth * 3) / 2,
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            opacity: opacity,
                        },
                        props.horizontal &&
                            !intactTopLabel && { transform: [{ rotate: '270deg' }] },
                        props.side === 'right' && { transform: [{ rotateY: '180deg' }] },
                        topLabelContainerStyle !== null && topLabelContainerStyle !== void 0 ? topLabelContainerStyle : item.topLabelContainerStyle,
                    ], children: showValuesAsTopLabel ? (_jsx(Text, { style: topLabelTextStyle, children: item.value })) : ((_a = item.topLabelComponent) === null || _a === void 0 ? void 0 : _a.call(item)) }))] })) }));
};
export default AnimatedThreeDBar;
