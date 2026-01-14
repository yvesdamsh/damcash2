import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Training() {
  const navigate = useNavigate();
  React.useEffect(() => { navigate('/Academy', { replace: true }); }, [navigate]);
  return null;
}