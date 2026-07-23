import { describe, expect, it } from "vitest";
import {
  combineProviders,
  createBasemapCatalog,
  DEFAULT_BASEMAPS,
  DEFAULT_BASEMAP_PROVIDERS,
  filterBasemaps,
  getBasemapCategories,
  resolveBasemapProviders,
} from "../src/lib/core/catalog";

describe("basemap catalog", () => {
  it("includes default basemaps and custom basemaps", () => {
    const catalog = createBasemapCatalog([
      {
        id: "custom",
        name: "Custom",
        provider: "custom",
        type: "raster",
        source: {
          type: "raster",
          tiles: ["https://example.com/{z}/{x}/{y}.png"],
        },
      },
    ]);

    expect(catalog.length).toBe(DEFAULT_BASEMAPS.length + 1);
    expect(catalog.some((basemap) => basemap.id === "custom")).toBe(true);
  });

  it("can replace the default catalog", () => {
    const catalog = createBasemapCatalog(
      [
        {
          id: "custom",
          name: "Custom",
          provider: "custom",
          type: "raster",
          source: {
            type: "raster",
            tiles: ["https://example.com/{z}/{x}/{y}.png"],
          },
        },
      ],
      false,
    );

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe("custom");
  });

  it("filters by query, provider, and category", () => {
    const catalog = createBasemapCatalog();

    expect(
      filterBasemaps(catalog, { query: "imagery" }).map((item) => item.id),
    ).toContain("esri-world-imagery");
    expect(
      filterBasemaps(catalog, { provider: "carto" }).length,
    ).toBeGreaterThan(3);
    expect(
      filterBasemaps(catalog, { category: "Terrain" }).map((item) => item.id),
    ).toContain("opentopomap");
  });

  it("includes additional XYZ basemaps from the qgis-basemaps catalog", () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);

    expect(ids).toContain("google-satellite");
    expect(ids).toContain("swisstopo-swissimage");
    expect(ids).toContain("nasa-gibs-blue-marble");
    expect(ids).toContain("usgs-us-topo");
  });

  it("no longer ships the nlmaps provider or its basemaps", () => {
    const catalog = createBasemapCatalog();

    expect(
      catalog.filter((basemap) => basemap.provider === "nlmaps"),
    ).toHaveLength(0);
    expect(
      catalog.filter((basemap) => basemap.id.startsWith("nlmaps-")),
    ).toHaveLength(0);
    expect(
      DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id),
    ).not.toContain("nlmaps");
    // The provider list is also derived from the catalog, so a stray basemap
    // would resurrect the filter entry even without the default above.
    expect(resolveBasemapProviders(catalog).map((p) => p.id)).not.toContain(
      "nlmaps",
    );
  });

  it("includes the Openbasiskaart Netherlands basemap on the Web Mercator grid", () => {
    const catalog = createBasemapCatalog();
    const openbasiskaart = catalog.find(
      (basemap) => basemap.id === "openbasiskaart",
    );

    expect(openbasiskaart?.provider).toBe("openbasiskaart");
    expect(openbasiskaart?.category).toBe("Regional");
    expect(
      openbasiskaart?.source.type === "raster"
        ? openbasiskaart.source.tiles[0]
        : "",
    ).toBe(
      "https://www.openbasiskaart.nl/mapcache/wmts/1.0.0/osm-g/default/g/{z}/{y}/{x}.png",
    );
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toContain(
      "openbasiskaart",
    );
  });

  it("includes the EOX Sentinel-2 cloudless and terrain basemaps", () => {
    const catalog = createBasemapCatalog();
    const s2cloudless = catalog.find(
      (basemap) => basemap.id === "eox-s2cloudless-2025",
    );
    const terrainLight = catalog.find(
      (basemap) => basemap.id === "eox-terrain-light",
    );

    expect(s2cloudless?.provider).toBe("eox");
    expect(s2cloudless?.category).toBe("Imagery");
    expect(
      s2cloudless?.source.type === "raster" ? s2cloudless.source.tiles[0] : "",
    ).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    );
    expect(s2cloudless?.attribution).toContain("EOX IT Services GmbH");
    expect(s2cloudless?.attribution).toContain("Copernicus Sentinel data 2025");

    // EOX publishes annual Sentinel-2 cloudless mosaics; the catalog should
    // expose one entry per year from 2018 through 2025.
    for (let year = 2018; year <= 2025; year += 1) {
      const yearly = catalog.find(
        (basemap) => basemap.id === `eox-s2cloudless-${year}`,
      );
      expect(yearly, `missing eox-s2cloudless-${year}`).toBeDefined();
      expect(yearly?.provider).toBe("eox");
      expect(yearly?.name).toBe(`EOX Sentinel-2 cloudless ${year}`);
      expect(
        yearly?.source.type === "raster" ? yearly.source.tiles[0] : "",
      ).toBe(
        `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`,
      );
      expect(yearly?.attribution).toContain(
        `Copernicus Sentinel data ${year}`,
      );
    }

    expect(terrainLight?.provider).toBe("eox");
    expect(terrainLight?.category).toBe("Terrain");
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toContain(
      "eox",
    );
  });

  it("includes the EOX terrain and overlay reference layers", () => {
    const catalog = createBasemapCatalog();
    const tileUrl = (id: string): string => {
      const basemap = catalog.find((entry) => entry.id === id);
      expect(basemap, `missing ${id}`).toBeDefined();
      expect(basemap?.provider).toBe("eox");
      return basemap?.source.type === "raster" ? basemap.source.tiles[0] : "";
    };

    expect(tileUrl("eox-terrain")).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/terrain_3857/default/g/{z}/{y}/{x}.jpg",
    );
    expect(catalog.find((b) => b.id === "eox-terrain")?.category).toBe(
      "Terrain",
    );

    expect(tileUrl("eox-overlay")).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/overlay_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
    );
    expect(tileUrl("eox-overlay-bright")).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
    );
    for (const id of ["eox-overlay", "eox-overlay-bright"]) {
      expect(catalog.find((b) => b.id === id)?.category).toBe("Labels");
    }
  });

  it("includes OpenFreeMap vector styles", () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);

    expect(ids).toContain("openfreemap-positron");
    expect(ids).toContain("openfreemap-bright");
    expect(ids).toContain("openfreemap-liberty");
    expect(ids).toContain("openfreemap-dark");
    expect(ids).toContain("openfreemap-fiord");
    expect(ids).toContain("openfreemap-3d");
    expect(
      catalog.find((basemap) => basemap.id === "openfreemap-3d")?.view?.pitch,
    ).toBe(60);
  });

  it("includes Stadia Maps and Stadia x Stamen basemaps", () => {
    const catalog = createBasemapCatalog();
    const stadia = catalog.filter((basemap) => basemap.provider === "stadia");
    const tileUrl = (id: string): string => {
      const basemap = catalog.find((entry) => entry.id === id);
      expect(basemap, `missing ${id}`).toBeDefined();
      expect(basemap?.provider).toBe("stadia");
      return basemap?.source.type === "raster" ? basemap.source.tiles[0] : "";
    };

    const cases: Array<[string, string, "png" | "jpg"]> = [
      ["stadia-alidade-smooth", "alidade_smooth", "png"],
      ["stadia-alidade-smooth-dark", "alidade_smooth_dark", "png"],
      ["stadia-alidade-satellite", "alidade_satellite", "jpg"],
      ["stadia-outdoors", "outdoors", "png"],
      ["stadia-osm-bright", "osm_bright", "png"],
      ["stadia-stamen-toner", "stamen_toner", "png"],
      ["stadia-stamen-toner-lite", "stamen_toner_lite", "png"],
      ["stadia-stamen-toner-background", "stamen_toner_background", "png"],
      ["stadia-stamen-toner-labels", "stamen_toner_labels", "png"],
      ["stadia-stamen-terrain", "stamen_terrain", "png"],
      ["stadia-stamen-terrain-background", "stamen_terrain_background", "png"],
      ["stadia-stamen-terrain-labels", "stamen_terrain_labels", "png"],
      ["stadia-stamen-watercolor", "stamen_watercolor", "jpg"],
    ];

    for (const [id, slug, extension] of cases) {
      expect(tileUrl(id)).toBe(
        `https://tiles.stadiamaps.com/tiles/${slug}/{z}/{x}/{y}.${extension}?api_key={api-key}`,
      );
    }

    expect(stadia).toHaveLength(cases.length);
    // Stamen styles must carry the extra Stamen Design credit; the house
    // Stadia styles must not.
    expect(
      catalog.find((b) => b.id === "stadia-stamen-watercolor")?.attribution,
    ).toContain("Stamen Design");
    expect(
      catalog.find((b) => b.id === "stadia-alidade-smooth")?.attribution,
    ).not.toContain("Stamen Design");
    for (const basemap of stadia) {
      expect(basemap.attribution).toContain("Stadia Maps");
    }
    expect(
      catalog.find((b) => b.id === "stadia-stamen-watercolor")?.category,
    ).toBe("Artistic");
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toContain(
      "stadia",
    );
  });

  it("includes Protomaps vector styles with API key placeholders", () => {
    const catalog = createBasemapCatalog();
    const styleUrl = (id: string): string => {
      const basemap = catalog.find((entry) => entry.id === id);
      expect(basemap, `missing ${id}`).toBeDefined();
      expect(basemap?.provider).toBe("protomaps");
      expect(basemap?.type).toBe("style");
      return basemap?.source.type === "style" ? basemap.source.url : "";
    };

    for (const styleId of [
      "light",
      "dark",
      "white",
      "black",
      "grayscale",
      "contrast",
    ]) {
      expect(styleUrl(`protomaps-${styleId}`)).toBe(
        `https://api.protomaps.com/styles/v5/${styleId}/en.json?key={api-key}`,
      );
    }

    expect(
      catalog.filter((basemap) => basemap.provider === "protomaps"),
    ).toHaveLength(6);
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toContain(
      "protomaps",
    );
  });

  it("includes the additional OpenRailwayMap, USGS, and Esri layers", () => {
    const catalog = createBasemapCatalog();
    const tileUrl = (id: string, provider: string): string => {
      const basemap = catalog.find((entry) => entry.id === id);
      expect(basemap, `missing ${id}`).toBeDefined();
      expect(basemap?.provider).toBe(provider);
      return basemap?.source.type === "raster" ? basemap.source.tiles[0] : "";
    };

    for (const layer of ["maxspeed", "electrification", "signals"]) {
      expect(tileUrl(`openrailwaymap-${layer}`, "openrailwaymap")).toBe(
        `https://a.tiles.openrailwaymap.org/${layer}/{z}/{x}/{y}.png`,
      );
      expect(
        catalog.find((b) => b.id === `openrailwaymap-${layer}`)?.category,
      ).toBe("Transport");
    }

    expect(tileUrl("usgs-us-hydro", "usgs")).toBe(
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}",
    );
    expect(tileUrl("usgs-us-shaded-relief", "usgs")).toBe(
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}",
    );

    expect(tileUrl("esri-world-dark-gray-canvas", "esri")).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    );
    expect(tileUrl("esri-world-light-gray-reference", "esri")).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    );
    expect(tileUrl("esri-world-dark-gray-reference", "esri")).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    );
    expect(
      catalog.find((b) => b.id === "esri-world-dark-gray-canvas")?.category,
    ).toBe("Dark");
  });

  it("includes Maptoolkit vector styles", () => {
    const catalog = createBasemapCatalog();
    const styleUrl = (id: string): string => {
      const basemap = catalog.find((entry) => entry.id === id);
      expect(basemap, `missing ${id}`).toBeDefined();
      expect(basemap?.provider).toBe("maptoolkit");
      expect(basemap?.type).toBe("style");
      expect(basemap?.attribution).toContain("Maptoolkit");
      expect(basemap?.attribution).toContain("OSM");
      return basemap?.source.type === "style" ? basemap.source.url : "";
    };

    for (const styleId of [
      "summer",
      "light",
      "hiking",
      "cycling",
      "winter",
      "dark",
      "street",
    ]) {
      expect(styleUrl(`maptoolkit-${styleId}`)).toBe(
        `https://styles.maptoolkit.org/${styleId}.json`,
      );
    }

    expect(
      catalog.filter((basemap) => basemap.provider === "maptoolkit"),
    ).toHaveLength(7);
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toContain(
      "maptoolkit",
    );
  });

  it("includes MapTiler styles with API key placeholders", () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);
    const streets = catalog.find(
      (basemap) => basemap.id === "maptiler-streets",
    );
    const openstreetmap = catalog.find(
      (basemap) => basemap.id === "maptiler-openstreetmap",
    );
    const toner = catalog.find((basemap) => basemap.id === "maptiler-toner");

    expect(ids).toContain("maptiler-aquarelle");
    expect(ids).toContain("maptiler-backdrop");
    expect(ids).toContain("maptiler-base");
    expect(ids).toContain("maptiler-dataviz");
    expect(ids).toContain("maptiler-landscape");
    expect(ids).toContain("maptiler-ocean");
    expect(ids).toContain("maptiler-openstreetmap");
    expect(ids).toContain("maptiler-outdoor");
    expect(ids).toContain("maptiler-satellite-hybrid");
    expect(ids).toContain("maptiler-satellite-plain");
    expect(ids).toContain("maptiler-streets");
    expect(ids).toContain("maptiler-toner");
    expect(ids).toContain("maptiler-topo");
    expect(ids).toContain("maptiler-winter");
    expect(streets?.source.type).toBe("style");
    expect(streets?.source.type === "style" ? streets.source.url : "").toBe(
      "https://api.maptiler.com/maps/streets-v4/style.json?key={api-key}",
    );
    expect(
      openstreetmap?.source.type === "style" ? openstreetmap.source.url : "",
    ).toBe("https://api.maptiler.com/maps/openstreetmap/style.json?key");
    expect(toner?.source.type === "style" ? toner.source.url : "").toBe(
      "https://api.maptiler.com/maps/toner-v2/style.json?key=",
    );
  });

  it("includes Amazon Location styles with API key and region placeholders", () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);
    const standard = catalog.find(
      (basemap) => basemap.id === "amazon-standard",
    );

    expect(ids).toContain("amazon-standard");
    expect(ids).toContain("amazon-monochrome");
    expect(ids).toContain("amazon-hybrid");
    expect(ids).toContain("amazon-satellite");
    expect(standard?.source.type).toBe("style");
    expect(standard?.source.type === "style" ? standard.source.url : "").toBe(
      "https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}",
    );
  });

  it("includes Mapbox styles with access token placeholders", () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);
    const streets = catalog.find((basemap) => basemap.id === "mapbox-streets");

    expect(ids).toContain("mapbox-streets");
    expect(ids).toContain("mapbox-outdoors");
    expect(ids).toContain("mapbox-light");
    expect(ids).toContain("mapbox-dark");
    expect(ids).toContain("mapbox-satellite");
    expect(ids).toContain("mapbox-satellite-streets");
    expect(ids).toContain("mapbox-navigation-day");
    expect(ids).toContain("mapbox-navigation-night");
    expect(streets?.source.type).toBe("style");
    expect(streets?.source.type === "style" ? streets.source.url : "").toBe(
      "https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={api-key}",
    );
  });

  it("includes traffic overlays for TomTom, HERE, Mapbox, and Google", () => {
    const catalog = createBasemapCatalog();
    const byId = new Map(catalog.map((basemap) => [basemap.id, basemap]));

    const tomtom = byId.get("tomtom-traffic-flow-relative");
    expect(tomtom?.category).toBe("Traffic");
    expect(tomtom?.source.type === "raster" ? tomtom.source.tiles[0] : "").toBe(
      "https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key={api-key}",
    );

    const here = byId.get("here-traffic-flow");
    expect(here?.source.type === "raster" ? here.source.tiles[0] : "").toBe(
      "https://traffic.maps.hereapi.com/v3/flow/mc/{z}/{x}/{y}/png?apiKey={api-key}",
    );

    const mapbox = byId.get("mapbox-traffic");
    expect(mapbox?.type).toBe("vector-overlay");
    expect(
      mapbox?.source.type === "vector-overlay" ? mapbox.source.url : "",
    ).toBe("mapbox://mapbox.mapbox-traffic-v1");
    expect(
      mapbox?.source.type === "vector-overlay" ? mapbox.source.sourceLayer : "",
    ).toBe("traffic");

    const google = byId.get("google-traffic");
    expect(
      google?.source.type === "raster"
        ? google.source.googleSession?.layerTypes
        : [],
    ).toEqual(["layerTraffic"]);
    expect(
      google?.source.type === "raster"
        ? google.source.googleSession?.overlay
        : false,
    ).toBe(true);
  });

  it("gives the base Google basemaps a session config and a keyless fallback", () => {
    const byId = new Map(DEFAULT_BASEMAPS.map((basemap) => [basemap.id, basemap]));
    const cases = [
      { id: "google-maps", mapType: "roadmap", layerTypes: undefined, lyrs: "m" },
      { id: "google-satellite", mapType: "satellite", layerTypes: undefined, lyrs: "s" },
      {
        id: "google-terrain",
        mapType: "terrain",
        layerTypes: ["layerRoadmap"],
        lyrs: "p",
      },
      {
        id: "google-hybrid",
        mapType: "satellite",
        layerTypes: ["layerRoadmap"],
        lyrs: "y",
      },
    ] as const;

    for (const { id, mapType, layerTypes, lyrs } of cases) {
      const basemap = byId.get(id);
      expect(basemap?.source.type).toBe("raster");
      if (basemap?.source.type !== "raster") continue;
      expect(basemap.source.googleSession?.mapType).toBe(mapType);
      expect(basemap.source.googleSession?.layerTypes).toEqual(layerTypes);
      // `tiles` is the keyless public endpoint, so a consumer reading the
      // definition without a key never sees an unresolvable {session} template.
      expect(basemap.source.tiles[0]).toBe(
        `https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`,
      );
      expect(basemap.source.tiles[0]).not.toContain("tile.googleapis.com");
      expect(basemap.source.sessionTiles?.[0]).toContain("tile.googleapis.com");
    }
  });

  it("lists TomTom and HERE as traffic providers", () => {
    expect(DEFAULT_BASEMAP_PROVIDERS.map((provider) => provider.id)).toEqual(
      expect.arrayContaining(["tomtom", "here"]),
    );
  });

  it("deduplicates providers by id", () => {
    const providers = combineProviders(DEFAULT_BASEMAP_PROVIDERS, [
      { id: "carto", name: "Carto Custom" },
      { id: "custom", name: "Custom" },
    ]);

    expect(providers.find((provider) => provider.id === "carto")?.name).toBe(
      "Carto Custom",
    );
    expect(providers.find((provider) => provider.id === "custom")?.name).toBe(
      "Custom",
    );
  });

  it("returns providers alphabetically by name", () => {
    const providers = combineProviders(DEFAULT_BASEMAP_PROVIDERS, [
      { id: "zzz", name: "Zzz" },
      { id: "aaa", name: "Aaa" },
    ]);
    const names = providers.map((provider) => provider.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("returns sorted categories", () => {
    const categories = getBasemapCategories(createBasemapCatalog());

    expect(categories).toEqual([...categories].sort());
    expect(categories).toContain("Street");
  });
});
