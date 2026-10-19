
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from app.routes.simulation import router as simulation_router


app = FastAPI(
    title="Velocity API",
    description="Interactive algorithm learning and simulation API",
    version="1.0.0",
)

# CORS configuration must be added after creating the app.
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the simulation routes.
app.include_router(simulation_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to Velocity API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Velocity API",
    }


@app.get("/api/algorithms")
def get_algorithms():
    return {
        "algorithms": [
            {
                "id": "merge_sort",
                "name": "Merge Sort",
                "category": "Divide and Conquer",
                "status": "ready",
            },
            {
                "id": "quick_sort",
                "name": "Quick Sort",
                "category": "Divide and Conquer",
                "status": "ready",
            },
            {
                "id": "tsp_dp",
                "name": "Travelling Salesperson Problem",
                "category": "Dynamic Programming",
                "status": "ready",
            },
            {
                "id": "dijkstra",
                "name": "Dijkstra's Algorithm",
                "category": "Greedy",
                "status": "ready",
            },
        ]
    }
