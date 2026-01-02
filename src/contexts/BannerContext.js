import React, { createContext, useContext, useState, useCallback } from 'react';
import Banner from '../components/Banner';

const BannerContext = createContext();

export const useBanner = () => {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
};

export const BannerProvider = ({ children }) => {
  const [banner, setBanner] = useState(null);

  const showBanner = useCallback((message, type = 'success', duration = 4000) => {
    setBanner({ message, type, duration });
  }, []);

  const showSuccess = useCallback((message, duration = 4000) => {
    showBanner(message, 'success', duration);
  }, [showBanner]);

  const showError = useCallback((message, duration = 5000) => {
    showBanner(message, 'error', duration);
  }, [showBanner]);

  const hideBanner = useCallback(() => {
    setBanner(null);
  }, []);

  return (
    <BannerContext.Provider value={{ showBanner, showSuccess, showError, hideBanner }}>
      {children}
      {banner && (
        <Banner
          message={banner.message}
          type={banner.type}
          duration={banner.duration}
          onClose={hideBanner}
        />
      )}
    </BannerContext.Provider>
  );
};

