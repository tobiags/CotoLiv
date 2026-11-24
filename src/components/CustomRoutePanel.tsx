import {type FormEvent, useCallback, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {MapPin} from 'lucide-react';
import type {DeliveryOrder, DeliveryQueryPoint} from '../types/delivery';
import {useAutocompleteSuggestions} from '../hooks/useAutocompleteSuggestions';
import {isGmpQuotaError} from '../utils/routeTracking';

interface PlaceSearchInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectResolvedPlace: (point: DeliveryQueryPoint) => void;
  error?: string;
}

function PlaceSearchInput({
  id,
  label,
  placeholder,
  value,
  onChangeText,
  onSelectResolvedPlace,
  error,
}: PlaceSearchInputProps) {
  const placesLib = useMapsLibrary('places');
  const [isOpen, setIsOpen] = useState(false);
  const {suggestions, isLoading, resetSession} = useAutocompleteSuggestions(
    isOpen ? value : ''
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;

      const labelText = suggestion.placePrediction.text.text;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });

        const loc = place.location;
        const point: DeliveryQueryPoint = {
          label: place.displayName || labelText.split(',')[0].trim(),
          query: place.formattedAddress || labelText,
          formattedAddress: place.formattedAddress ?? labelText,
          location: loc
            ? {
                lat:
                  typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat),
                lng:
                  typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng),
              }
            : undefined,
        };

        onChangeText(point.formattedAddress ?? point.label);
        onSelectResolvedPlace(point);
        setIsOpen(false);
        resetSession();
      } catch (err: unknown) {
        console.error('place.fetchFields error:', err);
        if (isGmpQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onChangeText(labelText);
        onSelectResolvedPlace({
          label: labelText.split(',')[0].trim(),
          query: labelText,
        });
        setIsOpen(false);
        resetSession();
      }
    },
    [placesLib, onChangeText, onSelectResolvedPlace, resetSession]
  );

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[#2B3731] dark:text-[#C8D4CE] mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        autoComplete="off"
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 180);
        }}
        onChange={(e) => {
          onChangeText(e.target.value);
          setIsOpen(true);
        }}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm text-[#111815] dark:text-[#EEF2F0] placeholder:text-[#7E8B84] dark:placeholder:text-[#6F8179] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
      />
      {error && (
        <p role="alert" className="text-xs text-[#A32222] dark:text-[#FCA5A5] mt-1">
          {error}
        </p>
      )}

      {isOpen && (isLoading || suggestions.length > 0) && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-[#141F1B] border border-[#D8DFDA] dark:border-[#26362F] rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-[#EEF1EF] dark:divide-[#202E28]"
        >
          {isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-[#5A6760] dark:text-[#96A59E]">
              Recherche d’adresses à Cotonou…
            </li>
          )}
          {suggestions.map((suggestion, idx) => {
            const text = suggestion.placePrediction?.text.text;
            if (!text) return null;
            return (
              <li key={suggestion.placePrediction?.placeId ?? idx}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelectSuggestion(suggestion);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#F3F6F4] dark:hover:bg-[#1C2B25] flex items-start gap-2 text-xs text-[#111815] dark:text-[#EEF2F0] cursor-pointer"
                >
                  <MapPin
                    className="w-3.5 h-3.5 text-[#0F6B4B] dark:text-[#34D399] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface CustomRoutePanelProps {
  onCreateDelivery: (order: DeliveryOrder) => void;
  onCancel: () => void;
}

export function CustomRoutePanel({
  onCreateDelivery,
  onCancel,
}: CustomRoutePanelProps) {
  const [originText, setOriginText] = useState('');
  const [originResolved, setOriginResolved] =
    useState<DeliveryQueryPoint | null>(null);

  const [destinationText, setDestinationText] = useState('');
  const [destinationResolved, setDestinationResolved] =
    useState<DeliveryQueryPoint | null>(null);

  const [parcelTitle, setParcelTitle] = useState('');
  const [courierName, setCourierName] = useState('Kossi Mensah');
  const [vehicle, setVehicle] = useState('Moto Express 125cc');
  const [errors, setErrors] = useState<{
    origin?: string;
    destination?: string;
    parcelTitle?: string;
  }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: {
      origin?: string;
      destination?: string;
      parcelTitle?: string;
    } = {};

    if (!originText.trim()) {
      nextErrors.origin = 'Veuillez renseigner le point de départ à Cotonou.';
    }
    if (!destinationText.trim()) {
      nextErrors.destination = 'Veuillez renseigner la destination du colis.';
    }
    if (!parcelTitle.trim()) {
      nextErrors.parcelTitle = 'Veuillez préciser la description du colis.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    const now = new Date();
    const dispatchedAtLabel = `${String(now.getHours()).padStart(2, '0')} h ${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const randomNum = Math.floor(100 + Math.random() * 899);
    const originQuery = originText.toLowerCase().includes('cotonou')
      ? originText.trim()
      : `${originText.trim()}, Cotonou, Bénin`;

    const destinationQuery = destinationText.toLowerCase().includes('cotonou')
      ? destinationText.trim()
      : `${destinationText.trim()}, Cotonou, Bénin`;

    const originPoint: DeliveryQueryPoint = originResolved ?? {
      label: originText.trim().split(',')[0].trim(),
      query: originQuery,
    };

    const destPoint: DeliveryQueryPoint = destinationResolved ?? {
      label: destinationText.trim().split(',')[0].trim(),
      query: destinationQuery,
    };

    const initials = courierName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    const newOrder: DeliveryOrder = {
      id: `del-custom-${Date.now()}`,
      trackingCode: `CTL-2026-${randomNum}`,
      parcelTitle: parcelTitle.trim(),
      parcelCategory: 'Course sur mesure',
      weightLabel: '1,8 kg',
      senderName: originPoint.label,
      recipientName: 'Client Cotonou',
      dispatchedAtLabel,
      initialProgress: 0.08,
      origin: originPoint,
      destination: destPoint,
      courier: {
        name: courierName.trim() || 'Kossi Mensah',
        vehicle,
        plate: 'BJ · 5302 · LT',
        phoneDisplay: '+229 01 97 42 18 05',
        avatarUrl: '/src/assets/images/courier_kossi_avatar_1795433824609.jpg',
        initials: initials || 'KM',
      },
      note: 'Itinéraire personnalisé calculé en temps réel via Google Maps Routes API.',
    };

    onCreateDelivery(newOrder);
  };

  return (
    <div className="p-5 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-[#111815] dark:text-[#EEF2F0]">
          Planifier un itinéraire à Cotonou
        </h1>
        <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-1 leading-relaxed">
          Choisissez le lieu de départ du colis et la destination pour tracer la
          route réelle du livreur en 3D et sur Google Maps.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <PlaceSearchInput
          id="custom-origin-input"
          label="D’où part le livreur (origine du colis)"
          placeholder="Ex. Marché Dantokpa, Akpakpa, Ganhi…"
          value={originText}
          onChangeText={(val) => {
            setOriginText(val);
            setOriginResolved(null);
            if (errors.origin)
              setErrors((prev) => ({...prev, origin: undefined}));
          }}
          onSelectResolvedPlace={setOriginResolved}
          error={errors.origin}
        />

        <PlaceSearchInput
          id="custom-destination-input"
          label="Où livrer le colis (destination)"
          placeholder="Ex. Haie Vive, Fidjrossè, Cadjèhoun…"
          value={destinationText}
          onChangeText={(val) => {
            setDestinationText(val);
            setDestinationResolved(null);
            if (errors.destination)
              setErrors((prev) => ({...prev, destination: undefined}));
          }}
          onSelectResolvedPlace={setDestinationResolved}
          error={errors.destination}
        />

        <div>
          <label
            htmlFor="custom-parcel-input"
            className="block text-xs font-medium text-[#2B3731] dark:text-[#C8D4CE] mb-1.5"
          >
            Contenu du colis
          </label>
          <input
            id="custom-parcel-input"
            type="text"
            value={parcelTitle}
            onChange={(e) => {
              setParcelTitle(e.target.value);
              if (errors.parcelTitle)
                setErrors((prev) => ({...prev, parcelTitle: undefined}));
            }}
            placeholder="Ex. Commande pharmacie, colis boutique…"
            className="w-full h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm text-[#111815] dark:text-[#EEF2F0] placeholder:text-[#7E8B84] dark:placeholder:text-[#6F8179] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
          />
          {errors.parcelTitle && (
            <p
              role="alert"
              className="text-xs text-[#A32222] dark:text-[#FCA5A5] mt-1"
            >
              {errors.parcelTitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label
              htmlFor="custom-courier-input"
              className="block text-xs font-medium text-[#2B3731] dark:text-[#C8D4CE] mb-1.5"
            >
              Nom du livreur
            </label>
            <input
              id="custom-courier-input"
              type="text"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm text-[#111815] dark:text-[#EEF2F0] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
            />
          </div>

          <div>
            <label
              htmlFor="custom-vehicle-select"
              className="block text-xs font-medium text-[#2B3731] dark:text-[#C8D4CE] mb-1.5"
            >
              Véhicule
            </label>
            <select
              id="custom-vehicle-select"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm text-[#111815] dark:text-[#EEF2F0] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
            >
              <option value="Moto Express 125cc">Moto Express 125cc</option>
              <option value="Moto Express électrique">
                Moto Express électrique
              </option>
              <option value="Fourgonnette climatisée">
                Fourgonnette climatisée
              </option>
            </select>
          </div>
        </div>

        <div className="pt-3 flex items-center gap-2.5">
          <button
            type="submit"
            className="flex-1 h-10 px-4 rounded-lg bg-[#0F3D2E] hover:bg-[#0B2E22] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#071510] text-sm font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer"
          >
            Lancer le suivi sur la carte
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] hover:bg-[#F5F7F5] dark:hover:bg-[#1C2B25] text-sm font-medium text-[#2B3731] dark:text-[#D7E0DC] transition-colors duration-150 whitespace-nowrap cursor-pointer"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
