import React from 'react';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
                <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
                <p className="mb-4 text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>

                <div className="space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
                        <p>By accessing and using this Facebook Ads Dashboard, you accept and agree to be bound by the terms and provision of this agreement.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">2. Use License</h2>
                        <p>Permission is granted to temporarily download one copy of the materials (information or software) on this website for personal, non-commercial transitory viewing only.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">3. Disclaimer</h2>
                        <p>The materials on this website are provided "as is". We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">4. Limitations</h2>
                        <p>In no event shall we or our suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on this website.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">5. Governing Law</h2>
                        <p>Any claim relating to this website shall be governed by the laws of the State without regard to its conflict of law provisions.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
