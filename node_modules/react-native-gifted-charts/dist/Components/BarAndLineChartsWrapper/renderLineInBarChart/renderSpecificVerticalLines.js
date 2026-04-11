import { jsx as _jsx } from "react/jsx-runtime";
import { Rect } from 'react-native-svg';
export var renderSpecificVerticalLines = function (props) {
    var data = props.data, barWidth = props.barWidth, yAxisLabelWidth = props.yAxisLabelWidth, initialSpacing = props.initialSpacing, spacing = props.spacing, containerHeight = props.containerHeight, lineConfig = props.lineConfig, maxValue = props.maxValue;
    return data.map(function (item, index) {
        if (item.showVerticalLine) {
            var currentBarWidth = item.barWidth || barWidth || 30;
            return (_jsx(Rect, { x: yAxisLabelWidth +
                    6 -
                    (item.verticalLineThickness || 1) / 2 -
                    1 -
                    (initialSpacing - currentBarWidth / 2) +
                    (currentBarWidth + spacing) * index, y: containerHeight -
                    lineConfig.shiftY -
                    (item.value * containerHeight) / maxValue +
                    9, width: item.verticalLineThickness || 1, height: (item.value * containerHeight) / maxValue + lineConfig.shiftY, fill: item.verticalLineColor || 'lightgray' }));
        }
        return null;
    });
};
