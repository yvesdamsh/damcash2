import { useState } from 'react';

export const useLoadingState = () => {
  const [loading, setLoading] = useState({
    game: true,
    ai: false,
    move: false,
    data: false,
  });

  const setLoadingKey = (key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const isAnyLoading = Object.values(loading).some((v) => v);

  return { loading, setLoadingKey, isAnyLoading };
};