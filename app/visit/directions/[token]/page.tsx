"use client"

export default function DirectionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-2xl w-full mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Destination</h1>
        <p className="text-gray-600 mb-8">Campus directions and wayfinding</p>

        <div className="bg-white p-8 rounded-lg shadow-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Registrar's Office</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Building</p>
                <p className="font-semibold">Administration Building</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-semibold">Ground Floor, Room 103</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Landmark</p>
                <p className="font-semibold">Beside Guidance Office</p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-3">Step-by-Step Directions</p>
                <ol className="space-y-2 list-decimal list-inside">
                  <li className="text-gray-700">Enter through the main gate</li>
                  <li className="text-gray-700">Follow the covered walkway straight ahead</li>
                  <li className="text-gray-700">Turn left towards the Administration Building</li>
                  <li className="text-gray-700">Enter the building through the main entrance</li>
                  <li className="text-gray-700">Room 103 is on your right side</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center min-h-48">
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-2">Campus Map Placeholder</p>
              <p className="text-gray-400 text-sm">SVG campus map would display here</p>
              <p className="text-gray-400 text-sm">with destination marker and route</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> If you need more information, please ask any staff member wearing a school ID or contact the security office.
            </p>
          </div>

          <a
            href="/"
            className="w-full block text-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Return Home
          </a>
        </div>
      </div>
    </div>
  )
}
