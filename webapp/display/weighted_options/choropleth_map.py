def create_choropleth_map(gdf):
    if "county" not in gdf.columns:
        logger.debug("Choropleth: no 'county' property; using default display")
        return create_default_display(gdf)
    agg = gdf.groupby("county").agg({"original": "mean", "geometry": "first"}).reset_index()
    centroids = agg.geometry.centroid
    lats = centroids.y.tolist()
    lons = centroids.x.tolist()
    values = agg["original"].tolist()
    trace = {
        "type": "choroplethmapbox",
        "locations": agg["county"].tolist(),
        "z": values,
        "colorscale": "Viridis",
        "colorbar": {"title": "Avg Weight"},
        "geojson": {},
        "featureidkey": "properties.name",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Choropleth: aggregated %d counties", len(agg))
    return [trace], layout
