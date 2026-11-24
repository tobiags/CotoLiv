# Return a Polyline for a Route (Maps JavaScript API)

## Overview

The `computeRoutes` method in the Maps JavaScript API (`routes` library)
computes routes between two or more locations and returns the route represented
by a polyline. You can request different types of polylines depending on your
use case and billing requirements:

-   **Basic polyline (default)**: Represents a route without traffic information
    embedded in the polyline. Billed at the Routes Basic rate.
-   **Traffic-aware polyline**: Contains information about traffic conditions
    along the route expressed in speed categories (`NORMAL`, `SLOW`,
    `TRAFFIC_JAM`) applicable on intervals of the polyline. Billed at the Routes
    Preferred rate.
-   **Multimodal polyline**: Contains transit details as well as traffic
    information. Billed at the Routes Preferred rate.

--------------------------------------------------------------------------------

## Workflow: Requesting and Displaying Route Polylines

### 1. Request a Basic Polyline

A polyline is represented by a `google.maps.Polyline` object, where a path is an
array of `LatLngAltitude` coordinates. To return a basic polyline, call
`Route.computeRoutes` with the `fields` property including `'path'`, and then
call `createPolylines()` on the returned route instance.

```javascript
// Define a basic routes request.
const requestWithBasicPolyline = {
  origin: '155 Steuart St, San Francisco, CA 94105',
  destination: '450 Powell St, San Francisco, CA 94102',
  travelMode: 'WALKING',
  fields: ['path'], // Request path field to get a polyline.
  internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
};
```

### 2. Request a Traffic-Aware Polyline

To request a traffic-aware polyline, configure your `computeRoutes` request with
the following properties:

1.  Set `travelMode` to `'DRIVING'`.
2.  Set `routingPreference` to `'TRAFFIC_AWARE'`.
3.  Set `extraComputations` to `['TRAFFIC_ON_POLYLINE']`.
4.  Specify `'path'`, `'speedPaths'`, and `'routeLabels'` (or `'speedPaths'`) in
    the `fields` array.

```javascript
// Define a traffic-aware routes request.
const requestWithTraffic = {
  origin: '200 King St San Francisco, CA 94107',
  destination: 'Pier 41, San Francisco, CA 94133',
  travelMode: 'DRIVING',
  routingPreference: 'TRAFFIC_AWARE',
  extraComputations: ['TRAFFIC_ON_POLYLINE'],
  fields: ['path', 'speedPaths', 'routeLabels'],
  internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
};
```

### 3. Display Polylines on a Map

Once `computeRoutes` returns the `routes` array, call `createPolylines()` on the
desired route object to generate an array of `google.maps.Polyline` instances.
Use `setMap(map)` on each polyline to render it on the map.

```javascript
async function initMap() {
  const { Map } = await google.maps.importLibrary('maps');
  const { Route } = await google.maps.importLibrary('routes');

  const map = new Map(document.getElementById('map'), {
    zoom: 13,
    center: { lat: 37.785, lng: -122.405 },
    mapId: 'DEMO_MAP_ID',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  });

  const request = {
    origin: { lat: 37.7918, lng: -122.3918 },
    destination: { lat: 37.8087, lng: -122.4101 },
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_AWARE',
    extraComputations: ['TRAFFIC_ON_POLYLINE'],
    fields: ['path', 'speedPaths', 'viewport'],
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  };

  const { routes } = await Route.computeRoutes(request);

  if (routes && routes.length > 0) {
    // Call createPolylines to create polylines for the first route.
    const mapPolylines = routes[0].createPolylines();

    // Add polylines to the map.
    mapPolylines.forEach((polyline) => polyline.setMap(map));

    // Fit map to route viewport if requested
    if (routes[0].viewport) {
      map.fitBounds(routes[0].viewport);
    }
  }
}

initMap();
```

--------------------------------------------------------------------------------

## Working with Encoded Polylines & Lifecycle Management

When working with encoded polyline strings directly (for example, returned from
a backend Routes API call or custom route step rendering), use the `geometry`
library's `encoding.decodePath` method to convert the encoded string into a path
for `google.maps.Polyline`.

### Removing Polylines from a Map

To clean up and remove rendered polylines from the map (e.g., when recalculating
routes or unmounting components), call `setMap(null)` on each `Polyline`
instance:

```javascript
// Remove polylines from the map
function clearPolylines(mapPolylines) {
  mapPolylines.forEach((polyline) => polyline.setMap(null));
}
```

*(Source pattern:
[samples/polyline-remove/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/polyline-remove/index.ts?utm_campaign=gmp_git_agentskills_v1))*

### React Pattern: Decoding and Rendering an Encoded Polyline

The following pattern from `@vis.gl/react-google-maps` demonstrates how to
decode an `encodedPath` using the `geometry` library and manage the lifecycle of
a `google.maps.Polyline` instance on a map:

Source:
[examples/routes-api/src/components/polyline.tsx](https://github.com/visgl/react-google-maps/blob/HEAD/examples/routes-api/src/components/polyline.tsx?utm_campaign=gmp_git_agentskills_v1)

```tsx
import React, {useState, useEffect} from 'react';
import {useMap, useMapsLibrary} from '@vis.gl/react-google-maps';

type PolylineCustomProps = {
  encodedPath?: string;
};

export type PolylineProps = google.maps.PolylineOptions & PolylineCustomProps;

export const Polyline = (props: PolylineProps) => {
  const {encodedPath, ...polylineOptions} = props;

  const map = useMap();
  const geometryLibrary = useMapsLibrary('geometry');
  const mapsLibrary = useMapsLibrary('maps');

  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  // create polyline once available
  useEffect(() => {
    if (!mapsLibrary) return;

    setPolyline(new mapsLibrary.Polyline());
  }, [mapsLibrary]);

  // update options when changed
  useEffect(() => {
    if (!polyline) return;

    polyline.setOptions(polylineOptions);
  }, [polyline, polylineOptions]);

  // decode and update polyline with encodedPath
  useEffect(() => {
    if (!encodedPath || !geometryLibrary || !polyline) return;

    polyline.setPath(geometryLibrary.encoding.decodePath(encodedPath));
  }, [polyline, encodedPath, geometryLibrary]);

  // add polyline to map and clean up on unmount
  useEffect(() => {
    if (!map || !polyline) return;

    polyline.setMap(map);

    return () => polyline.setMap(null);
  }, [map, polyline]);

  return <></>;
};
```

> **Note**: When initializing the `<Map>` component in
> `@vis.gl/react-google-maps`, always include the usage attribution prop: `<Map
> internalUsageAttributionIds={['gmp_git_agentskills_v1']} ... />`
