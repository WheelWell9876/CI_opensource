import os
import numpy as np
from flask import Blueprint, request, jsonify
import geopandas as gpd
import logging
from shapely.geometry.base import BaseGeometry
from shapely.geometry import shape

from .weighted_options.comparative_overlay import create_comparative_overlay
from .weighted_options.interactive_filter import create_interactive_filter_display
from .weighted_options.voronoi_tessellation import create_voronoi_tessellation_display
from ..routes import determine_file_path
from scipy.stats import gaussian_kde
from scipy.spatial import Voronoi

from geo_open_source.webapp.display.weighted_options.animated_display import create_animated_display
from geo_open_source.webapp.display.weighted_options.basic_heatmap import create_basic_heatmap
from geo_open_source.webapp.display.weighted_options.bubble_map import create_bubble_map
from geo_open_source.webapp.display.weighted_options.choropleth_map import create_choropleth_map
from geo_open_source.webapp.display.weighted_options.convex_hull import create_convex_hull_display
from geo_open_source.webapp.display.weighted_options.gaussian_kde_heatmap import create_gaussian_kde_heatmap
from geo_open_source.webapp.display.weighted_options.weighted_heatmap import create_weighted_heatmap
from geo_open_source.webapp.display.weighted_options.threed_extrusion import create_3d_extrusion_display

display_blueprint = Blueprint('display', __name__)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Enable debug logging

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Assume data lives under static/resources/data
DATA_DIR = os.path.join(BASE_DIR, "static", "data")


def get_color(dataset_name):
    palette = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
        "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
        "#bcbd22", "#17becf", "#7B68EE", "#F08080",
        "#48D1CC", "#FFD700", "#ADFF2F", "#EE82EE"
    ]
    hash_val = sum(ord(c) for c in str(dataset_name))
    color = palette[hash_val % len(palette)]
    logger.debug("Assigned color '%s' for dataset '%s'", color, dataset_name)
    return color


@display_blueprint.route('/fetch_display_data', methods=['POST'])
def fetch_display_data():
    data = request.get_json() or {}
    logger.debug("Received payload for fetch_display_data: %s", data)
    display_method = data.get("display_method", "default")
    weight_type = data.get("weight_type", "original")
    logger.debug("Display method: %s; Weight type: %s", display_method, weight_type)

    dataset_file = None
    if "state" in data:
        state = data.get("state", "")
        county = data.get("county", "")
        category = data.get("category", "")
        dataset = data.get("dataset", "")
        dataset_file = determine_file_path(state, county, category, dataset)
        logger.debug("Regular mode. Using file: %s", dataset_file)
    else:
        dataset_file = os.path.join(DATA_DIR, data.get("dataset", ""))
        logger.debug("Weighted mode. Using file: %s", dataset_file)

    if not dataset_file or not os.path.exists(dataset_file):
        error_msg = f"File not found: {dataset_file}"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 404

    try:
        gdf = gpd.read_parquet(dataset_file)
        logger.debug("Loaded GeoDataFrame with %d features", len(gdf))
    except Exception as e:
        logger.exception("Error reading parquet file:")
        return jsonify({"error": str(e)}), 500

    if not gdf.empty:
        first_geom = gdf.iloc[0].geometry
        if not isinstance(first_geom, BaseGeometry):
            logger.debug("Converting geometries using shape()")
            gdf["geometry"] = gdf.geometry.apply(lambda geom: shape(geom) if geom is not None else None)
        else:
            logger.debug("Geometries are already shapely objects")

    # Log geometry types present.
    geom_types = gdf.geometry.apply(lambda g: g.geom_type if g is not None else "None").unique()
    logger.debug("Geometry types in dataset: %s", geom_types)

    if display_method == "basic_heatmap":
        logger.debug("Using basic_heatmap")
        traces, layout = create_basic_heatmap(gdf)
    elif display_method == "weighted_heatmap":
        logger.debug("Using weighted_heatmap")
        traces, layout = create_weighted_heatmap(gdf, weight_type)
    elif display_method == "convex_hull":
        logger.debug("Using convex_hull")
        traces, layout = create_convex_hull_display(gdf)
    elif display_method == "gaussian_kde":
        logger.debug("Using gaussian_kde")
        traces, layout = create_gaussian_kde_heatmap(gdf, weight_type)
    elif display_method == "bubble_map":
        logger.debug("Using bubble_map")
        traces, layout = create_bubble_map(gdf, weight_type)
    elif display_method == "choropleth":
        logger.debug("Using choropleth")
        traces, layout = create_choropleth_map(gdf)
    elif display_method == "animated":
        logger.debug("Using animated display")
        traces, layout = create_animated_display(gdf)
    elif display_method == "extrusion":
        logger.debug("Using 3d_extrusion")
        traces, layout = create_3d_extrusion_display(gdf, weight_type)
    elif display_method == "comparative":
        logger.debug("Using comparative overlay")
        traces, layout = create_comparative_overlay(gdf)
    elif display_method == "interactive_filter":
        logger.debug("Using interactive_filter")
        traces, layout = create_interactive_filter_display(gdf)
    elif display_method == "voronoi":
        logger.debug("Using voronoi tessellation")
        traces, layout = create_voronoi_tessellation_display(gdf)
    else:
        logger.debug("Using default display")
        traces, layout = create_default_display(gdf)

    logger.debug("Returning %d trace(s) with layout: %s", len(traces), layout)
    return jsonify({"traces": traces, "layout": layout})


