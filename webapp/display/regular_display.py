from __future__ import annotations

import geopandas as gpd
import plotly.graph_objects as go
import pandas as pd
import numpy as np
from typing import Dict, Any, List
import logging

from .display import (
    ensure_shapely, color_for_label, traces_from_geometry,
    center_of, openstreetmap_layout, flatten_points
)

logger = logging.getLogger(__name__)


def create_regular_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any] = None) -> go.Figure:
    """
    Simplified regular display focused on working hover text.
    """
    config = config or {}

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to create_regular_display")
        return create_empty_figure()

    # Apply basic filtering
    filtered_gdf = apply_basic_filters(gdf, config)

    if filtered_gdf.empty:
        logger.warning("No data remaining after applying filters")
        return create_empty_figure()

    # Generate the map with working hover
    return create_simple_display(filtered_gdf, config)


def apply_basic_filters(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> gpd.GeoDataFrame:
    """Apply basic filtering to the GeoDataFrame."""
    filtered_gdf = gdf.copy()

    # Apply data fraction sampling
    data_fraction = config.get('data_fraction', 1.0)
    if data_fraction < 1.0:
        sample_size = int(len(filtered_gdf) * data_fraction)
        if sample_size > 0:
            filtered_gdf = filtered_gdf.sample(n=sample_size, random_state=42)

    # Filter by geometry types if specified
    geometry_types = config.get('geometry_types', [])
    if geometry_types:
        mask = filtered_gdf.geometry.apply(
            lambda geom: ensure_shapely(geom) is not None and
                         getattr(ensure_shapely(geom), 'geom_type', '') in geometry_types
        )
        filtered_gdf = filtered_gdf[mask]

    # Filter out invalid geometries
    filtered_gdf = filtered_gdf[filtered_gdf.geometry.notna()]

    return filtered_gdf


def create_simple_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> go.Figure:
    """Create a simple display that definitely works with hover text."""
    has_ds = "Dataset" in gdf.columns
    all_lons, all_lats = [], []
    traces = []

    logger.info(f"Creating display for {len(gdf)} features, has Dataset column: {has_ds}")

    # Simple approach: one trace per row for debugging
    dataset_colors = {}
    seen_datasets = set()

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get dataset name and color
        dataset_name = str(row.get("Dataset", "Unknown")) if has_ds else "Data"
        if dataset_name not in dataset_colors:
            dataset_colors[dataset_name] = color_for_label(dataset_name)

        # Create clean hover text without HTML wrappers
        hover_text = create_clean_hover_text(row)
        logger.debug(f"Created hover text for row {idx}: {len(hover_text)} characters")

        # Handle point geometries only for now (to debug)
        if geom.geom_type == "Point":
            lon, lat = geom.x, geom.y
            all_lons.append(lon)
            all_lats.append(lat)

            # Create individual trace for this point
            trace = go.Scattermapbox(
                lon=[lon],
                lat=[lat],
                mode="markers",
                marker=dict(
                    size=10,  # Slightly larger for easier hovering
                    color=dataset_colors[dataset_name],
                    opacity=0.8
                ),
                name=dataset_name,
                customdata=[hover_text],  # Store hover text in customdata
                hovertemplate="%{customdata}<extra></extra>",  # Simple template
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset_name],  # Use dataset color for hover background
                    bordercolor="white",
                    font=dict(color="white", size=10)
                ),
                showlegend=dataset_name not in seen_datasets,
                legendgroup=dataset_name
            )
            traces.append(trace)
            seen_datasets.add(dataset_name)

        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                lon, lat = point.x, point.y
                all_lons.append(lon)
                all_lats.append(lat)

                trace = go.Scattermapbox(
                    lon=[lon],
                    lat=[lat],
                    mode="markers",
                    marker=dict(
                        size=10,
                        color=dataset_colors[dataset_name],
                        opacity=0.8
                    ),
                    name=dataset_name,
                    customdata=[hover_text],
                    hovertemplate="%{customdata}<extra></extra>",  # Simple template
                    hoverlabel=dict(
                        bgcolor=dataset_colors[dataset_name],  # Use dataset color for hover background
                        bordercolor="white",
                        font=dict(color="white", size=10)
                    ),
                    showlegend=dataset_name not in seen_datasets,
                    legendgroup=dataset_name
                )
                traces.append(trace)
                seen_datasets.add(dataset_name)

    logger.info(f"Created {len(traces)} traces for display")

    # Calculate map center
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
    else:
        cx, cy = -98.5795, 39.8283

    # Create layout with minimal hover configuration to let individual traces handle colors
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lon": cx, "lat": cy},
            "zoom": 8,  # Zoom in a bit more to see points better
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
        "hovermode": "closest",
        "hoverdistance": 20,  # Make hover more sensitive
        # Remove global hoverlabel to let individual traces control their colors
    }

    if has_ds:
        layout["legend"] = {"title": {"text": "Datasets"}}

    # Create figure
    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Created figure with {len(traces)} traces, center at ({cx:.3f}, {cy:.3f})")
    return fig


def create_clean_hover_text(row) -> str:
    """Create clean hover text without HTML div wrappers."""
    hover_parts = []

    # Get dataset name for color coordination
    dataset_name = str(row.get("Dataset", "Unknown"))

    # Add a title based on available fields
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in row and pd.notna(row[field]):
            title = str(row[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #2E86AB; font-size: 13px;'>{title}</b>")
        hover_parts.append("<span style='color: #666;'>─────────────────────────</span>")

    # Show ALL fields without any truncation
    for key, value in row.items():
        if key.lower() == "geometry":
            continue

        # Skip null/NaN values
        if pd.isna(value):
            continue

        # Format the value nicely but don't truncate
        if isinstance(value, (int, float)):
            if isinstance(value, float):
                # Handle very small or very large numbers
                if abs(value) < 0.001 and value != 0:
                    formatted_value = f"{value:.2e}"
                elif abs(value) < 1000:
                    formatted_value = f"{value:.3f}".rstrip('0').rstrip('.')
                else:
                    formatted_value = f"{value:,.2f}"
            else:
                formatted_value = f"{value:,}"  # Add comma separators for large integers
        else:
            formatted_value = str(value)
            # Don't truncate here - let the full content show

        hover_parts.append(
            f"<b style='color: #555; font-size: 10px;'>{key}:</b> <span style='color: #000; font-size: 10px;'>{formatted_value}</span>")

    # Join all parts without any HTML wrappers
    result = "<br>".join(hover_parts)
    return result


def create_empty_figure() -> go.Figure:
    """Create an empty figure with appropriate messaging."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 0, "b": 0, "l": 0}
    )

    # Add annotation for empty state
    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for the selected filters",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig