import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour } from '../../contexts/TourContext';
import { TOURS_BY_PATH } from './tourDefinitions';
import TourOverlay from './TourOverlay';

export default function TourManager() {
  const location = useLocation();
  const { startTour, isTourCompleted, toursEnabled, loading } = useTour();

  useEffect(() => {
    if (loading || !toursEnabled) return;

    const tour = TOURS_BY_PATH[location.pathname];
    if (!tour) return;
    if (isTourCompleted(tour.id)) return;

    const t = setTimeout(() => {
      startTour(tour);
    }, 800);

    return () => clearTimeout(t);
  }, [location.pathname, toursEnabled, loading]);

  return <TourOverlay />;
}
