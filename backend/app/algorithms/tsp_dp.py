
from math import inf


def run_tsp_dp(
    city_names: list[str],
    edges: list[dict],
    start_city: str,
) -> dict:
    """Solve TSP using Held-Karp DP and return a step-by-step trace."""

    n = len(city_names)
    start = city_names.index(start_city)

    # Build a symmetric cost matrix for an undirected graph.
    distances = [[0 if i == j else inf for j in range(n)] for i in range(n)]

    for edge in edges:
        i = city_names.index(edge["from_city"])
        j = city_names.index(edge["to_city"])
        cost = edge["cost"]

        distances[i][j] = cost
        distances[j][i] = cost

    # DP state: dp[mask][city] = minimum cost from start to city,
    # visiting exactly the cities represented by mask.
    state_count = 1 << n
    dp = [[inf] * n for _ in range(state_count)]
    parent = [[None] * n for _ in range(state_count)]

    start_mask = 1 << start
    dp[start_mask][start] = 0

    steps = []
    state_updates = 0

    def record(step_type: str, message: str, **details):
        steps.append({
            "step": len(steps) + 1,
            "type": step_type,
            "message": message,
            **details,
        })

    record(
        "initialize",
        f"Start at {start_city}; initial cost is zero.",
        start_city=start_city,
        start_index=start,
        visited_mask=start_mask,
        cost=0,
    )

    # Build states in increasing mask order.
    for mask in range(state_count):
        if not (mask & start_mask):
            continue

        for current in range(n):
            current_cost = dp[mask][current]

            if current_cost == inf:
                continue

            if not (mask & (1 << current)):
                continue

            for nxt in range(n):
                if mask & (1 << nxt):
                    continue

                next_mask = mask | (1 << nxt)
                candidate = current_cost + distances[current][nxt]

                record(
                    "consider_transition",
                    f"Consider travelling from {city_names[current]} "
                    f"to {city_names[nxt]}.",
                    from_city=city_names[current],
                    to_city=city_names[nxt],
                    current_mask=mask,
                    next_mask=next_mask,
                    current_cost=current_cost,
                    edge_cost=distances[current][nxt],
                    candidate_cost=candidate,
                    previous_cost=(
                        None if dp[next_mask][nxt] == inf
                        else dp[next_mask][nxt]
                    ),
                )

                if candidate < dp[next_mask][nxt]:
                    dp[next_mask][nxt] = candidate
                    parent[next_mask][nxt] = current
                    state_updates += 1

                    record(
                        "state_update",
                        f"Best known cost to reach {city_names[nxt]} "
                        f"for this visited set is now {candidate}.",
                        mask=next_mask,
                        city=city_names[nxt],
                        city_index=nxt,
                        cost=candidate,
                        predecessor=city_names[current],
                        predecessor_index=current,
                    )

    full_mask = state_count - 1
    best_cost = inf
    last_city = None

    # Complete the cycle by returning to the start.
    for city in range(n):
        if city == start:
            continue

        if dp[full_mask][city] == inf:
            continue

        tour_cost = dp[full_mask][city] + distances[city][start]

        record(
            "return_to_start",
            f"Return from {city_names[city]} to {start_city}.",
            from_city=city_names[city],
            to_city=start_city,
            path_cost=dp[full_mask][city],
            return_cost=distances[city][start],
            total_cost=tour_cost,
        )

        if tour_cost < best_cost:
            best_cost = tour_cost
            last_city = city

    if last_city is None:
        return {
            "result": {
                "tour": [],
                "tour_indices": [],
                "minimum_cost": None,
            },
            "statistics": {
                "city_count": n,
                "state_updates": state_updates,
                "time_complexity": "O(n^2 * 2^n)",
                "space_complexity": "O(n * 2^n)",
            },
            "steps": steps,
            "total_steps": len(steps),
        }

    # Reconstruct the optimal tour backwards using parent pointers.
    reverse_path = []
    mask = full_mask
    city = last_city

    while city != start:
        reverse_path.append(city)
        previous = parent[mask][city]

        if previous is None:
            raise RuntimeError("Could not reconstruct the optimal tour.")

        mask ^= 1 << city
        city = previous

    reverse_path.append(start)
    tour_indices = list(reversed(reverse_path))
    tour_indices.append(start)

    tour = [city_names[index] for index in tour_indices]

    record(
        "final_tour",
        f"Optimal tour found with total cost {best_cost}.",
        tour=tour,
        tour_indices=tour_indices,
        minimum_cost=best_cost,
    )

    return {
        "result": {
            "tour": tour,
            "tour_indices": tour_indices,
            "minimum_cost": best_cost,
        },
        "statistics": {
            "city_count": n,
            "state_updates": state_updates,
            "time_complexity": "O(n^2 * 2^n)",
            "space_complexity": "O(n * 2^n)",
        },
        "steps": steps,
        "total_steps": len(steps),
    }
