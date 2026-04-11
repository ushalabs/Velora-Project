import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from 'react';
import { styles } from '../../../BarChart/styles';
import { View } from 'react-native';
import { getXForLineInBar, getYForLineInBar } from 'gifted-charts-core';
import { Rect, Text as CanvasText, Circle } from 'react-native-svg';
export var renderDataPoints = function (props) {
    var data = props.data, lineConfig = props.lineConfig, barWidth = props.barWidth, containerHeight = props.containerHeight, maxValue = props.maxValue, firstBarWidth = props.firstBarWidth, yAxisLabelWidth = props.yAxisLabelWidth, spacing = props.spacing, selectedIndex = props.selectedIndex, yAxisOffset = props.yAxisOffset, opacity = props.opacity;
    return data.map(function (item, index) {
        var _a, _b, _c, _d, _e;
        if (index < lineConfig.startIndex ||
            index > lineConfig.endIndex ||
            item.hideDataPoint) {
            return null;
        }
        var currentBarWidth = item.barWidth || barWidth || 30;
        var customDataPoint = item.customDataPoint || lineConfig.customDataPoint;
        var dataPointColor = lineConfig.focusEnabled &&
            index === ((_a = lineConfig.focusedDataPointIndex) !== null && _a !== void 0 ? _a : selectedIndex)
            ? lineConfig.focusedDataPointColor
            : lineConfig.dataPointsColor;
        var dataPointRadius = lineConfig.focusEnabled &&
            index === ((_b = lineConfig.focusedDataPointIndex) !== null && _b !== void 0 ? _b : selectedIndex)
            ? lineConfig.focusedDataPointRadius
            : lineConfig.dataPointsRadius;
        var value = (_c = item.value) !== null && _c !== void 0 ? _c : item.stacks.reduce(function (total, item) { return total + item.value; }, 0);
        if (customDataPoint) {
            return (_jsx(View, { style: [
                    styles.customDataPointContainer,
                    {
                        opacity: opacity,
                        height: lineConfig.dataPointsHeight,
                        width: lineConfig.dataPointsWidth,
                        top: containerHeight -
                            (value * containerHeight) / maxValue -
                            ((_e = (_d = item.shiftY) !== null && _d !== void 0 ? _d : lineConfig.shiftY) !== null && _e !== void 0 ? _e : 0),
                        left: getXForLineInBar(index, firstBarWidth, currentBarWidth, yAxisLabelWidth, lineConfig, spacing),
                    },
                ], children: customDataPoint(item, index) }));
        }
        if (lineConfig.dataPointsShape === 'rectangular') {
            return (_jsxs(Fragment, { children: [_jsx(Rect, { x: getXForLineInBar(index, firstBarWidth, currentBarWidth, yAxisLabelWidth, lineConfig, spacing), y: getYForLineInBar(value, lineConfig.shiftY, containerHeight, maxValue, yAxisOffset) -
                            lineConfig.dataPointsHeight / 2, width: lineConfig.dataPointsWidth, height: lineConfig.dataPointsHeight, fill: dataPointColor, opacity: opacity }), item.dataPointText && (_jsx(CanvasText, { fill: item.textColor || lineConfig.textColor, opacity: opacity, fontSize: item.textFontSize || lineConfig.textFontSize, x: getXForLineInBar(index, firstBarWidth, currentBarWidth, yAxisLabelWidth, lineConfig, spacing) + (item.textShiftX || lineConfig.textShiftX || 0), y: getYForLineInBar(value, lineConfig.shiftY, containerHeight, maxValue, yAxisOffset) -
                            lineConfig.dataPointsHeight / 2 +
                            (item.textShiftY || lineConfig.textShiftY || 0), children: item.dataPointText }))] }, index));
        }
        return (_jsxs(Fragment, { children: [_jsx(Circle, { cx: getXForLineInBar(index, firstBarWidth, currentBarWidth, yAxisLabelWidth, lineConfig, spacing), cy: getYForLineInBar(value, lineConfig.shiftY, containerHeight, maxValue, yAxisOffset), r: dataPointRadius, fill: dataPointColor, opacity: opacity }), item.dataPointText && (_jsx(CanvasText, { fill: item.textColor || lineConfig.textColor, opacity: opacity, fontSize: item.textFontSize || lineConfig.textFontSize, x: getXForLineInBar(index, firstBarWidth, currentBarWidth, yAxisLabelWidth, lineConfig, spacing) + (item.textShiftX || lineConfig.textShiftX || 0), y: getYForLineInBar(value, lineConfig.shiftY, containerHeight, maxValue, yAxisOffset) -
                        lineConfig.dataPointsHeight / 2 +
                        (item.textShiftY || lineConfig.textShiftY || 0), children: item.dataPointText }))] }, index));
    });
};
