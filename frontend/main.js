
"use strict";

/* =========================================================
   ALGOSCOPE — FRONTEND / FASTAPI INTEGRATION
   Backend: http://127.0.0.1:8000
   Endpoint: POST /api/simulate
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000";

/* =========================================================
   1. COMMON HELPERS
========================================================= */

async function simulateAlgorithm(payload) {
    const response = await fetch(`${API_BASE_URL}/api/simulate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `The backend returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok) {
        const detail = data?.detail;

        throw new Error(
            typeof detail === "string"
                ? detail
                : JSON.stringify(
                    detail || `Request failed (${response.status}).`
                )
        );
    }

    return data;
}

function setText(element, value) {
    if (element) {
        element.textContent = String(value ?? "");
    }
}

function getSteps(data) {
    if (Array.isArray(data?.steps)) return data.steps;
    if (Array.isArray(data?.simulation_steps)) return data.simulation_steps;
    if (Array.isArray(data?.output?.steps)) return data.output.steps;

    return [];
}

function getResult(data) {
    if (data?.result && typeof data.result === "object") {
        return data.result;
    }

    if (data?.output && typeof data.output === "object") {
        return data.output;
    }

    return data || {};
}

function getArrayResult(data) {
    const result = getResult(data);

    const candidates = [
        result.sorted_array,
        result.sortedArray,
        result.array_values,
        result.sorted,
        result.result,
        result.array
    ];

    return candidates.find(Array.isArray) || null;
}

function parseIntegers(raw, min = 2, max = 20) {
    const parts = String(raw ?? "")
        .split(",")
        .map(value => value.trim());

    if (
        parts.length < min ||
        parts.length > max ||
        parts.some(value => !/^[-+]?\d+$/.test(value))
    ) {
        throw new Error(
            `Enter ${min}–${max} integers separated by commas.`
        );
    }

    const values = parts.map(Number);

    if (values.some(value => !Number.isSafeInteger(value))) {
        throw new Error("Every value must be a safe integer.");
    }

    return values;
}

function parseNames(raw) {
    const names = String(raw ?? "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    if (names.length < 2) {
        throw new Error("Enter at least two names separated by commas.");
    }

    if (new Set(names).size !== names.length) {
        throw new Error("Node or city names must be unique.");
    }

    return names;
}

function parseEdges(raw, names, weightLabel = "weight") {
    const lines = String(raw ?? "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        throw new Error("Enter at least one connection.");
    }

    return lines.map((line, index) => {
        const parts = line.split(",").map(part => part.trim());

        if (parts.length !== 3) {
            throw new Error(
                `Line ${index + 1}: use NameA, NameB, ${weightLabel}.`
            );
        }

        const [from, to, rawWeight] = parts;
        const weight = Number(rawWeight);

        if (!names.includes(from) || !names.includes(to)) {
            throw new Error(
                `Line ${index + 1}: both names must exist in the name list.`
            );
        }

        if (from === to) {
            throw new Error(
                `Line ${index + 1}: a connection must use two different nodes.`
            );
        }

        if (!Number.isFinite(weight) || weight < 0) {
            throw new Error(
                `Line ${index + 1}: ${weightLabel} must be a non-negative number.`
            );
        }

        return { from, to, weight };
    });
}

function getStepMessage(step, index) {
    if (typeof step === "string") return step;

    if (!step || typeof step !== "object") {
        return `Simulation step ${index + 1}`;
    }

    return (
        step.message ??
        step.text ??
        step.description ??
        step.explanation ??
        step.action ??
        step.operation ??
        step.type ??
        `Simulation step ${index + 1}`
    );
}

function showApiError(statusElement, error, label) {
    console.error(`${label} API error:`, error);

    setText(statusElement, `API error: ${error.message}`);
}

/* =========================================================
   2. REUSABLE STEP PLAYER
========================================================= */

function createPlayer(section, selectors, onRender) {
    if (!section) return null;

    const button = section.querySelector(selectors.button);
    const progress = section.querySelector(selectors.progress);
    const counter = section.querySelector(selectors.counter);
    const stepLabel = section.querySelector(selectors.stepLabel);
    const message = section.querySelector(selectors.message);

    let steps = [];
    let currentIndex = 0;
    let timer = null;

    function stop() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }

        if (button) {
            button.textContent = "▶";
        }
    }

    function render(index) {
        if (!steps.length) return;

        currentIndex = Math.max(
            0,
            Math.min(Number(index) || 0, steps.length - 1)
        );

        const step = steps[currentIndex];

        if (progress) {
            progress.min = "0";
            progress.max = String(steps.length - 1);
            progress.value = String(currentIndex);
        }

        setText(counter, `${currentIndex + 1} / ${steps.length}`);

        setText(
            stepLabel,
            String(currentIndex + 1).padStart(2, "0")
        );

        setText(message, getStepMessage(step, currentIndex));

        if (typeof onRender === "function") {
            onRender(step, currentIndex, steps);
        }
    }

    function load(newSteps) {
        stop();

        steps = Array.isArray(newSteps) ? newSteps : [];
        currentIndex = 0;

        if (!steps.length) {
            setText(
                message,
                "No animation steps were returned by the backend."
            );

            setText(counter, "0 / 0");

            if (progress) {
                progress.min = "0";
                progress.max = "0";
                progress.value = "0";
            }

            return;
        }

        render(0);
    }

    button?.addEventListener("click", () => {
        if (timer !== null) {
            stop();
            return;
        }

        if (!steps.length) {
            setText(message, "Run the algorithm first.");
            return;
        }

        if (currentIndex >= steps.length - 1) {
            render(0);
        }

        button.textContent = "⏸";

        timer = setInterval(() => {
            if (currentIndex >= steps.length - 1) {
                stop();
                return;
            }

            render(currentIndex + 1);

            if (currentIndex >= steps.length - 1) {
                stop();
            }
        }, 1100);
    });

    progress?.addEventListener("input", () => {
        stop();
        render(Number(progress.value));
    });

    return {
        load,
        render,
        stop,
        getSteps: () => steps
    };
}

