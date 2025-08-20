# geo_open_source/webapp/display/weighted_options/threed_extrusion.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a 3D extrusion visualization where height represents weight."""
    logger.info(f"Creating 3D extrusion display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🏗️ DEBUG: threed_extrusion.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to 3D extrusion")
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

    # Extract 3D point data
    points_3d = extract_3d_points(gdf, weight_type)

    if not points_3d:
        logger.warning("No valid 3D point data found")
        return create_empty_figure()

    print(f"🏗️ DEBUG: Extracted {len(points_3d)} 3D points")

    # Create 3D visualization
    fig = create_3d_figure(points_3d, weight_type, gdf, config)

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        fig.add_annotation(
            text=f"📊 Showing {len(gdf)} of {original_size} data points ({data_fraction * 100:.1f}%)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.98,
            xanchor="left", yanchor="top",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        )

    logger.info(f"Successfully created 3D extrusion with {len(points_3d)} points")
    print(f"✅ DEBUG: 3D extrusion created with {len(points_3d)} points")

    return fig


def extract_3d_points(gdf: gpd.GeoDataFrame, weight_type: str) -> list:
    """Extract 3D point data from GeoDataFrame."""
    points_3d = []

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

        # Get dataset name for coloring
        dataset_name = str(row.get("Dataset", "3D Data")) if "Dataset" in gdf.columns else "3D Data"

        # Handle different geometry types
        if geom.geom_type == "Point":
            points_3d.append({
                'lon': geom.x,
                'lat': geom.y,
                'weight': weight,
                'dataset': dataset_name,
                'original_data': row.to_dict()
            })
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                points_3d.append({
                    'lon': point.x,
                    'lat': point.y,
                    'weight': weight,
                    'dataset': dataset_name,
                    'original_data': row.to_dict()
                })

    return points_3d


def create_3d_figure(points_3d: list, weight_type: str, gdf: gpd.GeoDataFrame, config: dict) -> go.Figure:
    """Create the main 3D figure."""

    # Prepare data arrays
    lons = [p['lon'] for p in points_3d]
    lats = [p['lat'] for p in points_3d]
    weights = [p['weight'] for p in points_3d]
    datasets = [p['dataset'] for p in points_3d]

    # Calculate extrusion heights (Z values)
    # Normalize weights to reasonable height range
    if weights:
        min_weight = min(weights)
        max_weight = max(weights)
        weight_range = max_weight - min_weight if max_weight != min_weight else 1

        # Scale heights from 0 to 100 units, with minimum height of 5
        heights = [5 + ((w - min_weight) / weight_range) * 95 for w in weights]
    else:
        heights = [5] * len(lons)

    # Create color mapping based on weights
    colors = weights  # Use weights for color scaling

    # Create hover text
    hover_texts = []
    for i, point_data in enumerate(points_3d):
        hover_text = create_3d_hover_text(point_data, weight_type, heights[i])
        hover_texts.append(hover_text)

    # Determine if we have multiple datasets for coloring
    unique_datasets = list(set(datasets))
    has_multiple_datasets = len(unique_datasets) > 1

    traces = []

    if has_multiple_datasets:
        # Create separate traces for each dataset
        dataset_colors = {}
        for i, dataset in enumerate(unique_datasets):
            dataset_colors[dataset] = color_for_label(dataset)

        for dataset in unique_datasets:
            # Filter points for this dataset
            dataset_indices = [i for i, d in enumerate(datasets) if d == dataset]
            dataset_lons = [lons[i] for i in dataset_indices]
            dataset_lats = [lats[i] for i in dataset_indices]
            dataset_heights = [heights[i] for i in dataset_indices]
            dataset_weights = [weights[i] for i in dataset_indices]
            dataset_hovers = [hover_texts[i] for i in dataset_indices]

            trace = go.Scatter3d(
                x=dataset_lons,
                y=dataset_lats,
                z=dataset_heights,
                mode='markers',
                marker=dict(
                    size=8,
                    color=dataset_weights,
                    colorscale='Viridis',
                    opacity=0.8,
                    line=dict(width=2, color=dataset_colors[dataset]),
                    colorbar=dict(
                        title=f"Weight ({weight_type})",
                        x=1.02,
                        len=0.8
                    ) if dataset == unique_datasets[0] else None  # Only show colorbar once
                ),
                name=dataset,
                text=dataset_hovers,
                hovertemplate='%{text}<extra></extra>',
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset],
                    bordercolor="white",
                    font=dict(color="white", size=12)
                )
            )
            traces.append(trace)
    else:
        # Single trace for all data
        trace = go.Scatter3d(
            x=lons,
            y=lats,
            z=heights,
            mode='markers',
            marker=dict(
                size=8,
                color=colors,
                colorscale='Viridis',
                opacity=0.8,
                line=dict(width=1, color='black'),
                colorbar=dict(
                    title=f"Weight ({weight_type})",
                    x=1.02,
                    len=0.8
                )
            ),
            name="3D Extrusion",
            text=hover_texts,
            hovertemplate='%{text}<extra></extra>',
            hoverlabel=dict(
                bgcolor="rgba(50,50,50,0.8)",
                bordercolor="white",
                font=dict(color="white", size=12)
            )
        )
        traces.append(trace)

    # Add optional surface/base plane for reference
    if len(points_3d) > 4:  # Only if we have enough points
        base_trace = create_base_surface(lons, lats)
        if base_trace:
            traces.append(base_trace)

    # Calculate scene bounds
    lon_center = np.mean(lons) if lons else -98.5795
    lat_center = np.mean(lats) if lats else 39.8283
    height_max = max(heights) if heights else 100

    # Create layout
    layout = {
        "scene": {
            "xaxis": {
                "title": "Longitude",
                "showgrid": True,
                "gridcolor": "lightgray",
                "showbackground": True,
                "backgroundcolor": "rgba(230,230,230,0.3)"
            },
            "yaxis": {
                "title": "Latitude",
                "showgrid": True,
                "gridcolor": "lightgray",
                "showbackground": True,
                "backgroundcolor": "rgba(230,230,230,0.3)"
            },
            "zaxis": {
                "title": f"Extrusion Height ({weight_type})",
                "showgrid": True,
                "gridcolor": "lightgray",
                "showbackground": True,
                "backgroundcolor": "rgba(230,230,230,0.3)",
                "range": [0, height_max * 1.1]
            },
            "camera": {
                "eye": {"x": 1.5, "y": 1.5, "z": 1.2},
                "center": {"x": 0, "y": 0, "z": 0}
            },
            "aspectmode": "manual",
            "aspectratio": {"x": 1, "y": 1, "z": 0.6}
        },
        "title": {
            "text": f"3D Extrusion Visualization - Heights represent {weight_type} values",
            "x": 0.5,
            "font": {"size": 16}
        },
        "margin": {"r": 0, "t": 50, "b": 0, "l": 0},
        "showlegend": has_multiple_datasets,
        "legend": {
            "x": 0.02,
            "y": 0.98,
            "bgcolor": "rgba(255,255,255,0.9)",
            "bordercolor": "black",
            "borderwidth": 1
        } if has_multiple_datasets else None
    }

    # Add explanatory annotation
    layout["annotations"] = [
        dict(
            text="🏗️ 3D Extrusion Map<br>💡 Height represents weight values<br>🎨 Color intensity shows weight magnitude",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.02,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="gray",
            borderwidth=1,
            font=dict(size=11)
        )
    ]

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    return fig


def create_base_surface(lons: list, lats: list) -> go.Surface:
    """Create a base surface plane for reference."""
    try:
        # Create a simple grid at z=0 for reference
        lon_min, lon_max = min(lons), max(lons)
        lat_min, lat_max = min(lats), max(lats)

        # Create a simple 2x2 grid
        x_grid = np.array([[lon_min, lon_max], [lon_min, lon_max]])
        y_grid = np.array([[lat_min, lat_min], [lat_max, lat_max]])
        z_grid = np.zeros_like(x_grid)

        return go.Surface(
            x=x_grid,
            y=y_grid,
            z=z_grid,
            opacity=0.2,
            colorscale=[[0, 'lightgray'], [1, 'lightgray']],
            showscale=False,
            name="Base Reference",
            hovertemplate="Base Reference Plane<extra></extra>"
        )
    except Exception as e:
        print(f"⚠️ DEBUG: Could not create base surface: {e}")
        return None


def create_3d_hover_text(point_data: dict, weight_type: str, height: float) -> str:
    """Create hover text for 3D points."""
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
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🏗️ {title}</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🏗️ 3D Data Point</b>")

    # 3D information
    hover_parts.append(
        f"<b style='color: #FF6B35; font-size: 13px;'>Weight ({weight_type}): {point_data['weight']:.3f}</b>")
    hover_parts.append(f"<b style='color: #32CD32; font-size: 12px;'>Extrusion Height: {height:.1f} units</b>")
    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────</span>")

    # Location info
    hover_parts.append(
        f"<b style='color: #555; font-size: 11px;'>Location:</b> <span style='color: #000; font-size: 11px;'>{point_data['lat']:.4f}°N, {point_data['lon']:.4f}°W</span>")
    hover_parts.append(
        f"<b style='color: #555; font-size: 11px;'>Dataset:</b> <span style='color: #000; font-size: 11px;'>{point_data['dataset']}</span>")

    # Additional fields from original data
    priority_fields = ['State', 'County', 'City', 'Type', 'Category']
    shown_fields = set(['geometry', 'name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME'])

    for field in priority_fields:
        if field in original_data and pd.notna(original_data[field]) and field not in shown_fields:
            value = str(original_data[field])
            hover_parts.append(
                f"<b style='color: #555; font-size: 10px;'>{field}:</b> <span style='color: #000; font-size: 10px;'>{value}</span>")
            shown_fields.add(field)

    return "<br>".join(hover_parts)


def create_empty_figure() -> go.Figure:
    """Create an empty 3D figure when no data is available."""
    fig = go.Figure()

    # Create basic 3D scene
    fig.update_layout(
        scene=dict(
            xaxis=dict(title="Longitude"),
            yaxis=dict(title="Latitude"),
            zaxis=dict(title="Height")
        ),
        margin=dict(r=0, t=50, b=0, l=0)
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for 3D extrusion visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig