from typing import Annotated, Literal
from pydantic import (
    BaseModel,
    ConfigDict,
    StrictInt,
    Field,
    field_validator,
    model_validator,
)


class MergeSortInput(BaseModel):
    array_values: list[StrictInt] = Field(min_length=2, max_length=20)


class TSPEdge(BaseModel):
    from_city: str = Field(min_length=1, max_length=20)
    to_city: str = Field(min_length=1, max_length=20)
    cost: StrictInt = Field(gt=0, le=1_000_000)

    @field_validator("from_city", "to_city")
    @classmethod
    def strip_city_names(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("City names cannot be empty.")
        return value


class TSPInput(BaseModel):
    city_names: list[str] = Field(min_length=3, max_length=10)
    edges: list[TSPEdge]
    start_city: str | None = None

    @field_validator("city_names")
    @classmethod
    def validate_city_names(cls, cities: list[str]) -> list[str]:
        cities = [city.strip() for city in cities]

        if any(not city for city in cities):
            raise ValueError("City names cannot be empty.")

        if len(set(cities)) != len(cities):
            raise ValueError("City names must be unique.")

        return cities

    @model_validator(mode="after")
    def validate_graph(self):
        cities = set(self.city_names)

        if self.start_city is None:
            self.start_city = self.city_names[0]
        elif self.start_city not in cities:
            raise ValueError("start_city must be in city_names.")

        seen_edges = set()

        for edge in self.edges:
            if edge.from_city not in cities or edge.to_city not in cities:
                raise ValueError("Every edge must reference a listed city.")

            if edge.from_city == edge.to_city:
                raise ValueError("Self-loops are not allowed.")

            key = frozenset((edge.from_city, edge.to_city))

            if key in seen_edges:
                raise ValueError("Duplicate undirected edges are not allowed.")

            seen_edges.add(key)

        expected_edges = len(cities) * (len(cities) - 1) // 2

        if len(seen_edges) != expected_edges:
            raise ValueError(
                "Provide an edge between every pair of cities."
            )

        return self


class MergeSortRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    algorithm: Literal["merge_sort"]
    input: MergeSortInput


class TSPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    algorithm: Literal["tsp_dp"]
    input: TSPInput


class QuickSortRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    algorithm: Literal["quick_sort"]
    input: MergeSortInput



class DijkstraEdge(BaseModel):
    from_node: str = Field(min_length=1, max_length=30)
    to_node: str = Field(min_length=1, max_length=30)
    weight: StrictInt = Field(ge=0, le=1_000_000)

    @field_validator("from_node", "to_node")
    @classmethod
    def strip_node_names(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Node names cannot be empty.")
        return value


class DijkstraInput(BaseModel):
    node_names: list[str] = Field(min_length=2, max_length=20)
    edges: list[DijkstraEdge]
    source_node: str
    destination_node: str | None = None
    graph_type: Literal["directed", "undirected"] = "undirected"

    @field_validator("node_names")
    @classmethod
    def validate_node_names(cls, nodes: list[str]) -> list[str]:
        nodes = [node.strip() for node in nodes]

        if any(not node for node in nodes):
            raise ValueError("Node names cannot be empty.")

        if len(set(nodes)) != len(nodes):
            raise ValueError("Node names must be unique.")

        return nodes

    @field_validator("source_node", "destination_node")
    @classmethod
    def strip_selected_nodes(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError("Selected node names cannot be empty.")

        return value

    @model_validator(mode="after")
    def validate_graph(self):
        nodes = set(self.node_names)

        if self.source_node not in nodes:
            raise ValueError("source_node must be in node_names.")

        if (
            self.destination_node is not None
            and self.destination_node not in nodes
        ):
            raise ValueError("destination_node must be in node_names.")

        seen_edges = set()

        for edge in self.edges:
            if edge.from_node not in nodes or edge.to_node not in nodes:
                raise ValueError("Every edge must reference a listed node.")

            if edge.from_node == edge.to_node:
                raise ValueError("Self-loops are not allowed.")

            if self.graph_type == "undirected":
                edge_key = frozenset((edge.from_node, edge.to_node))
            else:
                edge_key = (edge.from_node, edge.to_node)

            if edge_key in seen_edges:
                raise ValueError("Duplicate edges are not allowed.")

            seen_edges.add(edge_key)

        return self


class DijkstraRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    algorithm: Literal["dijkstra"]
    input: DijkstraInput




SimulationRequest = Annotated[
    MergeSortRequest | TSPRequest | DijkstraRequest |QuickSortRequest,
    Field(discriminator="algorithm"),
]