# --- Helper to convert a shapely geometry to Plotly traces using its GeoJSON interface ---
def get_traces_from_geojson(geojson, name, color, hover_text, showlegend, legend_group):
    traces = []
    geom_type = geojson.get("type", "")
    logger.debug("Converting geometry type: %s", geom_type)
    if geom_type == "Point":
        traces.append({
            "type": "scattermapbox",
            "lon": [geojson["coordinates"][0]],
            "lat": [geojson["coordinates"][1]],
            "mode": "markers",
            "marker": {"color": color, "size": 8},
            "name": name,
            "hoverinfo": "text",
            "hovertext": hover_text,
            "showlegend": showlegend,
            "legendgroup": legend_group
        })
    elif geom_type == "MultiPoint":
        lons = [pt[0] for pt in geojson["coordinates"]]
        lats = [pt[1] for pt in geojson["coordinates"]]
        traces.append({
            "type": "scattermapbox",
            "lon": lons,
            "lat": lats,
            "mode": "markers",
            "marker": {"color": color, "size": 8},
            "name": name,
            "hoverinfo": "text",
            "hovertext": hover_text,
            "showlegend": showlegend,
            "legendgroup": legend_group
        })
    elif geom_type == "LineString":
        lons = [pt[0] for pt in geojson["coordinates"]]
        lats = [pt[1] for pt in geojson["coordinates"]]
        traces.append({
            "type": "scattermapbox",
            "lon": lons,
            "lat": lats,
            "mode": "lines",
            "line": {"color": color, "width": 2},
            "name": name,
            "hoverinfo": "text",
            "hovertext": hover_text,
            "showlegend": showlegend,
            "legendgroup": legend_group
        })
    elif geom_type == "MultiLineString":
        for line in geojson["coordinates"]:
            lons = [pt[0] for pt in line]
            lats = [pt[1] for pt in line]
            traces.append({
                "type": "scattermapbox",
                "lon": lons,
                "lat": lats,
                "mode": "lines",
                "line": {"color": color, "width": 2},
                "name": name,
                "hoverinfo": "text",
                "hovertext": hover_text,
                "showlegend": showlegend,
                "legendgroup": legend_group
            })
    elif geom_type == "Polygon":
        exterior = geojson["coordinates"][0]
        lons = [pt[0] for pt in exterior]
        lats = [pt[1] for pt in exterior]
        traces.append({
            "type": "scattermapbox",
            "lon": lons,
            "lat": lats,
            "mode": "lines",
            "fill": "none",
            "line": {"color": color, "width": 2},
            "name": name,
            "hoverinfo": "text",
            "hovertext": hover_text,
            "showlegend": showlegend,
            "legendgroup": legend_group
        })
    elif geom_type == "MultiPolygon":
        for polygon in geojson["coordinates"]:
            exterior = polygon[0]
            lons = [pt[0] for pt in exterior]
            lats = [pt[1] for pt in exterior]
            traces.append({
                "type": "scattermapbox",
                "lon": lons,
                "lat": lats,
                "mode": "lines",
                "fill": "none",
                "line": {"color": color, "width": 2},
                "name": name,
                "hoverinfo": "text",
                "hovertext": hover_text,
                "showlegend": showlegend,
                "legendgroup": legend_group
            })
    return traces


# --- Full display: show all geometry types using their actual geometry ---
def create_full_display(gdf):
    traces = []
    all_coords = []
    unique_datasets = gdf["Dataset"].unique() if "Dataset" in gdf.columns else []
    uniform_color = None
    if len(unique_datasets) <= 1:
        uniform_color = "red"
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue
        geojson = geom.__geo_interface__
        hover_text = "<br>".join([f"{k}: {v}" for k, v in row.items() if k != "geometry"])
        if uniform_color:
            color = uniform_color
        else:
            dataset_val = row.get("Dataset", "NoName")
            color = get_color(dataset_val)
        new_traces = get_traces_from_geojson(geojson, row.get("Dataset", "NoName"), color, hover_text, idx == 0,
                                             row.get("Dataset", "NoName"))
        traces.extend(new_traces)
        try:
            if geom.geom_type in ["Polygon", "MultiPolygon"]:
                coords = list(geom.exterior.coords)
            else:
                coords = list(geom.coords)
        except Exception:
            coords = []
        all_coords.extend(coords)
    if all_coords:
        center_lon = np.mean([pt[0] for pt in all_coords])
        center_lat = np.mean([pt[1] for pt in all_coords])
    else:
        center_lon, center_lat = -98.5795, 39.8283
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": center_lat, "lon": center_lon},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Full display: center = (%s, %s) with %d traces", center_lat, center_lon, len(traces))
    return traces, layout


# --- The following helper functions use points only ---
def create_default_display(gdf):
    return create_full_display(gdf)

