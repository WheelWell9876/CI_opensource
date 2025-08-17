import logging
import numpy as np
import plotly.graph_objects as go
from geo_open_source.webapp.display.display import ensure_shapely, center_of

logger = logging.getLogger(__name__)


def create_basic_heatmap(gdf):
    """Create a basic density heatmap from point data."""
    logger.debug(f"Creating basic heatmap from {len(gdf)} features")

    # Extract point coordinates
    lats, lons = [], []

    for _, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        gt = getattr(geom, "geom_type", "")
        if gt == "Point":
            lons.append(geom.x)
            lats.append(geom.y)
        elif gt == "MultiPoint":
            for point in geom.geoms:
                lons.append(point.x)
                lats.append(point.y)

    if not lats or not lons:
        logger.warning("No valid points found for heatmap")
        # Return empty trace
        trace = go.Densitymapbox(
            lat=[39.8283],
            lon=[-98.5795],
            radius=10,
            colorscale="Viridis",
            opacity=0.7,
            name="Density Heatmap"
        )
    else:
        trace = go.Densitymapbox(
            lat=lats,
            lon=lons,
            radius=15,  # Increased radius for better visibility
            colorscale="Viridis",
            opacity=0.7,
            name="Density Heatmap",
            colorbar=dict(title="Density")
        )

    # Calculate center
    if lats and lons:
        cx, cy = center_of(lons, lats)
        # Calculate zoom based on data spread
        lat_range = max(lats) - min(lats) if len(lats) > 1 else 0
        lon_range = max(lons) - min(lons) if len(lons) > 1 else 0
        max_range = max(lat_range, lon_range)

        if max_range < 0.1:
            zoom = 12
        elif max_range < 1:
            zoom = 8
        elif max_range < 5:
            zoom = 6
        else:
            zoom = 4
    else:
        cx, cy = -98.5795, 39.8283
        zoom = 4

    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": cy, "lon": cx},
            "zoom": zoom
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0},
        "title": "Density Heatmap Visualization"
    }

    logger.debug(f"Basic heatmap created with {len(lats)} points, center: ({cx:.3f}, {cy:.3f})")
    return [trace], layout