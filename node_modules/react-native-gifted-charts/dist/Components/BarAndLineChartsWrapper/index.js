var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect } from 'react';
import { View, ScrollView, StyleSheet, I18nManager } from 'react-native';
import { renderHorizSections } from './renderHorizSections';
import RenderLineInBarChart from './renderLineInBarChart';
import RenderVerticalLines from './renderVerticalLines';
import { chartTypes, yAxisSides, useBarAndLineChartsWrapper, } from 'gifted-charts-core';
var isCloseToRight = function (_a, endReachedOffset) {
    var layoutMeasurement = _a.layoutMeasurement, contentOffset = _a.contentOffset, contentSize = _a.contentSize;
    return layoutMeasurement.width + contentOffset.x >= contentSize.width - endReachedOffset;
};
var isCloseToLeft = function (_a, endReachedOffset) {
    var layoutMeasurement = _a.layoutMeasurement, contentOffset = _a.contentOffset, contentSize = _a.contentSize;
    return layoutMeasurement.width + contentOffset.x <= contentSize.width - endReachedOffset;
};
var BarAndLineChartsWrapper = function (props) {
    var _a, _b, _c, _d, _e;
    var chartType = props.chartType, containerHeight = props.containerHeight, noOfSectionsBelowXAxis = props.noOfSectionsBelowXAxis, stepHeight = props.stepHeight, labelsExtraHeight = props.labelsExtraHeight, yAxisLabelWidth = props.yAxisLabelWidth, horizontal = props.horizontal, scrollRef = props.scrollRef, initialSpacing = props.initialSpacing, data = props.data, barWidth = props.barWidth, xAxisThickness = props.xAxisThickness, totalWidth = props.totalWidth, disableScroll = props.disableScroll, showScrollIndicator = props.showScrollIndicator, scrollToEnd = props.scrollToEnd, scrollToIndex = props.scrollToIndex, scrollAnimation = props.scrollAnimation, indicatorColor = props.indicatorColor, spacing = props.spacing, showLine = props.showLine, points2 = props.points2, renderChartContent = props.renderChartContent, remainingScrollViewProps = props.remainingScrollViewProps, endSpacing = props.endSpacing, hideAxesAndRules = props.hideAxesAndRules, showXAxisIndices = props.showXAxisIndices, xAxisIndicesHeight = props.xAxisIndicesHeight, xAxisIndicesWidth = props.xAxisIndicesWidth, xAxisIndicesColor = props.xAxisIndicesColor, pointerConfig = props.pointerConfig, getPointerProps = props.getPointerProps, pointerIndex = props.pointerIndex, pointerX = props.pointerX, pointerY = props.pointerY, onEndReached = props.onEndReached, onStartReached = props.onStartReached, endReachedOffset = props.endReachedOffset, onMomentumScrollEnd = props.onMomentumScrollEnd, onScrollEndDrag = props.onScrollEndDrag, nestedScrollEnabled = props.nestedScrollEnabled, _f = props.extraWidthDueToDataPoint, extraWidthDueToDataPoint = _f === void 0 ? 0 : _f;
    var _g = useBarAndLineChartsWrapper(__assign(__assign({}, props), { isRTL: I18nManager.isRTL })), containerHeightIncludingBelowXAxis = _g.containerHeightIncludingBelowXAxis, xAxisLabelsVerticalShift = _g.xAxisLabelsVerticalShift, trimYAxisAtTop = _g.trimYAxisAtTop, yAxisExtraHeight = _g.yAxisExtraHeight, overflowTop = _g.overflowTop, xAxisLabelsHeight = _g.xAxisLabelsHeight, xAxisTextNumberOfLines = _g.xAxisTextNumberOfLines, actualContainerWidth = _g.actualContainerWidth, transformForHorizontal = _g.transformForHorizontal, horizSectionProps = _g.horizSectionProps, referenceLinesOverChartContent = _g.referenceLinesOverChartContent, setCanMomentum = _g.setCanMomentum, isCloseToStart = _g.isCloseToStart, isCloseToEnd = _g.isCloseToEnd, canMomentum = _g.canMomentum, yAxisAtTop = _g.yAxisAtTop, yAxisThickness = _g.yAxisThickness, yAxisSide = _g.yAxisSide, showVerticalLines = _g.showVerticalLines, verticalLinesProps = _g.verticalLinesProps, lineInBarChartProps = _g.lineInBarChartProps, lineInBarChartProps2 = _g.lineInBarChartProps2;
    useEffect(function () {
        if (pointerConfig && getPointerProps) {
            getPointerProps({ pointerIndex: pointerIndex, pointerX: pointerX, pointerY: pointerY });
        }
    }, [pointerIndex, pointerX, pointerY]);
    /*******************************************************************************************************************************************/
    /*******************************************************************************************************************************************/
    var styles = StyleSheet.create({
        container: {
            width: '100%',
            height: containerHeightIncludingBelowXAxis +
                labelsExtraHeight +
                xAxisLabelsVerticalShift +
                (trimYAxisAtTop ? 0 : yAxisExtraHeight) +
                50 -
                overflowTop,
            marginTop: trimYAxisAtTop ? containerHeight / 20 : 0,
            marginBottom: (xAxisLabelsHeight !== null && xAxisLabelsHeight !== void 0 ? xAxisLabelsHeight : xAxisTextNumberOfLines * 18) -
                55 -
                xAxisLabelsVerticalShift, //This is to not let the Things that should be rendered below the chart overlap with it
        },
    });
    return (_jsxs(View, { style: [
            styles.container,
            horizontal && {
                width: actualContainerWidth,
                transform: transformForHorizontal,
            },
        ], children: [hideAxesAndRules !== true
                ? renderHorizSections(__assign(__assign({}, horizSectionProps), { onlyReferenceLines: false, renderReferenceLines: !referenceLinesOverChartContent }))
                : null, _jsx(ScrollView, __assign({ onScrollBeginDrag: function () {
                    setCanMomentum(true);
                }, onScrollEndDrag: function (evt) {
                    var direction = 0;
                    if (isCloseToLeft(evt.nativeEvent, endReachedOffset)) {
                        direction = -1;
                    }
                    else if (isCloseToRight(evt.nativeEvent, endReachedOffset)) {
                        direction = 1;
                    }
                    if (onScrollEndDrag) {
                        onScrollEndDrag(evt, direction);
                    }
                }, nestedScrollEnabled: nestedScrollEnabled, onMomentumScrollEnd: function (_a) {
                    var nativeEvent = _a.nativeEvent;
                    if (onMomentumScrollEnd) {
                        onMomentumScrollEnd();
                    }
                    if (isCloseToEnd(nativeEvent) && canMomentum) {
                        onEndReached ? onEndReached() : null;
                        setCanMomentum(false);
                    }
                    if (isCloseToStart(nativeEvent) && canMomentum) {
                        onStartReached ? onStartReached() : null;
                        setCanMomentum(false);
                    }
                }, scrollEventThrottle: props.scrollEventThrottle ? props.scrollEventThrottle : 16, horizontal: true, ref: scrollRef, style: [
                    {
                        marginLeft: horizontal && !yAxisAtTop
                            ? -yAxisThickness -
                                (props.width ? 20 : 0) -
                                ((_c = (_b = (_a = data[data.length - 1]) === null || _a === void 0 ? void 0 : _a.barWidth) !== null && _b !== void 0 ? _b : barWidth) !== null && _c !== void 0 ? _c : 0) / 2
                            : yAxisSide === yAxisSides.RIGHT
                                ? 0
                                : yAxisLabelWidth + yAxisThickness,
                        position: 'absolute',
                        bottom: chartType === chartTypes.LINE_BI_COLOR ? 0 : xAxisThickness,
                    },
                    !!props.width && { width: props.width + extraWidthDueToDataPoint },
                    horizontal && {
                        width: ((_d = props.width) !== null && _d !== void 0 ? _d : totalWidth) + (props.width ? endSpacing : -20),
                    },
                ], contentContainerStyle: [
                    {
                        height: containerHeightIncludingBelowXAxis +
                            yAxisExtraHeight +
                            labelsExtraHeight +
                            (50 + xAxisLabelsVerticalShift),
                        width: Math.max((_e = props.width) !== null && _e !== void 0 ? _e : 0, totalWidth - spacing + endSpacing) +
                            extraWidthDueToDataPoint,
                        paddingLeft: initialSpacing,
                        paddingBottom: noOfSectionsBelowXAxis * stepHeight + labelsExtraHeight,
                        alignItems: 'flex-end',
                    },
                    !props.width && { width: totalWidth },
                ], scrollEnabled: !disableScroll, showsHorizontalScrollIndicator: showScrollIndicator, indicatorStyle: indicatorColor, onContentSizeChange: function () {
                    if (scrollRef.current && scrollToEnd) {
                        scrollRef.current.scrollToEnd({ animated: scrollAnimation });
                    }
                    else if (scrollRef.current && scrollToIndex) {
                        scrollRef.current.scrollTo({
                            x: initialSpacing +
                                ((barWidth !== null && barWidth !== void 0 ? barWidth : 0) + spacing) * scrollToIndex -
                                spacing,
                            animated: scrollAnimation,
                        });
                    }
                } }, remainingScrollViewProps, { children: _jsxs(Fragment, { children: [showVerticalLines ? (_jsx(RenderVerticalLines, __assign({}, verticalLinesProps))) : null, 
                        // Only For Bar Charts-
                        showLine ? _jsx(RenderLineInBarChart, __assign({}, lineInBarChartProps)) : null, 
                        // Only For Bar Charts-
                        showLine && (points2 === null || points2 === void 0 ? void 0 : points2.length) ? (_jsx(RenderLineInBarChart, __assign({}, lineInBarChartProps2))) : null, 
                        // Only For Line Charts-
                        chartType === chartTypes.LINE &&
                            data.map(function (item, index) {
                                return showXAxisIndices || item.showXAxisIndex ? (_jsx(View, { style: {
                                        position: 'absolute',
                                        height: xAxisIndicesHeight,
                                        width: xAxisIndicesWidth,
                                        backgroundColor: xAxisIndicesColor,
                                        bottom: 60 - xAxisIndicesHeight / 2,
                                        left: index * spacing +
                                            (initialSpacing - xAxisIndicesWidth / 2) -
                                            3,
                                    } }, index + '' + item.value)) : null;
                            }), renderChartContent(containerHeightIncludingBelowXAxis)] }) })), referenceLinesOverChartContent
                ? renderHorizSections(__assign(__assign({}, horizSectionProps), { onlyReferenceLines: true }))
                : null] }));
};
export default BarAndLineChartsWrapper;
