import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from typing import Dict, Any, List, Tuple

from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """
    Create a weighted heatmap with color gradient blobs (red hot → orange → yellow → purple cool).
    Shows weight density with intensity based on weight values, with optional data points overlay.
    """
    logger.info(f"Creating heat blob weighted heatmap from {len(gdf)} features using weight_type: {weight_type}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to weighted heatmap")
        return _create_empty_weighted_heatmap()

    # Apply geometry filtering if specified
    if config and 'geometry_types' in config:
        from ..geometry_filters import filter_by_geometry_types
        pre_filter_count = len(gdf)
        gdf = filter_by_geometry_types(gdf, config=config)
        if len(gdf) != pre_filter_count:
            print(f"🔍 DEBUG: Weighted heatmap geometry filter: {pre_filter_count} → {len(gdf)} rows")

    if gdf.empty:
        logger.warning("No data after geometry filtering for weighted heatmap")
        return _create_empty_weighted_heatmap()

    # Apply data fraction sampling
    original_size = len(gdf)
    data_fraction = 1.0

    if config:
        data_fraction = config.get('data_fraction', config.get('dataFraction', 1.0))
        print(f"📊 DEBUG: Weighted heatmap data fraction: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Weighted heatmap sampled to {len(gdf)} points ({data_fraction * 100:.1f}%)")

    # Check if weight column exists
    if weight_type not in gdf.columns:
        logger.warning(f"Weight column '{weight_type}' not found. Available columns: {list(gdf.columns)}")
        weight_type = "original"  # fallback

    print(f"⚖️ DEBUG: Using weight column: {weight_type}")

    # Extract point coordinates and weights
    lats, lons, weights = [], [], []
    point_data = []  # Store for optional point overlay
    processed_count = 0
    skipped_weight_count = 0

    for _, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get weight value
        weight = 1.0
        if weight_type in gdf.columns:
            try:
                weight = float(row[weight_type])
                if not np.isfinite(weight):
                    weight = 1.0
                    skipped_weight_count += 1
            except (ValueError, TypeError):
                weight = 1.0
                skipped_weight_count += 1

        gt = getattr(geom, "geom_type", "")
        if gt == "Point":
            lon, lat = geom.x, geom.y
            lons.append(lon)
            lats.append(lat)
            weights.append(weight)
            point_data.append((lon, lat, weight, row))
            processed_count += 1
        elif gt == "MultiPoint":
            for point in geom.geoms:
                lon, lat = point.x, point.y
                lons.append(lon)
                lats.append(lat)
                weights.append(weight)  # Use same weight for all points in MultiPoint
                point_data.append((lon, lat, weight, row))
                processed_count += 1

    if not lats or not lons:
        logger.warning("No valid points found for weighted heatmap")
        return _create_empty_weighted_heatmap()

    print(f"🔥 DEBUG: Weighted heatmap processing {len(lats)} points with weights")
    print(f"⚖️ DEBUG: Weight stats - min: {min(weights):.4f}, max: {max(weights):.4f}, mean: {np.mean(weights):.4f}")

    if skipped_weight_count > 0:
        print(f"⚠️ DEBUG: Skipped {skipped_weight_count} invalid weight values")

    # Check if user wants to show data points overlay
    show_points = config.get('show_heatmap_points', False) if config else False

    traces = []

    # Create the main weighted density heatmap blob (red hot → orange → yellow → purple cool)
    # The key difference: using z=weights to influence intensity
    heatmap_trace = go.Densitymapbox(
        lat=lats,
        lon=lons,
        z=weights,  # This makes it weight-based instead of pure density
        radius=20,  # Slightly smaller for weight-based visualization
        colorscale=[
            [0.0, "rgb(128, 0, 128)"],  # Purple (low weight/cool)
            [0.3, "rgb(255, 255, 0)"],  # Yellow
            [0.6, "rgb(255, 165, 0)"],  # Orange
            [1.0, "rgb(255, 0, 0)"]  # Red (high weight/hot)
        ],
        opacity=0.7,
        name=f"Weight Heat Blobs ({weight_type})",
        colorbar=dict(
            title=dict(text=f"Weight Density<br>({weight_type})"),
            x=1.02,
            tickformat=".3f"
        ),
        hovertemplate="<b>Weight Heat Zone</b><br>" +
                      f"Weight ({weight_type}): " + "%{z:.4f}<br>" +
                      "Lat: %{lat:.4f}<br>" +
                      "Lon: %{lon:.4f}<br>" +
                      "<extra></extra>",
        showlegend=True
    )
    traces.append(heatmap_trace)

    # Add data points overlay if requested
    if show_points:
        print(f"📍 DEBUG: Adding {len(point_data)} weighted data points overlay")

        # Group by dataset for consistent coloring
        dataset_groups = {}
        for lon, lat, weight, row in point_data:
            dataset_name = str(row.get("Dataset", "Weighted Data Points"))
            if dataset_name not in dataset_groups:
                dataset_groups[dataset_name] = []
            dataset_groups[dataset_name].append((lon, lat, weight, row))

        # Create traces for each dataset
        for dataset_name, points in dataset_groups.items():
            point_lons = [p[0] for p in points]
            point_lats = [p[1] for p in points]
            point_weights = [p[2] for p in points]

            # Create hover text for points
            hover_texts = []
            for _, _, weight, row in points:
                hover_parts = [f"<b>{dataset_name}</b>"]
                hover_parts.append(f"Weight ({weight_type}): {weight:.4f}")
                for field in ['name', 'Name', 'title', 'Title', 'facility_name']:
                    if field in row and row[field]:
                        hover_parts.append(f"{field}: {row[field]}")
                        break
                hover_texts.append("<br>".join(hover_parts))

            # Size points based on weight for better visualization
            point_sizes = [max(4, min(15, w * 10)) if np.isfinite(w) else 6 for w in point_weights]

            point_trace = go.Scattermapbox(
                lat=point_lats,
                lon=point_lons,
                mode="markers",
                marker=dict(
                    size=point_sizes,
                    color=color_for_label(dataset_name),
                    opacity=0.8,
                    line=dict(color="white", width=1)
                ),
                name=f"{dataset_name} Points",
                customdata=hover_texts,
                hovertemplate="%{customdata}<extra></extra>",
                showlegend=True,
                legendgroup="points"
            )
            traces.append(point_trace)

    # Calculate center and zoom
    if lats and lons:
        cx, cy = center_of(lons, lats)
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

    # Create layout
    layout = {
        "mapbox": {
            "style": config.get("map_style", "open-street-map") if config else "open-street-map",
            "center": {"lat": cy, "lon": cx},
            "zoom": zoom
        },
        "margin": {"r": 60, "t": 30, "b": 0, "l": 0},
        "title": {
            "text": f"Weighted Heat Blobs - {weight_type} ({len(lats)} points)",
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

    # Add annotations for data info
    annotations = []

    if data_fraction < 1.0:
        annotations.append(dict(
            text=f"📊 Showing {len(gdf)} of {original_size} points ({data_fraction * 100:.1f}%)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.02,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        ))

    # Add weight information
    viz_type = "Weight Blobs + Points" if show_points else "Weight Blobs Only"
    annotations.append(dict(
        text=f"⚖️ {viz_type}<br>Range: {min(weights):.3f} - {max(weights):.3f}",
        showarrow=False,
        xref="paper", yref="paper",
        x=0.98, y=0.98,
        xanchor="right", yanchor="top",
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="purple",
        borderwidth=1,
        font=dict(size=10, color="purple")
    ))

    if skipped_weight_count > 0:
        annotations.append(dict(
            text=f"⚠️ {skipped_weight_count} invalid weights defaulted to 1.0",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.98, y=0.02,
            xanchor="right", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="orange",
            borderwidth=1,
            font=dict(size=9, color="orange")
        ))

    if annotations:
        layout["annotations"] = annotations

    # Create and return figure
    fig = go.Figure(data=traces, layout=layout)

    logger.info(
        f"Weighted heat blob heatmap created with {len(lats)} points using {weight_type}, show_points={show_points}")
    print(f"✅ DEBUG: Weighted heat blob heatmap completed - weight-based visualization")

    return fig


def _create_empty_weighted_heatmap() -> go.Figure:
    """Create an empty weighted heatmap figure."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 60, "t": 30, "b": 0, "l": 0},
        title="Weighted Heat Blob Heatmap - No Data Available"
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No weighted point data available for heatmap",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig