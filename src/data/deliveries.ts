import type {DeliveryOrder} from '../types/delivery';

/**
 * Curated Cotonou delivery scenarios.
 * Note: All geographic coordinates, road polylines, distances, durations, and
 * street steps are resolved live via Google Maps Platform Routes API and Places API (New).
 */
export const INITIAL_COTONOU_DELIVERIES: DeliveryOrder[] = [
  {
    id: 'del-dantokpa-fidjrosse',
    trackingCode: 'CTL-2026-841',
    parcelTitle: 'Coffret textiles & artisanat wax',
    parcelCategory: 'Colis fragile',
    weightLabel: '2,4 kg',
    senderName: 'Atelier Dantokpa',
    recipientName: 'Sènan Houngbédji',
    dispatchedAtLabel: '10 h 15',
    initialProgress: 0.44,
    origin: {
      label: 'Marché Dantokpa',
      query: 'Marché Dantokpa, Cotonou, Bénin',
    },
    waypoint: {
      label: 'Relais Étoile Rouge',
      query: "Place de l'Étoile Rouge, Cotonou, Bénin",
    },
    destination: {
      label: 'Fidjrossè Plage',
      query: 'Fidjrossè Plage, Cotonou, Bénin',
    },
    courier: {
      name: 'Kossi Mensah',
      vehicle: 'Moto Express 125cc',
      plate: 'BJ · 4829 · LT',
      phoneDisplay: '+229 01 97 42 18 05',
      avatarUrl: '/src/assets/images/courier_kossi_avatar_1795433824609.jpg',
      initials: 'KM',
    },
    note: 'Remise en main propre contre code de vérification. Appeler à l’approche du carrefour Fidjrossè.',
  },
  {
    id: 'del-port-haievive',
    trackingCode: 'CTL-2026-905',
    parcelTitle: 'Station de travail & accessoires',
    parcelCategory: 'Équipement pro',
    weightLabel: '6,8 kg',
    senderName: 'Entrepôt Portuaire Cotonou',
    recipientName: 'Cabinet Atlantique Conseils',
    dispatchedAtLabel: '10 h 40',
    initialProgress: 0.32,
    origin: {
      label: 'Port de Cotonou',
      query: 'Port Autonome de Cotonou, Cotonou, Bénin',
    },
    destination: {
      label: 'Quartier Haie Vive',
      query: 'Haie Vive, Cotonou, Bénin',
    },
    courier: {
      name: 'Aïcha Bio',
      vehicle: 'Fourgonnette climatisée',
      plate: 'BJ · 7104 · LT',
      phoneDisplay: '+229 01 96 15 39 82',
      avatarUrl: '/src/assets/images/courier_aicha_avatar_1795433824841.jpg',
      initials: 'AB',
    },
    note: 'Livraison au secrétariat au rez-de-chaussée. Signature électronique requise.',
  },
  {
    id: 'del-akpakpa-cadjehoun',
    trackingCode: 'CTL-2026-712',
    parcelTitle: 'Pli administratif & contrat signé',
    parcelCategory: 'Coursier urgent',
    weightLabel: '0,4 kg',
    senderName: 'Pôle Logistique Akpakpa',
    recipientName: 'Mireille Agbo',
    dispatchedAtLabel: '11 h 05',
    initialProgress: 0.62,
    origin: {
      label: 'Akpakpa Centre',
      query: 'Akpakpa, Cotonou, Bénin',
    },
    waypoint: {
      label: 'Escales Ganhi',
      query: 'Ganhi, Cotonou, Bénin',
    },
    destination: {
      label: 'Cadjèhoun',
      query: 'Cadjèhoun, Cotonou, Bénin',
    },
    courier: {
      name: 'Romaric Dossou',
      vehicle: 'Moto Express électrique',
      plate: 'BJ · 2951 · LT',
      phoneDisplay: '+229 01 94 88 20 11',
      avatarUrl: '/src/assets/images/courier_romaric_avatar_1795433825963.jpg',
      initials: 'RD',
    },
    note: 'Passage par le pont de Cotonou et Ganhi avant remise directe à Cadjèhoun.',
  },
];
