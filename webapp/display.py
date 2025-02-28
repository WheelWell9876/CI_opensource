import os
import numpy as np
from flask import Blueprint, request, jsonify
import geopandas as gpd
import logging
from shapely.geometry.base import BaseGeometry
from shapely.geometry import shape
from scipy.stats import gaussian_kde
from scipy.spatial import Voronoi

display_blueprint = Blueprint('display', __name__)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Enable debug logging

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Assume data lives under static/resources/data
DATA_DIR = os.path.join(BASE_DIR, "static", "resources", "data")


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
        from routes import determine_file_path
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


def create_basic_heatmap(gdf):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    trace = {
        "type": "densitymapbox",
        "lat": lats,
        "lon": lons,
        "radius": 10,
        "colorscale": "Viridis",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Basic heatmap: %d points", len(lats))
    return [trace], layout


def create_weighted_heatmap(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    trace = {
        "type": "densitymapbox",
        "lat": lats,
        "lon": lons,
        "z": weights,
        "radius": 10,
        "colorscale": "Viridis",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Weighted heatmap: %d points, using weight type '%s'", len(lats), weight_type)
    return [trace], layout


def create_convex_hull_display(gdf):
    """
    Computes the convex hull over the top 10% highest weight points.
    Uses the 'original' weight if present, otherwise a generic 'weight' column.
    If no high-weight features are found, falls back to default display.
    """
    logger.debug("Running convex hull display method")
    if "original" in gdf.columns:
        threshold = gdf["original"].quantile(0.9)
        high_weight = gdf[gdf["original"] >= threshold]
    elif "weight" in gdf.columns:
        threshold = gdf["weight"].quantile(0.9)
        high_weight = gdf[gdf["weight"] >= threshold]
    else:
        logger.debug("No weight column found for convex hull; using default display")
        return create_default_display(gdf)

    if high_weight.empty:
        logger.debug("No high-weight features found; using default display")
        return create_default_display(gdf)

    try:
        hull = high_weight.unary_union.convex_hull
        logger.debug("Convex hull computed successfully")
    except Exception as e:
        logger.exception("Error computing convex hull:")
        return create_default_display(gdf)

    # Convert hull to GeoJSON mapping.
    try:
        geojson = hull.__geo_interface__
    except Exception as e:
        logger.exception("Error obtaining __geo_interface__ for hull:")
        return create_default_display(gdf)

    # Use red for convex hull boundary.
    traces = get_traces_from_geojson(geojson, "Convex Hull", "red", "Convex Hull", True, "Convex Hull")

    try:
        coords = list(hull.exterior.coords)
        center_lon = np.mean([pt[0] for pt in coords])
        center_lat = np.mean([pt[1] for pt in coords])
        logger.debug("Convex hull center computed as (%s, %s)", center_lat, center_lon)
    except Exception:
        center_lon, center_lat = -98.5795, 39.8283
        logger.debug("Using default center for convex hull")

    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": center_lat, "lon": center_lon},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Returning convex hull display with %d trace(s)", len(traces))
    return traces, layout


def create_gaussian_kde_heatmap(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        logger.debug("Gaussian KDE: no point data")
        return create_default_display(gdf)
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    try:
        kde = gaussian_kde(np.vstack([lons, lats]), weights=weights)
    except Exception as e:
        logger.exception("Gaussian KDE failed:")
        return create_default_display(gdf)
    xi = np.linspace(min(lons), max(lons), 100)
    yi = np.linspace(min(lats), max(lats), 100)
    xi, yi = np.meshgrid(xi, yi)
    zi = kde(np.vstack([xi.flatten(), yi.flatten()])).reshape(xi.shape)
    trace = {
        "type": "densitymapbox",
        "lat": yi.flatten().tolist(),
        "lon": xi.flatten().tolist(),
        "z": zi.flatten().tolist(),
        "radius": 10,
        "colorscale": "Viridis",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats), "lon": np.mean(lons)},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Gaussian KDE: processed %d points", len(lats))
    return [trace], layout


def create_bubble_map(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    sizes = [max(5, min(30, w * 30)) for w in weights]
    trace = {
        "type": "scattermapbox",
        "lat": lats,
        "lon": lons,
        "mode": "markers",
        "marker": {"size": sizes, "color": "rgba(255,0,0,0.5)"},
        "name": "Bubble Map"
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Bubble map: %d points, weight type '%s'", len(lats), weight_type)
    return [trace], layout


def create_choropleth_map(gdf):
    if "county" not in gdf.columns:
        logger.debug("Choropleth: no 'county' property; using default display")
        return create_default_display(gdf)
    agg = gdf.groupby("county").agg({"original": "mean", "geometry": "first"}).reset_index()
    centroids = agg.geometry.centroid
    lats = centroids.y.tolist()
    lons = centroids.x.tolist()
    values = agg["original"].tolist()
    trace = {
        "type": "choroplethmapbox",
        "locations": agg["county"].tolist(),
        "z": values,
        "colorscale": "Viridis",
        "colorbar": {"title": "Avg Weight"},
        "geojson": {},
        "featureidkey": "properties.name",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Choropleth: aggregated %d counties", len(agg))
    return [trace], layout


def create_animated_display(gdf):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        return create_default_display(gdf)
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weight1 = gdf_points["original"].tolist() if "original" in gdf_points.columns else [1] * len(lats)
    trace = {
        "type": "scattermapbox",
        "lat": lats,
        "lon": lons,
        "mode": "markers",
        "marker": {"size": 8, "color": weight1, "colorscale": "Viridis"},
        "name": "Original Weight"
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0},
        "updatemenus": [{
            "type": "buttons",
            "buttons": [{
                "label": "Play",
                "method": "animate",
                "args": [None, {"frame": {"duration": 1000, "redraw": True},
                                "fromcurrent": True}]
            }]
        }]
    }
    logger.debug("Animated display: %d points", len(lats))
    return [trace], layout


def create_3d_extrusion_display(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        return create_default_display(gdf)
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    zs = [w * 50 for w in weights]
    trace = {
        "type": "scatter3d",
        "x": lons,
        "y": lats,
        "z": zs,
        "mode": "markers",
        "marker": {"size": 5, "color": zs, "colorscale": "Viridis"},
        "name": "3D Extrusion"
    }
    layout = {
        "scene": {
            "xaxis": {"title": "Longitude"},
            "yaxis": {"title": "Latitude"},
            "zaxis": {"title": "Extrusion Height"}
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("3D Extrusion: %d points", len(lats))
    return [trace], layout


def create_comparative_overlay(gdf):
    if "Dataset" in gdf.columns:
        groups = gdf.groupby("Dataset")
    else:
        groups = [("All", gdf)]
    traces = []
    for name, group in groups:
        if group.empty:
            continue
        gdf_points = group[group.geometry.geom_type == "Point"]
        lats = [pt.y for pt in gdf_points.geometry]
        lons = [pt.x for pt in gdf_points.geometry]
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "markers",
            "marker": {"size": 8, "color": get_color(str(name))},
            "name": str(name)
        }
        traces.append(trace)
    # var_all_lats = [];
    # var_all_lons = [];
    # for (var i = 0; i < traces.length; i++) {
    #     var tr = traces[i];
    # var_all_lats = var_all_lats.concat(tr["lat"]);
    # var_all_lons = var_all_lons.concat(tr["lon"]);
    # }
    # center = {"lat": np.mean(var_all_lats) if var_all_lats.length else 39.8283,
    #           "lon": np.mean(var_all_lons) if var_all_lons.length else -98.5795}
    # layout = {
    #     "mapbox": {
    #         "style": "open-street-map",
    #         "center": center,
    #         "zoom": 6
    #     },
    #     "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    # }
    logger.debug("Comparative overlay: %d groups", len(traces))
    return traces


def create_interactive_filter_display(gdf):
    if "Category" in gdf.columns:
        groups = gdf.groupby("Category")
    else:
        groups = [("All", gdf)]
    traces = []
    for name, group in groups:
        gdf_points = group[group.geometry.geom_type == "Point"]
        lats = [pt.y for pt in gdf_points.geometry]
        lons = [pt.x for pt in gdf_points.geometry]
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "markers",
            "marker": {"size": 8},
            "name": str(name)
        }
        traces.append(trace)
    # all_lats = [];
    # all_lons = [];
    # for (var i = 0; i < traces.length; i++) {
    #     all_lats = all_lats.concat(traces[i]["lat"]);
    # all_lons = all_lons.concat(traces[i]["lon"]);
    # }
    # center = {"lat": np.mean(all_lats) if all_lats.length else 39.8283,
    #           "lon": np.mean(all_lons) if all_lons.length else -98.5795}
    # layout = {
    #     "mapbox": {
    #         "style": "open-street-map",
    #         "center": center,
    #         "zoom": 6
    #     },
    #     "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    # }
    logger.debug("Interactive filter: %d groups", len(traces))
    return traces


def create_voronoi_tessellation_display(gdf):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        return create_default_display(gdf)
    points = np.array([[pt.x, pt.y] for pt in gdf_points.geometry])
    try:
        vor = Voronoi(points)
    except Exception:
        logger.exception("Voronoi tessellation failed")
        return create_default_display(gdf)
    traces = []
    for ridge in vor.ridge_vertices:
        if -1 in ridge:
            continue
        pts = [vor.vertices[i] for i in ridge]
        lons, lats = zip(*pts)
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "lines",
            "line": {"color": "orange", "width": 2},
            "name": "Voronoi"
        }
        traces.append(trace)
    center = {"lat": np.mean(points[:, 1]), "lon": np.mean(points[:, 0])}
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": center,
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Voronoi tessellation: processed %d points", len(points))
    return traces, layout
