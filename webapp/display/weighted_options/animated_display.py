# geo_open_source/webapp/display/weighted_options/animated_display.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create an animated visualization that transitions between different weight representations."""
    logger.info(f"Creating animated display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🎬 DEBUG: animated_display.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to animated display")
        return create_empty_figure()

    # Apply data fraction sampling if specified
    original_size = len(gdf)
    data_fraction = 1.0

    if config and 'data_fraction' in config:
        data_fraction = config['data_fraction']
    elif config and 'dataFraction' in config:
        data_fraction = config['dataFraction']

    print(f"📊 DEBUG: Original dataset size: {original_size}")
    print(f"📊 DEBUG: Data fraction to use: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Sampled {len(gdf)} points from {original_size} ({data_fraction * 100:.1f}%)")

    # Extract animation data
    animation_data = extract_animation_data(gdf, weight_type)

    if not animation_data['points']:
        logger.warning("No valid animation data found")
        return create_empty_figure()

    print(f"🎬 DEBUG: Extracted {len(animation_data['points'])} points for animation")
    print(f"🎬 DEBUG: Available weight types: {animation_data['weight_types']}")

    # Create animated figure
    fig = create_animated_figure(animation_data, weight_type, config)

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        fig.add_annotation(
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

    logger.info(f"Successfully created animated display with {len(animation_data['points'])} points")
    print(f"✅ DEBUG: Animated display created with {len(animation_data['points'])} points")

    return fig


def extract_animation_data(gdf: gpd.GeoDataFrame, weight_type: str) -> dict:
    """Extract data for animation including multiple weight types."""
    points_data = []

    # Find all weight-related columns for animation frames
    weight_columns = [col for col in gdf.columns if 'weight' in col.lower() or 'normalized' in col.lower()]
    if weight_type and weight_type in gdf.columns and weight_type not in weight_columns:
        weight_columns.append(weight_type)

    # Add common weight column names if they exist
    common_weight_cols = ['original', 'Weight', 'normalizedDatasetWeight', 'normalizedCategoryWeight',
                          'normalizedOverallWeight']
    for col in common_weight_cols:
        if col in gdf.columns and col not in weight_columns:
            weight_columns.append(col)

    # Ensure we have at least the primary weight type
    if not weight_columns and weight_type in gdf.columns:
        weight_columns = [weight_type]
    elif not weight_columns:
        weight_columns = ['default']  # Fallback

    print(f"🎬 DEBUG: Found weight columns for animation: {weight_columns}")

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get dataset name for coloring
        dataset_name = str(row.get("Dataset", "Animated Data")) if "Dataset" in gdf.columns else "Animated Data"

        # Extract weights for all animation frames
        weights = {}
        for col in weight_columns:
            if col == 'default':
                weights[col] = 1.0
            elif col in gdf.columns:
                try:
                    weights[col] = float(row[col])
                except Exception:
                    weights[col] = 1.0
            else:
                weights[col] = 1.0

        # Handle different geometry types
        if geom.geom_type == "Point":
            points_data.append({
                'lon': geom.x,
                'lat': geom.y,
                'weights': weights,
                'dataset': dataset_name,
                'original_data': row.to_dict()
            })
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                points_data.append({
                    'lon': point.x,
                    'lat': point.y,
                    'weights': weights,
                    'dataset': dataset_name,
                    'original_data': row.to_dict()
                })

    return {
        'points': points_data,
        'weight_types': weight_columns
    }


def create_animated_figure(animation_data: dict, primary_weight_type: str, config: dict) -> go.Figure:
    """Create the main animated figure with frames."""

    points = animation_data['points']
    weight_types = animation_data['weight_types']

    # Prepare base data
    lons = [p['lon'] for p in points]
    lats = [p['lat'] for p in points]
    datasets = [p['dataset'] for p in points]

    # Determine if we have multiple datasets
    unique_datasets = list(set(datasets))
    has_multiple_datasets = len(unique_datasets) > 1

    # Create color mapping for datasets
    dataset_colors = {}
    for dataset in unique_datasets:
        dataset_colors[dataset] = color_for_label(dataset)

    # Calculate map center
    center_lat = np.mean(lats) if lats else 39.8283
    center_lon = np.mean(lons) if lons else -98.5795

    # Calculate zoom based on data spread
    if len(lons) > 1:
        lon_range = max(lons) - min(lons)
        lat_range = max(lats) - min(lats)
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
        zoom = 6

    # Create initial frame (use primary weight type)
    initial_weights = [p['weights'].get(primary_weight_type, 1.0) for p in points]

    # Create hover texts
    hover_texts = []
    for i, point in enumerate(points):
        hover_text = create_animated_hover_text(point, primary_weight_type, initial_weights[i])
        hover_texts.append(hover_text)

    # Create initial traces
    initial_traces = []

    if has_multiple_datasets:
        for dataset in unique_datasets:
            dataset_indices = [i for i, d in enumerate(datasets) if d == dataset]
            dataset_lons = [lons[i] for i in dataset_indices]
            dataset_lats = [lats[i] for i in dataset_indices]
            dataset_weights = [initial_weights[i] for i in dataset_indices]
            dataset_hovers = [hover_texts[i] for i in dataset_indices]

            # Calculate marker sizes based on weights
            marker_sizes = [max(6, min(30, w * 15.0)) if np.isfinite(w) else 8 for w in dataset_weights]

            trace = go.Scattermapbox(
                lon=dataset_lons,
                lat=dataset_lats,
                mode='markers',
                marker=dict(
                    size=marker_sizes,
                    color=dataset_colors[dataset],
                    opacity=0.8,
                    colorscale='Viridis'
                ),
                name=dataset,
                customdata=dataset_hovers,
                hovertemplate='%{customdata}<extra></extra>',
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset],
                    bordercolor="white",
                    font=dict(color="white", size=11)
                )
            )
            initial_traces.append(trace)
    else:
        # Single trace
        marker_sizes = [max(6, min(30, w * 15.0)) if np.isfinite(w) else 8 for w in initial_weights]

        trace = go.Scattermapbox(
            lon=lons,
            lat=lats,
            mode='markers',
            marker=dict(
                size=marker_sizes,
                color=initial_weights,
                colorscale='Viridis',
                opacity=0.8,
                colorbar=dict(
                    title=f"Weight ({primary_weight_type})",
                    x=1.02,
                    len=0.8
                )
            ),
            name="Animated Data",
            customdata=hover_texts,
            hovertemplate='%{customdata}<extra></extra>',
            hoverlabel=dict(
                bgcolor="rgba(50,50,50,0.8)",
                bordercolor="white",
                font=dict(color="white", size=11)
            )
        )
        initial_traces.append(trace)

    # Create animation frames
    frames = []
    for weight_type in weight_types:
        frame_weights = [p['weights'].get(weight_type, 1.0) for p in points]

        # Create hover texts for this frame
        frame_hovers = []
        for i, point in enumerate(points):
            hover_text = create_animated_hover_text(point, weight_type, frame_weights[i])
            frame_hovers.append(hover_text)

        frame_traces = []

        if has_multiple_datasets:
            for dataset in unique_datasets:
                dataset_indices = [i for i, d in enumerate(datasets) if d == dataset]
                dataset_lons = [lons[i] for i in dataset_indices]
                dataset_lats = [lats[i] for i in dataset_indices]
                dataset_weights = [frame_weights[i] for i in dataset_indices]
                dataset_hovers = [frame_hovers[i] for i in dataset_indices]

                marker_sizes = [max(6, min(30, w * 15.0)) if np.isfinite(w) else 8 for w in dataset_weights]

                frame_trace = go.Scattermapbox(
                    lon=dataset_lons,
                    lat=dataset_lats,
                    mode='markers',
                    marker=dict(
                        size=marker_sizes,
                        color=dataset_colors[dataset],
                        opacity=0.8
                    ),
                    name=dataset,
                    customdata=dataset_hovers,
                    hovertemplate='%{customdata}<extra></extra>'
                )
                frame_traces.append(frame_trace)
        else:
            marker_sizes = [max(6, min(30, w * 15.0)) if np.isfinite(w) else 8 for w in frame_weights]

            frame_trace = go.Scattermapbox(
                lon=lons,
                lat=lats,
                mode='markers',
                marker=dict(
                    size=marker_sizes,
                    color=frame_weights,
                    colorscale='Viridis',
                    opacity=0.8,
                    colorbar=dict(
                        title=f"Weight ({weight_type})",
                        x=1.02,
                        len=0.8
                    )
                ),
                name="Animated Data",
                customdata=frame_hovers,
                hovertemplate='%{customdata}<extra></extra>'
            )
            frame_traces.append(frame_trace)

        frame = go.Frame(
            data=frame_traces,
            name=weight_type,
            layout=dict(
                title=f"Animated Visualization - {weight_type}",
                annotations=[
                    dict(
                        text=f"🎬 Current Weight Type: <b>{weight_type}</b>",
                        showarrow=False,
                        xref="paper", yref="paper",
                        x=0.5, y=0.98,
                        xanchor="center", yanchor="top",
                        bgcolor="rgba(255,255,255,0.9)",
                        bordercolor="gray",
                        borderwidth=1,
                        font=dict(size=14, color="black")
                    )
                ]
            )
        )
        frames.append(frame)

    # Create figure
    fig = go.Figure(data=initial_traces, frames=frames)

    # Update layout with animation controls
    fig.update_layout(
        mapbox=dict(
            style="open-street-map",
            center=dict(lat=center_lat, lon=center_lon),
            zoom=zoom
        ),
        margin=dict(r=0, t=80, b=0, l=0),
        title=dict(
            text=f"Animated Weight Visualization - {primary_weight_type}",
            x=0.5,
            font=dict(size=16)
        ),
        showlegend=has_multiple_datasets,
        legend=dict(
            x=1.02,
            y=1,
            bgcolor="rgba(255,255,255,0.9)",
            bordercolor="black",
            borderwidth=1
        ) if has_multiple_datasets else None,
        updatemenus=[
            dict(
                type="buttons",
                direction="left",
                buttons=list([
                    dict(
                        args=[None, {
                            "frame": {"duration": 2000, "redraw": True},
                            "fromcurrent": True,
                            "transition": {"duration": 300, "easing": "quadratic-in-out"}
                        }],
                        label="▶️ Play",
                        method="animate"
                    ),
                    dict(
                        args=[[None], {
                            "frame": {"duration": 0, "redraw": True},
                            "mode": "immediate",
                            "transition": {"duration": 0}
                        }],
                        label="⏸️ Pause",
                        method="animate"
                    )
                ]),
                pad={"r": 10, "t": 87},
                showactive=False,
                x=0.011,
                xanchor="right",
                y=0,
                yanchor="top"
            ),
        ],
        sliders=[dict(
            active=0,
            currentvalue={"prefix": "Weight Type: "},
            pad={"t": 50},
            steps=[
                dict(
                    args=[[wt], {
                        "frame": {"duration": 300, "redraw": True},
                        "mode": "immediate",
                        "transition": {"duration": 300}
                    }],
                    label=wt,
                    method="animate"
                ) for wt in weight_types
            ]
        )]
    )

    # Add explanatory annotation
    fig.add_annotation(
        text="🎬 Animation Controls:<br>▶️ Play to cycle through weight types<br>🎛️ Use slider to jump to specific weights",
        showarrow=False,
        xref="paper", yref="paper",
        x=0.02, y=0.98,
        xanchor="left", yanchor="top",
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1,
        font=dict(size=10)
    )

    return fig


