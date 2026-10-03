import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Bantay-Agapay</h1>
          <p className="text-xl text-gray-600">AFGBMTS Visitor Monitoring System</p>
        </div>

        <p className="text-lg text-gray-700 mb-12">
          Digital visitor registration and campus wayfinding for Assemblywoman Felicita G. Bernardino Memorial Trade School
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link
            href="/visit"
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            New Visitor Registration
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
          >
            Staff Login
          </Link>
        </div>

        <Link
          href="/visit/returning"
          className="inline-block px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
        >
          Returning Visitor? Quick Entry
        </Link>

        <p className="text-gray-500 text-sm mt-12">
          For visitor registration: scan the QR code at the security desk
        </p>
      </div>
    </main>
  )
}
