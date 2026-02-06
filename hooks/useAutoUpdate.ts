
import { useState, useEffect } from 'react';

export const useAutoUpdate = () => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);
    const [newVersion, setNewVersion] = useState<string | null>(null);

    const reloadPage = () => {
        window.location.reload();
    };

    useEffect(() => {
        // 1. Get initial version
        const initialVersion = (window as any)._env_?.APP_VERSION;
        setCurrentVersion(initialVersion);

        if (!initialVersion) return;

        // 2. Check for updates
        const checkUpdate = async () => {
            try {
                const response = await fetch(`/env-config.js?t=${new Date().getTime()}`);
                const text = await response.text();

                const match = text.match(/APP_VERSION:\s*"([^"]+)"/);
                if (match && match[1]) {
                    const latestVersion = match[1];
                    if (latestVersion !== initialVersion) {
                        setNewVersion(latestVersion);
                        setHasUpdate(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check for updates:", error);
            }
        };

        // Check every 30 seconds
        const interval = setInterval(checkUpdate, 30 * 1000);
        return () => clearInterval(interval);
    }, []);

    return { hasUpdate, currentVersion, newVersion, reloadPage };
};
