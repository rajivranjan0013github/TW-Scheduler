import { useCallback, useEffect, useMemo, useState } from 'react';

let sharedInstallPrompt = null;
let sharedIsInstalled = false;
let browserListenersRegistered = false;
const promptListeners = new Set();

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

const notifyPromptListeners = () => {
  promptListeners.forEach((listener) => listener({
    installPrompt: sharedInstallPrompt,
    isInstalled: sharedIsInstalled,
  }));
};

const ensureBrowserListeners = () => {
  if (browserListenersRegistered || typeof window === 'undefined') return;
  browserListenersRegistered = true;
  sharedIsInstalled = isStandaloneDisplay();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    sharedInstallPrompt = event;
    notifyPromptListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedInstallPrompt = null;
    sharedIsInstalled = true;
    notifyPromptListeners();
  });
};

export const usePwaInstallPrompt = () => {
  const [promptState, setPromptState] = useState(() => ({
    installPrompt: sharedInstallPrompt,
    isInstalled: typeof window !== 'undefined' ? sharedIsInstalled || isStandaloneDisplay() : sharedIsInstalled,
  }));

  const isIOS = useMemo(() => (
    typeof window !== 'undefined' ? detectIOS() : false
  ), []);

  useEffect(() => {
    ensureBrowserListeners();
    const listener = (nextState) => setPromptState(nextState);
    promptListeners.add(listener);
    listener({
      installPrompt: sharedInstallPrompt,
      isInstalled: typeof window !== 'undefined' ? sharedIsInstalled || isStandaloneDisplay() : sharedIsInstalled,
    });

    return () => promptListeners.delete(listener);
  }, []);

  const install = useCallback(async () => {
    if (!promptState.installPrompt) return false;

    promptState.installPrompt.prompt();
    const choice = await promptState.installPrompt.userChoice;
    sharedInstallPrompt = null;

    if (choice?.outcome === 'accepted') {
      sharedIsInstalled = true;
      notifyPromptListeners();
      return true;
    }

    notifyPromptListeners();
    return false;
  }, [promptState.installPrompt]);

  return {
    canInstall: Boolean(promptState.installPrompt),
    install,
    isIOS,
    isInstalled: promptState.isInstalled,
    shouldShowInstall: !promptState.isInstalled,
  };
};
