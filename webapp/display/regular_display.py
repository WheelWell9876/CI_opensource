# Update your regular_display.py to support config and data sampling

from __future__ import annotations
import geopandas as gpd
import plotly.graph_objects as go
import pandas as pd
import numpy as np
from typing import Dict, Any
import logging

from .display import (
    ensure_shapely, color_for_label, center_of, openstreetmap_layout,
    traces_from_geometry
)
from .geometry_filters import filter_by_geometry_types  # Import the geometry filter

logger = logging.getLogger(__name__)


def create_regular_display(gdf: gpd.GeoDataFrame, config: dict = None) -> go.Figure:
    """Create regular display with optional data sampling and geometry filtering support."""
    logger.info(f"Creating regular display from {len(gdf)} features")
    print(f"🔧 DEBUG: create_regular_display called with {len(gdf)} rows")

    if config:
        print(f"🔧 DEBUG: Config received in regular display: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to regular display")
        return create_empty_regular_figure()

    # Apply geometry type filtering first
    if config and 'geometry_types' in config:
        from .geometry_filters import filter_by_geometry_types
        pre_filter_count = len(gdf)
        gdf = filter_by_geometry_types(gdf, config=config)
        if len(gdf) != pre_filter_count:
            print(f"🎯 DEBUG: Geometry filter applied: {pre_filter_count} → {len(gdf)} rows")

    if gdf.empty:
        logger.warning("No data after geometry filtering")
        return create_empty_regular_figure()

    # Apply data fraction sampling if specified
    original_size = len(gdf)
    data_fraction = 1.0

    if config and 'data_fraction' in config:
        data_fraction = config['data_fraction']
        print(f"📊 DEBUG: Found data_fraction in regular config: {data_fraction}")
    elif config and 'dataFraction' in config:
        data_fraction = config['dataFraction']
        print(f"📊 DEBUG: Found dataFraction in regular config: {data_fraction}")
    else:
        print(f"📊 DEBUG: No data fraction found in regular config, using all data")

    print(f"📊 DEBUG: Regular - Original dataset size: {original_size}")
    print(f"📊 DEBUG: Regular - Data fraction to use: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        print(f"📊 DEBUG: Regular - Calculated sample size: {sample_size}")
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Regular - After sampling: {len(gdf)} points ({data_fraction * 100:.1f}%)")
    else:
        print(f"📊 DEBUG: Regular - Using all {len(gdf)} data points (no sampling)")

    # Determine if we have a Dataset column for coloring
    has_ds = "Dataset" in gdf.columns
    all_lons, all_lats = [], []
    traces = []
    dataset_colors = {}
    seen_datasets = set()

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get dataset name and color
        dataset_name = str(row.get("Dataset", "Regular Data")) if has_ds else "Regular Data"
        if dataset_name not in dataset_colors:
            dataset_colors[dataset_name] = color_for_label(dataset_name)

        # Create hover text
        hover_text = create_regular_hover_text(row)

        # Handle different geometry types
        if geom.geom_type == "Point":
            lon, lat = geom.x, geom.y
            all_lons.append(lon)
            all_lats.append(lat)

            trace = go.Scattermapbox(
                lon=[lon],
                lat=[lat],
                mode="markers",
                marker=dict(
                    size=8,
                    color=dataset_colors[dataset_name],
                    opacity=0.8
                ),
                name=dataset_name,
                customdata=[hover_text],
                hovertemplate="%{customdata}<extra></extra>",
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset_name],
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
                        size=8,
                        color=dataset_colors[dataset_name],
                        opacity=0.8
                    ),
                    name=dataset_name,
                    customdata=[hover_text],
                    hovertemplate="%{customdata}<extra></extra>",
                    hoverlabel=dict(
                        bgcolor=dataset_colors[dataset_name],
                        bordercolor="white",
                        font=dict(color="white", size=10)
                    ),
                    showlegend=dataset_name not in seen_datasets,
                    legendgroup=dataset_name
                )
                traces.append(trace)
                seen_datasets.add(dataset_name)

        # Handle other geometry types (lines, polygons)
        else:
            geom_traces = traces_from_geometry(
                geom,
                name=dataset_name,
                color=dataset_colors[dataset_name],
                hovertext=hover_text,
                showlegend=dataset_name not in seen_datasets,
                legendgroup=dataset_name
            )
            traces.extend(geom_traces)
            seen_datasets.add(dataset_name)

            # Add coordinates for centering
            if geom.geom_type == "LineString":
                xs, ys = geom.xy
                all_lons.extend(xs)
                all_lats.extend(ys)
            elif geom.geom_type == "MultiLineString":
                for line in geom.geoms:
                    xs, ys = line.xy
                    all_lons.extend(xs)
                    all_lats.extend(ys)
            elif geom.geom_type == "Polygon":
                xs, ys = geom.exterior.coords.xy
                all_lons.extend(xs)
                all_lats.extend(ys)
            elif geom.geom_type == "MultiPolygon":
                for poly in geom.geoms:
                    xs, ys = poly.exterior.coords.xy
                    all_lons.extend(xs)
                    all_lats.extend(ys)

    if not traces:
        logger.warning("No valid traces created for regular display")
        return create_empty_regular_figure()

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
        "title": "Regular Data Display",
        "hovermode": "closest",
    }

    if has_ds and len(seen_datasets) > 1:
        layout["legend"] = {
            "title": {"text": "Datasets"},
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.8)",
            "bordercolor": "black",
            "borderwidth": 1
        }

    # Add info annotations
    annotations = []

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        annotations.append(dict(
            text=f"📊 Showing {len(gdf)} of {original_size} data points ({data_fraction * 100:.1f}%)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.02,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        ))

    # Add geometry filter info if filtering applied
    if config and 'geometry_types' in config:
        geom_types_text = ", ".join(config['geometry_types'])
        annotations.append(dict(
            text=f"🔍 Showing: {geom_types_text}",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.06,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="green",
            borderwidth=1,
            font=dict(size=10, color="green")
        ))

    if annotations:
        layout["annotations"] = annotations

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created regular display with {len(traces)} traces")
    print(f"✅ DEBUG: Regular display created with {len(traces)} traces")

    return fig


def create_regular_hover_text(row) -> str:
    """Create hover text for regular data."""
    hover_parts = []

    # Add a title
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in row and pd.notna(row[field]):
            title = str(row[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>{title}</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>Data Point</b>")

    hover_parts.append("<span style='color: #666;'>────────────────────────────────────────</span>")

    # Show priority fields
    priority_fields = ['Dataset', 'Category', 'State', 'County', 'City', 'Type', 'Status']
    shown_fields = set(['geometry'])

    for field in priority_fields:
        if field in row and pd.notna(row[field]):
            value = str(row[field])
            hover_parts.append(
                f"<b style='color: #555; font-size: 11px;'>{field}:</b> <span style='color: #000; font-size: 11px;'>{value}</span>")
            shown_fields.add(field)

    # Show other important fields (limit to prevent huge hover boxes)
    field_count = 0
    max_additional_fields = 8

    for key, value in row.items():
        if key in shown_fields or pd.isna(value) or field_count >= max_additional_fields:
            continue

        # Format the value nicely
        if isinstance(value, (int, float)):
            if isinstance(value, float):
                formatted_value = f"{value:.3f}".rstrip('0').rstrip('.')
            else:
                formatted_value = f"{value:,}"
        else:
            formatted_value = str(value)
            if len(formatted_value) > 40:
                formatted_value = formatted_value[:37] + "..."

        hover_parts.append(
            f"<b style='color: #555; font-size: 10px;'>{key}:</b> <span style='color: #000; font-size: 10px;'>{formatted_value}</span>")
        field_count += 1

    return "<br>".join(hover_parts)


def create_empty_regular_figure() -> go.Figure:
    """Create an empty figure for regular data."""
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
        text="No regular data available for the selected filters",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig