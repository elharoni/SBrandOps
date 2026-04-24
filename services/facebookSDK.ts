/**
 * Facebook SDK Loader
 * Loads and initializes the Facebook SDK for OAuth and API calls
 */

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

let sdkLoaded = false;
let sdkLoading = false;
let loadPromise: Promise<void> | null = null;

export async function loadFacebookSDK(appId: string): Promise<void> {
    if (sdkLoaded) {
        return Promise.resolve();
    }

    if (sdkLoading && loadPromise) {
        return loadPromise;
    }

    sdkLoading = true;

    loadPromise = new Promise((resolve, reject) => {
        try {
            // Check if script already exists
            if (document.getElementById('facebook-jssdk')) {
                sdkLoaded = true;
                sdkLoading = false;
                resolve();
                return;
            }

            // Define fbAsyncInit
            window.fbAsyncInit = () => {
                window.FB.init({
                    appId: appId,
                    cookie: false,   // third-party cookies blocked in modern browsers
                    xfbml: false,    // no FB social plugins needed
                    version: 'v23.0'
                });

                sdkLoaded = true;
                sdkLoading = false;
                console.log('✅ Facebook SDK loaded successfully');
                resolve();
            };

            // Load SDK script
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';

            script.onerror = () => {
                sdkLoading = false;
                reject(new Error('Failed to load Facebook SDK'));
            };

            // Insert script
            const firstScript = document.getElementsByTagName('script')[0];
            firstScript.parentNode?.insertBefore(script, firstScript);

        } catch (error) {
            sdkLoading = false;
            reject(error);
        }
    });

    return loadPromise;
}

export function checkFBSDK(): boolean {
    return sdkLoaded && typeof window.FB !== 'undefined';
}

export async function ensureFBSDK(appId: string): Promise<boolean> {
    if (!checkFBSDK()) {
        try {
            await loadFacebookSDK(appId);
            return checkFBSDK();
        } catch (error) {
            console.error('❌ Failed to load Facebook SDK:', error);
            return false;
        }
    }
    return true;
}
