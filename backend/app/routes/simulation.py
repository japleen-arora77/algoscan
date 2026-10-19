from fastapi import APIRouter, HTTPException
from app.algorithms.dijkstra import run_dijkstra
from app.algorithms.merge_sort import run_merge_sort
from app.algorithms.tsp_dp import run_tsp_dp
from app.algorithms.quick_sort import run_quick_sort
from app.schemas.simulation import (
    MergeSortRequest,
    SimulationRequest,
    TSPRequest,
    DijkstraRequest,
    QuickSortRequest,
)

router = APIRouter(prefix="/api", tags=["Simulations"])


@router.post("/simulate")
def simulate_algorithm(request: SimulationRequest):
    try:
        if isinstance(request, MergeSortRequest):
            output = run_merge_sort(request.input.array_values)
        
        elif isinstance(request, QuickSortRequest):
            output = run_quick_sort(
                request.input.array_values
            )

        elif isinstance(request, TSPRequest):
            output = run_tsp_dp(
                city_names=request.input.city_names,
                edges=[
                    edge.model_dump()
                    for edge in request.input.edges
                ],
                start_city=request.input.start_city,
            )
        
        elif isinstance(request, DijkstraRequest):
            output = run_dijkstra(
                node_names=request.input.node_names,
                edges=[
                    edge.model_dump()
                    for edge in request.input.edges
                ],
                source_node=request.input.source_node,
                destination_node=request.input.destination_node,
                graph_type=request.input.graph_type,
            )


        else:
            raise HTTPException(
                status_code=422,
                detail="Unsupported algorithm.",
            )

        return {
            "algorithm": request.algorithm,
            "status": "success",
            **output,
        }

    except HTTPException:
        raise

    except Exception as exc:
        # Log the actual error in the server terminal, but don't
        # expose internal details in the API response.
        print(f"Simulation error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="The algorithm simulation failed.",
        ) from exc
