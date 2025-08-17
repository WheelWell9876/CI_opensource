# geo_open_source/webapp/display/weighted_options/bubble_map.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd

from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a bubble map visualization where bubble size represents weight."""
    logger.info(f"Creating bubble map display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🔧 DEBUG: bubble_map.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to bubble_map")
        return create_empty_figure()

    # Apply data fraction sampling if specified
    original_size = len(gdf)
    data_fraction = 1.0

    print(f"🔧 DEBUG: Config received in bubble_map: {config}")

    if config and 'data_fraction' in config:
        data_fraction = config['data_fraction']
        print(f"📊 DEBUG: Found data_fraction in config: {data_fraction}")
    elif config and 'dataFraction' in config:  # Handle both naming conventions
        data_fraction = config['dataFraction']
        print(f"📊 DEBUG: Found dataFraction in config: {data_fraction}")
    else:
        print(f"📊 DEBUG: No data fraction found in config, using default: {data_fraction}")

    print(f"📊 DEBUG: Original dataset size: {original_size}")
    print(f"📊 DEBUG: Data fraction to use: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:  # Only sample if we have enough data
        sample_size = max(10, int(len(gdf) * data_fraction))  # Minimum 10 points
        print(f"📊 DEBUG: Calculated sample size: {sample_size}")
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: After sampling - actual dataset size: {len(gdf)}")
        print(f"📊 DEBUG: Sampled {len(gdf)} points from {original_size} ({data_fraction * 100:.1f}%)")
    else:
        print(f"📊 DEBUG: Using all {len(gdf)} data points (no sampling applied)")
        if data_fraction >= 1.0:
            print(f"📊 DEBUG: No sampling because data_fraction >= 1.0")
        if len(gdf) <= 10:
            print(f"📊 DEBUG: No sampling because dataset too small ({len(gdf)} <= 10)")

    # Extract points, weights, and dataset information
    all_lons, all_lats = [], []
    traces = []
    dataset_colors = {}
    seen_datasets = set()

    # Determine if we have a Dataset column for coloring
    has_ds = "Dataset" in gdf.columns

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get dataset name and color
        dataset_name = str(row.get("Dataset", "Bubble Data")) if has_ds else "Bubble Data"
        if dataset_name not in dataset_colors:
            dataset_colors[dataset_name] = color_for_label(dataset_name)

        # Get weight value
        weight = 1.0
        if weight_type and weight_type in gdf.columns:
            try:
                weight = float(row[weight_type])
            except Exception:
                weight = 1.0

        # Calculate bubble size based on weight
        # Use a more dramatic size scaling for bubble maps
        if np.isfinite(weight) and weight > 0:
            # Logarithmic scaling for better visual differentiation
            bubble_size = max(10, min(60, 15 + np.log10(weight + 1) * 25))
        else:
            bubble_size = 10

        # Create comprehensive hover text
        hover_text = create_bubble_hover_text(row, weight_type, weight)

        # Handle different geometry types
        if geom.geom_type == "Point":
            lon, lat = geom.x, geom.y
            all_lons.append(lon)
            all_lats.append(lat)

            # Create individual trace for this bubble
            trace = go.Scattermapbox(
                lon=[lon],
                lat=[lat],
                mode="markers",
                marker=dict(
                    size=bubble_size,
                    color=dataset_colors[dataset_name],
                    opacity=0.7  # Slightly more opaque since we can't add borders
                ),
                name=dataset_name,
                customdata=[hover_text],
                hovertemplate="%{customdata}<extra></extra>",
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset_name],
                    bordercolor="white",
                    font=dict(color="white", size=11)
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
                        size=bubble_size,
                        color=dataset_colors[dataset_name],
                        opacity=0.7  # Slightly more opaque since we can't add borders
                    ),
                    name=dataset_name,
                    customdata=[hover_text],
                    hovertemplate="%{customdata}<extra></extra>",
                    hoverlabel=dict(
                        bgcolor=dataset_colors[dataset_name],
                        bordercolor="white",
                        font=dict(color="white", size=11)
                    ),
                    showlegend=dataset_name not in seen_datasets,
                    legendgroup=dataset_name
                )
                traces.append(trace)
                seen_datasets.add(dataset_name)

    if not traces:
        logger.warning("No valid traces created for bubble map")
        return create_empty_figure()

    print(f"✅ DEBUG: Created {len(traces)} bubble traces")

    # Calculate map center and zoom
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
        lon_range = max(all_lons) - min(all_lons) if len(all_lons) > 1 else 0
        lat_range = max(all_lats) - min(all_lats) if len(all_lats) > 1 else 0
        max_range = max(lon_range, lat_range)

        if max_range < 0.1:
            zoom = 11
        elif max_range < 1:
            zoom = 7
        elif max_range < 5:
            zoom = 5
        else:
            zoom = 3
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
        "title": f"Bubble Map - Size represents {weight_type}",
        "hovermode": "closest",
        "hoverdistance": 30,  # Larger hover distance for bubbles
    }

    if has_ds and len(seen_datasets) > 1:
        layout["legend"] = {
            "title": {"text": f"Datasets (Bubble size: {weight_type})"},
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.9)",
            "bordercolor": "black",
            "borderwidth": 1
        }

    # Add annotations explaining bubble sizes and sampling
    annotations = [
        dict(
            text=f"💡 Bubble size represents {weight_type} values<br>Larger bubbles = higher weights",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.98,
            xanchor="left", yanchor="top",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="gray",
            borderwidth=1,
            font=dict(size=12)
        )
    ]

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        annotations.append(
            dict(
                text=f"📊 Showing {len(gdf)} of {original_size} data points ({data_fraction * 100:.1f}%)",
                showarrow=False,
                xref="paper", yref="paper",
                x=0.02, y=0.02,
                xanchor="left", yanchor="bottom",
                bgcolor="rgba(255,255,255,0.8)",
                bordercolor="blue",
                borderwidth=1,
                font=dict(size=10, color="blue")
            )
        )

    layout["annotations"] = annotations

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created bubble map with {len(traces)} bubbles")
    print(f"✅ DEBUG: Bubble map created successfully with {len(traces)} bubbles")

    return fig


def create_bubble_hover_text(row, weight_type: str, weight_value: float) -> str:
    """Create comprehensive hover text for bubble map."""
    hover_parts = []

    # Add a title with bubble information
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in row and pd.notna(row[field]):
            title = str(row[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🫧 {title}</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🫧 Bubble Data Point</b>")

    # Add bubble size explanation prominently
    hover_parts.append(
        f"<b style='color: #FF6B35; font-size: 13px;'>Bubble Weight ({weight_type}): {weight_value:.3f}</b>")
    hover_parts.append("<span style='color: #666;'>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>")

    # Show priority fields first
    priority_fields = ['Dataset', 'Category', 'State', 'County', 'City', 'Type', 'Status']
    shown_fields = set(['geometry'])  # Track what we've shown

    for field in priority_fields:
        if field in row and pd.notna(row[field]):
            value = str(row[field])
            hover_parts.append(
                f"<b style='color: #555; font-size: 11px;'>{field}:</b> <span style='color: #000; font-size: 11px;'>{value}</span>")
            shown_fields.add(field)

    # Add separator if we have more fields
    remaining_fields = [k for k in row.index if k not in shown_fields and pd.notna(row[k])]
    if remaining_fields:
        hover_parts.append("<span style='color: #666;'>──────────────────────────────────</span>")

    # Show other weight-related fields
    weight_fields = [k for k in row.index if 'weight' in k.lower() or 'normalized' in k.lower()]
    for field in weight_fields:
        if field in shown_fields or field not in row.index or pd.isna(row[field]):
            continue
        value = row[field]
        if isinstance(value, (int, float)):
            formatted_value = f"{value:.6f}" if abs(value) < 0.001 else f"{value:.3f}"
        else:
            formatted_value = str(value)
        hover_parts.append(
            f"<b style='color: #666; font-size: 10px;'>{field}:</b> <span style='color: #333; font-size: 10px;'>{formatted_value}</span>")
        shown_fields.add(field)

    # Show other important fields (limit to prevent huge hover boxes)
    field_count = 0
    max_additional_fields = 6

    for key, value in row.items():
        if key in shown_fields or pd.isna(value) or field_count >= max_additional_fields:
            continue

        # Format the value nicely
        if isinstance(value, (int, float)):
            if isinstance(value, float):
                if abs(value) < 0.001 and value != 0:
                    formatted_value = f"{value:.2e}"
                elif abs(value) < 1000:
                    formatted_value = f"{value:.3f}".rstrip('0').rstrip('.')
                else:
                    formatted_value = f"{value:,.2f}"
            else:
                formatted_value = f"{value:,}"
        else:
            formatted_value = str(value)
            if len(formatted_value) > 40:
                formatted_value = formatted_value[:37] + "..."

        hover_parts.append(
            f"<b style='color: #555; font-size: 10px;'>{key}:</b> <span style='color: #000; font-size: 10px;'>{formatted_value}</span>")
        field_count += 1

    # Add summary of remaining fields if any
    total_remaining = len([k for k in row.index if k not in shown_fields and pd.notna(row[k])]) - field_count
    if total_remaining > 0:
        hover_parts.append(f"<i style='color: #888; font-size: 9px;'>... +{total_remaining} more fields</i>")

    return "<br>".join(hover_parts)


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
        text="No data available for bubble map visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig