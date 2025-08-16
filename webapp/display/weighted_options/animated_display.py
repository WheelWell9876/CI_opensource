import logging as logger
import numpy as np
from geo_open_source.webapp.display.display import create_default_display


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
