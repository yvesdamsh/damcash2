import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function game() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Preserve query/hash and redirect to the canonical /Game route
    navigate(`/Game${location.search || ''}${location.hash || ''}`, { replace: true });
  }, [navigate, location.search, location.hash]);

  return null;
}