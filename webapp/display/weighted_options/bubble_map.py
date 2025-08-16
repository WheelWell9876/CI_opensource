import logging as logger
import numpy as np
from geo_open_source.webapp.display.display import create_default_display

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
