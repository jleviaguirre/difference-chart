import * as d3 from "d3";
import { DataViewRow, Size } from "spotfire-api";
import { rectangularSelection } from "./rectangularMarking";

export interface DifferenceChartNode {
    hasVirtualChildren?: boolean;
    mark: (operation?: any) => void;
    level: number;
    key: any;
    parent?: any;
    markedRowCount: () => number;
    formattedValue: () => string;
    formattedPath: () => string;
    leafCount: () => number;
    children?: DifferenceChartNode[];
    rows: () => DataViewRow[];
    virtualLeaf?: boolean;
    actualValue?: number;
    fill?: string;
}

export interface DifferenceChartSettings {
    style: {
        label: { size: number; weight: string; style: string; color: string; fontFamily: string };
        marking: { color: string };
        background: { color: string };
    };
    onMouseover?(data: unknown): void;
    onMouseLeave?(): void;
    containerSelector: string;
    size: { width: number; height: number };
    mark(data: unknown): void;
    click(data: unknown): void;
    clearMarking(): void;
}

export function renderChart(data: {}[], differenceChartSettings: DifferenceChartSettings) {

    //Chart options
    var margin = { top: 10, right: 10, bottom: 20, left: 40 },
        width = differenceChartSettings.size.width - margin.left - margin.right,
        height = differenceChartSettings.size.height - margin.top - margin.bottom - 50;

    var measure1 = Object.keys(data[0])[1]; //New York
    var measure2 = Object.keys(data[0])[2]; //San Francisco

    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    var xAxis = d3.axisBottom(x);
    var yAxis = d3.axisLeft(y);

    var line = d3.area()
        .curve(d3.curveBasis)
        .x(function (d:object) { return x(d.date); })
        .y(function (d:object) { return y(d[measure1]); });

    var area = d3.area()
        .curve(d3.curveBasis)
        .x(function (d:object) { return x(d.date); })
        .y1(function (d:object) { return y(d[measure1]); });

    d3.selectAll("#myChart").html("");

    var svg = d3.select("#myChart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    x.domain(d3.extent(data, function (d:object) { return d.date; }));

    y.domain([
        d3.min(data, function (d) { return Math.min(d[measure1], d[measure2]); }),
        d3.max(data, function (d) { return Math.max(d[measure1], d[measure2]); })
    ]);

    svg.datum(data);

    svg.append("clipPath")
        .attr("id", "clip-below")
        .append("path")
        .attr("d", area.y0(height));

    svg.append("clipPath")
        .attr("id", "clip-above")
        .append("path")
        .attr("d", area.y0(0));

    svg.append("path")
        .attr("class", "area above")
        .attr("clip-path", "url(#clip-above)")
        .attr("d", area.y0(function (d) { return y(d[measure2]); }));

    svg.append("path")
        .attr("class", "area below")
        .attr("clip-path", "url(#clip-below)")
        .attr("d", area);

    svg.append("path")
        .attr("class", "line")
        .attr("d", line);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end");


    //marking from https://github.com/TIBCOSoftware/spotfire-mods/blob/master/catalog/sunburst-chart/src/rectangularMarking.ts
    //but here is another code that handles marking in d3 that might be more appropiate for this use case
    //https://github.com/TIBCOSoftware/spotfire-mods/blob/master/examples/js-areachart-d3/src/render.js

    svg = d3.select("#myChart svg");
    rectangularSelection(svg, {
        clearMarking: differenceChartSettings.clearMarking,
        mark: (d: any) => differenceChartSettings.mark(d.data)
    });

}

