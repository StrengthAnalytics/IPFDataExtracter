import { isSupabaseConfigured } from '../config/supabase';

export function ConfigCheck({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-gray-900 rounded-lg p-8 border border-yellow-500/50">
          <div className="flex items-start gap-4">
            <div className="text-yellow-500 text-4xl">⚠️</div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Configuration Required
              </h1>
              <p className="text-gray-300 mb-4">
                Supabase environment variables are not configured. The app cannot connect to the database.
              </p>
              <div className="bg-gray-800 rounded p-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">Required environment variables:</p>
                <code className="text-green-400 text-sm block">
                  VITE_SUPABASE_URL=your-project-url<br/>
                  VITE_SUPABASE_ANON_KEY=your-anon-key
                </code>
              </div>
              <div className="text-sm text-gray-400">
                <p className="mb-2"><strong className="text-white">For local development:</strong></p>
                <ol className="list-decimal list-inside space-y-1 mb-4">
                  <li>Copy <code className="text-green-400">.env.example</code> to <code className="text-green-400">.env</code></li>
                  <li>Add your Supabase credentials to <code className="text-green-400">.env</code></li>
                  <li>Restart the dev server</li>
                </ol>

                <p className="mb-2"><strong className="text-white">For Vercel deployment:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to your Vercel project settings</li>
                  <li>Navigate to Environment Variables</li>
                  <li>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY</li>
                  <li>Redeploy your application</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
