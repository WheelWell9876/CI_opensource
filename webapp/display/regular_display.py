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
    Enhanced regular display with better geometry support and configuration options.

    Args:
        gdf: GeoDataFrame with geometry and optional Dataset column
        config: Optional configuration dict
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

    # Generate the map
    return create_basic_display(filtered_gdf, config)


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


def create_basic_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> go.Figure:
    """Create the standard display with dataset-based coloring."""
    has_ds = "Dataset" in gdf.columns
    seen_datasets: Dict[str, bool] = {}
    all_lons, all_lats = [], []
    traces = []

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Determine dataset label and color
        label = str(row["Dataset"]) if has_ds else "Data"
        color = color_for_label(label)

        # Create hover text
        hover = create_hover_text(row)

        # Check if this is the first occurrence of this dataset (for legend)
        show_legend = label not in seen_datasets
        seen_datasets[label] = True

        # Generate traces for this geometry
        geom_traces = traces_from_geometry(
            geom,
            name=label,
            color=color,
            hovertext=hover,
            showlegend=show_legend,
            legendgroup=label
        )
        traces.extend(geom_traces)

        # Collect coordinates for centering
        points = flatten_points(geom)
        if points:
            for lon, lat in points:
                all_lons.append(lon)
                all_lats.append(lat)
        else:
            # For non-point geometries, use bounds
            try:
                bounds = geom.bounds
                if len(bounds) >= 4:
                    all_lons.extend([bounds[0], bounds[2]])
                    all_lats.extend([bounds[1], bounds[3]])
            except:
                # Skip if bounds calculation fails
                pass

    # Calculate map center and create layout
    cx, cy = center_of(all_lons, all_lats)
    layout = openstreetmap_layout(cx, cy, 6, "Datasets" if has_ds else "Data")

    # Create and configure the figure
    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Created regular display with {len(traces)} traces for {len(gdf)} features")
    return fig


def create_hover_text(row) -> str:
    """Create formatted hover text from a row of data."""
    hover_parts = []

    for key, value in row.items():
        if key.lower() == "geometry":
            continue

        # Format the value nicely
        if pd.isna(value):
            continue
        elif isinstance(value, (int, float)):
            if isinstance(value, float):
                formatted_value = f"{value:.3f}" if abs(value) < 1000 else f"{value:.2e}"
            else:
                formatted_value = str(value)
        else:
            formatted_value = str(value)

        hover_parts.append(f"{key}: {formatted_value}")

    return "<br>".join(hover_parts)


def create_empty_figure() -> go.Figure:
    """Create an empty figure with appropriate messaging."""
    fig = go.Figure()
    fig.update_layout(**openstreetmap_layout(-98.5795, 39.8283, 3, "No Data"))

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