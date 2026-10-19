
def run_quick_sort(array_values: list[int]) -> dict:
    arr = array_values.copy()
    steps = []
    comparisons = 0
    swaps = 0

    def quick_sort(low: int, high: int):
        nonlocal comparisons, swaps

        if low >= high:
            if low == high:
                steps.append({
                    "type": "base_case",
                    "message": f"Element at index {low} is already in its final position.",
                    "array": arr.copy(),
                    "low": low,
                    "high": high,
                })
            return

        # Choose the last element as the pivot.
        pivot = arr[high]

        steps.append({
            "type": "pivot_selected",
            "message": f"Selected {pivot} as the pivot.",
            "array": arr.copy(),
            "low": low,
            "high": high,
            "pivot_index": high,
            "pivot_value": pivot,
        })

        i = low - 1

        for j in range(low, high):
            comparisons += 1

            steps.append({
                "type": "compare",
                "message": f"Comparing {arr[j]} with pivot {pivot}.",
                "array": arr.copy(),
                "low": low,
                "high": high,
                "current_index": j,
                "pivot_index": high,
                "pivot_value": pivot,
            })

            if arr[j] <= pivot:
                i += 1

                if i != j:
                    arr[i], arr[j] = arr[j], arr[i]
                    swaps += 1

                    steps.append({
                        "type": "swap",
                        "message": f"Swapped {arr[i]} and {arr[j]}.",
                        "array": arr.copy(),
                        "index_a": i,
                        "index_b": j,
                        "pivot_index": high,
                        "pivot_value": pivot,
                    })

        pivot_position = i + 1

        if pivot_position != high:
            arr[pivot_position], arr[high] = arr[high], arr[pivot_position]
            swaps += 1

        steps.append({
            "type": "pivot_placed",
            "message": f"Placed pivot {pivot} at index {pivot_position}.",
            "array": arr.copy(),
            "pivot_index": pivot_position,
            "pivot_value": arr[pivot_position],
            "low": low,
            "high": high,
        })

        quick_sort(low, pivot_position - 1)
        quick_sort(pivot_position + 1, high)

    quick_sort(0, len(arr) - 1)

    steps.append({
        "type": "complete",
        "message": "Quick Sort completed successfully.",
        "array": arr.copy(),
    })

    return {
        "result": {
            "sorted_array": arr,
        },
        "statistics": {
            "array_length": len(arr),
            "comparisons": comparisons,
            "swaps": swaps,
            "time_complexity": "O(n log n) average, O(n²) worst case",
            "space_complexity": "O(log n) average, O(n) worst case",
        },
        "steps": steps,
        "total_steps": len(steps),
    }
