
import heapq
from math import inf


def json_safe_distances(distances):
    return {
        node: None if distance == inf else distance
        for node, distance in distances.items()
    }

def run_dijkstra(
    node_names: list[str],
    edges: list[dict],
    source_node: str,
    destination_node: str | None,
    graph_type: str,
) -> dict:
    node_count = len(node_names)
    adjacency = {node: [] for node in node_names}

    for edge in edges:
        source = edge["from_node"]
        target = edge["to_node"]
        weight = edge["weight"]

        adjacency[source].append((target, weight))

        if graph_type == "undirected":
            adjacency[target].append((source, weight))

    distances = {node: inf for node in node_names}
    previous = {node: None for node in node_names}
    distances[source_node] = 0

    steps = [{
        "type": "initialize",
        "message": f"Starting Dijkstra from {source_node}.",
        "current_node": source_node,
        "distances": json_safe_distances(distances),
        "previous": previous.copy(),
    }]

    priority_queue = [(0, source_node)]
    visited = set()
    edge_checks = 0

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        if current_node in visited:
            continue

        visited.add(current_node)

        steps.append({
            "type": "select_vertex",
            "message": f"Selected {current_node} with distance {current_distance}.",
            "current_node": current_node,
            "distances": json_safe_distances(distances),
            "previous": previous.copy(),
            "visited": list(visited),
        })

        if current_node == destination_node:
            break

        for neighbor, weight in adjacency[current_node]:
            edge_checks += 1
            candidate_distance = current_distance + weight

            steps.append({
                "type": "check_edge",
                "message": (
                    f"Checking edge {current_node} → {neighbor} "
                    f"with weight {weight}."
                ),
                "current_node": current_node,
                "neighbor": neighbor,
                "weight": weight,
                "candidate_distance": candidate_distance,
                "distances": json_safe_distances(distances),
                "previous": previous.copy(),
            })

            if candidate_distance < distances[neighbor]:
                distances[neighbor] = candidate_distance
                previous[neighbor] = current_node
                heapq.heappush(
                    priority_queue,
                    (candidate_distance, neighbor),
                )

                steps.append({
                    "type": "relax_edge",
                    "message": (
                        f"Updated the distance to {neighbor} "
                        f"to {candidate_distance}."
                    ),
                    "current_node": current_node,
                    "neighbor": neighbor,
                    "distances": json_safe_distances(distances),
                    "previous": previous.copy(),
                })

    # Convert infinity to None so the response is valid JSON.
    json_distances = {
        node: None if distance == inf else distance
        for node, distance in distances.items()
    }

    # Reconstruct the shortest path to the destination, if requested.
    shortest_path = None
    destination_distance = None

    if destination_node is not None:
        if distances[destination_node] != inf:
            path = []
            current = destination_node

            while current is not None:
                path.append(current)
                current = previous[current]

            shortest_path = list(reversed(path))
            destination_distance = distances[destination_node]

        steps.append({
            "type": "final_path",
            "message": (
                f"Shortest path to {destination_node} found."
                if shortest_path
                else f"No path exists to {destination_node}."
            ),
            "path": shortest_path,
            "distance": destination_distance,
            "distances": json_distances.copy(),
        })

    steps.append({
        "type": "complete",
        "message": "Dijkstra's algorithm completed.",
        "distances": json_distances.copy(),
        "previous": previous.copy(),
    })

    return {
        "result": {
            "source_node": source_node,
            "destination_node": destination_node,
            "shortest_path": shortest_path,
            "destination_distance": destination_distance,
            "distances": json_distances,
            "previous": previous,
        },
        "statistics": {
            "node_count": node_count,
            "edge_checks": edge_checks,
            "time_complexity": "O((V + E) log V)",
            "space_complexity": "O(V + E)",
        },
        "steps": steps,
        "total_steps": len(steps),
    }
