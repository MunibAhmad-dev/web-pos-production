import { useEffect, useState } from 'react';
import { getLowStockThreshold, LOW_STOCK_THRESHOLD_EVENT } from '../utils/constants';

export function useLowStockThreshold() {
  const [threshold, setThreshold] = useState(getLowStockThreshold);

  useEffect(() => {
    const handler = () => setThreshold(getLowStockThreshold());
    window.addEventListener(LOW_STOCK_THRESHOLD_EVENT, handler);
    return () => window.removeEventListener(LOW_STOCK_THRESHOLD_EVENT, handler);
  }, []);

  return threshold;
}