def create_animated_hover_text(point_data: dict, weight_type: str, weight_value: float) -> str:
    """Create hover text for animated points."""
    hover_parts = []

    # Title
    original_data = point_data['original_data']
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in original_data and pd.notna(original_data[field]):
            title = str(original_data[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🎬 {title}</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🎬 Animated Data Point</b>")

    # Current animation frame info
    hover_parts.append(
        f"<b style='color: #FF6B35; font-size: 13px;'>Current Weight ({weight_type}): {weight_value:.3f}</b>")
    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────</span>")

    # Show all available weights for this point
    hover_parts.append("<b style='color: #555; font-size: 11px;'>All Weight Types:</b>")
    for wt, val in point_data['weights'].items():
        indicator = "👈" if wt == weight_type else ""
        hover_parts.append(f"<span style='color: #333; font-size: 10px;'>  • {wt}: {val:.3f} {indicator}</span>")

    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────</span>")

    # Location and dataset info
    hover_parts.append(
        f"<b style='color: #555; font-size: 10px;'>Location:</b> <span style='color: #000; font-size: 10px;'>{point_data['lat']:.4f}°N, {point_data['lon']:.4f}°W</span>")
    hover_parts.append(
        f"<b style='color: #555; font-size: 10px;'>Dataset:</b> <span style='color: #000; font-size: 10px;'>{point_data['dataset']}</span>")

    return "<br>".join(hover_parts)


def create_empty_figure() -> go.Figure:
    """Create an empty animated figure when no data is available."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 50, "b": 0, "l": 0}
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for animated visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig