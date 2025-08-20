import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from scipy.stats import gaussian_kde
from typing import Dict, Any, List, Tuple

from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """
    Create Gaussian KDE density heatmap overlay on mapbox.
    Shows smooth density estimation as a colored heatmap layer.
    """
    logger.info(f"Creating Mapbox Gaussian KDE from {len(gdf)} features using weight_type: {weight_type}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to Gaussian KDE")
        return create_empty_kde_figure()

    # Apply geometry type filtering first
    if config and 'geometry_types' in config:
        from ..geometry_filters import filter_by_geometry_types
        pre_filter_count = len(gdf)
        gdf = filter_by_geometry_types(gdf, config=config)
        if len(gdf) != pre_filter_count:
            print(f"🔍 DEBUG: Gaussian KDE geometry filter: {pre_filter_count} → {len(gdf)} rows")

    if gdf.empty:
        logger.warning("No data after geometry filtering for Gaussian KDE")
        return create_empty_kde_figure()

    # Apply data fraction sampling
    original_size = len(gdf)
    data_fraction = 1.0

    if config:
        data_fraction = config.get('data_fraction', config.get('dataFraction', 1.0))
        print(f"📊 DEBUG: Gaussian KDE data fraction: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Gaussian KDE sampled to {len(gdf)} points ({data_fraction * 100:.1f}%)")

    # Extract point coordinates and weights
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
                if not np.isfinite(weight) or weight <= 0:
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
        logger.warning("Not enough points for Gaussian KDE (need at least 3)")
        print("⚠️ DEBUG: Not enough points for Gaussian KDE, falling back to default display")
        return create_fallback_display(gdf, weight_type, config)

    print(f"📈 DEBUG: Gaussian KDE processing {len(points_data)} points")

    # Prepare data for KDE
    lons = np.array([p['lon'] for p in points_data])
    lats = np.array([p['lat'] for p in points_data])
    weights = np.array([p['weight'] for p in points_data])

    print(f"⚖️ DEBUG: Weight stats - min: {weights.min():.4f}, max: {weights.max():.4f}, mean: {weights.mean():.4f}")

    # Create KDE
    try:
        # Stack coordinates for KDE
        coordinates = np.vstack([lons, lats])

        # Create weighted KDE
        kde = gaussian_kde(coordinates, weights=weights)

        print("✅ DEBUG: Gaussian KDE created successfully")

    except Exception as e:
        logger.error(f"Error creating Gaussian KDE: {e}")
        print(f"❌ DEBUG: Error creating Gaussian KDE: {e}")
        return create_fallback_display(gdf, weight_type, config)

    # Create a dense grid of points for smooth heatmap
    lon_range = max(lons) - min(lons)
    lat_range = max(lats) - min(lats)

    # Add padding around the data
    padding = 0.1  # 10% padding
    lon_min = min(lons) - lon_range * padding
    lon_max = max(lons) + lon_range * padding
    lat_min = min(lats) - lat_range * padding
    lat_max = max(lats) + lat_range * padding

    # Create a much denser grid for smooth appearance
    grid_density = 100  # Higher resolution

    xi = np.linspace(lon_min, lon_max, grid_density)
    yi = np.linspace(lat_min, lat_max, grid_density)
    xi_grid, yi_grid = np.meshgrid(xi, yi)

    # Evaluate KDE on grid
    try:
        grid_coordinates = np.vstack([xi_grid.flatten(), yi_grid.flatten()])
        zi = kde(grid_coordinates)

        # Reshape and normalize the density values
        zi = zi.reshape(xi_grid.shape)
        zi_normalized = (zi - zi.min()) / (zi.max() - zi.min()) if zi.max() > zi.min() else zi

        print(f"📊 DEBUG: KDE evaluated on {grid_density}x{grid_density} grid")
        print(f"📊 DEBUG: Density range: {zi.min():.2e} to {zi.max():.2e}")

    except Exception as e:
        logger.error(f"Error evaluating KDE on grid: {e}")
        print(f"❌ DEBUG: Error evaluating KDE on grid: {e}")
        return create_fallback_display(gdf, weight_type, config)

    # Create traces
    traces = []

    # Method 1: Use multiple Densitymapbox points with varying densities
    # Sample points from the grid based on density
    n_heatmap_points = 2000  # Number of points to create the heatmap effect

    # Create probability distribution from density
    zi_flat = zi_normalized.flatten()
    zi_prob = zi_flat / zi_flat.sum()  # Normalize to probabilities

    # Sample points based on density
    sample_indices = np.random.choice(len(zi_flat), size=n_heatmap_points, p=zi_prob, replace=True)

    # Get coordinates and densities for sampled points
    lon_heatmap = xi_grid.flatten()[sample_indices]
    lat_heatmap = yi_grid.flatten()[sample_indices]
    density_heatmap = zi_flat[sample_indices]

    # Create main heatmap using Densitymapbox
    heatmap_trace = go.Densitymapbox(
        lat=lat_heatmap,
        lon=lon_heatmap,
        z=density_heatmap,
        radius=25,  # Radius for smoothing
        colorscale=[
            [0.0, "rgba(68, 1, 84, 0)"],  # Transparent purple (low density)
            [0.2, "rgba(68, 1, 84, 0.4)"],  # Semi-transparent purple
            [0.4, "rgba(62, 73, 137, 0.6)"],  # Blue-purple
            [0.6, "rgba(49, 104, 142, 0.7)"],  # Blue
            [0.8, "rgba(53, 139, 187, 0.8)"],  # Light blue
            [1.0, "rgba(253, 231, 37, 0.9)"]  # Bright yellow-hot
        ],
        opacity=0.8,
        name=f"KDE Density Heatmap ({weight_type})",
        colorbar=dict(
            title=dict(text=f"Density ({weight_type})"),
            x=1.02,
            tickformat=".2e"
        ),
        hovertemplate="<b>Density Heatmap</b><br>" +
                      "Lon: %{lon:.4f}<br>" +
                      "Lat: %{lat:.4f}<br>" +
                      f"Density ({weight_type}): " + "%{z:.2e}<br>" +
                      "<extra></extra>",
        showlegend=True
    )
    traces.append(heatmap_trace)

    # Add original data points as small markers
    point_lons = [p['lon'] for p in points_data]
    point_lats = [p['lat'] for p in points_data]
    point_weights = [p['weight'] for p in points_data]

    # Create hover text for original points
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

    # Add original points as small white dots
    points_trace = go.Scattermapbox(
        lon=point_lons,
        lat=point_lats,
        mode="markers",
        marker=dict(
            size=6,
            color="white",
            opacity=0.9
        ),
        name="Original Data Points",
        text=hover_texts,
        hovertemplate="%{text}<extra></extra>",
        showlegend=True
    )
    traces.append(points_trace)

    # Calculate map center and zoom
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
        lon_range_calc = max(all_lons) - min(all_lons) if len(all_lons) > 1 else 0
        lat_range_calc = max(all_lats) - min(all_lats) if len(all_lats) > 1 else 0
        max_range = max(lon_range_calc, lat_range_calc)

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
            "text": f"Gaussian KDE Density Heatmap - {weight_type} ({len(points_data)} points)",
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
            x=0.02, y=0.02,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        ))

    # Add KDE info
    annotations.append(dict(
        text=f"📈 Gaussian KDE Heatmap<br>Grid: {grid_density}×{grid_density}<br>Heatmap Points: {n_heatmap_points}",
        showarrow=False,
        xref="paper", yref="paper",
        x=0.98, y=0.98,
        xanchor="right", yanchor="top",
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="green",
        borderwidth=1,
        font=dict(size=10, color="green")
    ))

    if annotations:
        layout["annotations"] = annotations

    # Create figure
    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created Gaussian KDE heatmap with {len(traces)} traces")
    print(f"✅ DEBUG: Gaussian KDE heatmap figure created successfully")

    return fig


def create_fallback_display(gdf: gpd.GeoDataFrame, weight_type: str, config: dict = None) -> go.Figure:
    """Fallback display when KDE can't be created."""
    from ..weighted_display import create_weighted_default
    return create_weighted_default(gdf, weight_type, config)


def create_empty_kde_figure() -> go.Figure:
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
        text="No data available for Gaussian KDE visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig