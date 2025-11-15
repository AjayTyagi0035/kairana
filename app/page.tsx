import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="mb-8">
          <Map className="w-16 h-16 mx-auto mb-4 text-slate-700" />
          <h1 className="text-4xl font-bold mb-4 text-slate-900">
            Shapefile Map Viewer
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Load and visualize multiple Shapefiles on an interactive Leaflet map
          </p>
        </div>

        <Link href="/map">
          <Button size="lg" className="text-lg px-8 py-6">
            Open Map Viewer
          </Button>
        </Link>

        <div className="mt-12 text-left bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Features</h2>
          <ul className="space-y-2 text-slate-600">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Load 4 different Shapefile layers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Client-side processing using shpjs</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Automatic zoom to layer bounds</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Color-coded layers for easy identification</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Interactive OpenStreetMap base layer</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
