'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Facebook } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FacebookLoginProps {
  onLogin: (accessToken: string) => void;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function FacebookLogin({ onLogin }: FacebookLoginProps) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [manualToken, setManualToken] = useState('');

  useEffect(() => {
    if (window.FB) {
      setIsSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0',
      });
      setIsSdkLoaded(true);
    };

    (function (d, s, id) {
      var js: any,
        fjs: any = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      fjs.parentNode.insertBefore(js, fjs);
    })(document, 'script', 'facebook-jssdk');
  }, []);

  const handleLogin = () => {
    if (!window.FB) return;

    window.FB.login(
      function (response: any) {
        if (response.authResponse) {
          onLogin(response.authResponse.accessToken);
        } else {
          console.log('User cancelled login or did not fully authorize.');
        }
      },
      { scope: 'ads_read,read_insights,ads_management' }
    );
  };

  const handleManualLogin = () => {
    if (manualToken.trim()) {
      onLogin(manualToken.trim());
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card className="border-0 shadow-xl shadow-blue-100/50 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-xl text-center">Login to SMIT GATE</CardTitle>
          <CardDescription className="text-center">
            Connect your Facebook Ads account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button
            className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 h-12 text-lg font-medium transition-all hover:scale-[1.02]"
            onClick={handleLogin}
            disabled={!isSdkLoaded}
          >
            <Facebook className="mr-2 h-5 w-5" />
            Continue with Facebook
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Paste Access Token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <Button onClick={handleManualLogin} variant="outline" className="w-full">
              Use Access Token
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-gray-500">
        <a href="#" className="hover:text-blue-600 underline">Privacy Policy</a>
        <span className="mx-2">•</span>
        <a href="#" className="hover:text-blue-600 underline">Terms of Service</a>
      </div>
    </div>
  );
}
