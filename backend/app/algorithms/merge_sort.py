
def run_merge_sort(array_values: list[int]) -> dict:
    """Run Merge Sort and return the sorted result and execution trace."""

    arr = array_values.copy()
    steps = []
    comparisons = 0
    merge_operations = 0

    def record(step_type: str, message: str, **details):
        steps.append({
            "step": len(steps) + 1,
            "type": step_type,
            "message": message,
            **details,
        })

    def merge_sort(start: int, end: int):
        nonlocal comparisons, merge_operations

        if start >= end:
            record(
                "base_case",
                f"One element at index {start} is already sorted.",
                start=start,
                end=end,
                array=arr.copy(),
            )
            return

        mid = (start + end) // 2

        record(
            "split",
            f"Split the segment from index {start} to {end}.",
            start=start,
            mid=mid,
            end=end,
            left=arr[start:mid + 1],
            right=arr[mid + 1:end + 1],
            array=arr.copy(),
        )

        merge_sort(start, mid)
        merge_sort(mid + 1, end)

        left = arr[start:mid + 1]
        right = arr[mid + 1:end + 1]

        record(
            "merge_start",
            f"Merge the sorted segments {left} and {right}.",
            start=start,
            mid=mid,
            end=end,
            left=left.copy(),
            right=right.copy(),
            array=arr.copy(),
        )

        i = j = 0
        k = start

        while i < len(left) and j < len(right):
            comparisons += 1

            record(
                "compare",
                f"Compare {left[i]} and {right[j]}.",
                left_value=left[i],
                right_value=right[j],
                array=arr.copy(),
            )

            if left[i] <= right[j]:
                arr[k] = left[i]
                i += 1
            else:
                arr[k] = right[j]
                j += 1

            record(
                "place",
                f"Place {arr[k]} at index {k}.",
                index=k,
                value=arr[k],
                array=arr.copy(),
            )
            k += 1

        while i < len(left):
            arr[k] = left[i]

            record(
                "place",
                f"Copy remaining value {left[i]} to index {k}.",
                index=k,
                value=arr[k],
                array=arr.copy(),
            )
            i += 1
            k += 1

        while j < len(right):
            arr[k] = right[j]

            record(
                "place",
                f"Copy remaining value {right[j]} to index {k}.",
                index=k,
                value=arr[k],
                array=arr.copy(),
            )
            j += 1
            k += 1

        merge_operations += 1

        record(
            "merge_complete",
            f"Segment {arr[start:end + 1]} is sorted.",
            start=start,
            mid=mid,
            end=end,
            merged=arr[start:end + 1],
            array=arr.copy(),
        )

    if not arr:
        record("complete", "The array is empty.", array=[])
    else:
        merge_sort(0, len(arr) - 1)
        record(
            "complete",
            "Merge Sort has finished.",
            array=arr.copy(),
        )

    n = len(arr)

    return {
        "result": {
            "sorted_array": arr,
        },
        "statistics": {
            "array_length": n,
            "comparisons": comparisons,
            "merge_operations": merge_operations,
            "time_complexity": "O(n log n)",
            "space_complexity": "O(n)",
        },
        "steps": steps,
        "total_steps": len(steps),
    }
