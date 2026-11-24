export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface CourierProfile {
  name: string;
  vehicle: string;
  plate: string;
  phoneDisplay: string;
  avatarUrl: string;
  initials: string;
}

export interface DeliveryQueryPoint {
  label: string;
  query: string;
  location?: LatLngPoint;
  formattedAddress?: string;
}

export interface DeliveryOrder {
  id: string;
  trackingCode: string;
  parcelTitle: string;
  parcelCategory: string;
  weightLabel: string;
  recipientName: string;
  senderName: string;
  dispatchedAtLabel: string;
  initialProgress: number;
  origin: DeliveryQueryPoint;
  waypoint?: DeliveryQueryPoint;
  destination: DeliveryQueryPoint;
  courier: CourierProfile;
  note: string;
}

export interface RouteStepSummary {
  id: string;
  instruction: string;
  distanceMeters: number;
  durationMillis: number;
  cumulativeDistanceMeters: number;
}

export interface ComputedRouteData {
  orderId: string;
  path: LatLngPoint[];
  originPoint: LatLngPoint;
  waypointPoint?: LatLngPoint;
  destinationPoint: LatLngPoint;
  distanceMeters: number;
  durationMillis: number;
  steps: RouteStepSummary[];
  viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
}

export type DeliveryPhase = 'departed' | 'en_route' | 'arriving' | 'delivered';

export interface InterpolatedCourierState {
  position: LatLngPoint;
  heading: number;
  progress: number;
  traveledPath: LatLngPoint[];
  remainingPath: LatLngPoint[];
  traveledMeters: number;
  remainingMeters: number;
  remainingMillis: number;
  phase: DeliveryPhase;
}

export type WorkspaceView = 'live' | 'deliveries' | 'planner';

export type ThemeMode = 'light' | 'dark';

export type MapViewMode = '3d' | '2d';

export type CameraPreset3D = 'overview' | 'follow' | 'street';

export type NotificationType = 'proximity' | 'delivered' | 'delay';

export interface NotificationPreferences {
  radiusMeters: 500 | 1000 | 2000;
  browserNotificationsEnabled: boolean;
}

export interface DelayIncident {
  orderId: string;
  extraMinutes: number;
  reason: string;
  reportedAtLabel: string;
}

export interface DeliveryNotification {
  id: string;
  orderId: string;
  trackingCode: string;
  type: NotificationType;
  title: string;
  message: string;
  timestampLabel: string;
  createdAtMs: number;
  read: boolean;
}

