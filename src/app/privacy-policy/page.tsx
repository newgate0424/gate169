import React from 'react';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
                <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
                <p className="mb-4 text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>

                <div className="space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
                        <p>Welcome to our Facebook Ads Dashboard. We respect your privacy and are committed to protecting your personal data.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">2. Data We Collect</h2>
                        <p>We only access data necessary to provide the dashboard service:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Facebook Access Tokens (stored locally on your device)</li>
                            <li>Ad Account information</li>
                            <li>Campaign performance data</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">3. How We Use Your Data</h2>
                        <p>Your data is used solely to display your advertising performance within this dashboard. We do not store your data on our servers; it is fetched directly from Facebook's API to your browser.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">4. Data Security</h2>
                        <p>We implement appropriate security measures to protect your data. Your access token is stored in your browser's local storage and is not shared with third parties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">5. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
