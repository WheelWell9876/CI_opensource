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


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a convex hull visualization over high-weight points with improved algorithm."""
    logger.info(f"Creating convex hull display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🔧 DEBUG: convex_hull.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")
    print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to convex_hull")
        return create_empty_figure()

    # Apply geometry type filtering first
    if config and 'geometry_types' in config:
        from ..geometry_filters import filter_by_geometry_types
        pre_filter_count = len(gdf)
        gdf = filter_by_geometry_types(gdf, config=config)
        if len(gdf) != pre_filter_count:
            print(f"🔍 DEBUG: Convex hull geometry filter: {pre_filter_count} → {len(gdf)} rows")

    if gdf.empty:
        logger.warning("No data after geometry filtering for convex hull")
        return create_empty_figure()

    # Apply data fraction sampling
    original_size = len(gdf)
    data_fraction = 1.0

    if config:
        data_fraction = config.get('data_fraction', config.get('dataFraction', 1.0))
        print(f"📊 DEBUG: Convex hull data fraction: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Convex hull sampled to {len(gdf)} points ({data_fraction * 100:.1f}%)")

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
                if not np.isfinite(weight):
                    weight = 1.0
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
        return create_fallback_display(gdf, weight_type, config)

    print(f"✅ DEBUG: Extracted {len(points_data)} points for convex hull")

    # Calculate weight thresholds for multiple hulls
    weights = [p['weight'] for p in points_data]
    weight_percentiles = np.percentile(weights, [50, 75, 90, 95])  # 50th, 75th, 90th, 95th percentiles

    print(
        f"📊 DEBUG: Weight percentiles - 50th: {weight_percentiles[0]:.3f}, 75th: {weight_percentiles[1]:.3f}, 90th: {weight_percentiles[2]:.3f}, 95th: {weight_percentiles[3]:.3f}")

    # Create multiple convex hulls for different weight thresholds
    hull_configs = [
        {'threshold': weight_percentiles[3], 'color': 'rgba(255, 0, 0, 0.3)', 'name': 'Top 5% Weight Zone',
         'line_color': 'red'},
        {'threshold': weight_percentiles[2], 'color': 'rgba(255, 165, 0, 0.2)', 'name': 'Top 10% Weight Zone',
         'line_color': 'orange'},
        {'threshold': weight_percentiles[1], 'color': 'rgba(255, 255, 0, 0.15)', 'name': 'Top 25% Weight Zone',
         'line_color': 'gold'},
        {'threshold': weight_percentiles[0], 'color': 'rgba(0, 255, 0, 0.1)', 'name': 'Above Median Weight Zone',
         'line_color': 'green'}
    ]

    traces = []
    hull_point_sets = []

    # Create convex hulls for each threshold (from highest to lowest)
    for config_item in hull_configs:
        threshold = config_item['threshold']
        hull_points = [p for p in points_data if p['weight'] >= threshold]

        if len(hull_points) < 3:
            print(f"⚠️ DEBUG: Not enough points above threshold {threshold:.3f}, skipping hull")
            continue

        try:
            coords = np.array([[p['lon'], p['lat']] for p in hull_points])

            # Remove duplicate points to avoid ConvexHull errors
            unique_coords = np.unique(coords, axis=0)
            if len(unique_coords) < 3:
                print(f"⚠️ DEBUG: Not enough unique points for threshold {threshold:.3f}, skipping")
                continue

            hull = ConvexHull(unique_coords)
            hull_vertices = unique_coords[hull.vertices]

            # Close the hull by adding the first point at the end
            hull_lons = list(hull_vertices[:, 0]) + [hull_vertices[0, 0]]
            hull_lats = list(hull_vertices[:, 1]) + [hull_vertices[0, 1]]

            # Add the convex hull as a filled polygon
            traces.append(go.Scattermapbox(
                lon=hull_lons,
                lat=hull_lats,
                mode="lines",
                fill="toself",
                fillcolor=config_item['color'],
                line=dict(color=config_item['line_color'], width=2),
                name=config_item['name'],
                hovertemplate=f"<b>{config_item['name']}</b><br>Min Weight: {threshold:.3f}<br>Points: {len(hull_points)}<extra></extra>",
                showlegend=True
            ))

            hull_point_sets.append({'points': hull_points, 'threshold': threshold, 'color': config_item['line_color']})

            print(f"✅ DEBUG: Created convex hull for threshold {threshold:.3f} with {len(hull.vertices)} vertices")

        except Exception as e:
            logger.error(f"Error creating convex hull for threshold {threshold:.3f}: {e}")
            print(f"❌ DEBUG: Error creating convex hull for threshold {threshold:.3f}: {e}")
            continue

    # Add all points as markers with size and color based on weight
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

        # Determine which hull zones this point belongs to
        zones = []
        for hull_config in hull_configs:
            if weight >= hull_config['threshold']:
                zones.append(hull_config['name'])

        if zones:
            hover_text += f"Zones: {', '.join(zones)}<br>"

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
            colorbar=dict(
                title=dict(text=f"Weight ({weight_type})"),
                x=1.02
            )
        ),
        name="All Data Points",
        text=hover_texts,
        hovertemplate="%{text}<extra></extra>",
        showlegend=True
    ))

    # Add special markers for the highest weight points in each hull
    for i, hull_set in enumerate(hull_point_sets):
        if i == 0:  # Only highlight the top-tier hull points
            hull_points = hull_set['points']
            top_points = sorted(hull_points, key=lambda x: x['weight'], reverse=True)[:5]  # Top 5 points

            if top_points:
                traces.append(go.Scattermapbox(
                    lon=[p['lon'] for p in top_points],
                    lat=[p['lat'] for p in top_points],
                    mode="markers",
                    marker=dict(
                        size=20,
                        color=hull_set['color'],
                        symbol="star",
                        opacity=1.0
                    ),
                    name="Highest Weight Points",
                    text=[f"<b>Top Weight Point</b><br>Weight: {p['weight']:.3f}" for p in top_points],
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
            "style": config.get("map_style", "open-street-map") if config else "open-street-map",
            "center": {"lat": cy, "lon": cx},
            "zoom": zoom,
        },
        "margin": {"r": 60, "t": 30, "l": 0, "b": 0},
        "title": {
            "text": f"Multi-Level Convex Hull - Weight Zones ({weight_type})",
            "x": 0.5,
            "font": {"size": 16}
        },
        "legend": {
            "x": 0.02,
            "y": 0.98,
            "bgcolor": "rgba(255,255,255,0.8)",
            "bordercolor": "black",
            "borderwidth": 1
        }
    }

    # Add info annotations
    annotations = []

    if data_fraction < 1.0:
        annotations.append(dict(
            text=f"📊 Showing {len(gdf)} of {original_size} points ({data_fraction * 100:.1f}%)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.98, y=0.02,
            xanchor="right", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        ))

    # Add hull statistics
    annotations.append(dict(
        text=f"🎯 {len(traces) - 1} Weight Zones Created<br>📊 {len(points_data)} Total Points",
        showarrow=False,
        xref="paper", yref="paper",
        x=0.98, y=0.98,
        xanchor="right", yanchor="top",
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="purple",
        borderwidth=1,
        font=dict(size=10, color="purple")
    ))

    if annotations:
        layout["annotations"] = annotations

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created convex hull display with {len(traces)} traces")
    print(f"✅ DEBUG: Multi-level convex hull figure created successfully with {len(traces)} traces")

    return fig


def create_fallback_display(gdf: gpd.GeoDataFrame, weight_type: str, config: dict = None) -> go.Figure:
    """Fallback display when convex hull can't be created."""
    from ..weighted_display import create_weighted_default
    return create_weighted_default(gdf, weight_type, config)


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