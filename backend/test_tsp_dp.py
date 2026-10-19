
from app.algorithms.tsp_dp import run_tsp_dp

cities = ["A", "B", "C", "D"]

edges = [
    {"from_city": "A", "to_city": "B", "cost": 10},
    {"from_city": "A", "to_city": "C", "cost": 15},
    {"from_city": "A", "to_city": "D", "cost": 20},
    {"from_city": "B", "to_city": "C", "cost": 35},
    {"from_city": "B", "to_city": "D", "cost": 25},
    {"from_city": "C", "to_city": "D", "cost": 30},
]

output = run_tsp_dp(cities, edges, "A")

print("Result:", output["result"])
print("Statistics:", output["statistics"])
print("Total steps:", output["total_steps"])

print("\nFirst 5 steps:")
for step in output["steps"][:5]:
    print(step)