/* =========================================================
   3. ALGORITHM CARDS
========================================================= */

document.querySelectorAll(".algorithm-card").forEach((card, index) => {
    card.querySelector(".arrow-button")?.addEventListener("click", () => {
        document.querySelectorAll(".algorithm-card").forEach(item => {
            item.classList.remove("active");
        });

        card.classList.add("active");

        const targets = [
            "#visualizer",
            "#tspVisualizer",
            "#dijkstraVisualizer"
        ];

        document.querySelector(targets[index])?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
});

/* =========================================================
   4. MERGE SORT — DYNAMIC BACKEND-DRIVEN TREE
========================================================= */

function buildMergeTree(container, values) {
    if (!container) return [];

    container.replaceChildren();

    const nodes = [];
    const maxDepth = Math.ceil(Math.log2(values.length)) + 1;

    const levels = Array.from(
        { length: maxDepth + 1 },
        (_, depth) => {
            const level = document.createElement("div");
            level.className = "level";
            level.id = `level${depth}`;

            container.appendChild(level);

            return level;
        }
    );

    function split(start, end, depth) {
        const node = {
            start,
            end,
            depth,
            element: null
        };

        nodes.push(node);

        if (depth >= levels.length) return;

        const arrayElement = document.createElement("div");
        arrayElement.className = depth === 0
            ? "arr"
            : "arr small";

        arrayElement.dataset.start = String(start);
        arrayElement.dataset.end = String(end);

        levels[depth].appendChild(arrayElement);
        node.element = arrayElement;

        if (start < end) {
            const mid = Math.floor((start + end) / 2);

            split(start, mid, depth + 1);
            split(mid + 1, end, depth + 1);
        }
    }

    split(0, values.length - 1, 0);

    return nodes;
}

function getActiveMergeRange(steps, index) {
    for (let i = index; i >= 0; i--) {
        const step = steps[i];

        if (
            step &&
            Number.isInteger(step.start) &&
            Number.isInteger(step.end) &&
            (
                step.type === "split" ||
                step.type === "merge_start" ||
                step.type === "merge_complete" ||
                step.type === "base_case"
            )
        ) {
            return {
                start: step.start,
                end: step.end
            };
        }
    }

    return null;
}

function renderMergeTreeStep(
    nodes,
    step,
    index,
    steps,
    initialValues,
    sortedArray
) {
    const snapshot = Array.isArray(step?.array)
        ? step.array
        : initialValues;

    const range = getActiveMergeRange(steps, index);
    const type = String(step?.type ?? "").toLowerCase();

    const completedRanges = new Set();

    for (let i = 0; i <= index; i++) {
        const previousStep = steps[i];

        if (
            previousStep?.type === "merge_complete" ||
            previousStep?.type === "base_case"
        ) {
            if (
                Number.isInteger(previousStep.start) &&
                Number.isInteger(previousStep.end)
            ) {
                completedRanges.add(
                    `${previousStep.start}-${previousStep.end}`
                );
            }
        }
    }

    nodes.forEach(node => {
        const element = node.element;

        if (!element) return;

        element.replaceChildren();

        const segmentValues = snapshot.slice(
            node.start,
            node.end + 1
        );

        segmentValues.forEach(value => {
            const span = document.createElement("span");
            span.textContent = String(value);
            element.appendChild(span);
        });

        const isActive = range &&
            node.start === range.start &&
            node.end === range.end;

        const isCompleted = completedRanges.has(
            `${node.start}-${node.end}`
        );

        element.classList.toggle("active", Boolean(isActive));
        element.classList.toggle(
            "sorted",
            Boolean(isCompleted) ||
            type === "complete" && node.depth === 0
        );

        element.style.opacity =
            isActive || node.depth === 0 ? "1" : "0.85";

        element.style.transform = isActive
            ? "scale(1.04)"
            : "scale(1)";

        element.style.transition =
            "opacity 0.25s ease, transform 0.25s ease";
    });

    if (
        type === "complete" &&
        Array.isArray(sortedArray) &&
        nodes.length
    ) {
        const root = nodes.find(
            node => node.start === 0 &&
                node.end === initialValues.length - 1
        );

        if (root?.element) {
            root.element.replaceChildren();

            sortedArray.forEach(value => {
                const span = document.createElement("span");
                span.textContent = String(value);
                root.element.appendChild(span);
            });
        }
    }
}

(() => {
    const section = document.querySelector("#visualizer");

    if (!section) return;

    const input = section.querySelector("#mergeArrayInput");
    const runButton = section.querySelector("#runMergeBtn");
    const status = section.querySelector("#mergeStatus");
    const tree = section.querySelector("#tree");

    let treeNodes = [];
    let originalValues = [];
    let backendSortedArray = null;

    const player = createPlayer(
        section,
        {
            button: "#playBtn",
            progress: "#progress",
            counter: "#counter",
            stepLabel: "#stepLabel",
            message: "#msgText"
        },
        (step, index, steps) => {
            renderMergeTreeStep(
                treeNodes,
                step,
                index,
                steps,
                originalValues,
                backendSortedArray
            );
        }
    );

    runButton?.addEventListener("click", async () => {
        let arrayValues;

        try {
            arrayValues = parseIntegers(input?.value);
        } catch (error) {
            setText(status, error.message);
            return;
        }

        runButton.disabled = true;
        setText(status, "Running Merge Sort on the backend…");

        try {
            const data = await simulateAlgorithm({
                algorithm: "merge_sort",
                input: {
                    array_values: arrayValues
                }
            });

            if (data?.status && data.status !== "success") {
                throw new Error(
                    data.message || `Algorithm status: ${data.status}`
                );
            }

            const steps = getSteps(data);
            const sortedArray = getArrayResult(data);

            if (!steps.length) {
                throw new Error(
                    "The backend did not return any simulation steps."
                );
            }

            originalValues = [...arrayValues];
            backendSortedArray = sortedArray;

            treeNodes = buildMergeTree(tree, originalValues);

            player.load(steps);

            if (sortedArray) {
                section.dataset.sortedArray =
                    JSON.stringify(sortedArray);
            }

            setText(
                status,
                sortedArray
                    ? `Backend connected · ${steps.length} steps · Sorted: ${sortedArray.join(", ")}`
                    : `Backend connected · ${steps.length} steps returned`
            );

        } catch (error) {
            showApiError(status, error, "Merge Sort");
        } finally {
            runButton.disabled = false;
        }
    });
})();

/* =========================================================
   5. TRAVELING SALESPERSON PROBLEM
========================================================= */

(() => {
    const section = document.querySelector("#tspVisualizer");

    if (!section) return;

    const cityInput = section.querySelector("#tspCitiesInput");
    const startInput = section.querySelector("#tspStartInput");
    const edgesInput = section.querySelector("#tspEdgesInput");
    const runButton = section.querySelector("#runTspBtn");
    const status = section.querySelector("#tspStatus");

    const tourTitle = section.querySelector("#tspTourTitle");
    const tourBadge = section.querySelector("#tourBadge");
    const stateBoxes = section.querySelector("#stateBoxes");
    const dpTable = section.querySelector("#dpTable");
    const maskText = section.querySelector("#maskText");
    const costText = section.querySelector("#costText");
    const totalSteps = section.querySelector("#totalSteps");

    function updateTspStep(step, index, steps) {
        const city = step?.city ?? step?.current_city;

        section.querySelectorAll(".node").forEach(node => {
            node.classList.remove("active");
        });

        if (city) {
            section.querySelector(
                `#node-${CSS.escape(String(city))}`
            )?.classList.add("active");
        }

        const visitedMask =
            step?.visited_mask ?? step?.current_mask ?? step?.mask;

        if (visitedMask !== undefined) {
            const mask = Number(visitedMask);

            setText(
                maskText,
                `${mask.toString(2).padStart(4, "0")} (${mask})`
            );
        }

        const currentCost =
            step?.cost ?? step?.current_cost ?? step?.candidate_cost;

        if (currentCost !== undefined) {
            setText(costText, currentCost);
        }

        if (stateBoxes && visitedMask !== undefined) {
            stateBoxes.replaceChildren();

            const chip = document.createElement("span");
            chip.className = "badge bg-secondary";
            chip.textContent = `Mask: ${visitedMask}`;

            stateBoxes.appendChild(chip);
        }

        if (
            dpTable &&
            (
                visitedMask !== undefined ||
                city !== undefined ||
                currentCost !== undefined
            )
        ) {
            const row = document.createElement("tr");

            [
                visitedMask,
                city,
                currentCost,
                step?.predecessor ?? step?.previous_city ??
                    step?.prev_city
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value == null ? "—" : String(value);
                row.appendChild(cell);
            });

            dpTable.appendChild(row);

            while (dpTable.children.length > 8) {
                dpTable.firstElementChild.remove();
            }
        }

        const result = section._tspResult || {};
        const isFinal = index === steps.length - 1;

        const tour =
            step?.tour ??
            step?.optimal_tour ??
            result.tour ??
            result.optimal_tour;

        const minimumCost =
            result.minimum_cost ??
            result.min_cost ??
            result.cost ??
            result.total_cost;

        if (isFinal && Array.isArray(tour) && tour.length > 1) {
            setText(
                tourTitle,
                `• Tour: ${tour.join(" → ")} · Cost: ${minimumCost ?? "—"}`
            );

            if (tourBadge) {
                setText(
                    tourBadge,
                    `Optimal Tour: ${tour.join(" → ")} • Cost: ${minimumCost ?? "—"}`
                );

                tourBadge.classList.remove("d-none");
            }
        } else {
            tourBadge?.classList.add("d-none");
        }
    }

    const player = createPlayer(
        section,
        {
            button: "#tspPlayBtn",
            progress: "#tspProgress",
            counter: "#tspCounter",
            stepLabel: "#tspStepLabel",
            message: "#tspMsgText"
        },
        updateTspStep
    );

    runButton?.addEventListener("click", async () => {
        let cityNames;
        let startCity;
        let edges;

        try {
            cityNames = parseNames(cityInput?.value);
            startCity = String(startInput?.value ?? "").trim();

            if (!cityNames.includes(startCity)) {
                throw new Error(
                    "The starting city must appear in the city names."
                );
            }

            edges = parseEdges(
                edgesInput?.value,
                cityNames,
                "cost"
            ).map(edge => ({
                from_city: edge.from,
                to_city: edge.to,
                cost: edge.weight
            }));

        } catch (error) {
            setText(status, error.message);
            return;
        }

        runButton.disabled = true;
        setText(status, "Calculating the tour on the backend…");

        try {
            const data = await simulateAlgorithm({
                algorithm: "tsp_dp",
                input: {
                    city_names: cityNames,
                    start_city: startCity,
                    edges
                }
            });

            const result = getResult(data);
            const steps = getSteps(data);

            if (!steps.length) {
                throw new Error(
                    "The backend did not return any TSP steps."
                );
            }

            section._tspResult = result;

            setText(totalSteps, steps.length);

            if (dpTable) dpTable.replaceChildren();
            if (stateBoxes) stateBoxes.replaceChildren();

            setText(maskText, "—");
            setText(costText, "—");

            tourBadge?.classList.add("d-none");

            player.load(steps);

            setText(
                status,
                `Simulation complete · ${steps.length} steps returned`
            );

            const tour = result.tour ?? result.optimal_tour;

            const minimumCost =
                result.minimum_cost ??
                result.min_cost ??
                result.cost ??
                result.total_cost;

            if (Array.isArray(tour) && tourTitle) {
                setText(
                    tourTitle,
                    `• Tour: ${tour.join(" → ")} · Cost: ${minimumCost ?? "—"}`
                );
            }

        } catch (error) {
            showApiError(status, error, "TSP");
        } finally {
            runButton.disabled = false;
        }
    });
})();

/* =========================================================
   6. DIJKSTRA'S ALGORITHM — GRAPH VISUALIZATION
========================================================= */

(() => {
    const section = document.querySelector("#dijkstraVisualizer");

    if (!section) return;

    const nodesInput = section.querySelector("#dijkstraNodesInput");
    const sourceInput = section.querySelector("#dijkstraSourceInput");
    const destinationInput =
        section.querySelector("#dijkstraDestinationInput");
    const edgesInput = section.querySelector("#dijkstraEdgesInput");

    const runButton = section.querySelector("#runDijkstraBtn");
    const status = section.querySelector("#dijkstraStatus");
    const resultBox = section.querySelector("#dijkstraResult");

    const SVG_NS = "http://www.w3.org/2000/svg";

    const graphState = {
        nodes: [],
        edges: [],
        positions: new Map(),
        source: null,
        destination: null,
        finalPath: [],
        finalDistances: {},
        finalPredecessors: {}
    };

    /*
     * Build the visualization inside the existing Dijkstra section.
     * No HTML or CSS file changes are required.
     */

    function createVisualization() {
        let panel = section.querySelector("#dijkstraGraphPanel");

        if (panel) return panel;

        panel = document.createElement("div");
        panel.id = "dijkstraGraphPanel";

        panel.style.cssText = [
            "display:grid",
            "grid-template-columns:minmax(0,1.6fr) minmax(240px,1fr)",
            "gap:16px",
            "margin-top:20px",
            "align-items:stretch"
        ].join(";");

        const graphCard = document.createElement("div");
        graphCard.style.cssText = [
            "min-width:0",
            "background:#1e2027",
            "border:1px solid #333",
            "padding:12px"
        ].join(";");

        const graphHeading = document.createElement("div");
        graphHeading.textContent = "GRAPH EXPLORER";
        graphHeading.style.cssText = [
            "font-family:'Space Mono',monospace",
            "font-size:11px",
            "letter-spacing:2px",
            "color:#9a9b9e",
            "margin-bottom:8px"
        ].join(";");

        const svg = document.createElementNS(SVG_NS, "svg");
        svg.id = "dijkstraGraphSvg";
        svg.setAttribute("viewBox", "0 0 700 430");
        svg.setAttribute("role", "img");
        svg.setAttribute(
            "aria-label",
            "Animated weighted graph for Dijkstra's shortest path"
        );
        svg.style.cssText = [
            "display:block",
            "width:100%",
            "height:auto",
            "min-height:250px",
            "overflow:visible"
        ].join(";");

        const legend = document.createElement("div");
        legend.style.cssText = [
            "display:flex",
            "gap:14px",
            "flex-wrap:wrap",
            "font-size:12px",
            "color:#ccc",
            "padding:10px 2px 2px"
        ].join(";");

        [
            ["#00a8ff", "Current node"],
            ["#a5b36a", "Source"],
            ["#c97968", "Shortest path"],
            ["#555", "Unvisited"]
        ].forEach(([color, label]) => {
            const item = document.createElement("span");
            item.style.cssText =
                "display:inline-flex;align-items:center;gap:6px;";

            const dot = document.createElement("span");
            dot.style.cssText = [
                "display:inline-block",
                "width:9px",
                "height:9px",
                "border-radius:50%",
                `background:${color}`
            ].join(";");

            const text = document.createElement("span");
            text.textContent = label;

            item.append(dot, text);
            legend.appendChild(item);
        });

        graphCard.append(graphHeading, svg, legend);

        const tableCard = document.createElement("div");
        tableCard.style.cssText = [
            "min-width:0",
            "background:#1e2027",
            "border:1px solid #333",
            "padding:18px",
            "overflow-x:auto"
        ].join(";");

        const tableHeading = document.createElement("div");
        tableHeading.textContent = "SHORTEST DISTANCES";
        tableHeading.style.cssText = [
            "font-family:'Space Mono',monospace",
            "font-size:11px",
            "letter-spacing:1.5px",
            "color:#9a9b9e",
            "margin-bottom:14px"
        ].join(";");

        const table = document.createElement("table");
        table.id = "dijkstraDistanceTable";
        table.style.cssText = [
            "width:100%",
            "border-collapse:collapse",
            "font-size:13px",
            "color:#fff"
        ].join(";");

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        ["Node", "Distance", "Previous"].forEach(label => {
            const th = document.createElement("th");
            th.textContent = label;
            th.style.cssText = [
                "padding:10px 5px",
                "text-align:left",
                "color:#9a9b9e",
                "border-bottom:1px solid #444",
                "font-weight:500"
            ].join(";");

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        const tbody = document.createElement("tbody");
        tbody.id = "dijkstraDistanceRows";

        table.append(thead, tbody);

        const summary = document.createElement("div");
        summary.id = "dijkstraStepSummary";
        summary.style.cssText = [
            "margin-top:18px",
            "padding:12px",
            "background:#2a2d36",
            "font-size:13px",
            "line-height:1.6",
            "color:#ddd"
        ].join(";");

        summary.textContent =
            "Run the algorithm to see distances update at every step.";

        tableCard.append(table, summary);
        panel.append(graphCard, tableCard);

        const firstMessage = section.querySelector(".msg-box");

        if (firstMessage) {
            section.insertBefore(panel, firstMessage);
        } else {
            section.appendChild(panel);
        }

        const responsiveStyle = document.createElement("style");
        responsiveStyle.id = "dijkstraVisualizationResponsive";
        responsiveStyle.textContent = `
            @media (max-width: 760px) {
                #dijkstraGraphPanel {
                    grid-template-columns: minmax(0, 1fr) !important;
                }

                #dijkstraGraphSvg {
                    min-height: 200px !important;
                }
            }

            #dijkstraDistanceTable tbody tr {
                transition: background 0.2s ease;
            }

            #dijkstraDistanceTable tbody tr.current {
                background: rgba(0, 168, 255, 0.16);
            }

            #dijkstraDistanceTable tbody tr.path-node {
                background: rgba(201, 121, 104, 0.13);
            }

            #dijkstraDistanceTable td {
                padding: 11px 5px;
                border-bottom: 1px solid #333;
                overflow-wrap: anywhere;
            }

            #dijkstraGraphSvg .dijkstra-edge {
                stroke: #555;
                stroke-width: 2.5;
                transition: stroke 0.2s ease, stroke-width 0.2s ease;
            }

            #dijkstraGraphSvg .dijkstra-edge.active {
                stroke: #00a8ff;
                stroke-width: 4;
            }

            #dijkstraGraphSvg .dijkstra-edge.relaxed {
                stroke: #a5b36a;
                stroke-width: 4;
            }

            #dijkstraGraphSvg .dijkstra-edge.final {
                stroke: #c97968;
                stroke-width: 5;
            }

            #dijkstraGraphSvg .dijkstra-node circle {
                fill: #2a2d36;
                stroke: #666;
                stroke-width: 2.5;
                transition: fill 0.2s ease, stroke 0.2s ease;
            }

            #dijkstraGraphSvg .dijkstra-node text {
                fill: #fff;
                text-anchor: middle;
                dominant-baseline: middle;
                font-size: 17px;
                font-weight: 600;
                pointer-events: none;
            }

            #dijkstraGraphSvg .dijkstra-node.active circle {
                fill: #00a8ff;
                stroke: #fff;
            }

            #dijkstraGraphSvg .dijkstra-node.visited circle {
                fill: #333;
                stroke: #a5b36a;
            }

            #dijkstraGraphSvg .dijkstra-node.source circle {
                fill: #a5b36a;
                stroke: #fff;
            }

            #dijkstraGraphSvg .dijkstra-node.destination circle {
                stroke: #c97968;
                stroke-width: 4;
            }

            #dijkstraGraphSvg .dijkstra-node.path-node circle {
                fill: #c97968;
                stroke: #fff;
            }

            #dijkstraGraphSvg .dijkstra-weight {
                fill: #fff;
                stroke: #1e2027;
                stroke-width: 5px;
                paint-order: stroke;
                text-anchor: middle;
                font-family: 'Space Mono', monospace;
                font-size: 13px;
            }

            #dijkstraGraphSvg .dijkstra-distance {
                fill: #c9cbd1;
                text-anchor: middle;
                font-size: 11px;
                font-family: 'Space Mono', monospace;
            }
        `;

        if (!document.querySelector("#dijkstraVisualizationResponsive")) {
            document.head.appendChild(responsiveStyle);
        }

        return panel;
    }

    function svgElement(name, attributes = {}) {
        const element = document.createElementNS(SVG_NS, name);

        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, String(value));
        });

        return element;
    }

    function edgeKey(from, to) {
        const a = String(from);
        const b = String(to);

        return a < b ? `${a}::${b}` : `${b}::${a}`;
    }

    function calculateNodePositions(nodeNames) {
        const positions = new Map();

        const width = 700;
        const height = 430;
        const centerX = width / 2;
        const centerY = height / 2;

        const radiusX = nodeNames.length <= 3 ? 145 : 255;
        const radiusY = nodeNames.length <= 3 ? 120 : 155;

        nodeNames.forEach((name, index) => {
            const angle =
                -Math.PI / 2 +
                (2 * Math.PI * index) / nodeNames.length;

            positions.set(name, {
                x: centerX + radiusX * Math.cos(angle),
                y: centerY + radiusY * Math.sin(angle)
            });
        });

        return positions;
    }

    function buildDijkstraGraph(nodeNames, edges) {
        createVisualization();

        const svg = section.querySelector("#dijkstraGraphSvg");
        if (!svg) return;

        svg.replaceChildren();

        graphState.nodes = [...nodeNames];
        graphState.edges = [...edges];
        graphState.positions = calculateNodePositions(nodeNames);

        const defs = svgElement("defs");

        const marker = svgElement("marker", {
            id: "dijkstraArrow",
            markerWidth: 7,
            markerHeight: 7,
            refX: 5,
            refY: 3,
            orient: "auto",
            markerUnits: "strokeWidth"
        });

        marker.appendChild(svgElement("path", {
            d: "M0,0 L6,3 L0,6 Z",
            fill: "#777"
        }));

        defs.appendChild(marker);
        svg.appendChild(defs);

        /*
         * Draw edges before nodes so that the node circles sit above
         * the connection lines.
         */

        const edgeLayer = svgElement("g", {
            class: "dijkstra-edge-layer"
        });

        edges.forEach((edge, index) => {
            const fromPosition = graphState.positions.get(edge.from);
            const toPosition = graphState.positions.get(edge.to);

            if (!fromPosition || !toPosition) return;

            const line = svgElement("line", {
                x1: fromPosition.x,
                y1: fromPosition.y,
                x2: toPosition.x,
                y2: toPosition.y,
                class: "dijkstra-edge",
                "data-edge-key": edgeKey(edge.from, edge.to),
                "data-edge-index": index
            });

            const midpointX = (fromPosition.x + toPosition.x) / 2;
            const midpointY = (fromPosition.y + toPosition.y) / 2;

            const dx = toPosition.x - fromPosition.x;
            const dy = toPosition.y - fromPosition.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;

            const offsetX = (dy / length) * 13;
            const offsetY = (-dx / length) * 13;

            const weight = svgElement("text", {
                x: midpointX + offsetX,
                y: midpointY + offsetY,
                class: "dijkstra-weight"
            });

            weight.textContent = String(edge.weight);

            edgeLayer.append(line, weight);
        });

        svg.appendChild(edgeLayer);

        const nodeLayer = svgElement("g", {
            class: "dijkstra-node-layer"
        });

        nodeNames.forEach(name => {
            const position = graphState.positions.get(name);

            const group = svgElement("g", {
                class: "dijkstra-node",
                "data-node": name,
                transform: `translate(${position.x}, ${position.y})`
            });

            const circle = svgElement("circle", {
                r: 28
            });

            const label = svgElement("text", {
                x: 0,
                y: 0
            });

            label.textContent = name;

            const distanceLabel = svgElement("text", {
                x: 0,
                y: 44,
                class: "dijkstra-distance",
                "data-distance-node": name
            });

            distanceLabel.textContent = "∞";

            group.append(circle, label, distanceLabel);
            nodeLayer.appendChild(group);
        });

        svg.appendChild(nodeLayer);

        renderDistanceRows(nodeNames, {}, {});
    }

    function renderDistanceRows(nodeNames, distances, predecessors, activeNode, path) {
        const tbody = section.querySelector("#dijkstraDistanceRows");

        if (!tbody) return;

        tbody.replaceChildren();

        nodeNames.forEach(name => {
            const row = document.createElement("tr");

            if (name === activeNode) {
                row.classList.add("current");
            }

            if (Array.isArray(path) && path.includes(name)) {
                row.classList.add("path-node");
            }

            const distance = readNodeValue(distances, name);
            const predecessor = readNodeValue(predecessors, name);

            const distanceText = distance === undefined ||
                distance === null ||
                distance === Infinity
                ? "∞"
                : String(distance);

            const predecessorText =
                predecessor === undefined ||
                predecessor === null ||
                predecessor === ""
                    ? "—"
                    : String(predecessor);

            [name, distanceText, predecessorText].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        nodeNames.forEach(name => {
            const label = section.querySelector(
                `[data-distance-node="${CSS.escape(name)}"]`
            );

            if (!label) return;

            const distance = readNodeValue(distances, name);

            label.textContent =
                distance === undefined ||
                distance === null ||
                distance === Infinity
                    ? "∞"
                    : `d=${distance}`;
        });
    }

    function readNodeValue(object, nodeName) {
        if (!object || typeof object !== "object") {
            return undefined;
        }

        if (Object.prototype.hasOwnProperty.call(object, nodeName)) {
            return object[nodeName];
        }

        const entry = Array.isArray(object)
            ? object.find(item => {
                if (!item || typeof item !== "object") return false;

                return (
                    item.node === nodeName ||
                    item.name === nodeName ||
                    item.vertex === nodeName ||
                    item.to_node === nodeName
                );
            })
            : null;

        if (entry) {
            return (
                entry.distance ??
                entry.dist ??
                entry.value ??
                entry.predecessor ??
                entry.previous ??
                entry.prev
            );
        }

        return undefined;
    }

    function normalizeNodeList(value) {
        if (!Array.isArray(value)) return [];

        return value.map(item => {
            if (typeof item === "string" || typeof item === "number") {
                return String(item);
            }

            if (item && typeof item === "object") {
                return String(
                    item.node ??
                    item.name ??
                    item.vertex ??
                    item.current_node ??
                    ""
                );
            }

            return "";
        }).filter(Boolean);
    }

    function getStepNode(step) {
        if (!step || typeof step !== "object") return null;

        const value =
            step.current_node ??
            step.selected_node ??
            step.visited_node ??
            step.active_node ??
            step.processing_node ??
            step.node;

        if (value !== undefined && value !== null) {
            if (typeof value === "object") {
                return String(
                    value.node ??
                    value.name ??
                    value.id ??
                    ""
                ) || null;
            }

            return String(value);
        }

        return null;
    }

    function getStepDistances(step) {
        if (!step || typeof step !== "object") return {};

        return (
            step.distances ??
            step.distance_table ??
            step.current_distances ??
            step.shortest_distances ??
            step.distance ??
            {}
        );
    }

    function getStepPredecessors(step) {
        if (!step || typeof step !== "object") return {};

        return (
            step.predecessors ??
            step.previous_nodes ??
            step.previous ??
            step.parents ??
            step.parent ??
            {}
        );
    }

    function getStepVisited(step) {
        if (!step || typeof step !== "object") return [];

        return normalizeNodeList(
            step.visited_nodes ??
            step.visited ??
            step.processed_nodes ??
            step.settled_nodes ??
            step.completed_nodes
        );
    }

    function getStepEdge(step) {
        if (!step || typeof step !== "object") return null;

        const nestedEdge = step.edge ?? step.current_edge ?? step.relaxed_edge;

        if (nestedEdge && typeof nestedEdge === "object") {
            const from =
                nestedEdge.from_node ??
                nestedEdge.from ??
                nestedEdge.source;

            const to =
                nestedEdge.to_node ??
                nestedEdge.to ??
                nestedEdge.target;

            if (from != null && to != null) {
                return {
                    from: String(from),
                    to: String(to)
                };
            }
        }

        const from =
            step.from_node ??
            step.from ??
            step.source_node ??
            step.edge_from;

        const to =
            step.to_node ??
            step.to ??
            step.neighbor ??
            step.neighbour ??
            step.target_node ??
            step.edge_to;

        if (from != null && to != null) {
            return {
                from: String(from),
                to: String(to)
            };
        }

        return null;
    }

    function getPathFromResult(result) {
        if (!result || typeof result !== "object") return [];

        const candidates = [
            result.shortest_path,
            result.path,
            result.final_path,
            result.route
        ];

        const path = candidates.find(Array.isArray);

        return path
            ? path.map(item => {
                if (typeof item === "object" && item !== null) {
                    return String(
                        item.node ??
                        item.name ??
                        item.vertex ??
                        ""
                    );
                }

                return String(item);
            }).filter(Boolean)
            : [];
    }

    function getFinalDistances(result) {
        if (!result || typeof result !== "object") return {};

        return (
            result.distances ??
            result.shortest_distances ??
            result.distance_table ??
            result.distance ??
            {}
        );
    }

    function getFinalPredecessors(result) {
        if (!result || typeof result !== "object") return {};

        return (
            result.predecessors ??
            result.previous_nodes ??
            result.previous ??
            result.parents ??
            {}
        );
    }

    function getPathFromPredecessors(predecessors, source, destination) {
        if (!predecessors || typeof predecessors !== "object") {
            return [];
        }

        const path = [];
        const seen = new Set();
        let current = destination;

        while (current != null && current !== "") {
            if (seen.has(String(current))) return [];

            seen.add(String(current));
            path.unshift(String(current));

            if (String(current) === String(source)) {
                return path;
            }

            current = readNodeValue(predecessors, current);
        }

        return [];
    }

    function updateDijkstraStep(step, index, steps) {
        const currentNode = getStepNode(step);
        const distances = getStepDistances(step);
        const predecessors = getStepPredecessors(step);
        const visited = getStepVisited(step);
        const currentEdge = getStepEdge(step);

        const svg = section.querySelector("#dijkstraGraphSvg");
        const summary = section.querySelector("#dijkstraStepSummary");

        if (!svg) return;

        const result = section._dijkstraResult || {};

        const finalPath =
            graphState.finalPath.length
                ? graphState.finalPath
                : getPathFromResult(result);

        const isLastStep = index === steps.length - 1;

        svg.querySelectorAll(".dijkstra-node").forEach(node => {
            const name = node.dataset.node;

            node.classList.remove(
                "active",
                "visited",
                "source",
                "destination",
                "path-node"
            );

            if (visited.includes(name)) {
                node.classList.add("visited");
            }

            if (name === graphState.source) {
                node.classList.add("source");
            }

            if (name === graphState.destination) {
                node.classList.add("destination");
            }

            if (name === currentNode) {
                node.classList.add("active");
            }

            if (finalPath.includes(name) && isLastStep) {
                node.classList.add("path-node");
            }
        });

        svg.querySelectorAll(".dijkstra-edge").forEach(edge => {
            edge.classList.remove("active", "relaxed", "final");

            const key = edge.dataset.edgeKey;

            if (
                currentEdge &&
                key === edgeKey(currentEdge.from, currentEdge.to)
            ) {
                const type = String(step?.type ?? "").toLowerCase();

                edge.classList.add(
                    type.includes("relax") ||
                    type.includes("update") ||
                    type.includes("improv")
                        ? "relaxed"
                        : "active"
                );
            }

            if (isLastStep && finalPath.length > 1) {
                for (let i = 0; i < finalPath.length - 1; i++) {
                    if (
                        key === edgeKey(
                            finalPath[i],
                            finalPath[i + 1]
                        )
                    ) {
                        edge.classList.add("final");
                    }
                }
            }
        });

        const effectiveDistances =
            distances && typeof distances === "object" &&
            !Array.isArray(distances)
                ? distances
                : {};

        const effectivePredecessors =
            predecessors && typeof predecessors === "object" &&
            !Array.isArray(predecessors)
                ? predecessors
                : {};

        /*
         * Some backends only return the changed node and its distance
         * rather than a complete distance dictionary.
         */

        const nodeDistance =
            step?.current_distance ??
            step?.new_distance ??
            step?.tentative_distance;

        if (
            currentNode &&
            nodeDistance !== undefined &&
            !Object.prototype.hasOwnProperty.call(
                effectiveDistances,
                currentNode
            )
        ) {
            effectiveDistances[currentNode] = nodeDistance;
        }

        renderDistanceRows(
            graphState.nodes,
            effectiveDistances,
            effectivePredecessors,
            currentNode,
            isLastStep ? finalPath : []
        );

        if (summary) {
            const parts = [];

            if (currentNode) {
                parts.push(`Current node: ${currentNode}`);
            }

            if (currentEdge) {
                parts.push(
                    `Examining edge: ${currentEdge.from} → ${currentEdge.to}`
                );
            }

            if (nodeDistance !== undefined) {
                parts.push(`Distance: ${nodeDistance}`);
            }

            if (parts.length === 0) {
                parts.push(getStepMessage(step, index));
            }

            if (isLastStep && finalPath.length > 0) {
                parts.push(`Path: ${finalPath.join(" → ")}`);
            }

            summary.textContent = parts.join(" | ");
        }
    }

    const player = createPlayer(
        section,
        {
            button: "#dijkstraPlayBtn",
            progress: "#dijkstraProgress",
            counter: "#dijkstraCounter",
            stepLabel: "#dijkstraStepLabel",
            message: "#dijkstraMsgText"
        },
        updateDijkstraStep
    );

    runButton?.addEventListener("click", async () => {
        let nodeNames;
        let sourceNode;
        let destinationNode;
        let edges;

        try {
            nodeNames = parseNames(nodesInput?.value);

            sourceNode = String(sourceInput?.value ?? "").trim();
            destinationNode =
                String(destinationInput?.value ?? "").trim();

            if (!nodeNames.includes(sourceNode)) {
                throw new Error(
                    "The source node must be in the node names."
                );
            }

            if (!nodeNames.includes(destinationNode)) {
                throw new Error(
                    "The destination node must be in the node names."
                );
            }

            edges = parseEdges(
                edgesInput?.value,
                nodeNames,
                "weight"
            ).map(edge => ({
                from_node: edge.from,
                to_node: edge.to,
                weight: edge.weight
            }));

        } catch (error) {
            setText(status, error.message);
            return;
        }

        runButton.disabled = true;
        setText(status, "Finding the shortest path on the backend…");

        try {
            const data = await simulateAlgorithm({
                algorithm: "dijkstra",
                input: {
                    node_names: nodeNames,
                    edges,
                    source_node: sourceNode,
                    destination_node: destinationNode,
                    graph_type: "undirected"
                }
            });

            const result = getResult(data);
            const steps = getSteps(data);

            if (!steps.length) {
                throw new Error(
                    "The backend did not return any Dijkstra steps."
                );
            }

            graphState.source = sourceNode;
            graphState.destination = destinationNode;
            graphState.finalDistances = getFinalDistances(result);
            graphState.finalPredecessors = getFinalPredecessors(result);

            graphState.finalPath = getPathFromResult(result);

            if (!graphState.finalPath.length) {
                graphState.finalPath = getPathFromPredecessors(
                    graphState.finalPredecessors,
                    sourceNode,
                    destinationNode
                );
            }

            section._dijkstraResult = result;

            buildDijkstraGraph(nodeNames, edges);

            /*
             * Show the graph at the first step, then let the shared
             * player animate each backend step.
             */

            player.load(steps);

            /*
             * Display the backend result without assuming a specific
             * result schema.
             */

            if (resultBox) {
                resultBox.replaceChildren();

                const heading = document.createElement("strong");
                heading.textContent = "Shortest Path Result";

                const body = document.createElement("p");
                body.style.marginTop = "8px";

                const entries = Object.entries(result).filter(
                    ([key]) => ![
                        "steps",
                        "simulation_steps",
                        "status",
                        "algorithm",
                        "output"
                    ].includes(key)
                );

                body.textContent = entries.length
                    ? entries.map(([key, value]) => {
                        const formattedValue = Array.isArray(value)
                            ? value.join(" → ")
                            : value !== null &&
                                typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value);

                        return `${key.replaceAll("_", " ")}: ${formattedValue}`;
                    }).join(" | ")
                    : "The backend returned no additional result fields.";

                resultBox.append(heading, body);
            }

            setText(
                status,
                `Simulation complete · ${steps.length} steps returned`
            );

        } catch (error) {
            showApiError(status, error, "Dijkstra");
            setText(resultBox, error.message);
        } finally {
            runButton.disabled = false;
        }
    });
})();

/* =========================================================
   7. PRACTICE LAB
========================================================= */

(() => {
    const lab = document.querySelector(".practice-lab");

    if (!lab) return;

    const input = lab.querySelector("#practiceArrayInput");
    const sortButton = lab.querySelector(".sort-btn");
    const status = lab.querySelector(".preview-status");
    const itemCount = lab.querySelector(".item-count");
    const boxes = lab.querySelector(".array-boxes");

    function showArray(values) {
        if (!boxes) return;

        boxes.replaceChildren();

        values.forEach((value, index) => {
            const box = document.createElement("div");
            box.className = "array-box";

            const number = document.createElement("span");
            number.textContent = String(value);

            const position = document.createElement("small");
            position.textContent = String(index);

            box.append(number, position);
            boxes.appendChild(box);
        });

        setText(itemCount, `${values.length} ITEMS`);
    }

    input?.addEventListener("input", () => {
        try {
            const values = parseIntegers(input.value);

            showArray(values);
            setText(status, "Input preview updated");
        } catch {
            setText(status, "Enter 2–20 valid integers");
        }
    });

    sortButton?.addEventListener("click", async () => {
        let values;

        try {
            values = parseIntegers(input?.value);
        } catch (error) {
            setText(status, error.message);
            return;
        }

        sortButton.disabled = true;
        setText(status, "Running Merge Sort on the backend…");

        try {
            const data = await simulateAlgorithm({
                algorithm: "merge_sort",
                input: {
                    array_values: values
                }
            });

            const steps = getSteps(data);
            const sortedArray = getArrayResult(data);

            if (sortedArray) {
                showArray(sortedArray);

                setText(
                    status,
                    `Sorted by backend · ${sortedArray.join(", ")}`
                );
            } else {
                setText(
                    status,
                    `Simulation completed · ${steps.length} steps returned`
                );
            }

        } catch (error) {
            showApiError(status, error, "Practice Lab");
        } finally {
            sortButton.disabled = false;
        }
    });

    try {
        showArray(parseIntegers(input?.value));
    } catch {
        // Keep the original preview if its initial values are invalid.
    }
})();

/* =========================================================
   8. BACKEND HEALTH CHECK
========================================================= */

(async () => {
    const status = document.querySelector("#backendStatus");

    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);

        if (!response.ok) {
            throw new Error(
                `Health endpoint returned ${response.status}`
            );
        }

        setText(status, "BACKEND CONNECTED");

        if (status) {
            status.dataset.status = "online";
        }

    } catch (error) {
        setText(status, "BACKEND OFFLINE · START FASTAPI");

        if (status) {
            status.dataset.status = "offline";
        }

        console.warn(
            "Cannot reach the FastAPI backend. Start it with:",
            "python -m uvicorn app.main:app --reload",
            error
        );
    }
})();
