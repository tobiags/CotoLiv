# Specify a Stop or Pass-Through Point for a Route Request

## Overview

When calculating a route using the Routes library in the Maps JavaScript API,
you can specify intermediate waypoints between the origin and destination. By
default, waypoints are treated as stopovers, or you can explicitly configure
them for pickup and drop-off scenarios using the `vehicleStopover` property.

Setting `vehicleStopover: true` on a waypoint ensures that the calculated route
does not begin or end a leg on a road that is unsuitable for stopping—such as a
highway, freeway, or underground tunnel—even if a surface road intersects
directly above or below it on a 2D map.

> **Billing Note:** Requests that use the `vehicleStopover` property are billed
> at a higher rate. Refer to the
> [Google Maps Platform usage and billing documentation](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
> for details.

## Prerequisites

-   **Any of the routing request capabilities**: You must already have a basic
    route request setup using the Maps JavaScript API (`routes` library).

## Configuring Stopover Waypoints

To designate a waypoint as a stop suitable for a pickup or drop-off, add an
object to the `intermediates` array in your route request and set its
`vehicleStopover` property to `true`.

### Waypoint Properties

Property          | Type                                                                             | Description
:---------------- | :------------------------------------------------------------------------------- | :----------
`location`        | `string \| google.maps.LatLng \| google.maps.LatLngLiteral \| google.maps.Place` | The address, coordinates, or Place representing the intermediate waypoint.
`vehicleStopover` | `boolean` (Optional)                                                             | When `true`, ensures the route starts or ends at a road suitable for passenger pickup and drop-off (avoiding tunnels or highways).

### Basic Request Configuration

The following example demonstrates how to construct a route request object with
multiple intermediate waypoints, specifying `vehicleStopover: true` for a
stopover location:

```javascript
const routeRequestWithIntermediates = {
  origin: 'Mountain View, CA',
  destination: 'San Francisco, CA',
  travelMode: 'DRIVING',
  intermediates: [
    { location: 'San Mateo, CA' },
    { location: 'Half Moon Bay, CA', vehicleStopover: true }
  ],
  fields: ['path', 'legs'],
  internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
};
```

## Complete Implementation Example

This example initializes a Google Map, imports the `routes` library, requests a
route containing an intermediate stopover waypoint, and renders the resulting
route legs and markers on the map.

```typescript
async function initMapAndRoute(): Promise<void> {
  // 1. Load required libraries
  const { Map, Polyline } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
  const { Route } = await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

  // 2. Initialize the Map with usage attribution
  const mapElement = document.getElementById('map') as HTMLElement;
  const map = new Map(mapElement, {
    zoom: 10,
    center: { lat: 37.5630, lng: -122.3255 }, // San Mateo area
    mapId: 'DEMO_MAP_ID',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  });

  // 3. Define the route request with intermediate waypoints and vehicleStopover
  const routeRequest = {
    origin: 'Mountain View, CA',
    destination: 'San Francisco, CA',
    travelMode: 'DRIVING',
    intermediates: [
      { location: 'San Mateo, CA' },
      { location: 'Half Moon Bay, CA', vehicleStopover: true }
    ],
    fields: ['path', 'legs', 'viewport'],
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  };

  try {
    // 4. Compute the route
    const { routes } = await Route.computeRoutes(routeRequest);

    if (!routes || routes.length === 0) {
      console.warn('No routes found for the given request.');
      return;
    }

    const primaryRoute = routes[0];

    // 5. Fit the map to the returned route viewport
    if (primaryRoute.viewport) {
      map.fitBounds(primaryRoute.viewport);
    }

    // 6. Render the route path on the map
    if (primaryRoute.path) {
      const routePolyline = new Polyline({
        path: primaryRoute.path,
        strokeColor: '#4285F4',
        strokeWeight: 5,
        strokeOpacity: 0.8,
        map: map,
      });
    }

    // 7. Place markers at the start of each leg and the final destination
    if (primaryRoute.legs && primaryRoute.legs.length > 0) {
      primaryRoute.legs.forEach((leg, index) => {
        if (leg.startLocation) {
          new AdvancedMarkerElement({
            map,
            position: leg.startLocation,
            title: index === 0 ? 'Origin' : `Waypoint ${index}`,
          });
        }
      });

      const lastLeg = primaryRoute.legs[primaryRoute.legs.length - 1];
      if (lastLeg.endLocation) {
        new AdvancedMarkerElement({
          map,
          position: lastLeg.endLocation,
          title: 'Destination',
        });
      }
    }
  } catch (error) {
    console.error('Failed to compute route with intermediates:', error);
  }
}

initMapAndRoute();
```

## Best Practices & Common Pitfalls

-   **Tunnels and Overpasses**: When geocoding or using coordinates for a
    waypoint where a surface street intersects a tunnel or elevated highway,
    omitting `vehicleStopover: true` may snap the waypoint to the tunnel or
    highway. Always set `vehicleStopover: true` if a driver needs to physically
    stop at the location.
-   **Field Masking**: Ensure `'legs'` is included in your `fields` array if you
    need to inspect individual segments between your origin, intermediate
    stopovers, and destination. Each stopover splits the route into a separate
    leg in the `legs` array.
-   **Cost Optimization**: Only enable `vehicleStopover: true` when physical
    pickup/drop-off road suitability is required, as requests utilizing this
    parameter incur higher billing rates.

## Reference Links

-   **Official Documentation**:
    [Specify a stop or pass-through point for a route request](https://developers.google.com/maps/documentation/javascript/routes)
-   **Usage and Billing**:
    [Routes API Usage and Billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
-   **Supporting Code Samples**:
    -   [Google Maps JS Samples - Datasets Point](https://github.com/googlemaps/js-samples/blob/HEAD/samples/dds-datasets-point/index.ts?utm_campaign=gmp_git_agentskills_v1)
    -   [React Google Maps - Routes API Example](https://github.com/visgl/react-google-maps/blob/HEAD/examples/routes-api/src/components/route.tsx?utm_campaign=gmp_git_agentskills_v1)
    -   [Extended Component Library - Route Polyline](https://github.com/googlemaps/extended-component-library/blob/HEAD/src/route_building_blocks/route_polyline/route_polyline.ts?utm_campaign=gmp_git_agentskills_v1)
    -   [Extended Component Library - Route Marker](https://github.com/googlemaps/extended-component-library/blob/HEAD/src/route_building_blocks/route_marker/route_marker.ts?utm_campaign=gmp_git_agentskills_v1)
