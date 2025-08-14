# regular_display.py
import os, logging, numpy as np, geopandas as gpd
from flask import Blueprint, request, jsonify
from shapely.geometry.base import BaseGeometry
from shapely.geometry import shape
from ..routes import determine_file_path           # already exists
from display import get_color, get_traces_from_geojson  # re-use, don’t duplicate

regular_blueprint = Blueprint("regular_display", __name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def create_regular_display(gdf):
    """
    Very light wrapper around display.create_full_display().
    All geometries are rendered; no weighting is applied.
    """
    from display import create_full_display        # avoid circular import
    return create_full_display(gdf)

@regular_blueprint.route("/fetch_regular_display", methods=["POST"])
def fetch_regular_display():
    data = request.get_json() or {}
    # 1. Resolve file path exactly the same way the weighted route does
    dataset_file = determine_file_path(
        data.get("state", ""), data.get("county", ""),
        data.get("category", ""), data.get("dataset", "")
    )
    if not dataset_file or not os.path.exists(dataset_file):
        return jsonify({"error": f"File not found: {dataset_file}"}), 404

    # 2. Read GeoDataFrame and ensure geometries are Shapely objects
    gdf = gpd.read_parquet(dataset_file)
    if not gdf.empty and not isinstance(gdf.iloc[0].geometry, BaseGeometry):
        gdf["geometry"] = gdf.geometry.apply(lambda g: shape(g) if g else None)

    traces, layout = create_regular_display(gdf)
    return jsonify({"traces": traces, "layout": layout})
