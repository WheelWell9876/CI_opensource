# geo_open_source/webapp/display/weighted_options/convex_hull.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, MultiPoint
from shapely.ops import unary_union
from scipy.spatial import ConvexHull

from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original") -> go.Figure:
    """Create a convex hull visualization over high-weight points."""
    logger.info(f"Creating convex hull display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🔧 DEBUG: convex_hull.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to convex_hull")
        return create_empty_figure()

    # Extract points and weights
    points_data = []
    all_lons, all_lats = [], []

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get weight value
        weight = 1.0
        if weight_type and weight_type in gdf.columns:
            try:
                weight = float(row[weight_type])
            except Exception:
                weight = 1.0

        # Extract coordinates based on geometry type
        if geom.geom_type == "Point":
            lon, lat = geom.x, geom.y
            points_data.append({'lon': lon, 'lat': lat, 'weight': weight, 'row': row})
            all_lons.append(lon)
            all_lats.append(lat)
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                lon, lat = point.x, point.y
                points_data.append({'lon': lon, 'lat': lat, 'weight': weight, 'row': row})
                all_lons.append(lon)
                all_lats.append(lat)

    if len(points_data) < 3:
        logger.warning("Not enough points for convex hull (need at least 3)")
        print("⚠️ DEBUG: Not enough points for convex hull, falling back to default display")
        # Fall back to showing all points as markers
        return create_fallback_display(gdf, weight_type)

    print(f"✅ DEBUG: Extracted {len(points_data)} points for convex hull")

    # Sort points by weight (descending)
    points_data.sort(key=lambda x: x['weight'], reverse=True)

    # Take top 25% of points by weight for convex hull
    hull_count = max(3, len(points_data) // 4)
    high_weight_points = points_data[:hull_count]

    print(f"🔧 DEBUG: Using top {hull_count} points for convex hull")

    # Create convex hull
    try:
        coords = np.array([[p['lon'], p['lat']] for p in high_weight_points])
        hull = ConvexHull(coords)
        hull_points = coords[hull.vertices]

        # Close the hull by adding the first point at the end
        hull_lons = list(hull_points[:, 0]) + [hull_points[0, 0]]
        hull_lats = list(hull_points[:, 1]) + [hull_points[0, 1]]

        print(f"✅ DEBUG: Convex hull created with {len(hull.vertices)} vertices")

    except Exception as e:
        logger.error(f"Error creating convex hull: {e}")
        print(f"❌ DEBUG: Error creating convex hull: {e}")
        return create_fallback_display(gdf, weight_type)

    # Create traces
    traces = []

    # 1. Add the convex hull as a filled polygon
    traces.append(go.Scattermapbox(
        lon=hull_lons,
        lat=hull_lats,
        mode="lines",
        fill="toself",
        fillcolor="rgba(255, 0, 0, 0.2)",
        line=dict(color="red", width=3),
        name=f"High Weight Zone (Top {hull_count} points)",
        hovertemplate=f"<b>High Weight Convex Hull</b><br>Contains top {hull_count} weighted points<extra></extra>",
        showlegend=True
    ))

    # 2. Add all points as markers with size based on weight
    point_lons = [p['lon'] for p in points_data]
    point_lats = [p['lat'] for p in points_data]
    point_weights = [p['weight'] for p in points_data]
    point_sizes = [max(6, min(25, w * 15.0)) if np.isfinite(w) else 8 for w in point_weights]

    # Create hover text for each point
    hover_texts = []
    for p in points_data:
        row = p['row']
        weight = p['weight']

        # Get title from common fields
        title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
        title = "Data Point"
        for field in title_fields:
            if field in row and pd.notna(row[field]):
                title = str(row[field])
                break

        hover_text = f"<b>{title}</b><br>"
        hover_text += f"Weight ({weight_type}): {weight:.3f}<br>"

        # Add dataset info if available
        if 'Dataset' in row and pd.notna(row['Dataset']):
            hover_text += f"Dataset: {row['Dataset']}<br>"

        hover_text += f"Location: ({p['lon']:.4f}, {p['lat']:.4f})"
        hover_texts.append(hover_text)

    traces.append(go.Scattermapbox(
        lon=point_lons,
        lat=point_lats,
        mode="markers",
        marker=dict(
            size=point_sizes,
            color=point_weights,
            colorscale="Viridis",
            opacity=0.8,
            colorbar=dict(title=f"Weight ({weight_type})")
        ),
        name="All Data Points",
        text=hover_texts,
        hovertemplate="%{text}<extra></extra>",
        showlegend=True
    ))

    # 3. Highlight the hull points specifically
    hull_point_lons = [high_weight_points[i]['lon'] for i in range(len(high_weight_points))]
    hull_point_lats = [high_weight_points[i]['lat'] for i in range(len(high_weight_points))]
    hull_point_weights = [high_weight_points[i]['weight'] for i in range(len(high_weight_points))]

    traces.append(go.Scattermapbox(
        lon=hull_point_lons,
        lat=hull_point_lats,
        mode="markers",
        marker=dict(
            size=15,
            color="red",
            symbol="star",
            opacity=1.0
        ),
        name="Hull Points (Highest Weight)",
        text=[f"<b>Hull Point</b><br>Weight: {w:.3f}" for w in hull_point_weights],
        hovertemplate="%{text}<extra></extra>",
        showlegend=True
    ))

    # Calculate map center and zoom
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
        lon_range = max(all_lons) - min(all_lons) if len(all_lons) > 1 else 0
        lat_range = max(all_lats) - min(all_lats) if len(all_lats) > 1 else 0
        max_range = max(lon_range, lat_range)

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

    # Create layout
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": cy, "lon": cx},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
        "title": f"Convex Hull Visualization - Top {hull_count} Points by {weight_type}",
        "legend": {
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.8)",
            "bordercolor": "black",
            "borderwidth": 1
        }
    }

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created convex hull display with {len(traces)} traces")
    print(f"✅ DEBUG: Convex hull figure created successfully with {len(traces)} traces")

    return fig


def create_fallback_display(gdf: gpd.GeoDataFrame, weight_type: str) -> go.Figure:
    """Fallback display when convex hull can't be created."""
    from ..weighted_display import create_weighted_default
    return create_weighted_default(gdf, weight_type)


def create_empty_figure() -> go.Figure:
    """Create an empty figure when no data is available."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 0, "b": 0, "l": 0}
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for convex hull visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig