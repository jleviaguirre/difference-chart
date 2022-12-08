import * as d3 from "d3";
import { Axis, DataView, DataViewHierarchyNode, DataViewRow, Mod, ModProperty, Size } from "spotfire-api";
import { generalErrorHandler } from "./generalErrorHandler";
import { interactionLock } from "./interactionLock";
import { renderChart, DifferenceChartNode, DifferenceChartSettings } from "./differenceChart";

const xAxisName = "X";
const colorAxisName = "Color";
const y1AxisName = "Y1";
const y2AxisName = "Y2";

enum InteractionMode {
    drilldown = "drilldown",
    mark = "mark"
}

window.Spotfire.initialize(async (mod) => {
    const context = mod.getRenderContext();

    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize(),
        mod.visualization.axis(xAxisName),
        mod.visualization.axis(colorAxisName),
        mod.visualization.axis(y1AxisName),
        mod.property<string>("labels"),
        mod.property<boolean>("showNullValues"),
        mod.property<string>("interactionMode"),
        mod.property<string>("rootNode"),
        mod.property<boolean>("sortByValue")
    );

    let interaction = interactionLock();
    reader.subscribe(generalErrorHandler(mod, 10000, interaction)(onChange));

    let totalSize = 0;

    function findNode(jsonPath: string | null, rootNode: DataViewHierarchyNode | null) {
        if (jsonPath == null || rootNode == null) {
            return undefined;
        }
        let path = jsonToPath(jsonPath);
        let node: DataViewHierarchyNode | undefined = rootNode;
        if (path.length == 0) {
            return undefined;
        }

        path.forEach((key) => {
            node = node?.children?.find((c) => c.key == key);
        });
        return node;
    }

    async function onChange(
        dataView: DataView,
        windowSize: Size,
        hierarchyAxis: Axis,
        colorAxis: Axis,
        sizeAxis: Axis,
        labels: ModProperty<string>,
        showNullValues: ModProperty<boolean>,
        interactionMode: ModProperty<string>,
        rootNodePath: ModProperty<string>,
        sortByValue: ModProperty<boolean>
    ) {
        const hasHierarchyExpression = !!hierarchyAxis.parts.length;
        const hasColorHierarchy = !!colorAxis.parts.length && colorAxis.isCategorical;

        const settings: DifferenceChartSettings = {
            containerSelector: "#mod-container",
            size: windowSize,
            clearMarking: () => {
                if (currentInteractionMode() == InteractionMode.drilldown) {
                    var currentPath = rootNodePath.value();
                    if (currentPath) {
                        let json = JSON.parse(currentPath) as { path: (string | null)[] };
                        json.path.pop();
                        rootNodePath.set(JSON.stringify(json));
                    }
                } else dataView.clearMarking();
            },
            mark(node: DifferenceChartNode) {
                if (d3.event.ctrlKey) {
                    node.mark("ToggleOrAdd");
                } else {
                    node.mark();
                }
            },
            click(node: DifferenceChartNode) {
                if (currentInteractionMode() == InteractionMode.drilldown) {
                    if (node.children && node.children.length) {
                        rootNodePath.set(JSON.stringify({ path: getPathToNode(node) }));
                    }
                } else {
                    if (d3.event.ctrlKey) {
                        node.mark("ToggleOrAdd");
                    } else {
                        node.mark();
                    }
                }
            },
            getId(node: DifferenceChartNode) {
                function hash(s: string) {
                    return s.split("").reduce(function (a, b) {
                        a = (a << 5) - a + b.charCodeAt(0);
                        return a & a;
                    }, 0);
                }
                return hash(pathToJson(getPathToNode(node))).toString();
            },
            getLabel(node: DifferenceChartNode, availablePixels: number) {
                if (labels.value() == "off") {
                    return "";
                }

                if (labels.value() == "marked" && node.markedRowCount() == 0) {
                    return "";
                }
                const fontSize = context.styling.general.font.fontSize;
                const fontWidth = fontSize * 0.7;

                let label = node.formattedValue();
                if (label.length > availablePixels / fontWidth) {
                    return label.slice(0, Math.max(1, availablePixels / fontWidth - 2)) + "…";
                }

                return label;
            },
            style: {
                marking: { color: context.styling.scales.font.color },
                background: { color: context.styling.general.backgroundColor },
                label: {
                    fontFamily: context.styling.general.font.fontFamily,
                    color: context.styling.general.font.color,
                    size: parseInt("" + context.styling.general.font.fontSize),
                    style: context.styling.general.font.fontStyle,
                    weight: context.styling.general.font.fontWeight
                }
            },
            onMouseover(node: DifferenceChartNode) {
                mod.controls.tooltip.show(node.formattedPath());
            },
            onMouseLeave: mod.controls.tooltip.hide,
            spotfireDataView: dataView
        };

          
        let spotfireData: {}[] = [];
        
        //gets all dataView rows and parses to populates SpotfireData
        const rows = await dataView.allRows();
        rows.map(r=>{

             //parse dates
             let aDate = r.categorical("X").value()[0].value();

            let dataPoint:any = { 
            //create JSON structure
                date:aDate,
                Y1: r.continuous("Y1").value()??0,
                Y2: r.continuous("Y2").value()??0,
                row: r
            }

            //add structure to array
            spotfireData.push(dataPoint);
        })

        console.log(spotfireData);

        renderChart(spotfireData, settings);  
        context.signalRenderComplete();



        function currentInteractionMode(): InteractionMode {
            if (interactionMode.value() == InteractionMode.drilldown) {
                return d3.event.altKey ? InteractionMode.mark : InteractionMode.drilldown;
            }
            return d3.event.altKey ? InteractionMode.drilldown : InteractionMode.mark;
        }


    }
});


function jsonToPath(str: string): (string | null)[] {
    let json = JSON.parse(str) as { path: (string | null)[] };
    return json.path || [];
}

function pathToJson(path: (string | null)[]): string {
    return JSON.stringify({ path });
}

function getPathToNode(d: DifferenceChartNode): (string | null)[] {
    let path = [d.key];
    let node = d.parent as DifferenceChartNode | undefined;
    while (node && node.level >= 0) {
        path.push(node.key);
        node = node.parent;
    }
    return path.reverse();
}



