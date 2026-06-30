import { useCallback, useEffect, useMemo, useState } from 'react';

const isStandaloneDisplay = () => (
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
);

const detectIOS = () => {
  const platform = window.navigator.platform || '';
  const userAgent = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
};

export const usePwaInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => (
    typeof window !== 'undefined' ? isStandaloneDisplay() : false
  ));

  const isIOS = useMemo(() => (
    typeof window !== 'undefined' ? detectIOS() : false
  ), []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice?.outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }

    return false;
  }, [installPrompt]);

  return {
    canInstall: Boolean(installPrompt),
    install,
    isIOS,
    isInstalled,
    shouldShowInstall: !isInstalled,
  };
};
